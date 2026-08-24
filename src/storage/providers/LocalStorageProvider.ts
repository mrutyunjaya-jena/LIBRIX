import { IStorageProvider, StorageCapabilities, StorageItem, StorageQuota } from '../StorageProvider';
import { StorageProviderType } from '../../core/types';
import { IPlatformServices } from '../../platform/PlatformInterface';

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
    supportsTrash: true,
    supportsDirectStreaming: true,
    supportsSearch: true,
    supportsVersions: false,
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
    return {
      total: 512 * 1024 * 1024 * 1024, // 512 GB representation
      used: 84 * 1024 * 1024 * 1024,
      free: 428 * 1024 * 1024 * 1024,
    };
  }

  async listFiles(folderPath = ''): Promise<StorageItem[]> {
    const fullPath = folderPath ? `${this.basePath}/${folderPath}` : this.basePath;
    try {
      const files = await this.platform.fileSystem.listDirectory(fullPath);
      return files.map(f => ({
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
    } catch {
      return [];
    }
  }

  async getMetadata(itemPath: string): Promise<StorageItem> {
    const meta = await this.platform.fileSystem.getMetadata(itemPath);
    return {
      id: `local_${itemPath}`,
      name: meta.name,
      path: meta.path,
      size: meta.size,
      isDirectory: meta.isDirectory,
      mimeType: meta.mimeType,
      modifiedAt: meta.lastModified,
      providerType: 'local',
      providerId: this.id,
    };
  }

  async download(itemPath: string): Promise<Uint8Array> {
    return await this.platform.fileSystem.readFile(itemPath);
  }

  async upload(folderPath: string, filename: string, data: Uint8Array, mimeType?: string): Promise<StorageItem> {
    const targetPath = folderPath ? `${folderPath}/${filename}` : `${this.basePath}/${filename}`;
    await this.platform.fileSystem.writeFile(targetPath, data);
    return {
      id: `local_${targetPath}`,
      name: filename,
      path: targetPath,
      size: data.length,
      isDirectory: false,
      mimeType: mimeType || 'application/octet-stream',
      modifiedAt: Date.now(),
      providerType: 'local',
      providerId: this.id,
    };
  }

  async createFolder(folderPath: string, name: string): Promise<StorageItem> {
    const newPath = folderPath ? `${folderPath}/${name}` : `${this.basePath}/${name}`;
    await this.platform.fileSystem.createDirectory(newPath);
    return {
      id: `local_${newPath}`,
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
    await this.platform.fileSystem.deleteFile(itemPath);
  }

  async move(srcPath: string, destPath: string): Promise<void> {
    const data = await this.platform.fileSystem.readFile(srcPath);
    await this.platform.fileSystem.writeFile(destPath, data);
    await this.platform.fileSystem.deleteFile(srcPath);
  }

  async copy(srcPath: string, destPath: string): Promise<void> {
    const data = await this.platform.fileSystem.readFile(srcPath);
    await this.platform.fileSystem.writeFile(destPath, data);
  }

  async search(query: string): Promise<StorageItem[]> {
    const all = await this.listFiles('');
    const q = query.toLowerCase();
    return all.filter(item => item.name.toLowerCase().includes(q));
  }
}
