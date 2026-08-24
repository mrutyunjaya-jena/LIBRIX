import { IStorageProvider, StorageItem } from './StorageProvider';
import { LocalStorageProvider } from './providers/LocalStorageProvider';
import { GoogleDriveProvider } from './providers/GoogleDriveProvider';
import { OneDriveProvider } from './providers/OneDriveProvider';
import { MegaProvider } from './providers/MegaProvider';
import { TeraBoxProvider } from './providers/TeraBoxProvider';
import { TelegramStorageProvider } from './providers/TelegramStorageProvider';
import { CustomStorageProvider, CustomProtocolType } from './providers/CustomStorageProvider';
import { IPlatformServices } from '../platform/PlatformInterface';
import { getPlatformServices } from '../platform/PlatformFactory';
import { StorageProviderType } from '../core/types';

export class StorageRegistry {
  private static instance: StorageRegistry | null = null;
  private providers = new Map<string, IStorageProvider>();
  private defaultProviderId = 'local';
  private platform: IPlatformServices;

  private constructor() {
    this.platform = getPlatformServices();
    this.registerDefaultProviders();
  }

  public static getInstance(): StorageRegistry {
    if (!StorageRegistry.instance) {
      StorageRegistry.instance = new StorageRegistry();
    }
    return StorageRegistry.instance;
  }

  private registerDefaultProviders(): void {
    const local = new LocalStorageProvider(this.platform, 'local', 'Local Storage');
    const gdrive = new GoogleDriveProvider(this.platform, 'gdrive-main', 'Google Drive');

    this.registerProvider(local);
    this.registerProvider(gdrive);
  }

  public registerProvider(provider: IStorageProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): IStorageProvider | undefined {
    return this.providers.get(id);
  }

  public getAllProviders(): IStorageProvider[] {
    return Array.from(this.providers.values());
  }

  public getDefaultProvider(): IStorageProvider {
    const persisted = typeof localStorage !== 'undefined' ? localStorage.getItem('librix_default_storage_provider') : null;
    if (persisted) {
      const match = this.providers.get(persisted) || Array.from(this.providers.values()).find(p => p.id === persisted || p.type === persisted);
      if (match) return match;
    }
    return this.providers.get(this.defaultProviderId) || this.providers.values().next().value!;
  }

  public setDefaultProvider(id: string): void {
    const match = this.providers.get(id) || Array.from(this.providers.values()).find(p => p.id === id || p.type === id);
    if (match) {
      this.defaultProviderId = match.id;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('librix_default_storage_provider', match.id);
      }
    }
  }

  public createCustomProvider(config: {
    id: string;
    name: string;
    type: StorageProviderType;
    protocol?: CustomProtocolType;
    endpointUrl?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    bucket?: string;
    region?: string;
  }): IStorageProvider {
    let provider: IStorageProvider;
    if (config.type === 'gdrive') {
      provider = new GoogleDriveProvider(this.platform, config.id, config.name);
    } else if (config.type === 'onedrive') {
      provider = new OneDriveProvider(config.id, config.name, this.platform);
    } else if (config.type === 'mega') {
      provider = new MegaProvider(config.id, config.name, this.platform);
    } else if (config.type === 'terabox') {
      provider = new TeraBoxProvider(config.id, config.name, this.platform);
    } else if (config.type === 'telegram') {
      provider = new TelegramStorageProvider(this.platform, config.id, config.name);
    } else {
      provider = new CustomStorageProvider(
        {
          id: config.id,
          name: config.name,
          protocol: config.protocol || 'webdav',
          endpointUrl: config.endpointUrl || 'https://storage.internal/dav',
          username: config.username,
          password: config.password,
          apiKey: config.apiKey,
          bucket: config.bucket,
          region: config.region,
        },
        this.platform
      );
    }
    this.registerProvider(provider);
    return provider;
  }

  public async initializeFromDatabase(): Promise<void> {
    try {
      const { db } = await import('../core/db/DatabaseEngine');
      const connections = await db.getCloudConnections();
      for (const conn of connections) {
        let provider = this.getProvider(conn.id);
        const cfg = conn.config || {};
        if (!provider) {
          provider = this.createCustomProvider({
            id: conn.id,
            name: conn.name,
            type: conn.providerType,
            apiKey: cfg.apiKey || cfg.token,
            endpointUrl: cfg.endpointUrl,
            username: cfg.username,
            password: cfg.password,
          });
        }
        if (provider && !provider.isConnected()) {
          const directToken = cfg.apiKey || cfg.token;
          if (directToken) {
            await provider.authenticate({ accessToken: directToken }).catch(() => {});
          } else if (typeof (provider as any).restoreSession === 'function') {
            await (provider as any).restoreSession().catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('StorageRegistry initializeFromDatabase error:', err);
    }
  }

  public async fetchUnifiedFiles(): Promise<StorageItem[]> {
    const results: StorageItem[] = [];
    for (const provider of this.providers.values()) {
      if (provider.isConnected()) {
        try {
          const files = await provider.listFiles();
          results.push(...files);
        } catch (e) {
          console.warn(`Failed to list files for provider ${provider.name}:`, e);
        }
      }
    }
    return results;
  }
}

export const storageRegistry = StorageRegistry.getInstance();
