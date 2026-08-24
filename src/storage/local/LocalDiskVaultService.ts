/**
 * LIBRIX Physical Local Disk Vault Service
 * Handles native File System Access API linking, directory creation, and instant ZIP archive export.
 * Creates and exports:
 *   📁 <vault>/Library/ (Books & Documents)
 *   📁 <vault>/Notes/ (Markdown Knowledge Notes)
 *   📄 <vault>/vault_index.json (Catalog Index)
 */

import JSZip from 'jszip';
import { db } from '../../core/db/DatabaseEngine';
import { fileBinaryStore } from '../../core/storage/FileBinaryStore';
import { DocumentDataLoader } from '../../core/storage/DocumentDataLoader';
import { cloudVaultSyncService } from '../sync/CloudVaultSyncService';
import { Note } from '../../core/types';

const DB_NAME = 'librix_disk_vault_idb';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'root_dir_handle';
const VAULT_NAME_KEY = 'librix_physical_vault_name';
const VAULT_PATH_KEY = 'librix_custom_local_vault_path';

export class LocalDiskVaultService {
  private static instance: LocalDiskVaultService | null = null;
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private isSyncing = false;

  public static getInstance(): LocalDiskVaultService {
    if (!LocalDiskVaultService.instance) {
      LocalDiskVaultService.instance = new LocalDiskVaultService();
    }
    return LocalDiskVaultService.instance;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
  }

  public getLinkedDirectoryName(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(VAULT_NAME_KEY);
  }

  public getVaultPath(): string {
    if (typeof localStorage === 'undefined') return 'Local Vault';
    return localStorage.getItem(VAULT_PATH_KEY) || 'Local Vault';
  }

