import { clear, createStore, del, entries, get, set } from "idb-keyval";

import type { DoubleRatchetState, MyKeysStorage } from "@/types/crypto.ts";

import { DoubleRatchet } from "@/utils/ratchet.ts";

const KEYPAIR_STORAGE_KEY = "identity_keypair";

const ratchetStore = createStore("ratchet-db", "ratchet-storage");
const keysStore = createStore("keys-db", "keys-storage");

export const cryptoStorage = {
  async clearKeys(): Promise<void> {
    await del(KEYPAIR_STORAGE_KEY, keysStore);
  },

  async getMyKeys(): Promise<MyKeysStorage | null> {
    const keys = await get<MyKeysStorage>(KEYPAIR_STORAGE_KEY, keysStore);
    return keys ?? null;
  },

  async getRatchets(): Promise<Map<string, DoubleRatchet>> {
    const allEntries = await entries<string, DoubleRatchetState>(ratchetStore);
    const deserializedRatchets = allEntries.map(([nickname, state]) => {
      return [nickname, DoubleRatchet.deserialize(state)] as [string, DoubleRatchet];
    });
    return new Map<string, DoubleRatchet>(deserializedRatchets);
  },

  async loadRatchet(nickname: string): Promise<DoubleRatchet | undefined> {
    const state = await get<DoubleRatchetState>(nickname, ratchetStore);
    return state ? DoubleRatchet.deserialize(state) : undefined;
  },

  async saveMyKeys(keys: MyKeysStorage): Promise<void> {
    await set(KEYPAIR_STORAGE_KEY, keys, keysStore);
  },

  async saveRatchet(nickname: string, ratchet: DoubleRatchet): Promise<void> {
    await set(nickname, ratchet.serialize(), ratchetStore);
  },

  async wipe(): Promise<void> {
    await clear(ratchetStore);
    await clear(keysStore);
  },
};
