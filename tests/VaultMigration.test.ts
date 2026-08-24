import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseEngine } from '../src/core/db/DatabaseEngine';
import { storageRegistry } from '../src/storage/StorageRegistry';
import { vaultMigrationService } from '../src/storage/transfer/VaultMigrationService';
import { Document, Note } from '../src/core/types';
import { IStorageProvider } from '../src/storage/StorageProvider';

describe('VaultMigrationService', () => {
  let db: DatabaseEngine;

  beforeEach(async () => {
    db = DatabaseEngine.getInstance();
    await db.initialize();

    // Mock Cloud Storage Provider
    const mockCloudProvider: IStorageProvider = {
      id: 'mock_gdrive',
      name: 'Google Drive',
      type: 'gdrive',
      capabilities: {
        supportsFolders: true,
        supportsMove: true,
        supportsCopy: true,
        supportsRename: true,
        supportsTrash: true,
        supportsDirectStreaming: true,
        supportsSearch: true,
        supportsVersions: true,
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
        maxFileSize: 5 * 1024 * 1024 * 1024,
      },
      authenticate: async () => true,
      disconnect: async () => {},
      isConnected: () => true,
      upload: async (folderPath: string, fileName: string, data: Uint8Array, mimeType?: string) => ({
        id: `cloud_file_${Date.now()}_${Math.random()}`,
        name: fileName,
        path: `${folderPath}/${fileName}`,
        size: data.length,
        isDirectory: false,
        mimeType: mimeType || 'application/octet-stream',
        providerType: 'gdrive',
        providerId: 'mock_gdrive',
        modifiedAt: Date.now(),
      }),
      download: async () => new Uint8Array([1, 2, 3, 4]),
      delete: async () => {},
      listFiles: async () => [],
      getMetadata: async (path: string) => ({
        id: 'meta_1',
        name: 'meta',
        path,
        size: 100,
        isDirectory: false,
        modifiedAt: Date.now(),
        providerType: 'gdrive',
        providerId: 'mock_gdrive',
      }),
      createFolder: async (path: string, folderName: string) => ({
        id: 'fld_1',
        name: folderName,
        path: `${path}/${folderName}`,
        size: 0,
        isDirectory: true,
        modifiedAt: Date.now(),
        providerType: 'gdrive',
        providerId: 'mock_gdrive',
      }),
      getQuota: async () => ({ used: 100, total: 1000, free: 900, isAvailable: true }),
    };

    storageRegistry.registerProvider(mockCloudProvider);
  });

  it('should migrate all local documents and notes to connected cloud storage', async () => {
    // 1. Create local test document
    const localDoc: Document = {
      id: 'doc_migration_test_1',
      title: 'Local Physics Paper',
      author: 'A. Einstein',
      filename: 'physics.pdf',
      format: 'pdf',
      mimeType: 'application/pdf',
      size: 2048,
      hash: 'hash123',
      storageProvider: 'local',
      storagePath: '/local/physics.pdf',
      isFavorite: false,
      isTrash: false,
      tags: ['Science'],
      collections: [],
      contentSnippet: 'Theory of Relativity',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveDocument(localDoc);

    // 2. Create local test note
    const localNote: Note = {
      id: 'note_migration_test_1',
      title: 'Quantum Field Observations',
      slug: 'quantum-field-observations',
      content: '# Quantum Field Observations\n\nNotes on particle interactions.',
      tags: ['Quantum'],
      frontmatter: {},
      wikilinks: [],
      backlinks: [],
      folderId: null,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveNote(localNote);

    // 3. Execute migration
    const progressUpdates: any[] = [];
    const result = await vaultMigrationService.migrateLocalVaultToCloud(
      'mock_gdrive',
      'copy',
      p => progressUpdates.push(p)
    );

    expect(result.failedCount).toBe(0);
    expect(result.migratedDocuments).toBeGreaterThanOrEqual(1);
    expect(result.migratedNotes).toBeGreaterThanOrEqual(1);
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1].status).toBe('completed');

    // 4. Verify document updated in DB with cloud provider
    const updatedDoc = await db.getDocumentById('doc_migration_test_1');
    expect(updatedDoc?.storageProvider).toBe('gdrive');
    expect(updatedDoc?.storagePath).toContain('/LIBRIX/Library/physics.pdf');
    expect(updatedDoc?.cloudFileId).toBeDefined();

    // Clean up
    await db.deleteDocument('doc_migration_test_1', true);
    await db.deleteNote('note_migration_test_1');
  });
});
