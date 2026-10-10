import type { GeneralLog, LogStatus, LogStyle, SavedMessage } from "@/types/messages.ts";

import { useIdentityStore } from "@/stores/identity.ts";
import { useTerminal } from "@/stores/terminal.ts";

const getRandomDelay = (min: number, max: number): number => {
  // eslint-disable-next-line sonarjs/pseudo-random
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export type AsyncLogFunction = (text: string, options?: LogOptions & { delayMs?: number }) => Promise<void>;

export interface LogOptions {
  prefix?: string;
  prefixColor?: string;
  sessionId?: string;
  status?: LogStatus;
  style?: LogStyle;
}

export type SyncLogFunction = (text: string, options?: LogOptions) => void;

export const systemLog: SyncLogFunction = (text: string, options?: LogOptions): void => {
  const { addLog, currentSessionId } = useTerminal.getState();

  if (options?.sessionId === undefined) {
    console.log(`Message: ${text}: Unknown session id. Using defaults.`);
  }

  const logItem: GeneralLog = {
    content: {
      prefix: options?.prefix,
      prefixColor: options?.prefixColor,
      style: options?.style ?? "default",
      text,
      type: "text",
    },
    id: crypto.randomUUID(),
    status: options?.status ?? "default",
  };

  addLog(logItem, options?.sessionId ?? currentSessionId);
};

export const messageTextLog = (text: string, sender: "Peer" | "You", chatNickname: string): void => {
  const { addMessage } = useIdentityStore.getState();

  const message: SavedMessage = {
    id: crypto.randomUUID(),
    sender,
    text: text,
    timestamp: Date.now(),
    type: "text",
  };

  addMessage(chatNickname, message);
};
export const messageMediaLog = (fileId: string, sender: "Peer" | "You", chatNickname: string, type: "image" | "other" | "video", thumbnail: string): void => {
  const { addMessage } = useIdentityStore.getState();

  if (type === "other") {
    console.error("Unknown file type. Cannot display.");
    return;
  }

  const message: SavedMessage = {
    fileId,
    id: crypto.randomUUID(),
    sender,
    thumbnail,
    timestamp: Date.now(),
    type: type,
  };

  addMessage(chatNickname, message);
};

export const delayedSystemLog = async (text: string, options?: LogOptions & { delayMs?: number }): Promise<void> => {
  await wait(options?.delayMs ?? getRandomDelay(500, 1000));
  systemLog(text, { ...options, sessionId: options?.sessionId });
};

export const chatLog = (text: string, options?: LogOptions): void => {
  const { terminalSessionIds } = useIdentityStore.getState();
  systemLog(text, { ...options, sessionId: terminalSessionIds.chatTerminalId });
};
