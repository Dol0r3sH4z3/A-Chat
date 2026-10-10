import nacl from "tweetnacl";

import type { DoubleRatchetConstructorOptions, DoubleRatchetState, EncryptedMessage, Header } from "@/types/crypto.ts";

import { areUint8ArraysEqual, buildAAD } from "./utilities.ts";

export class DoubleRatchet {
  private rootKey: Uint8Array<ArrayBuffer>;
  private sendingChainKey: null | Uint8Array<ArrayBuffer> = null;
  private receivingChainKey: null | Uint8Array<ArrayBuffer> = null;

  private myDH: nacl.BoxKeyPair;
  private remoteDH_pub: null | Uint8Array = null;

  private Ns = 0;
  private Nr = 0;
  private PN = 0;

  private readonly skippedMessageKeys = new Map<string, Uint8Array>();
  private readonly MAX_SKIPPED_KEYS = 1000;

  constructor(options: DoubleRatchetConstructorOptions) {
    this.myDH = options.myDH;

    if (options.isInitiator) {
      this.remoteDH_pub = options.remoteDH_pub;
      this.rootKey = options.rootKey;
      this.sendingChainKey = options.sendingChainKey;
      this.receivingChainKey = null;
    } else {
      this.rootKey = options.initialRootKey;
      this.sendingChainKey = null;
      this.receivingChainKey = null;
      this.remoteDH_pub = null;
    }
  }

  static async create(initialRootKey: Uint8Array<ArrayBuffer>, myDH: nacl.BoxKeyPair, options: { isInitiator: false } | { isInitiator: true; remoteDH_pub: Uint8Array }): Promise<DoubleRatchet> {
    if (options.isInitiator) {
      const rawSecret = nacl.scalarMult(myDH.secretKey, options.remoteDH_pub);
      const sharedSecret = new Uint8Array(rawSecret);
      const [newRootKey, newChainKey] = await kdfRoot(initialRootKey, sharedSecret);

      return new DoubleRatchet({ isInitiator: true, myDH, remoteDH_pub: options.remoteDH_pub, rootKey: newRootKey, sendingChainKey: newChainKey });
    }
    return new DoubleRatchet({ initialRootKey: initialRootKey, isInitiator: false, myDH });
  }

  static deserialize(state: DoubleRatchetState): DoubleRatchet {
    const ratchet = Object.create(this.prototype) as DoubleRatchet;
    Object.assign(ratchet, state);
    return ratchet;
  }

  serialize(): DoubleRatchetState {
    return {
      myDH: this.myDH,
      Nr: this.Nr,
      Ns: this.Ns,
      PN: this.PN,
      receivingChainKey: this.receivingChainKey,
      remoteDH_pub: this.remoteDH_pub,
      rootKey: this.rootKey,
      sendingChainKey: this.sendingChainKey,
      skippedMessageKeys: this.skippedMessageKeys,
    };
  }

  public async send(plainText: string): Promise<EncryptedMessage> {
    if (!this.sendingChainKey) {
      throw new Error("No sending chain key found.");
    }

    const [newChainKey, messageKey] = await kdfChain(this.sendingChainKey);

    this.sendingChainKey = newChainKey;

    const header: Header = {
      dh_pub: this.myDH.publicKey,
      n: this.Ns,
      pn: this.PN,
    };
    const encryptedMessage = await encrypt(messageKey, plainText, header);

    const encryptedPacket: EncryptedMessage = {
      ...encryptedMessage,
      header,
    };

    this.Ns++;

    return encryptedPacket;
  }

