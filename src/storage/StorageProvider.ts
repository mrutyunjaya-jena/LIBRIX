/**
 * LIBRIX Storage Provider Subsystem
 * Abstract interface for local & multi-cloud storage backends.
 */

import { StorageProviderType } from '../core/types';

export interface StorageCapabilities {
  supportsFolders: boolean;
  supportsMove: boolean;
  supportsCopy: boolean;
  supportsRename: boolean;
  supportsTrash: boolean;
  supportsDirectStreaming: boolean;
  supportsSearch: boolean;
  supportsVersions: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canMove: boolean;
  canCopy: boolean;
  canRename: boolean;
  canDelete: boolean;
  canTrash: boolean;
  canSearch: boolean;
  canGetQuota: boolean;
  canSync: boolean;
  canServerSideCopy: boolean;
  maxFileSize: number; // In bytes (e.g. 2GB / 50GB / 5TB)
}

export interface StorageItem {
  id: string;
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  mimeType?: string;
  modifiedAt: number;
  providerType: StorageProviderType;
  providerId: string;
}

export interface StorageQuota {
  total: number;       // In bytes, 0 if unavailable OR unlimited (see `unlimited`)
  used: number;        // In bytes
  free: number;        // In bytes, 0 when unknown/unlimited
  isAvailable: boolean;// True if live API quota was retrieved, false if unavailable
  quotaSource?: 'api' | 'filesystem' | 'unavailable';
  unlimited?: boolean; // True when provider reports no finite limit
  usageInDrive?: number;      // Bytes used inside My Drive (Google)
  usageInDriveTrash?: number; // Bytes sitting in the Drive trash (Google)
}

export interface IStorageProvider {
  readonly id: string;
  readonly type: StorageProviderType;
  readonly name: string;
  readonly capabilities: StorageCapabilities;

  authenticate(credentials?: Record<string, any>): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  getQuota(): Promise<StorageQuota>;
  listFiles(folderPath?: string): Promise<StorageItem[]>;
  getMetadata(itemPath: string): Promise<StorageItem>;
  download(itemPath: string): Promise<Uint8Array>;
  upload(folderPath: string, filename: string, data: Uint8Array, mimeType?: string): Promise<StorageItem>;
  createFolder(folderPath: string, name: string): Promise<StorageItem>;
  delete(itemPath: string, permanent?: boolean): Promise<void>;
  rename?(itemPath: string, newName: string): Promise<StorageItem>;
  move?(srcPath: string, destPath: string): Promise<void>;
  copy?(srcPath: string, destPath: string): Promise<void>;
  search?(query: string): Promise<StorageItem[]>;
}
