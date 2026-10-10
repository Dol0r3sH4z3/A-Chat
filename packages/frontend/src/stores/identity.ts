import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SavedMessage } from "@/types/messages.ts";

interface IdentityState {
  addMessage: (nickname: string, message: SavedMessage) => void;
  addNickname: (nickname: string) => void;

  currentChatNickname: string;
  isAuthorized: boolean;
  isConnected: boolean;

  lastSPKRotation: number;
  messagesHistory: Record<string, SavedMessage[]>;

  nickname: string;

  setCurrentChat: (nickname: string) => void;
  setIsAuthorized: (isAuthorized: boolean) => void;
  setIsConnected: (isConnected: boolean) => void;

  setLastSPKRotation: (timestamp: number) => void;

  setMyNickname: (nick: string) => void;
  storedNicknames: string[];

  terminalSessionIds: {
    chatTerminalId: string;
    mainTerminalId: string;
  };
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set) => ({
      addMessage: (nickname, message): void => {
        set((s) => {
          const previousMessages = s.messagesHistory[nickname];

          return {
            messagesHistory: {
              ...s.messagesHistory,
              [nickname]: [...(previousMessages ?? []), message],
            },
          };
        });
      },
      addNickname: (nickname): void => {
        set((state) => {
          if (state.storedNicknames.includes(nickname)) return state;
          return { storedNicknames: [...state.storedNicknames, nickname] };
        });
      },

      currentChatNickname: "",

      isAuthorized: false,
      isConnected: false,

      lastSPKRotation: 0,
      messagesHistory: {},

      nickname: "",

      setCurrentChat: (nickname): void => {
        set({ currentChatNickname: nickname });
      },
      setIsAuthorized: (isAuthorized): void => {
        set({ isAuthorized });
      },
      setIsConnected: (isConnected): void => {
        set({ isConnected });
      },

      setLastSPKRotation: (timestamp): void => {
        set({ lastSPKRotation: timestamp });
      },

      setMyNickname: (nick): void => {
        set({ nickname: nick });
      },
      storedNicknames: [],

      terminalSessionIds: {
        chatTerminalId: crypto.randomUUID(),
        mainTerminalId: crypto.randomUUID(),
      },
    }),
    { name: "a-chat-identity" },
  ),
);
