import type { InitialEnvelope, MessageEnvelope } from "@a-chat/shared";

import nacl from "tweetnacl";

import type { EncryptedMessage, RawKeysBundle } from "@/types/crypto.ts";

import { cryptoManager } from "@/services/cryptoManager.ts";
import { useChatSessionStore } from "@/stores/chatSession.ts";
import { useIdentityStore } from "@/stores/identity.ts";

import { DoubleRatchet } from "./ratchet.ts";
import { base64ToUint8Array, concatUint8Arrays } from "./utilities.ts";

export async function deriveSK(
  dhConcat: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const F = new Uint8Array(32).fill(0xff);
  const ikm = new Uint8Array(concatUint8Arrays([F, dhConcat]));
  const salt = new Uint8Array(32);

  const baseKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);
  const info = new TextEncoder().encode("A-Chat X3DH");
  const bits = await crypto.subtle.deriveBits(
    { hash: "SHA-256", info, name: "HKDF", salt },
    baseKey,
    256,
  );

  return new Uint8Array(bits);
}

export async function handleReceiveMessage(
  nickname: string,
  message: MessageEnvelope,
): Promise<void> {
  const ratchet = cryptoManager.getRatchet(nickname);
  if (!ratchet) throw new Error("Error: Double ratchet instance is missing.");

  const preparedMessage: EncryptedMessage = {
    cipherText: base64ToUint8Array(message.cipherText),
    header: {
      dh_pub: base64ToUint8Array(message.header.dh_pub),
      n: message.header.n,
      pn: message.header.pn,
    },
    iv: base64ToUint8Array(message.iv),
  };

  const decryptedText = await ratchet.receive(preparedMessage);
  await cryptoManager.setRatchet(nickname, ratchet); // Update ratchet on every step

  const { addMessage } = useIdentityStore.getState();
  addMessage(nickname, {
    id: crypto.randomUUID(),
    sender: "Peer",
    text: decryptedText,
    timestamp: Date.now(),
    type: "text",
  });
}

export async function initDoubleRatchet(
  nickname: string,
  remoteKeys: RawKeysBundle,
): Promise<DoubleRatchet> {
  const initial = await runX3DH(remoteKeys);

  const ratchet = await DoubleRatchet.create(initial.SK, initial.EK_my, {
    isInitiator: true,
    remoteDH_pub: remoteKeys.SPK_dh_public,
  });
  await cryptoManager.setRatchet(nickname, ratchet);
  cryptoManager.saveWaitingData(nickname, {
    EK_my_pub: initial.EK_my.publicKey,
    OPK_id: remoteKeys.OPK_public?.id,
  });
  console.log("Double ratchet initialized. Send something...");

  return ratchet;
}

export async function respondDoubleRatchet(
  nickname: string,
  remotePacket: InitialEnvelope,
): Promise<void> {
  const { setStatus } = useChatSessionStore.getState();
  const myKeys = cryptoManager.myKeys;
  try {
    const initialRootKey = await respondX3DH(remotePacket);
    const ratchet = await DoubleRatchet.create(initialRootKey, myKeys.SPK_dh, {
      isInitiator: false,
    });
    await cryptoManager.setRatchet(nickname, ratchet);

    const message: MessageEnvelope = {
      ...remotePacket,
    };

    setStatus(nickname, "ready");
    await handleReceiveMessage(nickname, message);
  } catch (error) {
    console.log("Response error:", error);
  }
}

export async function respondX3DH(
  remotePacket: InitialEnvelope,
): Promise<Uint8Array<ArrayBuffer>> {
  const IK_dh_pub = base64ToUint8Array(remotePacket.IK_dh_pub);
  const EK_pub = base64ToUint8Array(remotePacket.EK_pub);

  const myKeys = cryptoManager.myKeys;

  const currentOPK =
    remotePacket.OPK_id === undefined
      ? null
      : myKeys.OPKs.get(remotePacket.OPK_id);
  if (currentOPK === null)
    throw new Error("Target OPK not found. X3DH rejected.");
  const DH1 = nacl.scalarMult(myKeys.SPK_dh.secretKey, IK_dh_pub);
  const DH2 = nacl.scalarMult(myKeys.IK_dh.secretKey, EK_pub);
  const DH3 = nacl.scalarMult(myKeys.SPK_dh.secretKey, EK_pub);

  let DH4: null | Uint8Array = null;
  if (currentOPK) {
    DH4 = nacl.scalarMult(currentOPK.secretKey, EK_pub);
    myKeys.OPKs.delete(remotePacket.OPK_id!);
  }

  const inputs = [DH1, DH2, DH3];
  if (DH4) inputs.push(DH4);

  const masterSecret = concatUint8Arrays(inputs);
  const SK = await deriveSK(masterSecret);
  return SK;
}

export async function runX3DH(
  remoteKeys: RawKeysBundle,
): Promise<{ EK_my: nacl.BoxKeyPair; SK: Uint8Array<ArrayBuffer> }> {
  const myKeys = cryptoManager.myKeys;

  const IK_dh = myKeys.IK_dh.secretKey;
  const isOk = nacl.sign.detached.verify(
    remoteKeys.SPK_dh_public,
    remoteKeys.SPK_signature,
    remoteKeys.IK_sign_public,
  );
  if (!isOk) {
    throw new Error("Invalid SPK signature.");
  }

  const EK_my = nacl.box.keyPair();
  let DH4: null | Uint8Array = null;

  const DH1 = nacl.scalarMult(IK_dh, remoteKeys.SPK_dh_public);
  const DH2 = nacl.scalarMult(EK_my.secretKey, remoteKeys.IK_dh_public);
  const DH3 = nacl.scalarMult(EK_my.secretKey, remoteKeys.SPK_dh_public);

  if (remoteKeys.OPK_public) {
    DH4 = nacl.scalarMult(EK_my.secretKey, remoteKeys.OPK_public.pub);
  }

  const inputs = [DH1, DH2, DH3];
  if (DH4) inputs.push(DH4);

  const masterSecret = concatUint8Arrays(inputs);
  const SK = await deriveSK(masterSecret);

  return { EK_my, SK };
}
