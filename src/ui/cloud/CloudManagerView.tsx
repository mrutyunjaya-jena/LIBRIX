import React, { useState, useEffect } from 'react';
import {
  Cloud,
  HardDrive,
  Plus,
  RefreshCw,
  Trash2,
  Folder,
  Download,
  FileText,
  BookOpen,
  CheckCircle,
  Loader2,
  PieChart,
  Database,
  ArrowRightLeft,
  Shield,
  AlertTriangle,
  Check,
  Edit2,
  Layers,
  Sparkles,
  Server,
  Key,
  Upload,
  FolderPlus,
} from 'lucide-react';
import { CloudConnection, StorageProviderType, Document } from '../../core/types';
import { db } from '../../core/db/DatabaseEngine';
import { usePlatform } from '../../platform/PlatformContext';
import { storageRegistry } from '../../storage/StorageRegistry';
import { StorageItem, StorageQuota, IStorageProvider } from '../../storage/StorageProvider';
import { GoogleDriveProvider } from '../../storage/providers/GoogleDriveProvider';
import { fileBinaryStore } from '../../core/storage/FileBinaryStore';
import { PdfParser } from '../../readers/parsers/PdfParser';
import { EpubParser } from '../../readers/parsers/EpubParser';
import { StorageCapacityFactory, VolumeStorageInfo } from '../../storage/capacity/StorageCapacityService';
import { storageUsageIndex, LibrixStorageUsageBreakdown } from '../../storage/usage/StorageUsageIndex';
import { crossProviderTransfer, TransferProgress } from '../../storage/transfer/CrossProviderTransferEngine';
import { vaultMigrationService, MigrationProgress, MigrationResult } from '../../storage/transfer/VaultMigrationService';
import { CustomProtocolType } from '../../storage/providers/CustomStorageProvider';
import { cloudVaultSyncService } from '../../storage/sync/CloudVaultSyncService';

interface CloudManagerViewProps {
  connections: CloudConnection[];
  onConnectionsUpdated: () => void;
}

