/**
 * LIBRIX Universal Database Engine — Sci-Fi Workstation Edition
 * Platform-independent relational data store with full CRUD, nested folders, annotations, and persistence.
 */

import {
  Document,
  Folder,
  Collection,
  Tag,
  Bookmark,
  Annotation,
  Note,
  CloudConnection,
  SyncQueueItem,
  SyncConflict,
  LibrisChatSession,
  DocumentChunk,
  CustomAIProviderConfig,
} from '../types';

export class DatabaseEngine {
  private static instance: DatabaseEngine | null = null;

  // In-memory relational tables with persistence
  private documents = new Map<string, Document>();
  private folders = new Map<string, Folder>();
  private collections = new Map<string, Collection>();
  private tags = new Map<string, Tag>();
  private bookmarks = new Map<string, Bookmark>();
  private annotations = new Map<string, Annotation>();
  private notes = new Map<string, Note>();
  private cloudConnections = new Map<string, CloudConnection>();
  private syncQueue = new Map<string, SyncQueueItem>();
  private syncConflicts = new Map<string, SyncConflict>();
  private chatSessions = new Map<string, LibrisChatSession>();
  private documentChunks = new Map<string, DocumentChunk[]>();
  private aiProviders = new Map<string, CustomAIProviderConfig>();

  private isInitialized = false;

