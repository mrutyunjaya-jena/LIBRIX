import { IStorageProvider } from '../StorageProvider';
import { db } from '../../core/db/DatabaseEngine';
import { Document, Note, Folder, DocumentFormat } from '../../core/types';
import { storageRegistry } from '../StorageRegistry';

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
    const allFolders = await db.getFolders();
    const folderMap = new Map<string, Folder>();
    allFolders.forEach(f => folderMap.set(f.id, f));

    const pathSegments: string[] = [];
    let currentId: string | null | undefined = folderId;
    const visited = new Set<string>();

    while (currentId && folderMap.has(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      const currentFolder: Folder | undefined = folderMap.get(currentId);
      if (!currentFolder) break;
      pathSegments.unshift(currentFolder.name.trim().replace(/[/\\?%*:|"<>]/g, '_'));
      currentId = currentFolder.parentId;
    }

    if (pathSegments.length === 0) return rootPrefix;
    return `${rootPrefix}/${pathSegments.join('/')}`;
  }

  /**
   * Ensures the standard LIBRIX root folder and subfolder hierarchy exist on the cloud provider:
   * /LIBRIX
   * ├── /LIBRIX/Library   (Books & Documents)
   * └── /LIBRIX/Notes     (Knowledge Vault Notes)
   */
  public async ensureRootVaultStructure(provider: IStorageProvider): Promise<{
    rootFolderId?: string;
    libraryFolderId?: string;
    notesFolderId?: string;
  }> {
    try {
      if (typeof (provider as any).getOrCreateFolderPath === 'function') {
        const rootFolderId = await (provider as any).getOrCreateFolderPath('/LIBRIX');
        const libraryFolderId = await (provider as any).getOrCreateFolderPath('/LIBRIX/Library');
        const notesFolderId = await (provider as any).getOrCreateFolderPath('/LIBRIX/Notes');
        return { rootFolderId, libraryFolderId, notesFolderId };
      }

      if (typeof provider.createFolder === 'function') {
        const root = await provider.createFolder('', 'LIBRIX').catch(() => {});
        const libFolder = await provider.createFolder('/LIBRIX', 'Library').catch(() => {});
        const notesFolder = await provider.createFolder('/LIBRIX', 'Notes').catch(() => {});
        return {
          rootFolderId: root?.id,
          libraryFolderId: libFolder?.id,
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

      // Also sync all notes as individual Markdown files to /LIBRIX/Notes
      for (const note of allNotes) {
        try {
          const targetPath = await this.getFolderPathString(note.folderId, '/LIBRIX/Notes');
          const safeTitle = (note.title || 'Untitled_Note').replace(/[/\\?%*:|"<>]/g, '_');
          const noteBytes = new TextEncoder().encode(note.content || `# ${note.title}\n\n`);
          await provider.upload(targetPath, `${safeTitle}.md`, noteBytes, 'text/markdown');
        } catch (noteUploadErr) {
          console.warn(`[LIBRIX::CloudSync] Note "${note.title}" upload error:`, noteUploadErr);
        }
      }
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

      // 2. Check if a master vault_index.json exists in /LIBRIX
      let indexRestored = false;
      try {
        const files = await provider.listFiles('/LIBRIX');
        const indexFile = files.find(f => f.name.toLowerCase() === 'vault_index.json');
        if (indexFile) {
          const rawBytes = await provider.download(indexFile.path || indexFile.id);
          if (rawBytes && rawBytes.length > 0) {
            const text = new TextDecoder().decode(rawBytes);
            const index: VaultIndexData = JSON.parse(text);

            if (index && index.appName === 'LIBRIX' && Array.isArray(index.documents)) {
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

              // Restore notes with folderId associations
              const existingNotes = await db.getNotes();
              const existingNoteIds = new Set(existingNotes.map(n => n.id));

              if (Array.isArray(index.notes)) {
                for (const note of index.notes) {
                  if (!existingNoteIds.has(note.id)) {
                    await db.saveNote(note);
                    importedNotes++;
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

        // B. Discover notes in /LIBRIX/Notes
        try {
          const noteFiles = await provider.listFiles('/LIBRIX/Notes');
          const existingNotes = await db.getNotes();
          const existingTitles = new Set(existingNotes.map(n => n.title.toLowerCase()));

          for (const file of noteFiles) {
            if (file.isDirectory) continue;
            if (!file.name.toLowerCase().endsWith('.md')) continue;

            const title = file.name.replace(/\.md$/i, '').replace(/_/g, ' ');
            if (!existingTitles.has(title.toLowerCase())) {
              let content = `# ${title}\n\n`;
              try {
                const noteBytes = await provider.download(file.path || file.id);
                if (noteBytes && noteBytes.length > 0) {
                  content = new TextDecoder().decode(noteBytes);
                }
              } catch (dlErr) {
                console.warn(`Could not download note ${file.name}:`, dlErr);
              }

              const newNote: Note = {
                id: `note_cloud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                title,
                slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                content,
                frontmatter: {},
                tags: ['Cloud'],
                wikilinks: [],
                backlinks: [],
                folderId: null,
                createdAt: file.modifiedAt || Date.now(),
                modifiedAt: file.modifiedAt || Date.now(),
              };

              await db.saveNote(newNote);
              importedNotes++;
            }
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
