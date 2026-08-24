import { IStorageProvider, StorageCapabilities, StorageItem, StorageQuota } from '../StorageProvider';
import { StorageProviderType, Document } from '../../core/types';
import { IPlatformServices } from '../../platform/PlatformInterface';
import { fileBinaryStore } from '../../core/storage/FileBinaryStore';
import { db } from '../../core/db/DatabaseEngine';
import { StorageCapacityFactory } from '../capacity/StorageCapacityService';
import { storageUsageIndex } from '../usage/StorageUsageIndex';

export class LocalStorageProvider implements IStorageProvider {
  readonly id: string;
  readonly type: StorageProviderType = 'local';
  readonly name: string;
  private basePath: string;
  private connected = true;

  readonly capabilities: StorageCapabilities = {
    supportsFolders: true,
    supportsMove: true,
    supportsCopy: true,
    supportsRename: true,
    supportsTrash: true,
    supportsDirectStreaming: true,
    supportsSearch: true,
    supportsVersions: false,
    canUpload: true,
    canDownload: true,
    canMove: true,
    canCopy: true,
    canRename: true,
    canDelete: true,
    canTrash: true,
    canSearch: true,
    canGetQuota: true,
    canSync: true,
    canServerSideCopy: true,
    maxFileSize: Number.MAX_SAFE_INTEGER,
  };

  constructor(private platform: IPlatformServices, id = 'local', name = 'Local Device Storage', basePath = '/library') {
    this.id = id;
    this.name = name;
    this.basePath = basePath;
  }

