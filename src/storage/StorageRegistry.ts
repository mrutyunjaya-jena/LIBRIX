import { IStorageProvider, StorageItem } from './StorageProvider';
import { LocalStorageProvider } from './providers/LocalStorageProvider';
import { GoogleDriveProvider } from './providers/GoogleDriveProvider';
import { TelegramStorageProvider } from './providers/TelegramStorageProvider';
import { MegaProvider } from './providers/MegaProvider';
import { TeraBoxProvider, MediaFireProvider, CustomStorageProvider } from './providers/OtherCloudProviders';
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
    const telegram = new TelegramStorageProvider(this.platform, 'telegram-vault', 'Telegram Vault');
    const mega = new MegaProvider(this.platform, 'mega-store', 'MEGA Archive');
    const terabox = new TeraBoxProvider(this.platform, 'terabox-main', 'TeraBox');
    const mediafire = new MediaFireProvider(this.platform, 'mediafire-main', 'MediaFire');

    this.registerProvider(local);
    this.registerProvider(gdrive);
    this.registerProvider(telegram);
    this.registerProvider(mega);
    this.registerProvider(terabox);
    this.registerProvider(mediafire);
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
    return this.providers.get(this.defaultProviderId) || this.providers.values().next().value!;
  }

  public setDefaultProvider(id: string): void {
    if (this.providers.has(id)) {
      this.defaultProviderId = id;
    }
  }

  public createCustomProvider(config: {
    id: string;
    name: string;
    type: StorageProviderType;
    endpointUrl?: string;
  }): IStorageProvider {
    let provider: IStorageProvider;
    if (config.type === 'gdrive') {
      provider = new GoogleDriveProvider(this.platform, config.id, config.name);
    } else if (config.type === 'telegram') {
      provider = new TelegramStorageProvider(this.platform, config.id, config.name);
    } else if (config.type === 'mega') {
      provider = new MegaProvider(this.platform, config.id, config.name);
    } else if (config.type === 'terabox') {
      provider = new TeraBoxProvider(this.platform, config.id, config.name);
    } else {
      provider = new CustomStorageProvider(this.platform, config.id, config.name, config.endpointUrl);
    }
    this.registerProvider(provider);
    return provider;
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
