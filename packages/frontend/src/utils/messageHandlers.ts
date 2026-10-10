import type { MediaInitPayload } from "@/types/common.ts";
import type { RawKeysBundle } from "@/types/crypto.ts";
import type { PacketCallback } from "@/types/events.ts";
import type { GetKeysResponse, MediaChunk, MediaEnd, MediaInit, UserMessage } from "@/types/packets.ts";

import { cryptoManager } from "@/services/cryptoManager.ts";
import { socketClient } from "@/services/socketClient.ts";
import { useChatSessionStore } from "@/stores/chatSession.ts";
import { downloadStorage } from "@/stores/downloadStorage.ts";
import { useIdentityStore } from "@/stores/identity.ts";

import type { DoubleRatchet } from "./ratchet.ts";

import { initDoubleRatchet } from "./crypto.ts";
import { messageMediaLog, messageTextLog } from "./logger.ts";
import { extractKeys, generateThumbnail, getFileType, serializeMessageEnvelope, uint8ArrayToBase64 } from "./utilities.ts";

export function sendKeysToServer(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const { setLastSPKRotation } = useIdentityStore.getState();
    const keys = cryptoManager.myKeys;
    const keysBundle: UserMessage = {
      payload: {
        IK_dh_public: uint8ArrayToBase64(keys.IK_dh.publicKey),
        IK_sign_public: uint8ArrayToBase64(keys.IK_sign.publicKey),
        OPKs_public: Array.from(keys.OPKs, ([id, keys]) => ({ id, pub: uint8ArrayToBase64(keys.publicKey) })),
        SPK_dh_public: uint8ArrayToBase64(keys.SPK_dh.publicKey),
        SPK_signature: uint8ArrayToBase64(keys.SPK_signature),
      },
      type: "INIT_KEYS",
    };

    const timeout = setTimeout(() => {
      socketClient.off("INIT_KEYS_SUCCESS", onSuccess);
      socketClient.off("INIT_KEYS_ERROR", onError);
      reject(new Error("Превышено время ожидания от сервера."));
    }, 10_000);

    const onSuccess: PacketCallback = () => {
      clearTimeout(timeout);
      socketClient.off("INIT_KEYS_ERROR", onError);
      console.log("Keys uploaded successfully.");
      setLastSPKRotation(Date.now());
      resolve(true);
    };

    const onError: PacketCallback = () => {
      clearTimeout(timeout);
      socketClient.off("INIT_KEYS_SUCCESS", onSuccess);
      console.error("Keys uploading failed.");
      resolve(false);
    };

    socketClient.once("INIT_KEYS_ERROR", onError);
    socketClient.once("INIT_KEYS_SUCCESS", onSuccess);

    socketClient.send(keysBundle);
  });
}