  async authenticate(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getQuota(): Promise<StorageQuota> {
    try {
      const capacityService = StorageCapacityFactory.getService(this.platform.platform);
      const volumeInfo = await capacityService.getVolumeStorage(this.basePath);
      const usage = await storageUsageIndex.getUsage();

      const total = volumeInfo.total;
      const used = Math.max(usage.totalLibrixBytes, volumeInfo.used);
      const free = Math.max(0, total - used);

      return {
        total,
        used,
        free,
        isAvailable: true,
        quotaSource: 'filesystem',
      };
    } catch (err) {
      console.warn('LocalStorageProvider getQuota error:', err);
      const usage = await storageUsageIndex.getUsage();
      const total = 100 * 1024 * 1024 * 1024;
      return {
        total,
        used: usage.totalLibrixBytes,
        free: total - usage.totalLibrixBytes,
        isAvailable: true,
        quotaSource: 'filesystem',
      };
    }
  }

  async listFiles(folderPath = ''): Promise<StorageItem[]> {
    try {
      // 1. Check native filesystem if available
      const nativeFiles = await this.platform.fileSystem.listDirectory(folderPath ? `${this.basePath}/${folderPath}` : this.basePath);
      if (nativeFiles && nativeFiles.length > 0) {
        return nativeFiles.map(f => ({
          id: `local_${f.path}`,
          name: f.name,
          path: f.path,
          size: f.size,
          isDirectory: f.isDirectory,
          mimeType: f.mimeType,
          modifiedAt: f.lastModified,
          providerType: 'local',
          providerId: this.id,
        }));
      }
    } catch {
      // fallback to indexedDB database
    }

    // 2. Query IndexedDB document vault
    const docs = await db.getDocuments();
    return docs
      .filter((d: Document) => !d.isTrash)
      .map((d: Document) => ({
        id: d.id,
        name: d.filename || d.title,
        path: d.storagePath || `/library/${d.filename}`,
        size: d.size,
        isDirectory: false,
        mimeType: d.mimeType,
        modifiedAt: d.modifiedAt,
        providerType: 'local',
        providerId: this.id,
      }));
  }

  async getMetadata(itemPath: string): Promise<StorageItem> {
    try {
      const meta = await this.platform.fileSystem.getMetadata(itemPath);
      return {
        id: `local_${meta.path}`,
        name: meta.name,
        path: meta.path,
        size: meta.size,
        isDirectory: meta.isDirectory,
        mimeType: meta.mimeType,
        modifiedAt: meta.lastModified,
        providerType: 'local',
        providerId: this.id,
      };
    } catch {
      const doc = await db.getDocumentById(itemPath);
      if (doc) {
        return {
          id: doc.id,
          name: doc.filename,
          path: doc.storagePath,
          size: doc.size,
          isDirectory: false,
          mimeType: doc.mimeType,
          modifiedAt: doc.modifiedAt,
          providerType: 'local',
          providerId: this.id,
        };
      }
      throw new Error(`File not found: ${itemPath}`);
    }
  }

  async download(itemPath: string): Promise<Uint8Array> {
    // 1. Try fileBinaryStore directly by docId
    const directBytes = await fileBinaryStore.getFileBytes(itemPath);
    if (directBytes && directBytes.length > 0) {
      return directBytes;
    }

    // 2. Query database by path or filename match
    try {
      const docs = await db.getDocuments();
      const match = docs.find(d => d.id === itemPath || d.storagePath === itemPath || d.filename === itemPath);
      if (match) {
        const bytes = await fileBinaryStore.getFileBytes(match.id);
        if (bytes && bytes.length > 0) return bytes;
      }
    } catch {
      // fallback
    }

    // 3. Try native platform filesystem
    try {
      return await this.platform.fileSystem.readFile(itemPath);
    } catch {
      // fallback
    }

    return new Uint8Array();
  }

  async upload(folderPath: string, filename: string, data: Uint8Array, mimeType?: string): Promise<StorageItem> {
    const docId = `doc_local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const resolvedMime = mimeType || 'application/octet-stream';
    const targetPath = folderPath ? `${folderPath}/${filename}` : `${this.basePath}/${filename}`;

    // Save binary payload
    await fileBinaryStore.saveFileBlob(docId, data, resolvedMime, filename);

    // Save metadata
    const doc: Document = {
      id: docId,
      title: filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
      author: 'Local Document',
      filename,
      format: (filename.split('.').pop()?.toLowerCase() || 'unknown') as any,
      mimeType: resolvedMime,
      size: data.length,
      hash: 'hash_' + Date.now(),
      storageProvider: 'local',
      storagePath: targetPath,
      folderId: null,
      isFavorite: false,
      isTrash: false,
      tags: ['Local'],
      collections: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveDocument(doc);

    try {
      await this.platform.fileSystem.writeFile(targetPath, data);
    } catch {
      // fallback
    }

    return {
      id: docId,
      name: filename,
      path: targetPath,
      size: data.length,
      isDirectory: false,
      mimeType: resolvedMime,
      modifiedAt: Date.now(),
      providerType: 'local',
      providerId: this.id,
    };
  }

  async createFolder(folderPath: string, name: string): Promise<StorageItem> {
    const newPath = folderPath ? `${folderPath}/${name}` : `${this.basePath}/${name}`;
    await this.platform.fileSystem.createDirectory(newPath);
    return {
      id: `local_folder_${Date.now()}`,
      name,
      path: newPath,
      size: 0,
      isDirectory: true,
      modifiedAt: Date.now(),
      providerType: 'local',
      providerId: this.id,
    };
  }

  async delete(itemPath: string, _permanent = false): Promise<void> {
    await fileBinaryStore.deleteFileBlob(itemPath);
    await db.deleteDocument(itemPath);
    try {
      await this.platform.fileSystem.deleteFile(itemPath);
    } catch {
      // ignore
    }
  }

  async move(srcPath: string, destPath: string): Promise<void> {
    const data = await this.download(srcPath);
    const filename = destPath.split('/').pop() || 'file';
    await this.upload('', filename, data);
    await this.delete(srcPath);
  }

  async copy(srcPath: string, destPath: string): Promise<void> {
    const data = await this.download(srcPath);
    const filename = destPath.split('/').pop() || 'file';
    await this.upload('', filename, data);
  }

  async search(query: string): Promise<StorageItem[]> {
    const all = await this.listFiles('');
    const q = query.toLowerCase();
    return all.filter(item => item.name.toLowerCase().includes(q));
  }
}
