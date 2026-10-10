import { MediaInitPayloadSchema } from "@a-chat/shared";

import type { EncryptedMessage } from "@/types/crypto.ts";
import type { EventMap } from "@/types/events.ts";
import type { FileChunk } from "@/types/files.ts";

import { useDownloadsStore } from "@/stores/downloads.ts";
import { downloadStorage } from "@/stores/downloadStorage.ts";
import { runSerialized } from "@/utils/asyncQueue.ts";
import { messageMediaLog } from "@/utils/logger.ts";
import { base64ToUint8Array, generateThumbnail, getFileType, uint8ArrayToBase64 } from "@/utils/utilities.ts";

import { cryptoManager } from "../cryptoManager.ts";

export const handleMediaInit = async ({ payload }: EventMap["MEDIA_INIT"]): Promise<void> => {
  try {
    console.log("STARTING DOWNLOAD...");
    const ratchet = cryptoManager.getRatchet(payload.fromNickname);
    if (!ratchet) {
      console.error("No ratchet instance found: MEDIA_INIT");
      return;
    }
    const { fileID, ...toDecrypt } = payload.envelope;
    const parsedToDecrypt: EncryptedMessage = {
      cipherText: base64ToUint8Array(toDecrypt.cipherText),
      header: {
        ...toDecrypt.header,
        dh_pub: base64ToUint8Array(toDecrypt.header.dh_pub),
      },
      iv: base64ToUint8Array(toDecrypt.iv),
    };

    const decrypted = await ratchet.receive(parsedToDecrypt);
    const parsedReceived = MediaInitPayloadSchema.safeParse(JSON.parse(decrypted));
    if (!parsedReceived.success) {
      console.log("Zod parsing error: Invalid data in init media message.");
      return;
    }

    const { startDownload } = useDownloadsStore.getState();
    const { fileMasterKey, fileName, fileSize } = parsedReceived.data;

    const rawKey = base64ToUint8Array(fileMasterKey);
    const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
    startDownload(fileID, fileName, fileSize, key, payload.fromNickname);
  } catch (error) {
    console.error("Error handling MEDIA_INIT", error instanceof Error ? error.message : String(error));
  }
};

export const handleMediaChunk = async ({ payload }: EventMap["MEDIA_CHUNK"]): Promise<void> => {
  const { fileID } = payload.envelope;

  return runSerialized(fileID, async () => {
    const { chunkData, chunkIndex, iv } = payload.envelope;
    console.log("CHUNK NUMBER:", chunkIndex);

    const { addChunk } = useDownloadsStore.getState();
    const downloadSession = useDownloadsStore.getState().activeDownloads[fileID];

    if (!downloadSession) {
      console.error(`No download session found. MEDIA_CHUNK: ${payload.fromNickname}`);
      return;
    }

    if (downloadSession.chatNickname !== payload.fromNickname) {
      console.error("Different person sent a chunk of the same file. Skipping...");
      return;
    }

    const parsedIv = base64ToUint8Array(iv);
    const parsedChunkData = base64ToUint8Array(chunkData);

    const decrypted = await crypto.subtle.decrypt({ iv: parsedIv, name: "AES-GCM" }, downloadSession.fileMasterKey, parsedChunkData);
    const chunk: FileChunk = { data: new Uint8Array(decrypted), index: chunkIndex };
    addChunk(fileID, chunk);
  });
};

export const handleMediaEnd = async ({ payload }: EventMap["MEDIA_END"]): Promise<void> => {
  const { fileID } = payload.envelope;

  return runSerialized(fileID, async () => {
    const THUMBNAIL_FALLBACK = "/thumbnail.png";
    try {
      const { mimeType, sha256sum } = payload.envelope;
      console.log("MIME TYPE:", mimeType);
      const { setBlob, setDownloadStatus } = useDownloadsStore.getState();
      const downloadSession = useDownloadsStore.getState().activeDownloads[fileID];

      if (!downloadSession) {
        console.error(`No download session found. MEDIA_CHUNK: ${payload.fromNickname}`);
        return;
      }

      if (downloadSession.chatNickname !== payload.fromNickname) {
        console.error("Different person sent a chunk of the same file. Skipping...");
        return;
      }

      const expectedChunksCount = Math.ceil(downloadSession.fileSizeBytes / (512 * 1024));
      const orderedChunks: Uint8Array<ArrayBuffer>[] = [];

      for (let index = 0; index < expectedChunksCount; index++) {
        const chunkData = downloadSession.chunks[index];

        if (!chunkData) {
          console.error(`Chunk number ${index.toString()} is missing`);
          setDownloadStatus(fileID, "error");
          return;
        }

        orderedChunks.push(chunkData);
      }

      console.log(orderedChunks);

      const fileBlob = new Blob(orderedChunks, { type: mimeType });
      const fileBuffer = await fileBlob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);

      const calculatedSha256 = uint8ArrayToBase64(new Uint8Array(hashBuffer));

      if (calculatedSha256.toLowerCase() !== sha256sum.toLowerCase()) {
        setDownloadStatus(fileID, "error");
        console.error(`SHA-256 checksum mismmatch. File is corrupted. Expected: ${sha256sum.toLowerCase()}, current: ${calculatedSha256.toLowerCase()}`);
        return;
      }

      setBlob(fileID, fileBlob);
      setDownloadStatus(fileID, "ready");

      await downloadStorage.saveFile(fileBlob, {
        chatNickname: downloadSession.chatNickname,
        fileId: fileID,
        fileName: downloadSession.fileName,
        fileSizeBytes: downloadSession.fileSizeBytes,
        timestamp: Date.now(),
      });
      console.log(`Received file: ${fileID}. Type: ${fileBlob.type}`);

      const fileType = getFileType(fileBlob.type);
      if (fileType === "other") return;
      let thumbnail: string;
      try {
        thumbnail = await generateThumbnail(fileBlob, fileType);
      } catch (error) {
        console.log(`Failed to generate thumbnail for: ${fileID}`, error);
        thumbnail = THUMBNAIL_FALLBACK;
      }

      messageMediaLog(fileID, "Peer", payload.fromNickname, fileType, thumbnail);
    } catch (error) {
      console.error("Error handling MEDIA_END", error instanceof Error ? error.message : String(error));
    }
  });
};
