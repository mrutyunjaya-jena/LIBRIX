import { IStorageProvider } from '../StorageProvider';
import { db } from '../../core/db/DatabaseEngine';
import { Document, Note, Folder, DocumentFormat } from '../../core/types';
import { storageRegistry } from '../StorageRegistry';
import { parseNoteContent } from '../../notes/WikilinkParser';

export interface VaultIndexData {
  version: number;
  appName: 'LIBRIX';
  exportedAt: number;
  documents: Document[];
  notes: Note[];
  folders?: Folder[];
}

export class CloudVaultSyncService {
  private static instance: CloudVaultSyncService | null = null;
  private syncingProviders = new Set<string>();

  public static getInstance(): CloudVaultSyncService {
    if (!CloudVaultSyncService.instance) {
      CloudVaultSyncService.instance = new CloudVaultSyncService();
    }
    return CloudVaultSyncService.instance;
  }

  /**
   * Constructs the full hierarchical folder path for a given folder ID.
   * e.g. folderId -> '/LIBRIX/Library/Computer Science/Operating Systems'
   */
  public async getFolderPathString(folderId: string | null | undefined, rootPrefix: string): Promise<string> {
    if (!folderId) return rootPrefix;

    const hierarchy: string[] = [];
    let currentId: string | null = folderId;
    let guard = 0;

    while (currentId && guard < 20) {
      guard++;
      const folder = await db.getFolderById(currentId);
      if (!folder) break;
      hierarchy.unshift(folder.name);
      currentId = folder.parentId;
    }

    if (hierarchy.length === 0) return rootPrefix;
    return `${rootPrefix}/${hierarchy.join('/')}`;
  }

  /**
   * Ensures root /LIBRIX, /LIBRIX/Library, and /LIBRIX/Notes folders exist on cloud provider.
   */
  public async ensureRootVaultStructure(provider: IStorageProvider): Promise<{
    rootFolderId?: string;
    libraryFolderId?: string;
    notesFolderId?: string;
  }> {
    try {
      if ('getOrCreateFolderPath' in provider && typeof (provider as any).getOrCreateFolderPath === 'function') {
        const rootFolderId = await (provider as any).getOrCreateFolderPath('/LIBRIX');
        const libraryFolderId = await (provider as any).getOrCreateFolderPath('/LIBRIX/Library');
        const notesFolderId = await (provider as any).getOrCreateFolderPath('/LIBRIX/Notes');
        return { rootFolderId, libraryFolderId, notesFolderId };
      } else {
        const rootItems = await provider.listFiles('');
        let librixFolder = rootItems.find(i => i.isDirectory && i.name.toUpperCase() === 'LIBRIX');
        if (!librixFolder) {
          librixFolder = await provider.createFolder('', 'LIBRIX');
        }
        const librixSubItems = await provider.listFiles('/LIBRIX');
        let libraryFolder = librixSubItems.find(i => i.isDirectory && i.name.toUpperCase() === 'LIBRARY');
        if (!libraryFolder) {
          libraryFolder = await provider.createFolder('/LIBRIX', 'Library');
        }
        let notesFolder = librixSubItems.find(i => i.isDirectory && i.name.toUpperCase() === 'NOTES');
        if (!notesFolder) {
          notesFolder = await provider.createFolder('/LIBRIX', 'Notes');
        }
        return {
          rootFolderId: librixFolder?.id,
          libraryFolderId: libraryFolder?.id,
          notesFolderId: notesFolder?.id,
        };
      }
    } catch (err) {
      console.warn(`[LIBRIX::CloudSync] Could not ensure root folder hierarchy on ${provider.name}:`, err);
    }
    return {};
  }

  /**
   * Saves the master catalog index (vault_index.json) to /LIBRIX/ on the cloud provider.
   * Enables instant automatic restore when logging in from any device or browser.
   */
  public async saveMasterVaultCatalog(provider: IStorageProvider): Promise<void> {
    try {
      await this.ensureRootVaultStructure(provider);

      const allDocs = await db.getDocuments({ filterTrash: false });
      const allNotes = await db.getNotes();
      const allFolders = await db.getFolders();

      const indexData: VaultIndexData = {
        version: 1,
        appName: 'LIBRIX',
        exportedAt: Date.now(),
        documents: allDocs,
        notes: allNotes,
        folders: allFolders,
      };

      const payload = new TextEncoder().encode(JSON.stringify(indexData, null, 2));
      await provider.upload('/LIBRIX', 'vault_index.json', payload, 'application/json');
    } catch (err) {
      console.warn(`[LIBRIX::CloudSync] Failed to save vault_index.json to ${provider.name}:`, err);
    }
  }