  public clearAssignedPath(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(VAULT_PATH_KEY);
      localStorage.removeItem(VAULT_NAME_KEY);
    }
    this.rootHandle = null;
  }

  /**
   * Opens the IndexedDB database to persist the FileSystemDirectoryHandle
   */
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const idb = request.result;
        if (!idb.objectStoreNames.contains(STORE_NAME)) {
          idb.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const idb = await this.openDB();
      return new Promise((resolve) => {
        const tx = idb.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(HANDLE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  private async saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    try {
      const idb = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(handle, HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[LIBRIX::DiskVault] Could not persist directory handle:', err);
    }
  }

  /**
   * Retrieves active FileSystemDirectoryHandle and verifies permission
   */
  public async getActiveHandle(requestIfPrompt = false): Promise<FileSystemDirectoryHandle | null> {
    if (this.rootHandle) {
      const perm = await (this.rootHandle as any).queryPermission?.({ mode: 'readwrite' });
      if (perm === 'granted') return this.rootHandle;
      if (requestIfPrompt && (this.rootHandle as any).requestPermission) {
        const req = await (this.rootHandle as any).requestPermission({ mode: 'readwrite' });
        if (req === 'granted') return this.rootHandle;
      }
    }

    const stored = await this.getStoredHandle();
    if (stored) {
      this.rootHandle = stored;
      const perm = await (stored as any).queryPermission?.({ mode: 'readwrite' });
      if (perm === 'granted') return stored;
      if (requestIfPrompt && (stored as any).requestPermission) {
        const req = await (stored as any).requestPermission({ mode: 'readwrite' });
        if (req === 'granted') return stored;
      }
    }

    return null;
  }

  /**
   * Prompts native OS directory picker so user picks a real folder on their computer
   */
  public async pickPhysicalVaultDirectory(): Promise<{
    success: boolean;
    directoryName?: string;
    syncedDocs?: number;
    syncedNotes?: number;
    error?: string;
    isPermissionDenied?: boolean;
  }> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Native File System Access API is blocked or not exposed in this window. In Brave, try clicking Brave Shields (lion icon) and toggle shields down for localhost, or use the 1-Click Vault Export below.',
        isPermissionDenied: true,
      };
    }

    try {
      const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });

      // Verify readwrite permission
      if ((handle as any).requestPermission) {
        const status = await (handle as any).requestPermission({ mode: 'readwrite' });
        if (status !== 'granted') {
          return { success: false, error: 'Read/Write permission was not granted for the selected folder.', isPermissionDenied: true };
        }
      }

      this.rootHandle = handle;
      await this.saveHandle(handle);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(VAULT_NAME_KEY, handle.name);
        localStorage.setItem(VAULT_PATH_KEY, handle.name);
      }

      // Automatically create /Library, /Notes, vault_index.json on the physical hard drive
      await this.ensureStructure(handle);

      // Immediately export all local files and notes to the physical folder
      const syncResult = await this.syncAllToDisk();

      return {
        success: true,
        directoryName: handle.name,
        syncedDocs: syncResult.syncedDocs,
        syncedNotes: syncResult.syncedNotes,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Directory selection was cancelled.' };
      }
      return {
        success: false,
        error: err.message || 'Could not access physical directory.',
        isPermissionDenied: true,
      };
    }
  }

  /**
   * Ensures /Library, /Notes, and vault_index.json exist on the physical drive
   */
  public async ensureStructure(rootHandle?: FileSystemDirectoryHandle): Promise<void> {
    const handle = rootHandle || (await this.getActiveHandle());
    if (!handle) return;

    try {
      // 1. Create /Library directory on physical disk
      await handle.getDirectoryHandle('Library', { create: true });

      // 2. Create /Notes directory on physical disk
      await handle.getDirectoryHandle('Notes', { create: true });

      // 3. Create or update vault_index.json on physical disk
      const indexHandle = await handle.getFileHandle('vault_index.json', { create: true });
      const initialIndex = JSON.stringify(
        {
          vaultName: `LIBRIX Local Vault (${handle.name})`,
          version: '1.0',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          folders: ['Library', 'Notes'],
        },
        null,
        2
      );
      const writable = await (indexHandle as any).createWritable();
      await writable.write(initialIndex);
      await writable.close();
    } catch (err) {
      console.warn('[LIBRIX::DiskVault] Error ensuring physical directory hierarchy:', err);
    }
  }

  /**
   * Writes a document file directly into the physical disk <vault>/Library/ folder
   */
  public async saveDocumentToDisk(filename: string, data: Uint8Array): Promise<void> {
    const handle = await this.getActiveHandle();
    if (!handle) return;

    try {
      const libHandle = await handle.getDirectoryHandle('Library', { create: true });
      const fileHandle = await libHandle.getFileHandle(filename, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(data);
      await writable.close();
    } catch (err) {
      console.warn(`[LIBRIX::DiskVault] Failed to write document ${filename} to disk:`, err);
    }
  }

  /**
   * Writes a note markdown file directly into the physical disk <vault>/Notes/ folder
   */
  public async saveNoteToDisk(title: string, content: string, note?: Note): Promise<void> {
    const handle = await this.getActiveHandle();
    if (!handle) return;

    try {
      const cleanTitle = (title || 'Untitled Note').replace(/[/\\?%*:|"<>]/g, '_').trim();
      const notesHandle = await handle.getDirectoryHandle('Notes', { create: true });
      const fileHandle = await notesHandle.getFileHandle(`${cleanTitle}.md`, { create: true });
      
      const frontmatter = [
        '---',
        `title: "${title}"`,
        `id: "${note?.id || ''}"`,
        `tags: [${(note?.tags || []).map(t => `"${t}"`).join(', ')}]`,
        `updatedAt: "${new Date(note?.modifiedAt || Date.now()).toISOString()}"`,
        '---',
        '',
        content,
      ].join('\n');

      const writable = await (fileHandle as any).createWritable();
      await writable.write(frontmatter);
      await writable.close();
    } catch (err) {
      console.warn(`[LIBRIX::DiskVault] Failed to write note ${title} to disk:`, err);
    }
  }

  /**
   * Syncs all existing database documents and notes to the physical disk folder
   */
  public async syncAllToDisk(): Promise<{ syncedDocs: number; syncedNotes: number }> {
    if (this.isSyncing) return { syncedDocs: 0, syncedNotes: 0 };
    this.isSyncing = true;

    try {
      const handle = await this.getActiveHandle(true);
      if (!handle) {
        this.isSyncing = false;
        return { syncedDocs: 0, syncedNotes: 0 };
      }

      await this.ensureStructure(handle);

      const libHandle = await handle.getDirectoryHandle('Library', { create: true });
      const notesHandle = await handle.getDirectoryHandle('Notes', { create: true });

      // 1. Sync all documents
      const docs = await db.getDocuments();
      let syncedDocs = 0;
      for (const doc of docs) {
        if (doc.isTrash) continue;
        try {
          const bytes = await fileBinaryStore.getFileBytes(doc.id);
          if (bytes && bytes.length > 0) {
            const filename = doc.filename || `${doc.title}.pdf`;
            const fileHandle = await libHandle.getFileHandle(filename, { create: true });
            const writable = await (fileHandle as any).createWritable();
            await writable.write(bytes);
            await writable.close();
            syncedDocs++;
          }
        } catch (docErr) {
          console.warn(`[LIBRIX::DiskVault] Could not sync doc ${doc.title}:`, docErr);
        }
      }

      // 2. Sync all notes
      const notes = await db.getNotes();
      let syncedNotes = 0;
      for (const note of notes) {
        try {
          const cleanTitle = (note.title || 'Untitled Note').replace(/[/\\?%*:|"<>]/g, '_').trim();
          const fileHandle = await notesHandle.getFileHandle(`${cleanTitle}.md`, { create: true });
          const frontmatter = [
            '---',
            `title: "${note.title}"`,
            `id: "${note.id}"`,
            `tags: [${(note.tags || []).map(t => `"${t}"`).join(', ')}]`,
            `updatedAt: "${new Date(note.modifiedAt || Date.now()).toISOString()}"`,
            '---',
            '',
            note.content || '',
          ].join('\n');
          const writable = await (fileHandle as any).createWritable();
          await writable.write(frontmatter);
          await writable.close();
          syncedNotes++;
        } catch (noteErr) {
          console.warn(`[LIBRIX::DiskVault] Could not sync note ${note.title}:`, noteErr);
        }
      }

      // 3. Write catalog index
      try {
        const indexHandle = await handle.getFileHandle('vault_index.json', { create: true });
        const catalog = {
          vaultName: `LIBRIX Local Vault (${handle.name})`,
          version: '1.0',
          syncedAt: new Date().toISOString(),
          totalDocuments: syncedDocs,
          totalNotes: syncedNotes,
          documents: docs.filter(d => !d.isTrash).map(d => ({ id: d.id, title: d.title, filename: d.filename, size: d.size })),
          notes: notes.map(n => ({ id: n.id, title: n.title, tags: n.tags, updatedAt: n.modifiedAt })),
        };
        const writable = await (indexHandle as any).createWritable();
        await writable.write(JSON.stringify(catalog, null, 2));
        await writable.close();
      } catch {
        // ignore
      }

      this.isSyncing = false;
      return { syncedDocs, syncedNotes };
    } catch (err) {
      console.warn('[LIBRIX::DiskVault] syncAllToDisk error:', err);
      this.isSyncing = false;
      return { syncedDocs: 0, syncedNotes: 0 };
    }
  }

  /**
   * Generates a complete organized ZIP archive matching the exact cloud format:
   *   LIBRIX/
   *   ├── Library/
   *   │   └── [Nested Subfolders]/<books & pdfs>
   *   ├── Notes/
   *   │   └── [Nested Subfolders]/<markdown notes with YAML frontmatter>
   *   └── vault_index.json
   * Works 100% reliably in any browser without requiring File System API permissions.
   */
  public async exportVaultZip(): Promise<{ blob: Blob; filename: string; totalDocs: number; totalNotes: number }> {
    const zip = new JSZip();

    // 1. Export documents in organized /LIBRIX/Library/<subfolders>/ hierarchy
    const docs = await db.getDocuments({ filterTrash: false });
    let totalDocs = 0;
    for (const doc of docs) {
      if (doc.isTrash) continue;
      try {
        let bytes = await DocumentDataLoader.loadDocumentBytes(doc);
        if (!bytes || bytes.length === 0) {
          bytes = await fileBinaryStore.getFileBytes(doc.id);
        }
        if (!bytes || bytes.length === 0) {
          const fallbackText = doc.contentSnippet || `# ${doc.title}\n\nAuthor: ${doc.author || 'Unknown'}`;
          bytes = new TextEncoder().encode(fallbackText);
        }

        const targetFolder = await cloudVaultSyncService.getFolderPathString(doc.folderId, 'LIBRIX/Library');
        const filename = doc.filename || `${doc.title}.${doc.format || 'pdf'}`;
        zip.file(`${targetFolder}/${filename}`, bytes);
        totalDocs++;
      } catch (err) {
        console.warn(`[LIBRIX::DiskVault] Could not add document "${doc.title}" to ZIP:`, err);
      }
    }

    // 2. Export knowledge notes in organized /LIBRIX/Notes/<subfolders>/ hierarchy
    const notes = await db.getNotes();
    let totalNotes = 0;
    for (const note of notes) {
      try {
        const cleanTitle = (note.title || 'Untitled Note').replace(/[/\\?%*:|"<>]/g, '_').trim();
        const frontmatter = [
          '---',
          `title: "${note.title}"`,
          `id: "${note.id}"`,
          `tags: [${(note.tags || []).map(t => `"${t}"`).join(', ')}]`,
          `createdAt: "${new Date(note.createdAt || Date.now()).toISOString()}"`,
          `updatedAt: "${new Date(note.modifiedAt || Date.now()).toISOString()}"`,
          '---',
          '',
          note.content || `# ${note.title}\n\n`,
        ].join('\n');

        const targetFolder = await cloudVaultSyncService.getFolderPathString(note.folderId, 'LIBRIX/Notes');
        zip.file(`${targetFolder}/${cleanTitle}.md`, frontmatter);
        totalNotes++;
      } catch (err) {
        console.warn(`[LIBRIX::DiskVault] Could not add note "${note.title}" to ZIP:`, err);
      }
    }

    // 3. Export master catalog matching cloud format index schema
    const allFolders = await db.getFolders();
    const allCollections = await db.getCollections();
    const allTags = await db.getTags();
    const catalog = {
      version: 1,
      appName: 'LIBRIX',
      exportedAt: Date.now(),
      vaultStructure: {
        root: 'LIBRIX',
        library: 'LIBRIX/Library',
        notes: 'LIBRIX/Notes',
      },
      totalDocuments: totalDocs,
      totalNotes: totalNotes,
      totalFolders: allFolders.length,
      documents: docs.filter(d => !d.isTrash),
      notes: notes,
      folders: allFolders,
      collections: allCollections,
      tags: allTags,
    };
    zip.file('LIBRIX/vault_index.json', JSON.stringify(catalog, null, 2));

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    const filename = `LIBRIX_VAULT_${new Date().toISOString().slice(0, 10)}.zip`;
    return { blob, filename, totalDocs, totalNotes };
  }

  public async disconnect(): Promise<void> {
    this.rootHandle = null;
    try {
      const idb = await this.openDB();
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    } catch {
      // ignore
    }
    this.clearAssignedPath();
  }
}

export const localDiskVaultService = LocalDiskVaultService.getInstance();