  public static getInstance(): DatabaseEngine {
    if (!DatabaseEngine.instance) {
      DatabaseEngine.instance = new DatabaseEngine();
    }
    return DatabaseEngine.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.loadFromStorage();
    if (this.documents.size === 0 || this.folders.size === 0) {
      this.seedInitialData();
    }
    this.isInitialized = true;
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('librix_db_docs', JSON.stringify(Array.from(this.documents.values())));
      localStorage.setItem('librix_db_folders', JSON.stringify(Array.from(this.folders.values())));
      localStorage.setItem('librix_db_cols', JSON.stringify(Array.from(this.collections.values())));
      localStorage.setItem('librix_db_tags', JSON.stringify(Array.from(this.tags.values())));
      localStorage.setItem('librix_db_bmarks', JSON.stringify(Array.from(this.bookmarks.values())));
      localStorage.setItem('librix_db_annots', JSON.stringify(Array.from(this.annotations.values())));
      localStorage.setItem('librix_db_notes', JSON.stringify(Array.from(this.notes.values())));
      localStorage.setItem('librix_db_clouds', JSON.stringify(Array.from(this.cloudConnections.values())));
      localStorage.setItem('librix_db_sync_q', JSON.stringify(Array.from(this.syncQueue.values())));
      localStorage.setItem('librix_db_conflicts', JSON.stringify(Array.from(this.syncConflicts.values())));
      localStorage.setItem('librix_db_chats', JSON.stringify(Array.from(this.chatSessions.values())));
      localStorage.setItem('librix_db_aiproviders', JSON.stringify(Array.from(this.aiProviders.values())));
    } catch (e) {
      console.warn('Storage quota warning / failed to save db snapshot', e);
    }
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const loadTable = <T extends { id: string }>(key: string, map: Map<string, T>) => {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const items: T[] = JSON.parse(raw);
            if (Array.isArray(items)) {
              items.forEach(i => {
                if (i && i.id) {
                  map.set(i.id, i);
                }
              });
            }
          } catch (parseErr) {
            console.warn(`Failed to parse ${key} from storage:`, parseErr);
          }
        }
      };

      loadTable('librix_db_docs', this.documents);
      loadTable('librix_db_folders', this.folders);
      loadTable('librix_db_cols', this.collections);
      loadTable('librix_db_tags', this.tags);
      loadTable('librix_db_bmarks', this.bookmarks);
      loadTable('librix_db_annots', this.annotations);
      loadTable('librix_db_notes', this.notes);
      loadTable('librix_db_clouds', this.cloudConnections);
      loadTable('librix_db_sync_q', this.syncQueue);
      loadTable('librix_db_conflicts', this.syncConflicts);
      loadTable('librix_db_chats', this.chatSessions);
      loadTable('librix_db_aiproviders', this.aiProviders);
    } catch (e) {
      console.error('Failed to load database from storage:', e);
    }
  }

  private seedInitialData(): void {
    // Zero demo documents, books, or notes. Clean workstation vault.
    
    // Seed Custom AI Providers (Generic Architecture)
    if (this.aiProviders.size === 0) {
      const initialAIProviders: CustomAIProviderConfig[] = [
        {
          id: 'ai-local-ollama',
          name: 'Local Ollama',
          baseUrl: 'http://localhost:11434',
          modelName: 'llama3:latest',
          isLocal: true,
          isDefault: true,
          temperature: 0.7,
          maxTokens: 1024,
        },
        {
          id: 'ai-local-lmstudio',
          name: 'LM Studio / llama.cpp',
          baseUrl: 'http://localhost:1234/v1',
          modelName: 'local-model',
          isLocal: true,
          isDefault: false,
          temperature: 0.7,
          maxTokens: 1024,
        },
      ];
      initialAIProviders.forEach(p => this.aiProviders.set(p.id, p));
    }

    // Seed Default Local Storage Provider
    if (this.cloudConnections.size === 0) {
      const clouds: CloudConnection[] = [
        {
          id: 'cloud-local-1',
          providerId: 'local',
          providerType: 'local',
          name: 'Local Workstation Flash',
          status: 'connected',
          quotaTotal: 0,
          quotaUsed: 0,
          isDefault: true,
          config: { path: '/librix_vault' },
        },
      ];
      clouds.forEach(c => this.cloudConnections.set(c.id, c));
    }

    this.saveToStorage();
  }

  // ==========================================
  // NESTED FOLDER OPERATIONS
  // ==========================================
  public async getFolders(parentId?: string | null): Promise<Folder[]> {
    await this.initialize();
    let all = Array.from(this.folders.values());
    if (parentId !== undefined) {
      all = all.filter(f => f.parentId === parentId);
    }
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  public async getFolderById(id: string): Promise<Folder | null> {
    await this.initialize();
    return this.folders.get(id) || null;
  }

  public async saveFolder(folder: Folder): Promise<void> {
    await this.initialize();
    folder.modifiedAt = Date.now();
    this.folders.set(folder.id, folder);
    this.saveToStorage();
  }

  public async deleteFolder(id: string): Promise<void> {
    await this.initialize();
    // Recursively delete subfolders and unassign documents
    const subfolders = Array.from(this.folders.values()).filter(f => f.parentId === id);
    for (const sub of subfolders) {
      await this.deleteFolder(sub.id);
    }
    // Unassign documents in this folder
    for (const doc of this.documents.values()) {
      if (doc.folderId === id) {
        doc.folderId = null;
      }
    }
    this.folders.delete(id);
    this.saveToStorage();
  }

  public async renameFolder(id: string, newName: string): Promise<void> {
    await this.initialize();
    const folder = this.folders.get(id);
    if (folder) {
      folder.name = newName;
      folder.modifiedAt = Date.now();
      this.folders.set(id, folder);
      this.saveToStorage();
    }
  }

  public async moveFolder(folderId: string, targetParentId: string | null): Promise<void> {
    await this.initialize();
    if (folderId === targetParentId) return; // cannot move into self
    const folder = this.folders.get(folderId);
    if (folder) {
      folder.parentId = targetParentId;
      folder.modifiedAt = Date.now();
      this.folders.set(folderId, folder);
      this.saveToStorage();
    }
  }

  // ==========================================
  // DOCUMENT OPERATIONS & RENAMING
  // ==========================================
  public async getDocuments(options?: {
    filterTrash?: boolean;
    folderId?: string | null;
    collectionId?: string;
    tag?: string;
    storageProvider?: string;
    searchQuery?: string;
    favoritesOnly?: boolean;
  }): Promise<Document[]> {
    await this.initialize();
    let result = Array.from(this.documents.values());

    if (options?.filterTrash !== undefined) {
      result = result.filter(d => d.isTrash === options.filterTrash);
    } else {
      result = result.filter(d => !d.isTrash);
    }

    if (options?.favoritesOnly) {
      result = result.filter(d => d.isFavorite);
    }

    if (options?.folderId !== undefined) {
      result = result.filter(d => d.folderId === options.folderId);
    }

    if (options?.collectionId) {
      result = result.filter(d => d.collections.includes(options.collectionId!));
    }

    if (options?.tag) {
      result = result.filter(d => d.tags.includes(options.tag!));
    }

    if (options?.storageProvider) {
      result = result.filter(d => d.storageProvider === options.storageProvider);
    }

    if (options?.searchQuery) {
      const q = options.searchQuery.toLowerCase();
      result = result.filter(
        d =>
          d.title.toLowerCase().includes(q) ||
          d.author.toLowerCase().includes(q) ||
          d.filename.toLowerCase().includes(q) ||
          (d.contentSnippet && d.contentSnippet.toLowerCase().includes(q)) ||
          d.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => (b.lastOpenedAt || b.modifiedAt) - (a.lastOpenedAt || a.modifiedAt));
  }

  public async getDocumentById(id: string): Promise<Document | null> {
    await this.initialize();
    return this.documents.get(id) || null;
  }

  public async saveDocument(doc: Document): Promise<void> {
    await this.initialize();
    doc.modifiedAt = Date.now();
    this.documents.set(doc.id, doc);
    this.saveToStorage();
  }

  public async renameDocument(id: string, newTitle: string, newFilename?: string): Promise<Document | null> {
    await this.initialize();
    const doc = this.documents.get(id);
    if (!doc) return null;

    doc.title = newTitle.trim();
    if (newFilename && newFilename.trim()) {
      doc.filename = newFilename.trim();
    } else {
      const ext = doc.filename.split('.').pop();
      doc.filename = `${newTitle.trim().replace(/[/\\?%*:|"<>]/g, '_')}.${ext}`;
    }
    doc.modifiedAt = Date.now();
    this.documents.set(id, doc);
    this.saveToStorage();
    return doc;
  }

  public async moveDocumentToFolder(docId: string, folderId: string | null): Promise<void> {
    await this.initialize();
    const doc = this.documents.get(docId);
    if (doc) {
      doc.folderId = folderId;
      doc.modifiedAt = Date.now();
      this.documents.set(docId, doc);
      this.saveToStorage();
    }
  }

  public async duplicateDocument(id: string): Promise<Document | null> {
    await this.initialize();
    const source = this.documents.get(id);
    if (!source) return null;

    const copy: Document = {
      ...source,
      id: `doc_copy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: `${source.title} (Copy)`,
      filename: `Copy_${source.filename}`,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      readingProgress: { percentage: 0, currentLocation: 'start', updatedAt: Date.now() },
    };
    this.documents.set(copy.id, copy);
    this.saveToStorage();
    return copy;
  }

  public async deleteDocument(id: string, permanent = false): Promise<void> {
    await this.initialize();
    const doc = this.documents.get(id);
    if (!doc) return;

    if (permanent || doc.isTrash) {
      this.documents.delete(id);
    } else {
      doc.isTrash = true;
      doc.modifiedAt = Date.now();
      this.documents.set(id, doc);
    }
    this.saveToStorage();
  }

  public async restoreDocument(id: string): Promise<void> {
    await this.initialize();
    const doc = this.documents.get(id);
    if (doc) {
      doc.isTrash = false;
      doc.modifiedAt = Date.now();
      this.documents.set(id, doc);
      this.saveToStorage();
    }
  }

  public async updateReadingProgress(docId: string, progress: { percentage: number; currentLocation: string }): Promise<void> {
    await this.initialize();
    const doc = this.documents.get(docId);
    if (doc) {
      doc.readingProgress = {
        percentage: Math.min(100, Math.max(0, Math.round(progress.percentage))),
        currentLocation: progress.currentLocation,
        updatedAt: Date.now(),
      };
      doc.lastOpenedAt = Date.now();
      this.documents.set(docId, doc);
      this.saveToStorage();
    }
  }

  // ==========================================
  // PERSISTENT ANNOTATIONS & HIGHLIGHTS
  // ==========================================
  public async getAnnotations(documentId?: string): Promise<Annotation[]> {
    await this.initialize();
    let res = Array.from(this.annotations.values());
    if (documentId) {
      res = res.filter(a => a.documentId === documentId);
    }
    return res.sort((a, b) => b.createdAt - a.createdAt);
  }

  public async saveAnnotation(annotation: Annotation): Promise<void> {
    await this.initialize();
    annotation.updatedAt = Date.now();
    this.annotations.set(annotation.id, annotation);
    this.saveToStorage();
  }

  public async updateAnnotationNote(id: string, noteText: string): Promise<void> {
    await this.initialize();
    const ann = this.annotations.get(id);
    if (ann) {
      ann.note = noteText;
      ann.updatedAt = Date.now();
      this.annotations.set(id, ann);
      this.saveToStorage();
    }
  }

  public async deleteAnnotation(id: string): Promise<void> {
    await this.initialize();
    this.annotations.delete(id);
    this.saveToStorage();
  }

  // Bookmarks
  public async getBookmarks(documentId?: string): Promise<Bookmark[]> {
    await this.initialize();
    let res = Array.from(this.bookmarks.values());
    if (documentId) {
      res = res.filter(b => b.documentId === documentId);
    }
    return res.sort((a, b) => b.createdAt - a.createdAt);
  }

  public async saveBookmark(bmark: Bookmark): Promise<void> {
    await this.initialize();
    this.bookmarks.set(bmark.id, bmark);
    this.saveToStorage();
  }

  public async deleteBookmark(id: string): Promise<void> {
    await this.initialize();
    this.bookmarks.delete(id);
    this.saveToStorage();
  }

  // Collections
  public async getCollections(): Promise<Collection[]> {
    await this.initialize();
    return Array.from(this.collections.values());
  }

  public async saveCollection(col: Collection): Promise<void> {
    await this.initialize();
    this.collections.set(col.id, col);
    this.saveToStorage();
  }

  public async deleteCollection(id: string): Promise<void> {
    await this.initialize();
    this.collections.delete(id);
    for (const doc of this.documents.values()) {
      if (doc.collections.includes(id)) {
        doc.collections = doc.collections.filter(c => c !== id);
      }
    }
    this.saveToStorage();
  }

  // Tags
  public async getTags(): Promise<Tag[]> {
    await this.initialize();
    return Array.from(this.tags.values());
  }

  public async saveTag(tag: Tag): Promise<void> {
    await this.initialize();
    this.tags.set(tag.id, tag);
    this.saveToStorage();
  }

  // Notes & Knowledge
  public async getNotes(): Promise<Note[]> {
    await this.initialize();

    // Automatic deduplication by title (keeps newest version)
    const unique = new Map<string, Note>();
    const titleMap = new Map<string, string>(); // lowercase title -> note id

    const sorted = Array.from(this.notes.values()).sort((a, b) => b.modifiedAt - a.modifiedAt);
    for (const note of sorted) {
      const cleanTitle = (note.title || '').trim().toLowerCase();
      if (!cleanTitle || cleanTitle === 'untitled note') {
        unique.set(note.id, note);
        continue;
      }
      if (!titleMap.has(cleanTitle)) {
        titleMap.set(cleanTitle, note.id);
        unique.set(note.id, note);
      }
    }

    if (unique.size !== this.notes.size) {
      this.notes = unique;
      this.saveToStorage();
    }

    return Array.from(this.notes.values()).sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  public async getNoteById(id: string): Promise<Note | null> {
    await this.initialize();
    return this.notes.get(id) || null;
  }

  public async saveNote(note: Note): Promise<void> {
    await this.initialize();
    note.modifiedAt = Date.now();

    // Remove any duplicate note with exact same title
    const cleanTitle = (note.title || '').trim().toLowerCase();
    if (cleanTitle && cleanTitle !== 'untitled note') {
      for (const [existingId, existingNote] of this.notes.entries()) {
        if (existingId !== note.id && (existingNote.title || '').trim().toLowerCase() === cleanTitle) {
          this.notes.delete(existingId);
        }
      }
    }

    this.notes.set(note.id, note);
    this.saveToStorage();
  }

  public async deleteNote(id: string): Promise<void> {
    await this.initialize();
    this.notes.delete(id);
    this.saveToStorage();
  }

  // Custom AI Providers
  public async getAIProviders(): Promise<CustomAIProviderConfig[]> {
    await this.initialize();
    return Array.from(this.aiProviders.values());
  }

  public async saveAIProvider(config: CustomAIProviderConfig): Promise<void> {
    await this.initialize();
    this.aiProviders.set(config.id, config);
    this.saveToStorage();
  }

  public async deleteAIProvider(id: string): Promise<void> {
    await this.initialize();
    this.aiProviders.delete(id);
    this.saveToStorage();
  }

  public async setDefaultAIProvider(id: string): Promise<void> {
    await this.initialize();
    for (const p of this.aiProviders.values()) {
      p.isDefault = p.id === id;
    }
    this.saveToStorage();
  }

  // Cloud Connections
  public async getCloudConnections(): Promise<CloudConnection[]> {
    await this.initialize();
    return Array.from(this.cloudConnections.values());
  }

  public async saveCloudConnection(conn: CloudConnection): Promise<void> {
    await this.initialize();
    this.cloudConnections.set(conn.id, conn);
    this.saveToStorage();
  }

  public async deleteCloudConnection(id: string): Promise<void> {
    await this.initialize();
    this.cloudConnections.delete(id);
    this.saveToStorage();
  }

  // Sync Queue & Conflicts
  public async getSyncQueue(): Promise<SyncQueueItem[]> {
    await this.initialize();
    return Array.from(this.syncQueue.values());
  }

  public async addSyncItem(item: SyncQueueItem): Promise<void> {
    await this.initialize();
    this.syncQueue.set(item.id, item);
    this.saveToStorage();
  }

  public async removeSyncItem(id: string): Promise<void> {
    await this.initialize();
    this.syncQueue.delete(id);
    this.saveToStorage();
  }

  public async getSyncConflicts(): Promise<SyncConflict[]> {
    await this.initialize();
    return Array.from(this.syncConflicts.values()).filter(c => c.status === 'unresolved');
  }

  public async saveSyncConflict(conflict: SyncConflict): Promise<void> {
    await this.initialize();
    this.syncConflicts.set(conflict.id, conflict);
    this.saveToStorage();
  }

  // Libris AI Chat History
  public async getChatSessions(docId?: string): Promise<LibrisChatSession[]> {
    await this.initialize();
    let res = Array.from(this.chatSessions.values());
    if (docId) {
      res = res.filter(c => c.documentId === docId);
    }
    return res.sort((a, b) => b.createdAt - a.createdAt);
  }

  public async saveChatSession(session: LibrisChatSession): Promise<void> {
    await this.initialize();
    this.chatSessions.set(session.id, session);
    this.saveToStorage();
  }

  // Document Chunks (for RAG)
  public async saveDocumentChunks(docId: string, chunks: DocumentChunk[]): Promise<void> {
    await this.initialize();
    this.documentChunks.set(docId, chunks);
  }

  public async getDocumentChunks(docId: string): Promise<DocumentChunk[]> {
    await this.initialize();
    return this.documentChunks.get(docId) || [];
  }

  public async getAllDocumentChunks(): Promise<DocumentChunk[]> {
    await this.initialize();
    const all: DocumentChunk[] = [];
    for (const chunks of this.documentChunks.values()) {
      all.push(...chunks);
    }
    return all;
  }
}

export const db = DatabaseEngine.getInstance();
