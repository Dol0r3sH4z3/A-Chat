import { create } from "zustand";

import type { DownloadSession, DownloadStatus, FileChunk } from "@/types/files.ts";

interface DownloadsStoreProperties {
  activeDownloads: Record<string, DownloadSession | undefined>;
  addChunk: (fileId: string, chunk: FileChunk) => void;
  clearDownload: (fileId: string) => void;
  setBlob: (fileId: string, blob: Blob) => void;
  setDownloadStatus: (fileId: string, status: DownloadStatus) => void;
  startDownload: (fileId: string, fileName: string, size: number, fileMasterKey: CryptoKey, chatNickname: string) => void;
}

export const useDownloadsStore = create<DownloadsStoreProperties>((set) => ({
  activeDownloads: {},

  addChunk: (fileId, chunk): void => {
    set((state) => {
      const currentDownload = state.activeDownloads[fileId];
      if (!currentDownload) return state;

      const chunkCopy = new Uint8Array(chunk.data.byteLength);
      chunkCopy.set(new Uint8Array(chunk.data));

      return {
        activeDownloads: {
          ...state.activeDownloads,
          [fileId]: {
            ...currentDownload,
            chunks: {
              ...currentDownload.chunks,
              [chunk.index]: chunkCopy,
            },
          },
        },
      };
    });
  },
  clearDownload: (fileId): void => {
    set((state) => {
      // eslint-disable-next-line sonarjs/no-unused-vars
      const { [fileId]: _removed, ...rest } = state.activeDownloads;
      return {
        activeDownloads: rest,
      };
    });
  },
  setBlob: (fileId, blob): void => {
    set((state) => {
      const currentSession = state.activeDownloads[fileId];
      if (!currentSession) return state;

      return {
        activeDownloads: {
          ...state.activeDownloads,
          [fileId]: {
            ...currentSession,
            fileBlob: blob,
          },
        },
      };
    });
  },
  setDownloadStatus: (fileId, status): void => {
    set((state) => {
      const currentSession = state.activeDownloads[fileId];
      if (!currentSession) return state;

      const updatedSession: DownloadSession =
        status === "ready"
          ? {
              ...currentSession,
              chunks: {},
              status,
            }
          : { ...currentSession, status };

      return {
        activeDownloads: {
          ...state.activeDownloads,
          [fileId]: updatedSession,
        },
      };
    });
  },
  startDownload: (fileId, fileName, size, fileMasterKey, chatNickname): void => {
    set((state) => ({
      activeDownloads: {
        ...state.activeDownloads,
        [fileId]: {
          chatNickname,
          chunks: {},
          fileBlob: null,
          fileMasterKey,
          fileName,
          fileSizeBytes: size,
          status: "downloading",
        },
      },
    }));
  },
}));