export async function sendMediaFile(file: File, nickname: string): Promise<void> {
  const CHUNK_SIZE = 512 * 1024;

  const ratchet = cryptoManager.getRatchet(nickname);
  if (ratchet === null) {
    console.error("Ratchet instance not found.");
    return;
  }
  const fileID = crypto.randomUUID();

  // STEP 1

  const fileMasterKey = await crypto.subtle.generateKey({ length: 256, name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  const exportedRawKey = await crypto.subtle.exportKey("raw", fileMasterKey);
  const fileMasterKeyBase64 = uint8ArrayToBase64(new Uint8Array(exportedRawKey));

  const initPayload: MediaInitPayload = {
    fileMasterKey: fileMasterKeyBase64,
    fileName: file.name,
    fileSize: file.size,
  };

  const encryptedPayload = await ratchet.send(JSON.stringify(initPayload));
  await cryptoManager.setRatchet(nickname, ratchet); // Update ratchet on every step
  const serialized = serializeMessageEnvelope(encryptedPayload);
  console.log("Sent:", serialized);

  const initPacket: MediaInit = {
    ...serialized,
    fileID,
  };

  socketClient.send({
    payload: {
      envelope: initPacket,
      targetNickname: nickname,
    },
    type: "MEDIA_INIT",
  });

  // STEP 2

  let offset = 0;
  let chunkIndex = 0;

  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const chunkBuffer = await slice.arrayBuffer();

    const chunkIv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedChunkBuffer = await crypto.subtle.encrypt({ iv: chunkIv, name: "AES-GCM" }, fileMasterKey, chunkBuffer);

    const chunkEnvelope: MediaChunk = {
      chunkData: uint8ArrayToBase64(new Uint8Array(encryptedChunkBuffer)),
      chunkIndex,
      fileID,
      iv: uint8ArrayToBase64(chunkIv),
    };

    socketClient.send({
      payload: {
        envelope: chunkEnvelope,
        targetNickname: nickname,
      },
      type: "MEDIA_CHUNK",
    });
    offset += CHUNK_SIZE;
    chunkIndex++;
  }

  const entireFileBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", entireFileBuffer);
  const sha256Base64 = uint8ArrayToBase64(new Uint8Array(hashBuffer));

  const endEnvelope: MediaEnd = {
    fileID,
    mimeType: file.type,
    sha256sum: sha256Base64,
  };

  socketClient.send({
    payload: {
      envelope: endEnvelope,
      targetNickname: nickname,
    },
    type: "MEDIA_END",
  });

  console.log("End message:", endEnvelope);

  const fileBlob = file.slice(0, file.size, file.type);

  await downloadStorage.saveFile(fileBlob, {
    chatNickname: nickname,
    fileId: fileID,
    fileName: file.name,
    fileSizeBytes: file.size,
    timestamp: Date.now(),
  });

  const fileType = getFileType(fileBlob.type);
  if (fileType === "other") return;
  const thumbnail = await generateThumbnail(fileBlob, fileType);

  messageMediaLog(fileID, "You", nickname, fileType, thumbnail);
}

export async function sendMessage(nickname: string, text: string): Promise<void> {
  const { setStatus } = useChatSessionStore.getState();

  try {
    let ratchet = cryptoManager.getRatchet(nickname);

    if (ratchet === null) {
      setStatus(nickname, "exchanging");
      const remoteKeys = await fetchPeerKeys(nickname);
      ratchet = await initDoubleRatchet(nickname, remoteKeys);
      await sendInitialMessage(nickname, ratchet, remoteKeys, text);
      setStatus(nickname, "ready");
      return;
    }

    const encrypted = await ratchet.send(text);
    await cryptoManager.setRatchet(nickname, ratchet); // Update ratchet on every step
    const serialized = serializeMessageEnvelope(encrypted);

    const toSend: UserMessage = {
      payload: {
        envelope: serialized,
        targetNickname: nickname,
      },
      type: "MESSAGE",
    };

    socketClient.send(toSend);
    messageTextLog(text, "You", nickname);
  } catch (error) {
    const parsedError = error instanceof Error ? error.message : String(error);
    console.log("Send message error: " + parsedError);
  }
}

function fetchPeerKeys(nickname: string): Promise<RawKeysBundle> {
  return new Promise((resolve, reject) => {
    const handler = (packet: GetKeysResponse): void => {
      const payload = packet.payload;
      if (payload.targetNickname !== nickname) return;
      socketClient.off("GET_KEYS_RESPONSE", handler);

      if (payload.status === "SUCCESS") resolve(extractKeys(payload.keys));
      else reject(new Error(`Failed to fetch keys: ${payload.status}`));
    };

    socketClient.on("GET_KEYS_RESPONSE", handler);
    socketClient.send({ payload: { targetNickname: nickname }, type: "GET_KEYS" });
  });
}

async function sendInitialMessage(nickname: string, ratchet: DoubleRatchet, remoteKeys: RawKeysBundle, text: string): Promise<void> {
  const encrypted = await ratchet.send(text);
  await cryptoManager.setRatchet(nickname, ratchet); // Update ratchet on every step
  const myKeys = cryptoManager.myKeys;
  const temporaryKeys = cryptoManager.getWaitingData(nickname);
  if (!temporaryKeys) {
    throw new Error("Failed to start a conversation. Temporary keys are missing.");
  }
  const toSend: UserMessage = {
    payload: {
      envelope: {
        cipherText: uint8ArrayToBase64(encrypted.cipherText),
        EK_pub: uint8ArrayToBase64(temporaryKeys.EK_my_pub),
        header: { dh_pub: uint8ArrayToBase64(encrypted.header.dh_pub), n: encrypted.header.n, pn: encrypted.header.pn },

        IK_dh_pub: uint8ArrayToBase64(myKeys.IK_dh.publicKey),
        iv: uint8ArrayToBase64(encrypted.iv),
        OPK_id: remoteKeys.OPK_public?.id,
      },
      targetNickname: nickname,
    },
    type: "INITIAL_MESSAGE",
  };

  messageTextLog(text, "You", nickname);

  socketClient.send(toSend);
}
