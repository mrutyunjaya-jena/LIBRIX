/**
 * LIBRIX Platform Services Abstraction Interfaces
 * Cross-platform boundary between core application logic and OS/runtime layers.
 */

export type PlatformType = 'linux' | 'windows' | 'macos' | 'android' | 'ios' | 'web';
export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface PlatformInfo {
  os: PlatformType;
  deviceType: DeviceType;
  isMobile: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  isNative: boolean;
  version: string;
}

export interface FileMetadata {
  name: string;
  path: string;
  size: number;
  lastModified: number;
  isDirectory: boolean;
  mimeType?: string;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface IFileSystem {
  readFile(path: string): Promise<Uint8Array>;
  readTextFile(path: string): Promise<string>;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listDirectory(path: string): Promise<FileMetadata[]>;
  createDirectory(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getMetadata(path: string): Promise<FileMetadata>;
  getAppStorageDir(): Promise<string>;
}

export interface IFilePicker {
  pickDocument(filters?: FileFilter[], multiple?: boolean): Promise<Array<{ name: string; path: string; data?: Uint8Array }>>;
  pickFolder(): Promise<{ path: string; name: string } | null>;
  saveDocument(suggestedName: string, data: Uint8Array, mimeType?: string): Promise<string | null>;
}

export interface ISecureStorage {
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
}

export interface INotifications {
  show(title: string, options?: { body?: string; icon?: string }): Promise<void>;
  requestPermission(): Promise<boolean>;
}

export interface IClipboard {
  copyText(text: string): Promise<void>;
  readText(): Promise<string>;
}

export interface IShare {
  canShare(): boolean;
  shareText(title: string, text: string, url?: string): Promise<void>;
  shareFile(name: string, data: Uint8Array, mimeType: string): Promise<void>;
}

export interface INetwork {
  isOnline(): boolean;
  onNetworkChange(callback: (online: boolean) => void): () => void;
}

export interface IPlatformServices {
  readonly name?: string;
  readonly platform: PlatformInfo;
  readonly fileSystem: IFileSystem;
  readonly filePicker: IFilePicker;
  readonly secureStorage: ISecureStorage;
  readonly notifications: INotifications;
  readonly clipboard: IClipboard;
  readonly share: IShare;
  readonly network: INetwork;
}