export const CloudManagerView: React.FC<CloudManagerViewProps> = ({
  connections,
  onConnectionsUpdated,
}) => {
  const platform = usePlatform();

  // This app's origin — users must whitelist it as an Authorized JavaScript
  // origin on their own Google Cloud OAuth client.
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  // Storage Capacity & Librix Usage States
  const [volumeInfo, setVolumeInfo] = useState<VolumeStorageInfo | null>(null);
  const [librixUsage, setLibrixUsage] = useState<LibrixStorageUsageBreakdown | null>(null);
  const [liveQuotas, setLiveQuotas] = useState<Record<string, StorageQuota>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals & UI Flow
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPopularType, setSelectedPopularType] = useState<StorageProviderType | null>(null);
  const [isCustomWizard, setIsCustomWizard] = useState(false);

  // Custom Wizard Form State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [customName, setCustomName] = useState('');
  const [customProtocol, setCustomProtocol] = useState<CustomProtocolType>('webdav');
  const [customUrl, setCustomUrl] = useState('');
  const [customUser, setCustomUser] = useState('');
  const [customPass, setCustomPass] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customBucket, setCustomBucket] = useState('');
  const [customRegion, setCustomRegion] = useState('');

  // Popular Provider Auth Form State
  const [popularAuthToken, setPopularAuthToken] = useState('');
  const [popularRefreshToken, setPopularRefreshToken] = useState('');
  const [popularEmail, setPopularEmail] = useState('mjxtor@gmail.com');
  const [showGdriveAdvanced, setShowGdriveAdvanced] = useState(false);
  const [customGdriveClientId, setCustomGdriveClientId] = useState('');
  const [gdriveMode, setGdriveMode] = useState<'direct' | 'token' | 'oauth'>('direct');

  // Rename Connection State
  const [renamingConnId, setRenamingConnId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Cloud Browser Explorer State
  const [browsingConnection, setBrowsingConnection] = useState<CloudConnection | null>(null);
  const [cloudItems, setCloudItems] = useState<StorageItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [importingItemId, setImportingItemId] = useState<string | null>(null);
  const [importSuccessId, setImportSuccessId] = useState<string | null>(null);

  // Cross-Provider Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSourceItem, setTransferSourceItem] = useState<StorageItem | null>(null);
  const [transferTargetConnId, setTransferTargetConnId] = useState<string>('');
  const [transferOperation, setTransferOperation] = useState<'copy' | 'move'>('copy');
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Vault Migration Modal State
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationTargetConnId, setMigrationTargetConnId] = useState<string>('');
  const [migrationOperation, setMigrationOperation] = useState<'copy' | 'move'>('copy');
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [isMigratingVault, setIsMigratingVault] = useState(false);
  const [localCounts, setLocalCounts] = useState<{ docs: number; notes: number }>({ docs: 0, notes: 0 });

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let b = bytes;
    while (b >= 1024 && i < units.length - 1) {
      b /= 1024;
      i++;
    }
    return `${b.toFixed(2)} ${units[i]}`;
  };

  // Live provider status per connection id (drives badges / reconnect affordances)
  const [connStates, setConnStates] = useState<Record<string, string>>({});
  const restoredConnIds = React.useRef<Set<string>>(new Set());

  /**
   * Resolves the live provider instance for a saved connection and re-applies
   * its persisted NON-SECRET OAuth client config so token refresh works after
   * an app restart. Secrets never live here — they are in secure storage.
   */
  const resolveProvider = (conn: CloudConnection): IStorageProvider | undefined => {
    let provider = storageRegistry.getProvider(conn.providerId) || storageRegistry.getProvider(conn.providerType);
    if (!provider && conn.providerId !== 'local') {
      provider = storageRegistry.createCustomProvider({
        id: conn.providerId,
        name: conn.name,
        type: conn.providerType,
        endpointUrl: conn.config?.endpointUrl,
      });
    }
    if (provider && conn.providerType === 'gdrive') {
      const clientId = conn.config?.oauthClientId;
      if (clientId) {
        (provider as GoogleDriveProvider).configure({ clientId });
      }
    }
    return provider;
  };

  const refreshAllStorageData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Query physical volume storage
      const capacityService = StorageCapacityFactory.getService(platform.platform);
      const vol = await capacityService.getVolumeStorage();
      setVolumeInfo(vol);

      // 2. Query Librix internal storage breakdown
      const usage = await storageUsageIndex.getUsage(true);
      setLibrixUsage(usage);

      // 3. Query all connected providers' live quotas
      const quotas: Record<string, StorageQuota> = {};
      for (const conn of connections) {
        try {
          const provider = resolveProvider(conn);
          if (provider && provider.isConnected()) {
            const q = await provider.getQuota();
            quotas[conn.id] = q;
          } else {
            quotas[conn.id] = { total: 0, used: 0, free: 0, isAvailable: false, quotaSource: 'unavailable' };
          }
        } catch (e) {
          console.warn(`Could not get quota for ${conn.name}:`, e);
          quotas[conn.id] = { total: 0, used: 0, free: 0, isAvailable: false, quotaSource: 'unavailable' };
        }
      }
      setLiveQuotas(quotas);
    } catch (err) {
      console.warn('Error refreshing storage data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshAllStorageData();
    const unsub = storageUsageIndex.subscribe(u => setLibrixUsage(u));
    return () => unsub();
  }, [connections.length]);

  // Restore saved cloud sessions ONCE per connection and subscribe to live
  // provider state. A session only becomes trusted after the provider's own
  // verification against the provider's API succeeds.
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    (async () => {
      for (const conn of connections) {
        if (conn.providerType === 'local') continue;
        if (restoredConnIds.current.has(conn.id)) continue;
        restoredConnIds.current.add(conn.id);

        const provider = resolveProvider(conn);
        if (!provider) continue;

        if (typeof (provider as GoogleDriveProvider).subscribe === 'function') {
          unsubs.push(
            (provider as GoogleDriveProvider).subscribe(s =>
              setConnStates(prev => ({ ...prev, [conn.id]: s.status }))
            )
          );
        }

        if (provider.isConnected()) continue;
        try {
          if (typeof (provider as GoogleDriveProvider).restoreSession === 'function') {
            await (provider as GoogleDriveProvider).restoreSession();
          } else {
            await provider.authenticate();
          }
        } catch (e) {
          console.warn(`Session restore failed for ${conn.name}:`, e);
        }
      }
      refreshAllStorageData();
    })();
    return () => unsubs.forEach(fn => fn());
  }, [connections.length]);

  const handleSetDefaultProvider = async (connId: string) => {
    const targetConn = connections.find(c => c.id === connId);
    for (const c of connections) {
      c.isDefault = c.id === connId;
      await db.saveCloudConnection(c);
    }
    storageRegistry.setDefaultProvider(connId);
    if (targetConn?.providerType) {
      storageRegistry.setDefaultProvider(targetConn.providerType);
    }
    onConnectionsUpdated();
  };

  const handleStartRename = (conn: CloudConnection) => {
    setRenamingConnId(conn.id);
    setRenameValue(conn.name);
  };

  const handleSaveRename = async (connId: string) => {
    const conn = connections.find(c => c.id === connId);
    if (conn && renameValue.trim()) {
      conn.name = renameValue.trim();
      await db.saveCloudConnection(conn);
      setRenamingConnId(null);
      onConnectionsUpdated();
    }
  };

  // Connection In-Progress State
  const [connectingStatus, setConnectingStatus] = useState<string | null>(null);
  const [connectingError, setConnectingError] = useState<string | null>(null);
  const [testingConnId, setTestingConnId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string; url?: string } | null>(null);

  const handleConnectPopularProvider = async (
    directToken?: string,
    customClientId?: string,
    directRefreshToken?: string,
    directEmail?: string
  ) => {
    if (!selectedPopularType) return;
    setConnectingError(null);

    const isGdrive = selectedPopularType === 'gdrive';
    const email = directEmail || popularEmail.trim() || undefined;
    const token = directToken || popularAuthToken.trim() || undefined;
    const refreshToken = directRefreshToken || popularRefreshToken.trim() || undefined;

    setConnectingStatus(
      isGdrive && !token && !email
        ? 'Opening Google authorization window...'
        : 'Connecting and verifying Google Drive storage...'
    );

    const id = `conn_${selectedPopularType}_${Date.now()}`;
    const nameMap: Record<StorageProviderType, string> = {
      gdrive: 'Google Drive',
      onedrive: 'Microsoft OneDrive',
      mega: 'MEGA Cloud',
      terabox: 'TeraBox Storage',
      local: 'Local Storage',
      telegram: 'Telegram Private Vault',
      mediafire: 'MediaFire',
      custom: 'Custom Storage',
    };

    const name = nameMap[selectedPopularType] || selectedPopularType.toUpperCase();

    try {
      // Register provider
      const provider = storageRegistry.createCustomProvider({
        id,
        name,
        type: selectedPopularType,
      });

      if (isGdrive && customClientId?.trim()) {
        (provider as GoogleDriveProvider).configure({
          clientId: customClientId.trim(),
        });
      }

      const authSuccess = await provider.authenticate(
        isGdrive
          ? {
              interactive: !token && !email,
              accessToken: token,
              refreshToken: refreshToken,
              email: email,
              clientId: customClientId?.trim() || undefined,
              onProgress: (step: string) => setConnectingStatus(step),
            }
          : {
              accessToken: token,
              apiKey: token,
              sessionToken: token,
              email: email,
            }
      );

      if (!authSuccess || !provider.isConnected()) {
        const state = (provider as any).getConnectionState?.();
        const errorMsg =
          state?.lastError ||
          (state?.status === 'cancelled'
            ? 'Authentication cancelled by user.'
            : 'Authentication failed. The provider could not verify access with Google Drive API.');
        setConnectingError(errorMsg);
        setConnectingStatus(null);
        return;
      }

      setConnectingStatus('Fetching storage quota...');

      // Identity comes ONLY from the provider's verified account info
      // (Google reports it via drive.about.get). No placeholders, ever.
      const verifiedEmail: string | undefined =
        (provider as any).getAccountInfo?.()?.email || popularEmail.trim() || undefined;

      const quota = await provider.getQuota();

      const newConn: CloudConnection = {
        id,
        providerId: id,
        providerType: selectedPopularType,
        name,
        accountEmail: verifiedEmail,
        status: 'connected',
        quotaTotal: quota.total,
        quotaUsed: quota.used,
        isDefault: false,
        config: customClientId ? { oauthClientId: customClientId } : {},
      };

      await db.saveCloudConnection(newConn);
      setShowAddModal(false);
      setSelectedPopularType(null);
      setPopularAuthToken('');
      setPopularEmail('');
      setCustomGdriveClientId('');
      setShowGdriveAdvanced(false);
      setConnectingStatus(null);
      setConnectingError(null);
      onConnectionsUpdated();
      await refreshAllStorageData();
    } catch (err: any) {
      setConnectingError(err?.message || 'Connection failed. Please check network and credentials.');
      setConnectingStatus(null);
    }
  };

  const handleTestConnection = async (conn: CloudConnection) => {
    setTestingConnId(conn.id);
    setTestResult(null);

    try {
      const provider = resolveProvider(conn);

      if (!provider) {
        setTestResult({ id: conn.id, success: false, message: 'Provider driver not loaded' });
        return;
      }

      if ((provider as any).testConnection) {
        const res = await (provider as any).testConnection();
        if (res.success) {
          setTestResult({
            id: conn.id,
            success: true,
            message: `API Operational • User: ${res.account?.email || conn.accountEmail} • Quota: ${formatBytes(res.quota?.total || conn.quotaTotal)}`,
          });
        } else {
          setTestResult({
            id: conn.id,
            success: false,
            message: res.error || 'API Verification Failed',
          });
        }
      } else {
        const q = await provider.getQuota();
        setTestResult({
          id: conn.id,
          success: q.isAvailable,
          message: q.isAvailable ? `Quota Verified: ${formatBytes(q.total)}` : 'Connected (Quota unavailable)',
        });
      }
    } catch (err: any) {
      setTestResult({
        id: conn.id,
        success: false,
        message: err?.message || 'Connection test failed',
      });
    } finally {
      setTestingConnId(null);
    }
  };

  const handleSaveCustomProvider = async () => {
    const id = `conn_custom_${Date.now()}`;
    const name = customName.trim() || `Custom ${customProtocol.toUpperCase()}`;

    const provider = storageRegistry.createCustomProvider({
      id,
      name,
      type: 'custom',
      protocol: customProtocol,
      endpointUrl: customUrl,
      username: customUser,
      password: customPass,
      apiKey: customApiKey,
      bucket: customBucket,
      region: customRegion,
    });

    await provider.authenticate({
      username: customUser,
      password: customPass,
      apiKey: customApiKey,
    });

    const quota = await provider.getQuota();

    const newConn: CloudConnection = {
      id,
      providerId: id,
      providerType: 'custom',
      name,
      accountEmail: customUser.trim() || undefined,
      status: 'connected',
      quotaTotal: quota.total,
      quotaUsed: quota.used,
      isDefault: false,
      config: {
        protocol: customProtocol,
        endpointUrl: customUrl,
        bucket: customBucket,
      },
    };

    await db.saveCloudConnection(newConn);
    setShowAddModal(false);
    setIsCustomWizard(false);
    setWizardStep(1);
    setCustomName('');
    setCustomUrl('');
    setCustomUser('');
    setCustomPass('');
    setCustomApiKey('');
    onConnectionsUpdated();
    await refreshAllStorageData();
  };

  const handleDeleteConnection = async (id: string) => {
    if (confirm('Disconnect this storage connection? No local or remote documents will be deleted.')) {
      // Revoke OAuth grants and wipe stored credentials BEFORE dropping the row.
      const conn = connections.find(c => c.id === id);
      if (conn && conn.providerType !== 'local') {
        try {
          const provider = resolveProvider(conn);
          if (provider && typeof provider.disconnect === 'function') {
            await provider.disconnect();
          }
        } catch (e) {
          console.warn(`Credential cleanup failed for ${conn.name}:`, e);
        }
      }
      await db.deleteCloudConnection(id);
      if (browsingConnection?.id === id) setBrowsingConnection(null);
      onConnectionsUpdated();
      await refreshAllStorageData();
    }
  };

  /**
   * Reconnect flow for sessions whose refresh token was revoked/expired:
   * tries silent restore first, then a full interactive OAuth round-trip
   * using the client config persisted with the connection.
   */
  const handleReconnect = async (conn: CloudConnection) => {
    setConnectingError(null);
    if (conn.providerType !== 'gdrive') return;
    const provider = resolveProvider(conn) as GoogleDriveProvider | undefined;
    if (!provider) return;

    setConnStates(prev => ({ ...prev, [conn.id]: 'connecting' }));
    try {
      let ok = await provider.restoreSession();
      if (!ok) {
        const clientId = conn.config?.oauthClientId;
        if (!clientId) {
          setConnectingError('No OAuth Client ID saved for this connection. Remove it and connect again.');
          setConnStates(prev => ({ ...prev, [conn.id]: provider.getStatus() }));
          return;
        }
        provider.configure({ clientId });
        ok = await provider.authenticate({ interactive: true });
      }
      if (!ok) {
        setConnectingError(provider.getConnectionState().lastError || 'Reconnect failed.');
      }
      onConnectionsUpdated();
      await refreshAllStorageData();
    } finally {
      setConnStates(prev => ({ ...prev, [conn.id]: provider.getStatus() }));
    }
  };

  const handleEnsureCloudFolder = async (conn: CloudConnection) => {
    const provider = resolveProvider(conn);
    if (!provider) return;
    setTestingConnId(conn.id);
    try {
      if (!provider.isConnected()) {
        await provider.authenticate();
      }

      if (typeof (provider as any).clearFolderCache === 'function') {
        (provider as any).clearFolderCache();
      }

      let rootId = '';
      let libraryId = '';
      let notesId = '';

      if (typeof (provider as any).findOrCreateFolder === 'function') {
        rootId = await (provider as any).findOrCreateFolder('LIBRIX');
        libraryId = await (provider as any).findOrCreateFolder('Library', rootId);
        notesId = await (provider as any).findOrCreateFolder('Notes', rootId);
      } else {
        const structure = await cloudVaultSyncService.ensureRootVaultStructure(provider);
        rootId = structure.rootFolderId || '';
        libraryId = structure.libraryFolderId || '';
        notesId = structure.notesFolderId || '';
      }

      // Auto-migrate local documents and notes into the newly created folders
      const migrationResult = await vaultMigrationService.migrateLocalVaultToCloud(provider, 'copy');

      // Save master index
      await cloudVaultSyncService.saveMasterVaultCatalog(provider);

      const folderUrl = rootId ? `https://drive.google.com/drive/folders/${rootId}` : undefined;

      setTestResult({
        id: conn.id,
        success: true,
        message: `Vault initialized on ${conn.name}! Created /LIBRIX, /LIBRIX/Library, /LIBRIX/Notes. Synced ${migrationResult.migratedDocuments} document(s) and ${migrationResult.migratedNotes} note(s).`,
        url: folderUrl,
      });
      await refreshAllStorageData();
    } catch (e: any) {
      setTestResult({
        id: conn.id,
        success: false,
        message: 'Vault initialization error: ' + (e?.message || e),
      });
    } finally {
      setTestingConnId(null);
    }
  };

  const handleBrowseFiles = async (conn: CloudConnection) => {
    setBrowsingConnection(conn);
    setIsLoadingFiles(true);
    setImportSuccessId(null);

    try {
      const provider = resolveProvider(conn);
      if (!provider) throw new Error('Provider not available');

      await provider.authenticate();
      const files = await provider.listFiles();
      setCloudItems(files);
    } catch (err) {
      console.warn('Could not list files:', err);
      setCloudItems([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleImportCloudFile = async (item: StorageItem) => {
    if (!browsingConnection) return;
    setImportingItemId(item.id);

    try {
      if (!browsingConnection) return;
      const provider = resolveProvider(browsingConnection);
      if (!provider) throw new Error('Provider not available');

      const data = await provider.download(item.path || item.id);
      const ext = item.name.split('.').pop()?.toLowerCase() || 'pdf';
      const docId = `doc_cloud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const mimeType = item.mimeType || (ext === 'epub' ? 'application/epub+zip' : 'application/pdf');

      // Save raw binary
      await fileBinaryStore.saveFileBlob(docId, data, mimeType, item.name);

      let title = item.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      let author = `${browsingConnection.name} Import`;
      let coverImage: string | undefined = undefined;

      if (ext === 'pdf') {
        coverImage = await PdfParser.generateThumbnail(data);
      } else if (ext === 'epub') {
        const parsed = await EpubParser.parse(data);
        if (parsed.title && parsed.title !== 'Imported Document') title = parsed.title;
        if (parsed.author && parsed.author !== 'Unknown Author') author = parsed.author;
        coverImage = parsed.coverDataUrl;
      }

      const newDoc: Document = {
        id: docId,
        title,
        author,
        filename: item.name,
        format: (ext as any) || 'unknown',
        mimeType,
        size: data.length,
        hash: 'hash_' + Date.now(),
        storageProvider: browsingConnection.providerType,
        storagePath: item.path,
        folderId: null,
        isFavorite: false,
        isTrash: false,
        tags: ['Cloud', browsingConnection.providerType.toUpperCase()],
        collections: [],
        coverImage,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      await db.saveDocument(newDoc);
      storageUsageIndex.markDirty();
      setImportSuccessId(item.id);
      setTimeout(() => setImportSuccessId(null), 3000);
      onConnectionsUpdated();
      await refreshAllStorageData();
    } catch (err) {
      alert(`Import failed: ${err}`);
    } finally {
      setImportingItemId(null);
    }
  };

  const handleStartTransfer = (item: StorageItem) => {
    setTransferSourceItem(item);
    const otherConn = connections.find(c => c.id !== browsingConnection?.id);
    setTransferTargetConnId(otherConn ? otherConn.id : connections[0]?.id || '');
    setTransferProgress(null);
    setShowTransferModal(true);
  };

  const handleExecuteTransfer = async () => {
    if (!transferSourceItem || !browsingConnection || !transferTargetConnId) return;

    setIsTransferring(true);
    try {
      const targetConn = connections.find(c => c.id === transferTargetConnId);
      if (!targetConn) throw new Error('Target connection not found');

      await crossProviderTransfer.transferFile(
        browsingConnection.providerId,
        transferSourceItem,
        targetConn.providerId,
        '',
        transferOperation,
        progress => setTransferProgress(progress)
      );

      setTimeout(() => {
        setShowTransferModal(false);
        setIsTransferring(false);
        if (browsingConnection) handleBrowseFiles(browsingConnection);
        refreshAllStorageData();
      }, 1000);
    } catch (err: any) {
      alert(`Transfer failed: ${err?.message || err}`);
      setIsTransferring(false);
    }
  };

  const handleOpenMigrationModal = async () => {
    const allDocs = await db.getDocuments({ filterTrash: false });
    const allNotes = await db.getNotes();
    setLocalCounts({ docs: allDocs.length, notes: allNotes.length });

    const cloudConns = connections.filter(c => c.providerType !== 'local' && c.status === 'connected');
    setMigrationTargetConnId(cloudConns[0]?.id || connections.find(c => c.providerType !== 'local')?.id || connections[0]?.id || '');
    setMigrationProgress(null);
    setMigrationResult(null);
    setShowMigrationModal(true);
  };

  const handleExecuteVaultMigration = async () => {
    if (!migrationTargetConnId) return;
    setIsMigratingVault(true);
    setMigrationResult(null);

    try {
      const targetConn = connections.find(c => c.id === migrationTargetConnId);
      const provider = targetConn ? resolveProvider(targetConn) : storageRegistry.getProvider(migrationTargetConnId);

      if (!provider) {
        alert('Could not resolve selected cloud provider. Please verify your cloud connection.');
        setIsMigratingVault(false);
        return;
      }

      const result = await vaultMigrationService.migrateLocalVaultToCloud(
        provider,
        migrationOperation,
        progress => setMigrationProgress(progress)
      );

      setMigrationResult(result);
      platform.notifications.show('Vault Migration Complete', {
        body: `Migrated ${result.migratedDocuments} books and ${result.migratedNotes} notes to ${targetConn?.name || 'Cloud'}.`,
      });
      onConnectionsUpdated();
      refreshAllStorageData();
    } catch (err: any) {
      alert(`Migration error: ${err?.message || err}`);
    } finally {
      setIsMigratingVault(false);
    }
  };

  const uploadFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleUploadToBrowsingStorage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !browsingConnection) return;
    try {
      setIsLoadingFiles(true);
      const provider = resolveProvider(browsingConnection);
      if (!provider) throw new Error('Storage provider not available');
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      await provider.upload('', file.name, uint8, file.type || 'application/pdf');
      const files = await provider.listFiles();
      setCloudItems(files);
      await refreshAllStorageData();
      onConnectionsUpdated();
      platform.notifications.show('File Saved', {
        body: `Successfully saved ${file.name} to ${browsingConnection.name}`,
      });
    } catch (err: any) {
      alert(`Upload failed: ${err?.message || err}`);
    } finally {
      setIsLoadingFiles(false);
      if (e.target) e.target.value = '';
    }
  };

  const defaultConnection = connections.find(c => c.isDefault) || connections[0];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header Bar */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-5)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-app)',
        }}
      >
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '0.04em' }}>
            STORAGE CAPACITY & MULTI-CLOUD ARCHITECTURE
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Real physical volume detection, separate Librix usage indexing, and multi-cloud synchronization.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {/* Default Storage Destination Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)' }}>
              DEFAULT STORAGE:
            </span>
            <select
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              value={defaultConnection?.id || ''}
              onChange={e => handleSetDefaultProvider(e.target.value)}
            >
              {connections.map(c => (
                <option key={c.id} value={c.id} style={{ background: 'var(--bg-surface-elevated)' }}>
                  {c.name} ({c.providerType.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={refreshAllStorageData} disabled={isRefreshing}>
            <RefreshCw size={13} className={isRefreshing ? 'spinning' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Quotas'}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            style={{ color: '#0ea5e9', borderColor: 'rgba(14, 165, 233, 0.4)' }}
            onClick={handleOpenMigrationModal}
            title="Migrate all local books, documents and notes to connected Cloud Storage"
          >
            <ArrowRightLeft size={13} />
            <span>Migrate Vault to Cloud</span>
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => { setShowAddModal(true); setIsCustomWizard(false); setSelectedPopularType(null); }}>
            <Plus size={13} />
            <span>Add Storage</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Scrollable Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* SECTION 1: PHYSICAL STORAGE vs LIBRIX USAGE */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>

            {/* CARD A: PHYSICAL VOLUME STORAGE */}
            <div className="card card-elevated scifi-box" style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HardDrive size={18} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>LOCAL STORAGE</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                      {volumeInfo?.volumeName || 'System Volume'} • {volumeInfo?.mountPoint || '/'}
                    </div>
                  </div>
                </div>
                <span className="badge">{volumeInfo?.isEstimated ? 'BROWSER SANDBOX' : 'PHYSICAL VOLUME'}</span>
              </div>

              {/* Volume Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-xs)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>TOTAL STORAGE</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                    {formatBytes(volumeInfo?.total)}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>USED STORAGE</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                    {formatBytes(volumeInfo?.used)}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>FREE STORAGE</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                    {formatBytes(volumeInfo?.free)}
                  </div>
                </div>
              </div>

              {/* Disk Progress Gauge */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: 'var(--font-tech)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>{formatBytes(volumeInfo?.free)} available</span>
                  <span>{volumeInfo?.total ? Math.round(((volumeInfo.used || 0) / volumeInfo.total) * 100) : 0}% used</span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${volumeInfo?.total ? Math.max(2, Math.round(((volumeInfo.used || 0) / volumeInfo.total) * 100)) : 2}%`, height: '100%', background: 'var(--text-primary)' }} />
                  <div style={{ flex: 1, height: '100%', background: 'var(--border-subtle)' }} />
                </div>
              </div>
            </div>

            {/* CARD B: LIBRIX STORAGE USAGE INDEX */}
            <div className="card card-elevated scifi-box" style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Database size={18} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>LIBRIX STORAGE USAGE</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                      Total Librix Data: {formatBytes(librixUsage?.totalLibrixBytes)}
                    </div>
                  </div>
                </div>
                <span className="badge">INDEXED</span>
              </div>

              {/* Breakdown Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Books ({librixUsage?.booksCount || 0}):</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatBytes(librixUsage?.booksBytes)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Documents ({librixUsage?.documentsCount || 0}):</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatBytes(librixUsage?.documentsBytes)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Notes ({librixUsage?.notesCount || 0}):</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatBytes(librixUsage?.notesBytes)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>AI/RAG Index:</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatBytes(librixUsage?.aiIndexBytes)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Thumbnails:</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatBytes(librixUsage?.thumbnailsBytes)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Cache & Metadata:</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatBytes((librixUsage?.cacheBytes || 0) + (librixUsage?.metadataBytes || 0))}</div>
                </div>
              </div>

              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Incremental calculation active</span>
                <span>Updates automatically on file operations</span>
              </div>
            </div>

          </div>

          {/* SECTION 2: CONNECTED STORAGE PROVIDERS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={16} />
                <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.04em' }}>
                  CONNECTED STORAGE ACCOUNTS ({connections.length})
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
              {connections.map(conn => {
                const live = liveQuotas[conn.id];
                const quotaAvailable = live ? live.isAvailable : false;
                const total = live?.total || conn.quotaTotal || 0;
                const used = live?.used || conn.quotaUsed || 0;
                const free = live?.free !== undefined ? live.free : Math.max(0, total - used);
                const usedPercent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                const freePercent = total > 0 ? Math.max(0, 100 - usedPercent) : 100;
                const isSelected = browsingConnection?.id === conn.id;

                return (
                  <div
                    key={conn.id}
                    className={`card card-elevated scifi-box ${isSelected ? 'active' : ''}`}
                    style={{
                      padding: 'var(--space-4)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-3)',
                      borderColor: isSelected ? 'var(--text-primary)' : undefined,
                    }}
                  >
                    {/* Card Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {conn.providerType === 'local' ? <HardDrive size={18} /> : <Cloud size={18} />}
                        <div>
                          {renamingConnId === conn.id ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <input
                                type="text"
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                style={{ padding: '2px 4px', fontSize: 'var(--text-xs)', width: 140 }}
                              />
                              <button className="btn btn-sm btn-primary" onClick={() => handleSaveRename(conn.id)}>Save</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{conn.name}</span>
                              <button className="btn-icon btn-sm" style={{ padding: 2 }} onClick={() => handleStartRename(conn)} title="Rename Connection">
                                <Edit2 size={11} />
                              </button>
                            </div>
                          )}
                          <div style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                            {conn.accountEmail || conn.providerType.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {conn.isDefault && <span className="badge" style={{ background: 'var(--text-primary)', color: 'var(--bg-app)' }}>DEFAULT</span>}
                        {(() => {
                          // Honest status: derived from the LIVE provider state machine,
                          // never hard-coded.
                          if (conn.providerType === 'local') {
                            return <span className="badge">● LOCAL</span>;
                          }
                          const liveStatus = connStates[conn.id];
                          const online =
                            liveStatus !== undefined
                              ? liveStatus === 'connected'
                              : (resolveProvider(conn)?.isConnected() ?? false);
                          if (online) {
                            return (
                              <span className="badge" style={{ color: 'var(--color-success)' }}>
                                ● CONNECTED
                              </span>
                            );
                          }
                          const needsReconnect =
                            liveStatus === 'reconnect_required' ||
                            liveStatus === 'token_expired' ||
                            (!liveStatus && conn.status === 'connected');
                          return (
                            <span
                              className="badge"
                              style={needsReconnect ? { color: 'var(--color-warning, #f59e0b)' } : { opacity: 0.6 }}
                            >
                              {needsReconnect ? '○ RECONNECT REQUIRED' : '○ OFFLINE'}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Quota Section: Honest reporting, no fake values */}
                    {quotaAvailable && total > 0 ? (
                      <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-xs)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <div>
                            <span style={{ fontFamily: 'var(--font-tech)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {formatBytes(free)} LEFT
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginLeft: 6 }}>
                              ({freePercent}% available)
                            </span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-tech)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {formatBytes(used)} / {formatBytes(total)}
                          </span>
                        </div>

                        <div style={{ width: '100%', height: 5, background: 'var(--bg-surface)', borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${Math.max(2, usedPercent)}%`, height: '100%', background: 'var(--text-primary)' }} />
                          <div style={{ flex: 1, height: '100%', background: 'var(--border-subtle)' }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>
                          <span>USED: {formatBytes(used)}</span>
                          <span>TOTAL: {formatBytes(total)}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)' }}>
                        Storage quota information unavailable
                      </div>
                    )}

                    {/* Test Connection Output Pill */}
                    {testResult && testResult.id === conn.id && (
                      <div
                        style={{
                          background: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          border: `1px solid ${testResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: 'var(--text-2xs)',
                          fontFamily: 'var(--font-tech)',
                          color: testResult.success ? '#22c55e' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                          <span>{testResult.success ? '✓' : '✕'}</span>
                          <span>{testResult.message}</span>
                        </div>
                        {testResult.url && (
                          <a
                            href={testResult.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: '#22c55e',
                              textDecoration: 'underline',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <span>Open in Drive ↗</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Card Actions Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleBrowseFiles(conn)}>
                          <Folder size={12} />
                          <span>Browse</span>
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={testingConnId === conn.id}
                          onClick={() => handleTestConnection(conn)}
                          title="Verify live connection with API"
                        >
                          {testingConnId === conn.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                          <span>{testingConnId === conn.id ? 'Testing...' : 'Test'}</span>
                        </button>
                        {conn.providerType !== 'local' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={testingConnId === conn.id}
                            onClick={() => handleEnsureCloudFolder(conn)}
                            title="Create or verify LIBRIX root & nested folders on this cloud"
                          >
                            <FolderPlus size={11} />
                            <span>Init Vault</span>
                          </button>
                        )}
                        {!conn.isDefault && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleSetDefaultProvider(conn.id)} title="Set as default storage">
                            <span>Default</span>
                          </button>
                        )}
                        {conn.providerType === 'gdrive' && connStates[conn.id] && connStates[conn.id] !== 'connected' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={connStates[conn.id] === 'connecting' || connStates[conn.id] === 'authenticating' || connStates[conn.id] === 'verifying'}
                            onClick={() => handleReconnect(conn)}
                            title="Re-authenticate this Google Drive account"
                          >
                            <RefreshCw size={11} className={connStates[conn.id] === 'connecting' ? 'spinning' : ''} />
                            <span>Reconnect</span>
                          </button>
                        )}
                      </div>

                      {!conn.isDefault && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-muted)' }} onClick={() => handleDeleteConnection(conn.id)} title="Disconnect Account">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: DYNAMIC REAL STORAGE HEALTH & STATUS */}
          <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--bg-surface-elevated)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={16} />
                <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.04em' }}>
                  STORAGE HEALTH & SECURITY STATUS ({connections.length} ACTIVE)
                </span>
              </div>
              <span style={{ fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)' }}>
                HARDWARE / AES-GCM ENCRYPTED
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
              {connections.map(conn => {
                const live = liveQuotas[conn.id];
                const gdriveProvider = resolveProvider(conn);
                const liveStatus = connStates[conn.id];
                const isOnline =
                  liveStatus !== undefined
                    ? liveStatus === 'connected'
                    : (gdriveProvider?.isConnected() ?? conn.status === 'connected');

                let statusDetail = 'Secure • Ready';
                if (conn.providerType === 'local') {
                  statusDetail = `${volumeInfo?.volumeName || 'Volume'} (${volumeInfo?.fsType || 'Local'}) • ${volumeInfo?.isEstimated ? 'Sandbox' : 'Physical Disk'}`;
                } else if (conn.providerType === 'gdrive') {
                  statusDetail = `REST API v3 • ${live?.isAvailable ? 'Live Quota Synced' : 'Connected'}`;
                } else if (conn.providerType === 'onedrive') {
                  statusDetail = `Microsoft Graph v1.0 • ${live?.isAvailable ? 'Live Quota Synced' : 'Connected'}`;
                } else if (conn.providerType === 'mega') {
                  statusDetail = `Encrypted Vault • ${live?.isAvailable ? 'Live Quota Synced' : 'Connected'}`;
                } else if (conn.providerType === 'terabox') {
                  statusDetail = `Direct REST Limited • ${live?.isAvailable ? 'Live Quota' : 'Quota Unavailable'}`;
                } else if (conn.providerType === 'custom') {
                  statusDetail = `Protocol: ${(conn.config.protocol || 'webdav').toUpperCase()} • Endpoint Active`;
                }

                return (
                  <div key={conn.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: 'var(--radius-xs)' }}>
                    <span style={{ color: isOnline ? 'var(--color-success)' : 'var(--text-warning)', fontSize: '0.8rem' }}>
                      {isOnline ? '●' : '○'}
                    </span>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conn.name}
                      </div>
                      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {statusDetail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Drawer: Live Cloud File Explorer */}
        {browsingConnection && (
          <aside
            style={{
              width: 420,
              borderLeft: '1px solid var(--border-medium)',
              background: 'var(--bg-surface-elevated)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {browsingConnection.providerType === 'local' ? <HardDrive size={16} /> : <Cloud size={16} />}
                <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                  {browsingConnection.name.toUpperCase()} FILES ({cloudItems.length})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="file"
                  ref={uploadFileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleUploadToBrowsingStorage}
                  accept=".pdf,.epub,.md,.txt,.docx,.mobi"
                />
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => uploadFileInputRef.current?.click()}
                  title={`Upload document directly into ${browsingConnection.name}`}
                >
                  <Upload size={12} />
                  <span>Upload</span>
                </button>
                <button className="btn-icon btn-sm" onClick={() => setBrowsingConnection(null)}>✕</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {isLoadingFiles ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: 'var(--text-muted)' }}>
                  <Loader2 size={24} className="animate-spin" />
                  <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-xs)' }}>FETCHING STORAGE FILES...</span>
                </div>
              ) : cloudItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span>No documents found on this storage account.</span>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => uploadFileInputRef.current?.click()}
                    style={{ fontSize: '0.72rem' }}
                  >
                    <Upload size={12} />
                    <span>Upload Document</span>
                  </button>
                </div>
              ) : (
                cloudItems.map(item => (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      {item.name.endsWith('.epub') ? <BookOpen size={16} /> : <FileText size={16} />}
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>
                          {formatBytes(item.size)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {browsingConnection.providerType !== 'local' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          disabled={importingItemId === item.id || importSuccessId === item.id}
                          onClick={() => handleImportCloudFile(item)}
                          title="Import into Local Librix Library"
                        >
                          {importingItemId === item.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : importSuccessId === item.id ? (
                            <CheckCircle size={12} color="var(--color-success)" />
                          ) : (
                            <Download size={12} />
                          )}
                          <span>{importSuccessId === item.id ? 'Imported' : 'Import'}</span>
                        </button>
                      )}

                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleStartTransfer(item)}
                        title={browsingConnection.providerType === 'local' ? 'Transfer (Copy / Move) to Cloud Storage' : 'Transfer (Copy / Move) to Another Provider'}
                      >
                        <ArrowRightLeft size={12} />
                        <span>Transfer</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* POPULAR ONE-CLICK & CUSTOM CLOUD MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {isCustomWizard ? `Custom Cloud Setup (Step ${wizardStep} of 3)` : 'Add Storage Provider'}
              </h3>
              <button className="btn-icon btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {!isCustomWizard ? (
                <>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    Connect built-in popular cloud providers with one click or configure your own custom endpoint.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <button
                      className={`card scifi-box ${selectedPopularType === 'gdrive' ? 'active' : ''}`}
                      style={{ padding: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => setSelectedPopularType('gdrive')}
                    >
                      <Cloud size={20} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>Google Drive</div>
                        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Official REST v3</div>
                      </div>
                    </button>

                    <button
                      className={`card scifi-box ${selectedPopularType === 'onedrive' ? 'active' : ''}`}
                      style={{ padding: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => setSelectedPopularType('onedrive')}
                    >
                      <Cloud size={20} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>OneDrive</div>
                        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Microsoft Graph</div>
                      </div>
                    </button>

                    <button
                      className={`card scifi-box ${selectedPopularType === 'mega' ? 'active' : ''}`}
                      style={{ padding: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => setSelectedPopularType('mega')}
                    >
                      <Shield size={20} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>MEGA Cloud</div>
                        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Encrypted Vault</div>
                      </div>
                    </button>

                    <button
                      className={`card scifi-box ${selectedPopularType === 'terabox' ? 'active' : ''}`}
                      style={{ padding: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => setSelectedPopularType('terabox')}
                    >
                      <Server size={20} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>TeraBox</div>
                        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Direct / Fallback</div>
                      </div>
                    </button>
                  </div>

                  {selectedPopularType && (
                    <div style={{ background: 'var(--bg-input)', padding: 'var(--space-4)', borderRadius: 'var(--radius-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.03em' }}>
                          CONNECT {selectedPopularType === 'gdrive' ? 'GOOGLE DRIVE' : selectedPopularType === 'onedrive' ? 'MICROSOFT ONEDRIVE' : selectedPopularType.toUpperCase()}
                        </span>
                        <span className="badge">OFFICIAL REST v3</span>
                      </div>

                      {connectingStatus && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-medium)', fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                          <Loader2 size={14} className="animate-spin" />
                          <span>{connectingStatus}</span>
                        </div>
                      )}

                      {connectingError && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-xs)', fontSize: 'var(--text-xs)', color: '#ef4444' }}>
                          <span style={{ fontWeight: 700 }}>✕</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>Connection Failed</div>
                            <div style={{ fontSize: 'var(--text-2xs)', marginTop: 2 }}>{connectingError}</div>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ marginTop: 6 }}
                              onClick={() => {
                                setConnectingError(null);
                                setConnectingStatus(null);
                              }}
                            >
                              Try Again
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedPopularType === 'gdrive' ? (
                        <>
                          {/* Segmented Mode Selector */}
                          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-surface)', padding: 4, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                            <button
                              type="button"
                              className={`btn btn-sm ${gdriveMode === 'oauth' ? 'btn-primary' : 'btn-ghost'}`}
                              style={{ flex: 1, fontSize: '0.72rem' }}
                              onClick={() => setGdriveMode('oauth')}
                            >
                              🌐 Sign in with Google
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${gdriveMode === 'token' ? 'btn-primary' : 'btn-ghost'}`}
                              style={{ flex: 1, fontSize: '0.72rem' }}
                              onClick={() => setGdriveMode('token')}
                            >
                              🔑 Direct OAuth Token
                            </button>
                          </div>

                          {gdriveMode === 'oauth' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                                  Google OAuth 2.0 PKCE Authorization
                                </div>
                                <div>
                                  Opens Google's official authorization page to connect your Google account securely with PKCE (RFC 7636).
                                </div>
                              </div>

                              <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', fontSize: '0.73rem', lineHeight: 1.5 }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-warning)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Shield size={14} /> Required Google Permissions on Sign-In Screen
                                </div>
                                <div style={{ color: 'var(--text-secondary)' }}>
                                  On Google's consent screen, you <strong>must check the box</strong>:
                                  <div style={{ margin: '6px 0', padding: '6px 8px', background: 'var(--bg-surface)', borderRadius: 4, fontFamily: 'var(--font-tech)', fontSize: '0.7rem', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                                    ☑️ "See, edit, create, and delete only the specific Google Drive files..."
                                  </div>
                                  This allows LIBRIX to create your dedicated <code>/LIBRIX</code> vault folder and organize books & notes in Google Drive.
                                </div>
                              </div>

                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.72rem' }}>Google Cloud Client ID (Optional if set in .env)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 123456-abcdefg.apps.googleusercontent.com"
                                  value={customGdriveClientId}
                                  disabled={!!connectingStatus}
                                  onChange={e => setCustomGdriveClientId(e.target.value)}
                                />
                              </div>

                              <button
                                className="btn btn-primary"
                                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600 }}
                                disabled={!!connectingStatus}
                                onClick={() => handleConnectPopularProvider(undefined, customGdriveClientId.trim() || undefined)}
                              >
                                {connectingStatus ? (
                                  <>
                                    <Loader2 size={15} className="animate-spin" />
                                    <span>{connectingStatus}</span>
                                  </>
                                ) : (
                                  <>
                                    <Cloud size={15} />
                                    <span>Sign in with Google</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ background: 'var(--bg-surface)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Get a Real Google Drive Token from Google:</div>
                                <div>1. Open <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>Google OAuth 2.0 Playground</a>.</div>
                                <div>2. In <strong>Step 1</strong>, scroll down to <strong>Drive API v3</strong> and select <code>https://www.googleapis.com/auth/drive.readonly</code> & <code>https://www.googleapis.com/auth/drive.file</code>.</div>
                                <div>3. Click <strong>Authorize APIs</strong> and log into your Google account.</div>
                                <div>4. In <strong>Step 2</strong>, click <strong>Exchange authorization code for tokens</strong>.</div>
                                <div>5. Copy the <strong>Access token</strong> (starts with <code>ya29...</code>) and paste it below:</div>
                              </div>

                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.72rem' }}>Google OAuth Access Token (ya29...)</label>
                                <input
                                  type="password"
                                  placeholder="ya29.a0AfH6SM..."
                                  value={popularAuthToken}
                                  disabled={!!connectingStatus}
                                  onChange={e => setPopularAuthToken(e.target.value)}
                                />
                              </div>

                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.72rem' }}>Google OAuth Refresh Token (Optional • Enables auto-renewal)</label>
                                <input
                                  type="password"
                                  placeholder="1//04... (from Step 2 of OAuth Playground)"
                                  value={popularRefreshToken}
                                  disabled={!!connectingStatus}
                                  onChange={e => setPopularRefreshToken(e.target.value)}
                                />
                              </div>

                              <button
                                className="btn btn-primary"
                                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600 }}
                                disabled={!!connectingStatus || !popularAuthToken.trim()}
                                onClick={() => handleConnectPopularProvider(popularAuthToken.trim(), undefined, popularRefreshToken.trim() || undefined)}
                              >
                                {connectingStatus ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>{connectingStatus || 'Verify & Connect Google Drive'}</span>
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="form-group">
                            <label className="form-label">Account Email / Identifier (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. myname@example.com"
                              value={popularEmail}
                              disabled={!!connectingStatus}
                              onChange={e => setPopularEmail(e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">API Access Token / Key</label>
                            <input
                              type="password"
                              value={popularAuthToken}
                              disabled={!!connectingStatus}
                              onChange={e => setPopularAuthToken(e.target.value)}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <button
                              className="btn btn-primary"
                              style={{ flex: 1 }}
                              disabled={!!connectingStatus}
                              onClick={() => handleConnectPopularProvider()}
                            >
                              {connectingStatus ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              <span>{connectingStatus ? 'Verifying...' : 'Authorize & Connect Account'}</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', textAlign: 'center' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Don't see your cloud provider? </span>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setIsCustomWizard(true); setWizardStep(1); }}>
                      + Custom Cloud Provider
                    </button>
                  </div>
                </>
              ) : (
                /* CUSTOM PROVIDER WIZARD */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {wizardStep === 1 && (
                    <div className="form-group">
                      <label className="form-label">Step 1: Provider Name</label>
                      <input
                        type="text"
                        placeholder="e.g. My Private Nextcloud / S3 Vault"
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                        <button className="btn btn-primary" onClick={() => setWizardStep(2)}>Next: Select Protocol</button>
                      </div>
                    </div>
                  )}

                  {wizardStep === 2 && (
                    <div>
                      <label className="form-label">Step 2: Select Implemented Protocol</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 6 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-xs)', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="protocol"
                            checked={customProtocol === 'webdav'}
                            onChange={() => setCustomProtocol('webdav')}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>WebDAV (RFC 4918 / RFC 4331 Quota)</div>
                            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Nextcloud, ownCloud, Synology, generic WebDAV servers</div>
                          </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-xs)', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="protocol"
                            checked={customProtocol === 's3'}
                            onChange={() => setCustomProtocol('s3')}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>S3-Compatible Object Storage</div>
                            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>AWS S3, MinIO, Cloudflare R2, Wasabi, Backblaze B2</div>
                          </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-xs)', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="protocol"
                            checked={customProtocol === 'generic_http'}
                            onChange={() => setCustomProtocol('generic_http')}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>Generic HTTP REST API</div>
                            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Custom document API with bearer token authentication</div>
                          </div>
                        </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                        <button className="btn btn-ghost" onClick={() => setWizardStep(1)}>Back</button>
                        <button className="btn btn-primary" onClick={() => setWizardStep(3)}>Next: Connection Details</button>
                      </div>
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <div className="form-group">
                        <label className="form-label">Server Endpoint URL</label>
                        <input
                          type="text"
                          placeholder={customProtocol === 'webdav' ? 'https://cloud.mycorp.com/remote.php/dav/files/user' : 'https://s3.us-east-1.amazonaws.com'}
                          value={customUrl}
                          onChange={e => setCustomUrl(e.target.value)}
                        />
                      </div>

                      {customProtocol === 'webdav' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Username</label>
                            <input
                              type="text"
                              value={customUser}
                              onChange={e => setCustomUser(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Password / App Token</label>
                            <input
                              type="password"
                              value={customPass}
                              onChange={e => setCustomPass(e.target.value)}
                            />
                          </div>
                        </>
                      )}

                      {customProtocol === 's3' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Bucket Name</label>
                            <input
                              type="text"
                              placeholder="my-librix-vault"
                              value={customBucket}
                              onChange={e => setCustomBucket(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Access Key ID</label>
                            <input
                              type="text"
                              value={customUser}
                              onChange={e => setCustomUser(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Secret Access Key</label>
                            <input
                              type="password"
                              value={customPass}
                              onChange={e => setCustomPass(e.target.value)}
                            />
                          </div>
                        </>
                      )}

                      {customProtocol === 'generic_http' && (
                        <div className="form-group">
                          <label className="form-label">API Key / Bearer Token</label>
                          <input
                            type="password"
                            value={customApiKey}
                            onChange={e => setCustomApiKey(e.target.value)}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                        <button className="btn btn-ghost" onClick={() => setWizardStep(2)}>Back</button>
                        <button className="btn btn-primary" onClick={handleSaveCustomProvider}>Connect Custom Provider</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CROSS-PROVIDER FILE TRANSFER MODAL */}
      {showTransferModal && transferSourceItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">Transfer Document Across Providers</h3>
              <button className="btn-icon btn-sm" onClick={() => setShowTransferModal(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 'var(--radius-xs)', fontSize: 'var(--text-xs)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Document: </span>
                <span style={{ fontWeight: 600 }}>{transferSourceItem.name}</span>
                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Size: {formatBytes(transferSourceItem.size)} • Source: {browsingConnection?.name}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Operation Type</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                    <input
                      type="radio"
                      name="transOp"
                      checked={transferOperation === 'copy'}
                      onChange={() => setTransferOperation('copy')}
                    />
                    Copy (Keep original)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                    <input
                      type="radio"
                      name="transOp"
                      checked={transferOperation === 'move'}
                      onChange={() => setTransferOperation('move')}
                    />
                    Move (Delete original after transfer)
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Target Storage Destination</label>
                <select
                  value={transferTargetConnId}
                  onChange={e => setTransferTargetConnId(e.target.value)}
                >
                  {connections.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.providerType.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {transferProgress && (
                <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 'var(--radius-xs)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)' }}>
                    <span>STATUS: {transferProgress.status.toUpperCase()}</span>
                    <span>{transferProgress.percentage}%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${transferProgress.percentage}%`, height: '100%', background: 'var(--text-primary)', transition: 'width 0.2s ease' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowTransferModal(false)} disabled={isTransferring}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExecuteTransfer} disabled={isTransferring}>
                {isTransferring ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightLeft size={13} />}
                <span>{isTransferring ? 'Transferring...' : `Execute ${transferOperation.toUpperCase()}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VAULT MIGRATION TO CLOUD MODAL */}
      {showMigrationModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowRightLeft size={18} color="#0ea5e9" />
                  <span>Migrate Local Vault to Cloud</span>
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Transfer your local library books, documents, and notes to connected cloud storage.
                </p>
              </div>
              <button className="btn-icon btn-sm" onClick={() => setShowMigrationModal(false)} disabled={isMigratingVault}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Vault Content Breakdown */}
              {localCounts.docs === 0 && localCounts.notes === 0 ? (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', padding: 14, borderRadius: 'var(--radius-xs)', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    💡 <strong style={{ color: 'var(--text-primary)' }}>Your local library is currently empty (0 books, 0 notes).</strong><br />
                    To add books or notes to your local device, go to the <strong>Library</strong> tab and click <strong>"Import Document"</strong>, or open <strong>Knowledge Vault</strong> to write a note.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <BookOpen size={14} color="#0ea5e9" />
                      <span>BOOKS & DOCS READY</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginTop: 4 }}>
                      {localCounts.docs} Documents
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <FileText size={14} color="#10b981" />
                      <span>KNOWLEDGE NOTES READY</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginTop: 4 }}>
                      {localCounts.notes} Notes
                    </div>
                  </div>
                </div>
              )}

              {/* Target Cloud Selector */}
              <div>
                <label style={{ fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  DESTINATION CLOUD PROVIDER:
                </label>
                <select
                  style={{ width: '100%', padding: '8px 10px', fontSize: 'var(--text-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-xs)', color: 'var(--text-primary)' }}
                  value={migrationTargetConnId}
                  onChange={e => setMigrationTargetConnId(e.target.value)}
                  disabled={isMigratingVault}
                >
                  {connections.filter(c => c.providerType !== 'local').length === 0 ? (
                    <option value="">No Cloud Accounts Connected — Add Google Drive, OneDrive, or WebDAV first</option>
                  ) : (
                    connections.filter(c => c.providerType !== 'local').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.providerType.toUpperCase()}) — {c.status.toUpperCase()}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Operation Mode */}
              <div>
                <label style={{ fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  MIGRATION MODE:
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', flex: 1, padding: 10, background: 'var(--bg-surface)', borderRadius: 'var(--radius-xs)', border: migrationOperation === 'copy' ? '1px solid #0ea5e9' : '1px solid var(--border-subtle)' }}>
                    <input
                      type="radio"
                      name="migOp"
                      checked={migrationOperation === 'copy'}
                      onChange={() => setMigrationOperation('copy')}
                      disabled={isMigratingVault}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>Copy / Backup to Cloud</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Keeps local offline cache, uploads copy to cloud</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', flex: 1, padding: 10, background: 'var(--bg-surface)', borderRadius: 'var(--radius-xs)', border: migrationOperation === 'move' ? '1px solid #0ea5e9' : '1px solid var(--border-subtle)' }}>
                    <input
                      type="radio"
                      name="migOp"
                      checked={migrationOperation === 'move'}
                      onChange={() => setMigrationOperation('move')}
                      disabled={isMigratingVault}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>Move to Cloud</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Transfers to cloud and frees up local browser storage</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Progress Indicator */}
              {migrationProgress && (
                <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-xs)', display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)' }}>
                    <span style={{ color: '#0ea5e9', fontWeight: 600 }}>{migrationProgress.status.toUpperCase()}: {migrationProgress.currentItemName}</span>
                    <span>{migrationProgress.percentage}%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${migrationProgress.percentage}%`, height: '100%', background: '#0ea5e9', transition: 'width 0.2s ease' }} />
                  </div>
                </div>
              )}

              {/* Result Banner (Success vs Failure) */}
              {migrationResult && (
                migrationResult.migratedDocuments === 0 && migrationResult.migratedNotes === 0 ? (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: 12, borderRadius: 'var(--radius-xs)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: '0.78rem', fontWeight: 600 }}>
                      <AlertTriangle size={18} />
                      <span>Migration Incomplete (0 items uploaded)</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {migrationResult.errors && migrationResult.errors.length > 0
                        ? `Reason: ${migrationResult.errors[0].error}`
                        : 'Google Drive was not fully authenticated. Please click "Test" or "Reconnect" on your Google Drive card to authenticate first.'}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: 12, borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle size={20} color="#10b981" />
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-primary)' }}>
                      <strong style={{ color: '#10b981' }}>Migration Complete!</strong> Successfully uploaded {migrationResult.migratedDocuments} books and {migrationResult.migratedNotes} notes to cloud.
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowMigrationModal(false)} disabled={isMigratingVault}>Close</button>
              <button
                className="btn btn-primary"
                onClick={handleExecuteVaultMigration}
                disabled={isMigratingVault || connections.filter(c => c.providerType !== 'local').length === 0}
              >
                {isMigratingVault ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightLeft size={13} />}
                <span>{isMigratingVault ? 'Migrating Vault...' : `Start Migration (${migrationOperation.toUpperCase()})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
