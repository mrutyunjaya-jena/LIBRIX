import { describe, it, expect } from 'vitest';
import { storageRegistry } from '../src/storage/StorageRegistry';

describe('StorageRegistry & Providers', () => {
  it('should register default multi-cloud providers with capability flags', () => {
    const providers = storageRegistry.getAllProviders();
    expect(providers.length).toBeGreaterThanOrEqual(4);

    const local = storageRegistry.getProvider('local');
    expect(local).toBeDefined();
    expect(local?.capabilities.supportsFolders).toBe(true);

    const telegram = storageRegistry.getProvider('telegram-vault');
    expect(telegram).toBeDefined();
    expect(telegram?.type).toBe('telegram');
    expect(telegram?.capabilities.supportsFolders).toBe(false); // Verified Telegram specific capability
  });

  it('should aggregate unified files across connected providers', async () => {
    const gdrive = storageRegistry.getProvider('gdrive-main');
    const telegram = storageRegistry.getProvider('telegram-vault');
    if (gdrive) await gdrive.authenticate();
    if (telegram) await telegram.authenticate();

    const files = await storageRegistry.fetchUnifiedFiles();
    expect(files.length).toBeGreaterThan(0);
    const hasGdrive = files.some(f => f.providerType === 'gdrive');
    const hasTelegram = files.some(f => f.providerType === 'telegram');
    expect(hasGdrive || hasTelegram).toBe(true);
  });
});
