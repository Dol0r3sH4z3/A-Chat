import type { ServerMessage } from "@a-chat/shared";

interface BufferedEntry {
  message: ServerMessage;
  timestamp: number;
}

class OfflineMessageBuffer {
  private _buffers = new Map<string, BufferedEntry[]>();

  private readonly MESSAGES_PER_USER = 500;
  private readonly MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  add(nickname: string, message: ServerMessage): void {
    const queue = this._buffers.get(nickname) ?? [];
    queue.push({ message, timestamp: Date.now() });

    while (queue.length > this.MESSAGES_PER_USER) {
      queue.shift();
    }

    this._buffers.set(nickname, queue);
  }

  flush(nickname: string): ServerMessage[] {
    const queue = this._buffers.get(nickname);
    if (!queue) return [];

    this._buffers.delete(nickname);

    return queue.filter((entry) => Date.now() - entry.timestamp < this.MAX_AGE_MS).map((entry) => entry.message);
  }
}

export const offlineBuffer = new OfflineMessageBuffer();
