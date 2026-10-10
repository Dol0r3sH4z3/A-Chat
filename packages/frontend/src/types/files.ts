export interface DownloadSession {
  chatNickname: string;
  chunks: Record<number, Uint8Array<ArrayBuffer>>;
  fileBlob: Blob | null;
  fileMasterKey: CryptoKey;
  fileName: string;
  fileSizeBytes: number;
  status: DownloadStatus;
}
export type DownloadStatus = "downloading" | "error" | "ready";
export interface FileChunk {
  data: Uint8Array<ArrayBuffer>;
  index: number;
}
