/**
 * LIBRIX Universal IndexedDB Binary Blob Storage
 * Stores actual raw EPUB, PDF, and Markdown files safely without 5MB localStorage limits.
 */

const DB_NAME = 'librix_binary_vault';
const DB_VERSION = 1;
const STORE_NAME = 'file_blobs';

export interface StoredFileRecord {
  id: string;
  data: Uint8Array;
  mimeType: string;
  name: string;
  size: number;
  updatedAt: number;
}

export class FileBinaryStore {
  private static instance: FileBinaryStore | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private objectUrlCache = new Map<string, string>();
  private memoryFallback = new Map<string, StoredFileRecord>();

  public static getInstance(): FileBinaryStore {
    if (!FileBinaryStore.instance) {
      FileBinaryStore.instance = new FileBinaryStore();
    }
    return FileBinaryStore.instance;
  }

  private hasIndexedDB(): boolean {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (!this.hasIndexedDB()) {
        reject(new Error('IndexedDB not available'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result);
      };

      request.onerror = (event: any) => {
        reject(event.target.error);
      };
    });

    return this.dbPromise;
  }

  public async saveFileBlob(
    id: string,
    data: Uint8Array,
    mimeType: string,
    name: string
  ): Promise<void> {
    const record: StoredFileRecord = {
      id,
      data,
      mimeType,
      name,
      size: data.length,
      updatedAt: Date.now(),
    };

    if (!this.hasIndexedDB()) {
      this.memoryFallback.set(id, record);
      return;
    }

    try {
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const request = store.put(record);
        request.onsuccess = () => {
          if (this.objectUrlCache.has(id)) {
            if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
              URL.revokeObjectURL(this.objectUrlCache.get(id)!);
            }
            this.objectUrlCache.delete(id);
          }
          resolve();
        };
        request.onerror = (e: any) => reject(e.target.error);
      });
    } catch {
      this.memoryFallback.set(id, record);
    }
  }

  public async getRecord(id: string): Promise<StoredFileRecord | null> {
    if (!this.hasIndexedDB()) {
      return this.memoryFallback.get(id) || null;
    }

    try {
      const db = await this.openDatabase();
      return await new Promise<StoredFileRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          resolve((request.result as StoredFileRecord | undefined) || null);
        };
        request.onerror = (e: any) => reject(e.target.error);
      });
    } catch {
      return this.memoryFallback.get(id) || null;
    }
  }

  public async getFileBytes(id: string): Promise<Uint8Array | null> {
    const record = await this.getRecord(id);
    return record ? record.data : null;
  }

  public async getFileBlob(id: string): Promise<Blob | null> {
    const record = await this.getRecord(id);
    if (!record || !record.data) return null;

    if (typeof Blob !== 'undefined') {
      return new Blob([record.data as unknown as BlobPart], {
        type: record.mimeType || 'application/octet-stream',
      });
    }
    return null;
  }

  public async getFileObjectUrl(id: string): Promise<string | null> {
    if (this.objectUrlCache.has(id)) {
      return this.objectUrlCache.get(id)!;
    }

    const blob = await this.getFileBlob(id);
    if (!blob) return null;

    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      const url = URL.createObjectURL(blob);
      this.objectUrlCache.set(id, url);
      return url;
    }
    return null;
  }

  public async deleteFileBlob(id: string): Promise<void> {
    if (this.objectUrlCache.has(id)) {
      if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(this.objectUrlCache.get(id)!);
      }
      this.objectUrlCache.delete(id);
    }

    this.memoryFallback.delete(id);

    if (!this.hasIndexedDB()) return;

    try {
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e: any) => reject(e.target.error);
      });
    } catch {
      // fallback handled
    }
  }
}

export const fileBinaryStore = FileBinaryStore.getInstance();
