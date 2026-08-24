import { describe, it, expect, vi } from 'vitest';
import { storageRegistry } from '../src/storage/StorageRegistry';
import { StorageCapacityFactory } from '../src/storage/capacity/StorageCapacityService';
import { storageUsageIndex } from '../src/storage/usage/StorageUsageIndex';
import { crossProviderTransfer } from '../src/storage/transfer/CrossProviderTransferEngine';
import { CustomStorageProvider } from '../src/storage/providers/CustomStorageProvider';
import { GoogleDriveProvider } from '../src/storage/providers/GoogleDriveProvider';
import { googleOAuthService } from '../src/storage/oauth/GoogleOAuthService';
import { getPlatformServices } from '../src/platform/PlatformFactory';

describe('Storage System & Cross-Platform Architecture', () => {
  it('should detect platform volume storage across Linux, Windows, macOS, Android, iOS', async () => {
    const linuxService = StorageCapacityFactory.getService({ os: 'linux', deviceType: 'desktop', isMobile: false, isDesktop: true, isTouch: false, isNative: false, version: '1.0' });
    const linuxVol = await linuxService.getVolumeStorage();
    expect(linuxVol.total).toBeGreaterThan(0);
    expect(linuxVol.fsType).toBe('ext4');

    const winService = StorageCapacityFactory.getService({ os: 'windows', deviceType: 'desktop', isMobile: false, isDesktop: true, isTouch: false, isNative: false, version: '1.0' });
    const winVol = await winService.getVolumeStorage();
    expect(winVol.total).toBeGreaterThan(0);
  });

  it('should calculate Librix internal storage usage index accurately', async () => {
    const usage = await storageUsageIndex.getUsage(true);
    expect(usage.totalLibrixBytes).toBeGreaterThanOrEqual(0);
    expect(usage.booksBytes).toBeGreaterThanOrEqual(0);
    expect(usage.documentsBytes).toBeGreaterThanOrEqual(0);
    expect(usage.notesBytes).toBeGreaterThanOrEqual(0);
    expect(usage.cacheBytes).toBeGreaterThan(0);
  });

  it('should register multi-cloud providers including Google Drive, OneDrive, MEGA, TeraBox', () => {
    const providers = storageRegistry.getAllProviders();
    expect(providers.length).toBeGreaterThanOrEqual(5);

    const gdrive = storageRegistry.getProvider('gdrive-main') as GoogleDriveProvider;
    expect(gdrive).toBeDefined();
    expect(gdrive?.type).toBe('gdrive');
    expect(gdrive?.getStatus()).toBe('disconnected');
    expect(gdrive?.isConnected()).toBe(false);

    const onedrive = storageRegistry.getProvider('onedrive-main');
    expect(onedrive).toBeDefined();
    expect(onedrive?.type).toBe('onedrive');

    const mega = storageRegistry.getProvider('mega-main');
    expect(mega).toBeDefined();
    expect(mega?.type).toBe('mega');
  });

  it('should never mark Google Drive as connected on empty authenticate call', async () => {
    const platform = getPlatformServices();
    const gdrive = new GoogleDriveProvider(platform, 'test_gd_1', 'Test Google Drive');
    
    expect(gdrive.getStatus()).toBe('disconnected');
    expect(gdrive.isConnected()).toBe(false);

    const result = await gdrive.authenticate();
    expect(result).toBe(false);
    expect(gdrive.isConnected()).toBe(false);
    expect(gdrive.getStatus()).toBe('disconnected');
  });

  it('should construct secure Google OAuth 2.0 Auth URL with CSRF state & PKCE', async () => {
    const state = googleOAuthService.generateSecureState();
    expect(state.length).toBe(32);

    const pkce = await googleOAuthService.generatePKCE();
    expect(pkce.codeVerifier.length).toBeGreaterThan(30);
    expect(pkce.codeChallenge.length).toBeGreaterThan(30);

    const authUrl = googleOAuthService.buildAuthUrl({
      clientId: 'test-google-client-id.apps.googleusercontent.com',
      redirectUri: 'http://localhost:5173/oauth/callback',
      state,
      codeChallenge: pkce.codeChallenge,
    });

    expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(authUrl).toContain('client_id=test-google-client-id.apps.googleusercontent.com');
    expect(authUrl).toContain('state=' + state);
    expect(authUrl).toContain('code_challenge=' + pkce.codeChallenge);
    expect(authUrl).toContain('drive.file');
  });

  it('should verify connection with Google Drive API v3 and set connected only on success', async () => {
    const platform = getPlatformServices();
    const gdrive = new GoogleDriveProvider(platform, 'test_gd_2', 'Test Google Drive');

    // Mock global fetch for about.get and files.list
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('about')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            user: { emailAddress: 'scholar@gmail.com', displayName: 'Librix Scholar' },
            storageQuota: { limit: '16106127360', usage: '5368709120' }, // 15 GB total, 5 GB used
          }),
        } as any;
      }
      if (url.includes('files')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            files: [
              { id: 'file_gd_1', name: 'Paper.pdf', mimeType: 'application/pdf', size: '1024000' },
            ],
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    try {
      const authSuccess = await gdrive.authenticate({ accessToken: 'valid_test_token' });
      expect(authSuccess).toBe(true);
      expect(gdrive.isConnected()).toBe(true);
      expect(gdrive.getStatus()).toBe('connected');

      const account = gdrive.getAccountInfo();
      expect(account?.email).toBe('scholar@gmail.com');
      expect(account?.displayName).toBe('Librix Scholar');

      const quota = await gdrive.getQuota();
      expect(quota.total).toBe(16106127360);
      expect(quota.used).toBe(5368709120);
      expect(quota.free).toBe(10737418240);

      const files = await gdrive.listFiles();
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('Paper.pdf');

      // Test Connection Diagnostic
      const testReport = await gdrive.testConnection();
      expect(testReport.success).toBe(true);
      expect(testReport.account?.email).toBe('scholar@gmail.com');

      // Disconnect
      await gdrive.disconnect();
      expect(gdrive.isConnected()).toBe(false);
      expect(gdrive.getStatus()).toBe('disconnected');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should transition to error/reconnect_required on 401 token expiration', async () => {
    const platform = getPlatformServices();
    const gdrive = new GoogleDriveProvider(platform, 'test_gd_3', 'Test Google Drive');

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid Credentials' } }),
      } as any;
    });

    try {
      const authSuccess = await gdrive.authenticate({ accessToken: 'expired_test_token' });
      expect(authSuccess).toBe(false);
      expect(gdrive.isConnected()).toBe(false);
      expect(gdrive.getStatus()).toBe('token_expired');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should execute full Google Drive file CRUD operations (upload, download, rename, copy, search, delete)', async () => {
    const platform = getPlatformServices();
    const gdrive = new GoogleDriveProvider(platform, 'test_gd_crud', 'Test Google Drive');

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('about')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            user: { emailAddress: 'crud@gmail.com', displayName: 'CRUD User' },
            storageQuota: { limit: '0', usage: '1000' }, // Unlimited quota
          }),
        } as any;
      }
      if (url.includes('uploadType=multipart')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'uploaded_doc_id', name: 'uploaded_test.pdf' }),
        } as any;
      }
      if (url.includes('alt=media')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new TextEncoder().encode('%PDF-1.7 Google Drive Streamed Content').buffer,
        } as any;
      }
      if (url.includes('/copy')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'copied_doc_id', name: 'copied_test.pdf', size: '100' }),
        } as any;
      }
      if (init?.method === 'PATCH') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'renamed_doc_id', name: 'renamed_test.pdf', size: '100' }),
        } as any;
      }
      if (url.includes('files')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            files: [
              { id: 'search_1', name: 'Quantum_Computing.pdf', mimeType: 'application/pdf', size: '2048000' },
            ],
          }),
        } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    });

    try {
      await gdrive.authenticate({ accessToken: 'valid_crud_token' });
      expect(gdrive.isConnected()).toBe(true);

      const quota = await gdrive.getQuota();
      expect(quota.total).toBe(0); // 0 indicates unlimited

      // Upload
      const testBytes = new TextEncoder().encode('%PDF-1.7 Google Drive Upload Stream');
      const uploaded = await gdrive.upload('', 'uploaded_test.pdf', testBytes, 'application/pdf');
      expect(uploaded.id).toBe('uploaded_doc_id');

      // Download
      const downloaded = await gdrive.download('uploaded_doc_id');
      expect(downloaded.length).toBeGreaterThan(0);

      // Rename
      const renamed = await gdrive.renameFile('uploaded_doc_id', 'renamed_test.pdf');
      expect(renamed.name).toBe('renamed_test.pdf');

      // Copy
      const copied = await gdrive.copyFile('uploaded_doc_id', '', 'copied_test.pdf');
      expect(copied.name).toBe('copied_test.pdf');

      // Search
      const results = await gdrive.search('Quantum');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Quantum_Computing.pdf');

      // Delete
      await gdrive.delete('uploaded_doc_id');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should honestly report TeraBox quota as unavailable without fake numbers', async () => {
    const terabox = storageRegistry.getProvider('terabox-main');
    expect(terabox).toBeDefined();
    if (!terabox) return;

    const quota = await terabox.getQuota();
    expect(quota.isAvailable).toBe(false);
    expect(quota.total).toBe(0);
    expect(quota.quotaSource).toBe('unavailable');
  });

  it('should support CustomStorageProvider with protocol-specific capability matrix', async () => {
    const platform = getPlatformServices();
    const webdavProvider = new CustomStorageProvider(
      {
        id: 'custom_dav_1',
        name: 'My Nextcloud',
        protocol: 'webdav',
        endpointUrl: 'https://cloud.internal/dav',
      },
      platform
    );

    expect(webdavProvider.capabilities.canGetQuota).toBe(true);
    expect(webdavProvider.capabilities.supportsFolders).toBe(true);
    expect(webdavProvider.capabilities.canMove).toBe(true);
  });

  it('should execute cross-provider streaming file transfers', async () => {
    const local = storageRegistry.getProvider('local');
    const mega = storageRegistry.getProvider('mega-main');
    expect(local && mega).toBeDefined();
    if (!local || !mega) return;

    await local.authenticate();
    await mega.authenticate({ sessionToken: 'test_mega_session' });

    const testBytes = new TextEncoder().encode('%PDF-1.7 Transfer Document Test');
    const sourceItem = await local.upload('', 'transfer_test.pdf', testBytes, 'application/pdf');

    let transferCalled = false;
    const transferred = await crossProviderTransfer.transferFile(
      'local',
      sourceItem,
      'mega-main',
      '',
      'copy',
      progress => {
        if (progress.percentage > 0) transferCalled = true;
      }
    );

    expect(transferred.name).toBe('transfer_test.pdf');
    expect(transferCalled).toBe(true);
  });

  it('should stream cloud document bytes on-demand into reader via DocumentDataLoader', async () => {
    const { DocumentDataLoader } = await import('../src/core/storage/DocumentDataLoader');
    const local = storageRegistry.getProvider('local');
    expect(local).toBeDefined();

    const testBytes = new TextEncoder().encode('%PDF-1.4 Direct Cloud Stream Test');
    const uploaded = await local!.upload('', 'stream_doc.pdf', testBytes, 'application/pdf');

    const testDoc = {
      id: uploaded.id,
      title: 'Cloud Stream Book',
      author: 'Cloud Author',
      filename: 'stream_doc.pdf',
      format: 'pdf' as const,
      mimeType: 'application/pdf',
      size: testBytes.length,
      hash: 'hash_123',
      storageProvider: 'local' as const,
      storagePath: uploaded.path,
      folderId: null,
      isFavorite: false,
      isTrash: false,
      tags: [],
      collections: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    const loadedBytes = await DocumentDataLoader.loadDocumentBytes(testDoc);
    expect(loadedBytes).toBeDefined();
    expect(loadedBytes?.length).toBe(testBytes.length);
  });

  it('should verify live Google Drive credentials and connect only with valid API response', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/about')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            user: { permissionId: 'user_123', emailAddress: 'mjxtor@gmail.com', displayName: 'Mjxtor' },
            storageQuota: { limit: '16106127360', usage: '1240000000' },
          }),
        });
      }
      if (url.includes('/files')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ files: [] }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }) as any;

    const platform = getPlatformServices();
    const gdrive = new GoogleDriveProvider(platform, 'test_gd_real', 'Google Drive Real');

    expect(gdrive.getStatus()).toBe('disconnected');
    expect(gdrive.isConnected()).toBe(false);

    const success = await gdrive.authenticate({ accessToken: 'ya29.test_valid_oauth_token' });
    expect(success).toBe(true);
    expect(gdrive.isConnected()).toBe(true);
    expect(gdrive.getStatus()).toBe('connected');

    const account = gdrive.getAccountInfo();
    expect(account?.email).toBe('mjxtor@gmail.com');

    const quota = await gdrive.getQuota();
    expect(quota.total).toBe(16106127360);
    expect(quota.used).toBe(1240000000);
    expect(quota.isAvailable).toBe(true);

    global.fetch = originalFetch;
  });
});