  /**
   * Synchronizes and automatically imports all books, notes, and index catalog
   * from the cloud account into the local LIBRIX library upon login/connect,
   * restoring the exact nested folder hierarchy.
   */
  public async syncFromCloudOnLogin(provider: IStorageProvider): Promise<{
    importedDocuments: number;
    importedNotes: number;
  }> {
    if (this.syncingProviders.has(provider.id)) {
      return { importedDocuments: 0, importedNotes: 0 };
    }

    this.syncingProviders.add(provider.id);
    let importedDocuments = 0;
    let importedNotes = 0;

    try {
      // 1. Ensure root folders exist
      await this.ensureRootVaultStructure(provider);

      // 2. Check for master index (vault_index.json)
      let indexRestored = false;
      try {
        const rootFiles = await provider.listFiles('/LIBRIX');
        const indexFile = rootFiles.find(f => f.name.toLowerCase() === 'vault_index.json');

        if (indexFile) {
          const indexBytes = await provider.download(indexFile.path || indexFile.id);
          if (indexBytes && indexBytes.length > 0) {
            const indexJson = new TextDecoder().decode(indexBytes);
            const index: VaultIndexData = JSON.parse(indexJson);

            if (index && Array.isArray(index.documents)) {
              // Restore folders with exact hierarchy
              if (Array.isArray(index.folders)) {
                for (const f of index.folders) {
                  await db.saveFolder(f);
                }
              }

              // Restore documents metadata with folderId associations
              const existingDocs = await db.getDocuments({ filterTrash: false });
              const existingDocIds = new Set(existingDocs.map(d => d.id));

              for (const doc of index.documents) {
                if (!existingDocIds.has(doc.id)) {
                  const cloudDoc: Document = {
                    ...doc,
                    storageProvider: provider.type,
                    storagePath: doc.storagePath || `/LIBRIX/Library/${doc.filename}`,
                  };
                  await db.saveDocument(cloudDoc);
                  importedDocuments++;
                }
              }

              // Restore notes ONLY if the file actually exists in /LIBRIX/Notes on cloud
              const existingNotes = await db.getNotes();
              const existingNoteIds = new Set(existingNotes.map(n => n.id));
              const existingTitles = new Set(existingNotes.map(n => (n.title || '').trim().toLowerCase()));

              const cloudNoteFiles = await provider.listFiles('/LIBRIX/Notes').catch(() => []);
              const existingCloudNoteTitles = new Set(
                cloudNoteFiles
                  .filter(f => !f.isDirectory && f.name.toLowerCase().endsWith('.md'))
                  .map(f => f.name.replace(/\.md$/i, '').replace(/_/g, ' ').trim().toLowerCase())
              );

              if (Array.isArray(index.notes) && existingCloudNoteTitles.size > 0) {
                for (const note of index.notes) {
                  const titleKey = (note.title || '').trim().toLowerCase();
                  if (!existingCloudNoteTitles.has(titleKey)) {
                    // Note file was deleted on Google Drive, do NOT restore it
                    continue;
                  }
                  if (!existingNoteIds.has(note.id) && (!titleKey || titleKey === 'untitled note' || !existingTitles.has(titleKey))) {
                    await db.saveNote(note);
                    existingNoteIds.add(note.id);
                    if (titleKey && titleKey !== 'untitled note') existingTitles.add(titleKey);
                    importedNotes++;
                  } else if (existingNoteIds.has(note.id)) {
                    const local = existingNotes.find(n => n.id === note.id);
                    if (local && note.modifiedAt > (local.modifiedAt || 0)) {
                      await db.saveNote(note);
                    }
                  }
                }
              }

              indexRestored = true;
            }
          }
        }
      } catch (indexErr) {
        console.warn(`[LIBRIX::CloudSync] Could not read vault_index.json:`, indexErr);
      }

      // 3. Fallback / Direct Discovery: Scan /LIBRIX/Library and /LIBRIX/Notes directly
      if (!indexRestored) {
        // A. Discover books in /LIBRIX/Library or across the entire cloud account
        try {
          let libraryFiles = await provider.listFiles('/LIBRIX/Library');
          if (libraryFiles.length === 0) {
            libraryFiles = await provider.listFiles('');
          }
          const existingDocs = await db.getDocuments({ filterTrash: false });
          const existingNames = new Set(existingDocs.map(d => (d.filename || '').toLowerCase()));

          for (const file of libraryFiles) {
            if (file.isDirectory) continue;
            if (file.name.toLowerCase() === 'vault_index.json') continue;

            const nameLower = file.name.toLowerCase();
            if (!existingNames.has(nameLower)) {
              const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
              const format = (['pdf', 'epub', 'markdown', 'md', 'txt', 'mobi', 'docx'].includes(ext)
                ? ext === 'md' ? 'markdown' : ext
                : 'unknown') as DocumentFormat;

              const docId = `doc_cloud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              const newDoc: Document = {
                id: docId,
                title: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
                author: `${provider.name} Library`,
                filename: file.name,
                format,
                mimeType: file.mimeType || 'application/octet-stream',
                size: file.size,
                hash: 'hash_' + file.id,
                storageProvider: provider.type,
                storagePath: file.path || `/LIBRIX/Library/${file.name}`,
                cloudFileId: file.id,
                folderId: null,
                isFavorite: false,
                isTrash: false,
                tags: ['Cloud', provider.type.toUpperCase()],
                collections: [],
                createdAt: file.modifiedAt || Date.now(),
                modifiedAt: file.modifiedAt || Date.now(),
              };

              await db.saveDocument(newDoc);
              importedDocuments++;
            }
          }
        } catch (libErr) {
          console.warn(`[LIBRIX::CloudSync] Could not list /LIBRIX/Library:`, libErr);
        }

        // B. Discover notes in /LIBRIX/Notes with strict deduplication
        try {
          const noteFiles = await provider.listFiles('/LIBRIX/Notes');
          const existingNotes = await db.getNotes();
          const existingNoteIds = new Set(existingNotes.map(n => n.id));
          const existingTitles = new Set(existingNotes.map(n => (n.title || '').trim().toLowerCase()));
          const processedInBatch = new Set<string>();

          for (const file of noteFiles) {
            if (file.isDirectory) continue;
            if (!file.name.toLowerCase().endsWith('.md')) continue;

            const baseName = file.name.replace(/\.md$/i, '').replace(/_/g, ' ').trim();
            const baseKey = baseName.toLowerCase();

            if (existingTitles.has(baseKey) || processedInBatch.has(baseKey)) {
              continue;
            }
            processedInBatch.add(baseKey);

            let content = `# ${baseName}\n\n`;
            try {
              const noteBytes = await provider.download(file.path || file.id);
              if (noteBytes && noteBytes.length > 0) {
                content = new TextDecoder().decode(noteBytes);
              }
            } catch (dlErr) {
              console.warn(`Could not download note ${file.name}:`, dlErr);
            }

            const parsed = parseNoteContent(content);
            const resolvedTitle = parsed.frontmatter?.title || parsed.title || baseName;
            const resolvedId = parsed.frontmatter?.id || `note_cloud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const resolvedKey = resolvedTitle.trim().toLowerCase();

            if (existingNoteIds.has(resolvedId) || (resolvedKey !== 'untitled note' && existingTitles.has(resolvedKey))) {
              continue;
            }

            const newNote: Note = {
              id: resolvedId,
              title: resolvedTitle,
              slug: resolvedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              content,
              frontmatter: parsed.frontmatter || {},
              tags: parsed.tags.length > 0 ? parsed.tags : ['Cloud'],
              wikilinks: parsed.wikilinks || [],
              backlinks: [],
              folderId: null,
              createdAt: file.modifiedAt || Date.now(),
              modifiedAt: file.modifiedAt || Date.now(),
            };

            await db.saveNote(newNote);
            existingNoteIds.add(newNote.id);
            if (resolvedKey !== 'untitled note') existingTitles.add(resolvedKey);
            importedNotes++;
          }
        } catch (noteErr) {
          console.warn(`[LIBRIX::CloudSync] Could not list /LIBRIX/Notes:`, noteErr);
        }
      }
    } finally {
      this.syncingProviders.delete(provider.id);
    }

    return { importedDocuments, importedNotes };
  }
}

export const cloudVaultSyncService = CloudVaultSyncService.getInstance();
