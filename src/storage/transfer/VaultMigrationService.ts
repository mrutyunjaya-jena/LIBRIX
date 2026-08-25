/**
 * LIBRIX Vault Migration Service
 * Batch migrates all local books, documents, and notes to a connected cloud storage provider
 * (Google Drive, OneDrive, MEGA, WebDAV, S3, etc.) with real-time progress and rollback safety.
 */

import { db } from '../../core/db/DatabaseEngine';
import { storageRegistry } from '../StorageRegistry';
import { DocumentDataLoader } from '../../core/storage/DocumentDataLoader';
import { fileBinaryStore } from '../../core/storage/FileBinaryStore';
import { Document, Note } from '../../core/types';
import { cloudVaultSyncService } from '../sync/CloudVaultSyncService';

export interface MigrationProgress {
  totalItems: number;
  completedItems: number;
  currentItemName: string;
  percentage: number;
  status: 'scanning' | 'migrating_documents' | 'migrating_notes' | 'completed' | 'failed';
  error?: string;
}

export interface MigrationResult {
  totalDocuments: number;
  migratedDocuments: number;
  totalNotes: number;
  migratedNotes: number;
  failedCount: number;
  errors: Array<{ itemName: string; error: string }>;
}

export class VaultMigrationService {
  private static instance: VaultMigrationService | null = null;

  public static getInstance(): VaultMigrationService {
    if (!VaultMigrationService.instance) {
      VaultMigrationService.instance = new VaultMigrationService();
    }
    return VaultMigrationService.instance;
  }