  public async receive(packet: EncryptedMessage): Promise<string> {
    const { cipherText, header, iv } = packet;

    const skipKey = this.remoteDH_pub ? `${header.dh_pub.toString()}:${header.n.toString()}` : null;
    if (skipKey !== null && this.skippedMessageKeys.has(skipKey)) {
      const rawMessageKey = this.skippedMessageKeys.get(skipKey)!;
      const messageKey = new Uint8Array(rawMessageKey);
      const decrypted = await decrypt(messageKey, { cipherText, header, iv });
      this.skippedMessageKeys.delete(skipKey);
      return decrypted;
    }

    if (this.remoteDH_pub === null || !areUint8ArraysEqual(header.dh_pub, this.remoteDH_pub)) {
      if (this.remoteDH_pub !== null) {
        await this.skipMessageKeys(header.pn);
      }

      this.remoteDH_pub = header.dh_pub;

      const rawSecret = nacl.scalarMult(this.myDH.secretKey, this.remoteDH_pub);
      const sharedSecret = new Uint8Array(rawSecret);

      const [newRootKey, newChainKey] = await kdfRoot(this.rootKey, sharedSecret);

      this.rootKey = newRootKey;
      this.receivingChainKey = newChainKey;

      this.Nr = 0;
      this.PN = this.Ns;
      this.Ns = 0;

      this.myDH = nacl.box.keyPair();

      const rawSecretSend = nacl.scalarMult(this.myDH.secretKey, this.remoteDH_pub);
      const sharedSecretSend = new Uint8Array(rawSecretSend);

      const [newRootKeySend, newChainKeySend] = await kdfRoot(this.rootKey, sharedSecretSend);
      this.rootKey = newRootKeySend;
      this.sendingChainKey = newChainKeySend;
    }

    if (!this.receivingChainKey) throw new Error("No receiving chain key found.");

    while (this.Nr < header.n) {
      if (header.pn - this.Nr > this.MAX_SKIPPED_KEYS) throw new Error("Too many packets lost.");

      const [newChainKey, newMessageKey] = await kdfChain(this.receivingChainKey);
      this.receivingChainKey = newChainKey;

      this.skippedMessageKeys.set(`${this.remoteDH_pub.toString()}:${this.Nr.toString()}`, newMessageKey);
      this.Nr++;
    }

    const [finalChainKey, finalMessageKey] = await kdfChain(this.receivingChainKey);
    this.receivingChainKey = finalChainKey;
    this.Nr++;

    return await decrypt(finalMessageKey, { cipherText, header, iv });
  }

  private async skipMessageKeys(pn: number): Promise<void> {
    if (!this.receivingChainKey || !this.remoteDH_pub) return;

    if (pn - this.Nr > this.MAX_SKIPPED_KEYS) {
      console.log("Too many packets lost. Restart the chat again.");
      return;
    }

    while (this.Nr < pn) {
      const [chainKey, messageKey] = await kdfChain(this.receivingChainKey);
      this.receivingChainKey = chainKey;
      this.storeSkippedKey(`${this.remoteDH_pub.toString()}:${this.Nr.toString()}`, messageKey);
      this.Nr++;
    }
  }

  private storeSkippedKey(key: string, messageKey: Uint8Array): void {
    if (this.skippedMessageKeys.size >= this.MAX_SKIPPED_KEYS) {
      const oldestKey = this.skippedMessageKeys.keys().next().value;
      if (oldestKey !== undefined) this.skippedMessageKeys.delete(oldestKey);
    }
    this.skippedMessageKeys.set(key, messageKey);
  }
}

export async function decrypt(messageKey: Uint8Array<ArrayBuffer>, message: EncryptedMessage): Promise<string> {
  const key = await crypto.subtle.importKey("raw", messageKey, "AES-GCM", false, ["decrypt"]);
  const decryptedText = await crypto.subtle.decrypt({ additionalData: buildAAD(message.header), iv: message.iv, name: "AES-GCM", tagLength: 128 }, key, message.cipherText);

  return new TextDecoder().decode(decryptedText);
}

export async function encrypt(messageKey: Uint8Array<ArrayBuffer>, plainText: string, header: Header): Promise<{ cipherText: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer> }> {
  const key = await crypto.subtle.importKey("raw", messageKey, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherText = await crypto.subtle.encrypt({ additionalData: buildAAD(header), iv, name: "AES-GCM", tagLength: 128 }, key, new TextEncoder().encode(plainText));

  return { cipherText: new Uint8Array(cipherText), iv };
}

export async function kdfChain(chainKey: Uint8Array<ArrayBuffer>): Promise<[Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>]> {
  const key = await crypto.subtle.importKey("raw", chainKey, { hash: "SHA-256", name: "HMAC" }, false, ["sign"]);
  const messageKey = new Uint8Array(await crypto.subtle.sign("HMAC", key, new Uint8Array([0x02])));
  const newChainKey = new Uint8Array(await crypto.subtle.sign("HMAC", key, new Uint8Array([0x01])));

  return [newChainKey, messageKey];
}

export async function kdfRoot(rootKeyBytes: Uint8Array<ArrayBuffer>, sharedSecret: Uint8Array<ArrayBuffer>): Promise<[Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>]> {
  const baseKey = await crypto.subtle.importKey("raw", rootKeyBytes, "HKDF", false, ["deriveBits"]);

  const info = new TextEncoder().encode("A-Chat DoubleRatchet");
  const derivedBits = await crypto.subtle.deriveBits({ hash: "SHA-256", info, name: "HKDF", salt: sharedSecret }, baseKey, 512);

  const derivedBytes = new Uint8Array(derivedBits);

  return [derivedBytes.subarray(0, 32), derivedBytes.subarray(32, 64)];
}
