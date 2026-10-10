import type { DoubleRatchet } from "@/utils/ratchet.ts";

export interface ConversationState {
  nickname: string;
  ratchet: DoubleRatchet;
}

export type DoubleRatchetConstructorOptions = { initialRootKey: Uint8Array<ArrayBuffer>; isInitiator: false; myDH: nacl.BoxKeyPair } | { isInitiator: true; myDH: nacl.BoxKeyPair; remoteDH_pub: Uint8Array; rootKey: Uint8Array<ArrayBuffer>; sendingChainKey: Uint8Array<ArrayBuffer> };

export interface DoubleRatchetState {
  myDH: nacl.BoxKeyPair;

  Nr: number;
  Ns: number;
  PN: number;

  receivingChainKey: null | Uint8Array<ArrayBuffer>;
  remoteDH_pub: null | Uint8Array;
  rootKey: Uint8Array<ArrayBuffer>;
  sendingChainKey: null | Uint8Array<ArrayBuffer>;
  skippedMessageKeys: Map<string, Uint8Array>;
}

export interface EncryptedMessage {
  cipherText: Uint8Array<ArrayBuffer>;
  header: Header;
  iv: Uint8Array<ArrayBuffer>;
}

export interface Header {
  dh_pub: Uint8Array;
  n: number;
  pn: number;
}

export type KeyExchangeStatus = "error" | "exchanging" | "idle" | "ready";

export interface MyKeysStorage {
  IK_dh: nacl.BoxKeyPair;
  IK_sign: nacl.SignKeyPair;

  OPKs: Map<number, nacl.BoxKeyPair>;

  SPK_dh: nacl.BoxKeyPair;
  SPK_signature: Uint8Array;
}

export interface RawKeysBundle {
  IK_dh_public: Uint8Array;
  IK_sign_public: Uint8Array;
  OPK_public?: { id: number; pub: Uint8Array };
  SPK_dh_public: Uint8Array;
  SPK_signature: Uint8Array;
}