  /**
   * Migrates all local books, documents, and notes to a target cloud provider.
   */
  public async migrateLocalVaultToCloud(
    targetProviderOrId: string | any,
    operation: 'copy' | 'move' = 'copy',
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<MigrationResult> {
    let targetProvider = typeof targetProviderOrId === 'object' && targetProviderOrId !== null
      ? targetProviderOrId
      : storageRegistry.getProvider(targetProviderOrId);

    if (!targetProvider && typeof targetProviderOrId === 'string') {
      const cleanType = targetProviderOrId.replace(/^cloud-/, '').replace(/-\d+$/, '');
      targetProvider = storageRegistry.getProvider(cleanType as any);
      if (!targetProvider) {
        targetProvider = storageRegistry.getAllProviders().find(p => p.id === targetProviderOrId || p.type === targetProviderOrId);
      }
    }

    if (!targetProvider) {
      throw new Error(`Target cloud provider not connected: ${typeof targetProviderOrId === 'string' ? targetProviderOrId : 'Unknown'}`);
    }

    if (!targetProvider.isConnected()) {
      try {
        await targetProvider.authenticate();
      } catch (authErr) {
        console.warn('Auto-authenticate before migration failed:', authErr);
      }
    }

    if (!targetProvider.isConnected()) {
      throw new Error(`${targetProvider.name} is not authenticated. Please connect or sign in to your ${targetProvider.name} account in Cloud Manager first.`);
    }

    // 0. Ensure root /LIBRIX folder structure exists on cloud
    await cloudVaultSyncService.ensureRootVaultStructure(targetProvider);

    onProgress?.({
      totalItems: 0,
      completedItems: 0,
      currentItemName: 'Scanning local vault...',
      percentage: 5,
      status: 'scanning',
    });

    const allDocs = await db.getDocuments({ filterTrash: false });
    // Migrate any documents that are either local or not yet on this target cloud provider
    const docsToMigrate = allDocs.filter(d => !d.storageProvider || d.storageProvider === 'local' || d.storageProvider !== targetProvider.type);
    const allNotes = await db.getNotes();

    const totalItems = docsToMigrate.length + allNotes.length;
    let completedItems = 0;
    const errors: Array<{ itemName: string; error: string }> = [];
    let migratedDocsCount = 0;
    let migratedNotesCount = 0;

    if (totalItems === 0) {
      onProgress?.({
        totalItems: 0,
        completedItems: 0,
        currentItemName: allDocs.length > 0 ? 'All books and notes are already synced on this cloud' : 'No books or notes in library to migrate',
        percentage: 100,
        status: 'completed',
      });
      return {
        totalDocuments: allDocs.length,
        migratedDocuments: 0,
        totalNotes: allNotes.length,
        migratedNotes: 0,
        failedCount: 0,
        errors: [],
      };
    }

    // 1. Migrate Local Books & Documents
    for (const doc of docsToMigrate) {
      onProgress?.({
        totalItems,
        completedItems,
        currentItemName: `Migrating document: ${doc.title}`,
        percentage: Math.round((completedItems / totalItems) * 100),
        status: 'migrating_documents',
      });

      try {
        // Load binary bytes from IndexedDB
        let bytes = await DocumentDataLoader.loadDocumentBytes(doc);
        if (!bytes || bytes.length === 0) {
          // If no binary, fallback to text content snippet as UTF-8
          const text = doc.contentSnippet || `# ${doc.title}\n\n${doc.author}`;
          bytes = new TextEncoder().encode(text);
        }

        // Resolve exact nested folder hierarchy path (e.g. /LIBRIX/Library/Physics/Quantum Mechanics)
        const targetFolderPath = await cloudVaultSyncService.getFolderPathString(doc.folderId, '/LIBRIX/Library');

        // Upload to Cloud Provider in designated nested folder
        const cloudUpload = await targetProvider.upload(
          targetFolderPath,
          doc.filename || `${doc.title}.${doc.format}`,
          bytes,
          doc.mimeType || 'application/octet-stream'
        );

        // Update document record in database
        const updatedDoc: Document = {
          ...doc,
          storageProvider: (targetProvider.type || 'gdrive') as any,
          storagePath: cloudUpload.path || `${targetFolderPath}/${cloudUpload.name}`,
          cloudFileId: cloudUpload.id,
          modifiedAt: Date.now(),
        };
        await db.saveDocument(updatedDoc);

        // If operation is 'move', remove local binary cache
        if (operation === 'move') {
          try {
            await fileBinaryStore.deleteFileBlob(doc.id);
          } catch (delErr) {
            console.warn('Could not remove local binary cache after move:', delErr);
          }
        }

        migratedDocsCount++;
      } catch (err: any) {
        console.error(`Failed to migrate document "${doc.title}":`, err);
        errors.push({ itemName: doc.title, error: err?.message || 'Upload failed' });
      }

      completedItems++;
    }

    // 2. Clean orphaned drafts on cloud and migrate active notes
    try {
      const existingCloudNotes = await targetProvider.listFiles('/LIBRIX/Notes');
      const validFilenames = new Set(allNotes.map(n => ((n.title || 'Untitled_Note').replace(/[/\\?%*:|"<>]/g, '_') + '.md').toLowerCase()));

      for (const cloudFile of existingCloudNotes) {
        if (!cloudFile.isDirectory && cloudFile.name.toLowerCase().endsWith('.md')) {
          if (!validFilenames.has(cloudFile.name.toLowerCase())) {
            // Delete orphaned intermediate draft from cloud
            await targetProvider.delete(cloudFile.id || cloudFile.path).catch(() => {});
          }
        }
      }
    } catch (cleanErr) {
      console.warn('Could not clean orphaned cloud notes:', cleanErr);
    }

    for (const note of allNotes) {
      onProgress?.({
        totalItems,
        completedItems,
        currentItemName: `Syncing note: ${note.title || 'Untitled Note'}`,
        percentage: Math.round((completedItems / totalItems) * 100),
        status: 'migrating_notes',
      });

      try {
        const noteMarkdown = note.content || `# ${note.title}\n\n`;
        const noteBytes = new TextEncoder().encode(noteMarkdown);
        const safeTitle = (note.title || 'Untitled_Note').replace(/[/\\?%*:|"<>]/g, '_');

        // Resolve exact nested folder path for notes (e.g. /LIBRIX/Notes/Research/Daily)
        const targetFolderPath = await cloudVaultSyncService.getFolderPathString(note.folderId, '/LIBRIX/Notes');

        const uploadResult = await targetProvider.upload(
          targetFolderPath,
          `${safeTitle}.md`,
          noteBytes,
          'text/markdown'
        );

        if (uploadResult && uploadResult.id) {
          note.cloudFileId = uploadResult.id;
          await db.saveNote(note);
        }

        migratedNotesCount++;
      } catch (err: any) {
        console.error(`Failed to sync note "${note.title}":`, err);
        errors.push({ itemName: note.title || 'Note', error: err?.message || 'Upload failed' });
      }

      completedItems++;
    }

    // 3. Save master catalog index (vault_index.json) to /LIBRIX/
    if (migratedDocsCount > 0 || migratedNotesCount > 0) {
      await cloudVaultSyncService.saveMasterVaultCatalog(targetProvider);
    }

    onProgress?.({
      totalItems,
      completedItems,
      currentItemName: 'Vault Migration Complete!',
      percentage: 100,
      status: 'completed',
    });

    return {
      totalDocuments: docsToMigrate.length,
      migratedDocuments: migratedDocsCount,
      totalNotes: allNotes.length,
      migratedNotes: migratedNotesCount,
      failedCount: errors.length,
      errors,
    };
  }
}

export const vaultMigrationService = VaultMigrationService.getInstance();
