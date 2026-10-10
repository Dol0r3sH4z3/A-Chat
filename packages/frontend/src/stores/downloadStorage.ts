import { clear, createStore, get, keys, promisifyRequest } from "idb-keyval";

export interface SavedFileMeta {
  chatNickname: string;
  fileId: string;
  fileName: string;
  fileSizeBytes: number;
  timestamp: number;
}

const downloadStore = createStore("media-db", "media-store");

class DownloadStorageService {
  private readonly FILE_PREFIX = "file_data_";
  private readonly META_PREFIX = "file_meta_";

  public async saveFile(blob: Blob, meta: SavedFileMeta): Promise<void> {
    try {
      await downloadStore("readwrite", (store) => {
        store.put(blob, `${this.FILE_PREFIX}${meta.fileId}`);
        store.put(meta, `${this.META_PREFIX}${meta.fileId}`);
        return promisifyRequest(store.transaction);
      });
    } catch (error) {
      console.error(`Failed to save file ${meta.fileId} to IndexedDB:`, error);
      throw error;
    }
  }

  public async getFileBlob(fileId: string): Promise<Blob | null> {
    return (await get<Blob>(`${this.FILE_PREFIX}${fileId}`, downloadStore)) ?? null;
  }

  public async getAllSavedMeta(): Promise<SavedFileMeta[]> {
    const allKeys = await keys(downloadStore);
    const metaKeys = allKeys.filter((key): key is string => typeof key === "string" && key.startsWith(this.META_PREFIX));

    const metaPromises = metaKeys.map((key) => get<SavedFileMeta>(key, downloadStore));
    const metas = await Promise.all(metaPromises);

    return metas.filter((m): m is SavedFileMeta => m !== undefined);
  }

  public async deleteFile(fileId: string): Promise<void> {
    await downloadStore("readwrite", (store) => {
      store.delete(`${this.FILE_PREFIX}${fileId}`);
      store.delete(`${this.META_PREFIX}${fileId}`);
      return promisifyRequest(store.transaction);
    });
  }

  async wipe(): Promise<void> {
    await clear(downloadStore);
  }
}

export const downloadStorage = new DownloadStorageService();
