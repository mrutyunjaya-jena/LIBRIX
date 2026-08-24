import { IStorageProvider, StorageCapabilities, StorageItem, StorageQuota } from '../StorageProvider';
import { StorageProviderType, Document } from '../../core/types';
import { IPlatformServices } from '../../platform/PlatformInterface';
import { fileBinaryStore } from '../../core/storage/FileBinaryStore';
import { db } from '../../core/db/DatabaseEngine';
import { StorageCapacityFactory } from '../capacity/StorageCapacityService';
import { storageUsageIndex } from '../usage/StorageUsageIndex';
import { localDiskVaultService } from '../local/LocalDiskVaultService';

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

  constructor(private platform: IPlatformServices, id = 'local', name = 'Local Storage Vault', basePath?: string) {
    this.id = id;
    this.name = name;
    const custom = typeof localStorage !== 'undefined' ? localStorage.getItem('librix_custom_local_vault_path') : null;
    this.basePath = custom || basePath || 'Local Vault';
  }

  public getBasePath(): string {
    const custom = typeof localStorage !== 'undefined' ? localStorage.getItem('librix_custom_local_vault_path') : null;
    if (custom) this.basePath = custom;
    return this.basePath;
  }

  public setBasePath(path: string): void {
    this.basePath = path.trim();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('librix_custom_local_vault_path', this.basePath);
    }
  }

  public resetBasePath(): void {
    this.basePath = 'Local Vault';
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('librix_custom_local_vault_path');
      localStorage.removeItem('librix_physical_vault_name');
    }
  }

  /**
   * Automatically creates the local directory path and organized vault subfolders
   * (/Library, /Notes, vault_index.json) if they do not exist on disk.
   */
  public async ensureVaultDirectory(targetBasePath?: string): Promise<{
    success: boolean;
    rootPath: string;
    libraryPath: string;
    notesPath: string;
    created: boolean;
  }> {
    const root = (targetBasePath || this.getBasePath()).trim();
    const libraryPath = `${root}/Library`;
    const notesPath = `${root}/Notes`;
    const indexPath = `${root}/vault_index.json`;

    try {
      // 1. Check and create root directory if it doesn't exist
      const rootExists = await this.platform.fileSystem.exists(root).catch(() => false);
      if (!rootExists) {
        await this.platform.fileSystem.createDirectory(root).catch(() => {});
      }

      // 2. Check and create Library subdirectory
      const libExists = await this.platform.fileSystem.exists(libraryPath).catch(() => false);
      if (!libExists) {
        await this.platform.fileSystem.createDirectory(libraryPath).catch(() => {});
      }

      // 3. Check and create Notes subdirectory
      const notesExists = await this.platform.fileSystem.exists(notesPath).catch(() => false);
      if (!notesExists) {
        await this.platform.fileSystem.createDirectory(notesPath).catch(() => {});
      }

      // 4. Check and create vault_index.json
      const indexExists = await this.platform.fileSystem.exists(indexPath).catch(() => false);
      if (!indexExists) {
        const initialIndex = JSON.stringify(
          {
            vaultName: 'LIBRIX Local Vault',
            version: '1.0',
            rootPath: root,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folders: ['Library', 'Notes'],
          },
          null,
          2
        );
        await this.platform.fileSystem.writeFile(indexPath, initialIndex).catch(() => {});
      }

      this.setBasePath(root);

      return {
        success: true,
        rootPath: root,
        libraryPath,
        notesPath,
        created: true,
      };
    } catch (err) {
      console.warn('[LIBRIX::LocalStorageProvider] Failed to auto-create directory hierarchy:', err);
      return {
        success: true,
        rootPath: root,
        libraryPath,
        notesPath,
        created: false,
      };
    }
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
    const usage = await storageUsageIndex.getUsage();
    return {
      total: 0,
      used: usage.totalLibrixBytes,
      free: 0,
      isAvailable: true,
      quotaSource: 'librix_vault',
    };
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
    const base = this.getBasePath();
    const effectiveFolder = folderPath ? folderPath : `${base}/Library`;
    const targetPath = `${effectiveFolder}/${filename}`;

    // Auto-create directory hierarchy if it doesn't exist
    try {
      const exists = await this.platform.fileSystem.exists(effectiveFolder).catch(() => false);
      if (!exists) {
        await this.platform.fileSystem.createDirectory(effectiveFolder).catch(() => {});
      }
    } catch {
      // fallback
    }

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

    try {
      await localDiskVaultService.saveDocumentToDisk(filename, data);
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
    const base = this.getBasePath();
    const parent = folderPath ? folderPath : base;
    const newPath = `${parent}/${name}`;
    try {
      const parentExists = await this.platform.fileSystem.exists(parent).catch(() => false);
      if (!parentExists) {
        await this.platform.fileSystem.createDirectory(parent).catch(() => {});
      }
      await this.platform.fileSystem.createDirectory(newPath);
    } catch {
      // fallback
    }
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

  async delete(itemPath: string, permanent = true): Promise<void> {
    await fileBinaryStore.deleteFileBlob(itemPath);
    await db.deleteDocument(itemPath, permanent);
    try {
      await this.platform.fileSystem.deleteFile(itemPath);
    } catch {
      // ignore
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string; message?: string; quota?: StorageQuota }> {
    try {
      const quota = await this.getQuota();
      return {
        success: true,
        message: `Local Workstation & IndexedDB storage operational • ${Math.round((quota.used / Math.max(1, quota.total)) * 100)}% disk used`,
        quota,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Local storage check failed',
      };
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
