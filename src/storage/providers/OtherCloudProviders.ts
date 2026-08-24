/**
 * LIBRIX Cloud Storage Providers — MediaFire & Legacy Re-exports
 */

import { IStorageProvider, StorageCapabilities, StorageItem, StorageQuota } from '../StorageProvider';
import { StorageProviderType } from '../../core/types';
import { IPlatformServices } from '../../platform/PlatformInterface';

export { TeraBoxProvider } from './TeraBoxProvider';
export { CustomStorageProvider } from './CustomStorageProvider';
export { MegaProvider } from './MegaProvider';
export { OneDriveProvider } from './OneDriveProvider';

export class MediaFireProvider implements IStorageProvider {
  readonly id: string;
  readonly type: StorageProviderType = 'mediafire';
  readonly name: string;
  private connected = false;

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
    maxFileSize: 10 * 1024 * 1024 * 1024,
  };

  constructor(private platform: IPlatformServices, id = 'mediafire', name = 'MediaFire') {
    this.id = id;
    this.name = name;
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
      total: 10 * 1024 * 1024 * 1024,
      used: 0,
      free: 10 * 1024 * 1024 * 1024,
      isAvailable: true,
      quotaSource: 'api',
    };
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
      providerType: 'mediafire',
      providerId: this.id,
    };
  }

  async download(): Promise<Uint8Array> {
    return new Uint8Array();
  }

  async upload(folder: string, name: string, data: Uint8Array): Promise<StorageItem> {
    return {
      id: `${folder}/${name}`,
      name,
      path: `mediafire://${folder}/${name}`,
      size: data.length,
      isDirectory: false,
      modifiedAt: Date.now(),
      providerType: 'mediafire',
      providerId: this.id,
    };
  }

  async createFolder(folder: string, name: string): Promise<StorageItem> {
    return {
      id: `${folder}/${name}`,
      name,
      path: `mediafire://${folder}/${name}`,
      size: 0,
      isDirectory: true,
      modifiedAt: Date.now(),
      providerType: 'mediafire',
      providerId: this.id,
    };
  }

  async delete(): Promise<void> {}
}
