import nacl from "tweetnacl";

import type { MyKeysStorage, RawKeysBundle } from "@/types/crypto.ts";
import type { DoubleRatchet } from "@/utils/ratchet.ts";

import { cryptoStorage } from "@/stores/cryptoStorage.ts";
import { useIdentityStore } from "@/stores/identity.ts";
import { generateKeys, uint8ArrayToBase64 } from "@/utils/utilities.ts";

import { socketClient } from "./socketClient.ts";

type RatchetsMap = Map<string, DoubleRatchet>;
interface WaitingBundle {
  EK_my_pub: Uint8Array;
  OPK_id?: number;
}

class CryptoManager {
  private readonly _waitingForMessage = new Map<string, WaitingBundle>();
  private _temporaryPeerKeys = new Map<string, RawKeysBundle>();
  private _myKeys!: MyKeysStorage;
  private _ratchets!: RatchetsMap;

  private readonly SPK_ROTATION_INTERVAL = 7 * 24 * 60 * 60 * 1000;

  get myKeys(): MyKeysStorage {
    return this._myKeys;
  }

  static async create(): Promise<CryptoManager> {
    const manager = new CryptoManager();
    await manager.init();
    return manager;
  }

  getRatchet(nickname: string): DoubleRatchet | null {
    return this._ratchets.get(nickname) ?? null;
  }

  getPeerKeys(nickname: string): null | RawKeysBundle {
    const keys = this._temporaryPeerKeys.get(nickname);
    if (keys) {
      this._temporaryPeerKeys.delete(nickname);
    }
    return keys ?? null;
  }

  getNicknames(): string[] {
    return this._ratchets.keys().toArray();
  }

  getWaitingData(nickname: string): null | WaitingBundle {
    const keys = this._waitingForMessage.get(nickname);
    if (keys) {
      this._waitingForMessage.delete(nickname);
    }
    return keys ?? null;
  }

  async setRatchet(nickname: string, ratchet: DoubleRatchet): Promise<void> {
    const { addNickname } = useIdentityStore.getState();
    this._ratchets.set(nickname, ratchet);
    await cryptoStorage.saveRatchet(nickname, ratchet);
    addNickname(nickname);
  }

  setPeerKeys(nickname: string, keys: RawKeysBundle): void {
    this._temporaryPeerKeys.set(nickname, keys);
  }

  saveWaitingData(nickname: string, bundle: WaitingBundle): void {
    this._waitingForMessage.set(nickname, bundle);
  }

  async wipe(): Promise<void> {
    await cryptoStorage.wipe();
    await this.init();
  }

  checkAndRotateSPK(): void {
    const { lastSPKRotation, setLastSPKRotation } = useIdentityStore.getState();
    const now = Date.now();
    const timePassed = now - lastSPKRotation;

    if (timePassed < this.SPK_ROTATION_INTERVAL) {
      console.log(`[SPK] Update is not required. Next rotation in: ${((this.SPK_ROTATION_INTERVAL - timePassed) / 1000 / 60 / 60).toFixed(1)} h.`);
      return;
    }

    console.log("[SPK] Starting rotation...");

    const newSpkKeyPair = nacl.box.keyPair();
    const signature = nacl.sign.detached(newSpkKeyPair.publicKey, this.myKeys.IK_sign.secretKey);

    socketClient.send({
      payload: {
        SPK_dh_public: uint8ArrayToBase64(newSpkKeyPair.publicKey),
        SPK_signature: uint8ArrayToBase64(signature),
      },
      type: "UPDATE_SPK",
    });

    setLastSPKRotation(now);

    console.log("[SPK] Rotation completed.");
  }

  private async init(): Promise<void> {
    let myKeys = await cryptoStorage.getMyKeys();
    if (myKeys === null) {
      myKeys = await generateKeys();
      await cryptoStorage.saveMyKeys(myKeys);
    }

    this._myKeys = myKeys;
    this._ratchets = await cryptoStorage.getRatchets();
    this._temporaryPeerKeys = new Map();
  }
}

export const cryptoManager = await CryptoManager.create();
