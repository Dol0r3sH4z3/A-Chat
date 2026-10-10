import { create } from "zustand";

import type { KeyExchangeStatus } from "@/types/crypto.ts";

interface ChatSessionState {
  getStatus: (nickname: string) => KeyExchangeStatus;
  setStatus: (nickname: string, status: KeyExchangeStatus) => void;
  statusByNickname: Record<string, KeyExchangeStatus>;
}

export const useChatSessionStore = create<ChatSessionState>((set, get) => ({
  getStatus: (nickname): KeyExchangeStatus => get().statusByNickname[nickname] ?? "idle",
  setStatus: (nickname, status): void => {
    set((state) => ({
      statusByNickname: { ...state.statusByNickname, [nickname]: status },
    }));
  },
  statusByNickname: {},
}));
