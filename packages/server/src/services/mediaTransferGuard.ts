interface ActiveTransfer {
  totalBytes: number;
  senderNickname: string;
  lastActivity: number;
}

class MediaTransferGuard {
  private _transfers = new Map<string, ActiveTransfer>();

  private readonly MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
  private readonly TRANSFER_TTL_MS = 10 * 60 * 1000;

  startTransfer(fileID: string, senderNickname: string): void {
    this._transfers.set(fileID, { totalBytes: 0, senderNickname, lastActivity: Date.now() });
  }

  addChunk(fileID: string, chunkBytesLength: number): boolean {
    const transfer = this._transfers.get(fileID);
    if (!transfer) return true;

    transfer.totalBytes += chunkBytesLength;
    transfer.lastActivity = Date.now();

    if (transfer.totalBytes > this.MAX_FILE_SIZE_BYTES) {
      this._transfers.delete(fileID);
      return false;
    }

    return true;
  }

  getSender(fileID: string): string | undefined {
    return this._transfers.get(fileID)?.senderNickname;
  }

  endTransfer(fileID: string): void {
    this._transfers.delete(fileID);
  }

  sweepStale(): void {
    const now = Date.now();

    for (const [fileID, transfer] of this._transfers) {
      if (now - transfer.lastActivity > this.TRANSFER_TTL_MS) {
        this._transfers.delete(fileID);
      }
    }
  }
}

export const mediaTransferGuard = new MediaTransferGuard();
