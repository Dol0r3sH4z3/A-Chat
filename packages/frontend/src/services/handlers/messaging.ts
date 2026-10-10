import type { EventMap } from "@/types/events.ts";

import { handleReceiveMessage, respondDoubleRatchet } from "@/utils/crypto.ts";

import { cryptoManager } from "../cryptoManager.ts";

export const handleInitialMessage = async ({ payload }: EventMap["INITIAL_MESSAGE"]): Promise<void> => {
  const currentRatchet = cryptoManager.getRatchet(payload.fromNickname);
  if (!currentRatchet) {
    try {
      await respondDoubleRatchet(payload.fromNickname, payload.envelope);
    } catch (error) {
      console.error("Failed to respond Double ratchet:", error);
    }
  }
};

export const handleMessage = async ({ payload }: EventMap["MESSAGE"]): Promise<void> => {
  await handleReceiveMessage(payload.fromNickname, payload.envelope);
};
