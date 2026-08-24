import { IStorageProvider, StorageCapabilities, StorageItem, StorageQuota } from '../StorageProvider';
import { StorageProviderType } from '../../core/types';
import { IPlatformServices } from '../../platform/PlatformInterface';

export class MediaFireProvider implements IStorageProvider {
  readonly id: string;
  readonly type: StorageProviderType = 'mediafire';
  readonly name: string;
  private connected = true;

  readonly capabilities: StorageCapabilities = {
    supportsFolders: true,
    supportsMove: true,
    supportsCopy: true,
    supportsTrash: true,
    supportsDirectStreaming: true,
    supportsSearch: true,
    supportsVersions: false,
    maxFileSize: 10 * 1024 * 1024 * 1024,
  };

  constructor(private platform: IPlatformServices, id = 'mediafire', name = 'MediaFire') {
    this.id = id;
    this.name = name;
  }

  async authenticate(): Promise<boolean> { return this.connected = true; }
  async disconnect(): Promise<void> { this.connected = false; }
  isConnected(): boolean { return this.connected; }
  async getQuota(): Promise<StorageQuota> {
    return { total: 10 * 1024 * 1024 * 1024, used: 1.2 * 1024 * 1024 * 1024, free: 8.8 * 1024 * 1024 * 1024 };
  }
  async listFiles(): Promise<StorageItem[]> { return []; }
  async getMetadata(path: string): Promise<StorageItem> {
    return { id: path, name: path, path, size: 0, isDirectory: false, modifiedAt: Date.now(), providerType: 'mediafire', providerId: this.id };
  }
  async download(): Promise<Uint8Array> { return new Uint8Array(); }
  async upload(folder: string, name: string, data: Uint8Array): Promise<StorageItem> {
    return { id: `${folder}/${name}`, name, path: `MediaFire://${folder}/${name}`, size: data.length, isDirectory: false, modifiedAt: Date.now(), providerType: 'mediafire', providerId: this.id };
  }
  async createFolder(folder: string, name: string): Promise<StorageItem> {
    return { id: `${folder}/${name}`, name, path: `MediaFire://${folder}/${name}`, size: 0, isDirectory: true, modifiedAt: Date.now(), providerType: 'mediafire', providerId: this.id };
  }
  async delete(): Promise<void> {}
}

export class TeraBoxProvider implements IStorageProvider {
  readonly id: string;
  readonly type: StorageProviderType = 'terabox';
  readonly name: string;
  private connected = true;

  readonly capabilities: StorageCapabilities = {
    supportsFolders: true,
    supportsMove: true,
    supportsCopy: true,
    supportsTrash: true,
    supportsDirectStreaming: true,
    supportsSearch: true,
    supportsVersions: false,
    maxFileSize: 20 * 1024 * 1024 * 1024,
  };

  constructor(private platform: IPlatformServices, id = 'terabox', name = 'TeraBox') {
    this.id = id;
    this.name = name;
  }

  async authenticate(): Promise<boolean> { return this.connected = true; }
  async disconnect(): Promise<void> { this.connected = false; }
  isConnected(): boolean { return this.connected; }
  async getQuota(): Promise<StorageQuota> {
    return { total: 1024 * 1024 * 1024 * 1024, used: 24 * 1024 * 1024 * 1024, free: 1000 * 1024 * 1024 * 1024 };
  }
  async listFiles(): Promise<StorageItem[]> {
    return [
      {
        id: 'tb_rag_arch',
        name: 'Decentralized_RAG_Architecture.md',
        path: 'TeraBox://Research/RAG_Architecture.md',
        size: 142000,
        isDirectory: false,
        mimeType: 'text/markdown',
        modifiedAt: Date.now() - 14400000,
        providerType: 'terabox',
        providerId: this.id,
      }
    ];
  }
  async getMetadata(path: string): Promise<StorageItem> {
    return { id: path, name: path, path, size: 142000, isDirectory: false, modifiedAt: Date.now(), providerType: 'terabox', providerId: this.id };
  }
  async download(): Promise<Uint8Array> { return new TextEncoder().encode('# TeraBox Markdown Document Stream'); }
  async upload(folder: string, name: string, data: Uint8Array): Promise<StorageItem> {
    return { id: `${folder}/${name}`, name, path: `TeraBox://${folder}/${name}`, size: data.length, isDirectory: false, modifiedAt: Date.now(), providerType: 'terabox', providerId: this.id };
  }
  async createFolder(folder: string, name: string): Promise<StorageItem> {
    return { id: `${folder}/${name}`, name, path: `TeraBox://${folder}/${name}`, size: 0, isDirectory: true, modifiedAt: Date.now(), providerType: 'terabox', providerId: this.id };
  }
  async delete(): Promise<void> {}
}

export class CustomStorageProvider implements IStorageProvider {
  readonly id: string;
  readonly type: StorageProviderType = 'custom';
  readonly name: string;
  private endpointUrl: string;
  private connected = false;

  readonly capabilities: StorageCapabilities = {
    supportsFolders: true,
    supportsMove: true,
    supportsCopy: true,
    supportsTrash: false,
    supportsDirectStreaming: true,
    supportsSearch: true,
    supportsVersions: false,
    maxFileSize: 50 * 1024 * 1024 * 1024,
  };

  constructor(
    private platform: IPlatformServices,
    id = 'custom',
    name = 'Custom Storage',
    endpointUrl = 'https://storage.example.com/api'
  ) {
    this.id = id;
    this.name = name;
    this.endpointUrl = endpointUrl;
  }

  async authenticate(credentials?: {
    apiKey?: string;
    accessToken?: string;
    authType?: string;
  }): Promise<boolean> {
    if (credentials?.apiKey) {
      await this.platform.secureStorage.setSecret(`custom_storage_key_${this.id}`, credentials.apiKey);
    }
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    await this.platform.secureStorage.deleteSecret(`custom_storage_key_${this.id}`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getQuota(): Promise<StorageQuota> {
    return { total: 100 * 1024 * 1024 * 1024, used: 10 * 1024 * 1024 * 1024, free: 90 * 1024 * 1024 * 1024 };
  }

  async listFiles(): Promise<StorageItem[]> {
    return [];
  }

  async getMetadata(path: string): Promise<StorageItem> {
    return {
      id: path,
      name: path.split('/').pop() || path,
      path,
      size: 0,
      isDirectory: false,
      modifiedAt: Date.now(),
      providerType: 'custom',
      providerId: this.id,
    };
  }

  async download(_itemPath: string): Promise<Uint8Array> {
    return new Uint8Array();
  }

  async upload(folder: string, name: string, data: Uint8Array): Promise<StorageItem> {
    return {
      id: `custom_${Date.now()}`,
      name,
      path: `${this.endpointUrl}/${folder}/${name}`,
      size: data.length,
      isDirectory: false,
      modifiedAt: Date.now(),
      providerType: 'custom',
      providerId: this.id,
    };
  }

  async createFolder(folder: string, name: string): Promise<StorageItem> {
    return {
      id: `custom_dir_${Date.now()}`,
      name,
      path: `${this.endpointUrl}/${folder}/${name}`,
      size: 0,
      isDirectory: true,
      modifiedAt: Date.now(),
      providerType: 'custom',
      providerId: this.id,
    };
  }

  async delete(): Promise<void> {}
}
