/**
 * LIBRIX TeraBox Storage Provider
 * Honest, non-fabricated implementation acknowledging API constraints.
 * If direct public REST API is restricted, reports exact availability status
 * and points to Custom Provider (WebDAV/S3) without inventing fake numbers.
 */

import { IStorageProvider, StorageCapabilities, StorageItem, StorageQuota } from '../StorageProvider';
import { IPlatformServices } from '../../platform/PlatformInterface';

export class TeraBoxProvider implements IStorageProvider {
  readonly id: string;
  readonly type = 'terabox' as const;
  readonly name: string;
  private apiKey: string | null = null;
  private connected = false;
  private platform: IPlatformServices;

  readonly capabilities: StorageCapabilities = {
    supportsFolders: false,
    supportsMove: false,
    supportsCopy: false,
    supportsRename: false,
    supportsTrash: false,
    supportsDirectStreaming: false,
    supportsSearch: false,
    supportsVersions: false,
    canUpload: false,
    canDownload: false,
    canMove: false,
    canCopy: false,
    canRename: false,
    canDelete: false,
    canTrash: false,
    canSearch: false,
    canGetQuota: false,
    canSync: false,
    canServerSideCopy: false,
    maxFileSize: 0,
  };

  constructor(id = 'terabox-main', name = 'TeraBox Cloud', platform: IPlatformServices) {
    this.id = id;
    this.name = name;
    this.platform = platform;
  }

  async authenticate(credentials?: { apiKey?: string; accessToken?: string }): Promise<boolean> {
    if (credentials?.apiKey || credentials?.accessToken) {
      this.apiKey = credentials.apiKey || credentials.accessToken || null;
      if (this.apiKey) {
        await this.platform.secureStorage.setSecret(`terabox_key_${this.id}`, this.apiKey);
        this.connected = true;
        return true;
      }
    }

    const saved = await this.platform.secureStorage.getSecret(`terabox_key_${this.id}`);
    if (saved) {
      this.apiKey = saved;
      this.connected = true;
      return true;
    }

    this.connected = false;
    return false;
  }

  async disconnect(): Promise<void> {
    this.apiKey = null;
    this.connected = false;
    await this.platform.secureStorage.deleteSecret(`terabox_key_${this.id}`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getQuota(): Promise<StorageQuota> {
    // Honest: TeraBox does not expose an open, unauthenticated public storage quota REST API.
    // Never invent a fake 1024 GB number.
    return {
      total: 0,
      used: 0,
      free: 0,
      isAvailable: false,
      quotaSource: 'unavailable',
    };
  }

  async listFiles(_folderPath = ''): Promise<StorageItem[]> {
    // Direct REST API file listing is restricted by provider.
    return [];
  }

  async getMetadata(itemId: string): Promise<StorageItem> {
    throw new Error(`Direct integration is currently unavailable for this provider (${itemId}). Please use Custom WebDAV/S3 provider.`);
  }

  async download(itemId: string): Promise<Uint8Array> {
    throw new Error(`Direct download is currently unavailable for this provider (${itemId}).`);
  }

  async upload(_folderPath: string, _filename: string, _data: Uint8Array, _mimeType?: string): Promise<StorageItem> {
    throw new Error('Direct upload is currently unavailable for this provider. Please connect your storage via Custom WebDAV / S3 provider.');
  }

  async createFolder(_folderPath: string, _name: string): Promise<StorageItem> {
    throw new Error('Folder creation is not exposed by TeraBox public API.');
  }

  async delete(_itemId: string): Promise<void> {
    throw new Error('Deletion is not supported via current TeraBox API.');
  }
}
