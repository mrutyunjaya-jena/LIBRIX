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
          const items: T[] = JSON.parse(raw);
          items.forEach(i => map.set(i.id, i));
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
    // Seed Nested Folders
    const initialFolders: Folder[] = [
      { id: 'fld-prog', name: 'Programming', parentId: null, path: '/Programming', createdAt: Date.now(), modifiedAt: Date.now() },
      { id: 'fld-rust', name: 'Rust & Systems', parentId: 'fld-prog', path: '/Programming/Rust & Systems', createdAt: Date.now(), modifiedAt: Date.now() },
      { id: 'fld-arch', name: 'Architecture & Distributed', parentId: 'fld-prog', path: '/Programming/Architecture & Distributed', createdAt: Date.now(), modifiedAt: Date.now() },
      { id: 'fld-fin', name: 'Finance & Trading', parentId: null, path: '/Finance & Trading', createdAt: Date.now(), modifiedAt: Date.now() },
      { id: 'fld-quant', name: 'Quant & Derivatives', parentId: 'fld-fin', path: '/Finance & Trading/Quant & Derivatives', createdAt: Date.now(), modifiedAt: Date.now() },
      { id: 'fld-ai', name: 'Research & AI', parentId: null, path: '/Research & AI', createdAt: Date.now(), modifiedAt: Date.now() },
      { id: 'fld-rag', name: 'RAG & Knowledge Graphs', parentId: 'fld-ai', path: '/Research & AI/RAG & Knowledge Graphs', createdAt: Date.now(), modifiedAt: Date.now() },
      { id: 'fld-phil', name: 'Philosophy', parentId: null, path: '/Philosophy', createdAt: Date.now(), modifiedAt: Date.now() },
    ];
    initialFolders.forEach(f => this.folders.set(f.id, f));

    // Seed Collections
    const cols: Collection[] = [
      { id: 'col-1', name: 'Systems & Architecture', description: 'Low-level systems and distributed infrastructure', createdAt: Date.now() },
      { id: 'col-2', name: 'AI & Knowledge Graphs', description: 'Transformers, vectors, RAG and agents', createdAt: Date.now() },
      { id: 'col-3', name: 'Philosophy of Mind', description: 'Epistemology and rational cognition', createdAt: Date.now() },
    ];
    cols.forEach(c => this.collections.set(c.id, c));

    // Seed Tags
    const tags: Tag[] = [
      { id: 'tag-1', name: 'Rust' },
      { id: 'tag-2', name: 'Architecture' },
      { id: 'tag-3', name: 'AI-Agents' },
      { id: 'tag-4', name: 'Algorithms' },
      { id: 'tag-5', name: 'Epistemology' },
      { id: 'tag-6', name: 'Privacy' },
    ];
    tags.forEach(t => this.tags.set(t.id, t));

    // Seed Documents with folder mappings
    const docs: Document[] = [
      {
        id: 'doc-1',
        title: 'The Rust Programming Language',
        author: 'Steve Klabnik & Carol Nichols',
        filename: 'The_Rust_Programming_Language.epub',
        format: 'epub',
        mimeType: 'application/epub+zip',
        size: 4820000,
        hash: 'a94f82c',
        storageProvider: 'local',
        storagePath: '/Programming/Rust & Systems/The_Rust_Programming_Language.epub',
        folderId: 'fld-rust',
        isFavorite: true,
        isTrash: false,
        tags: ['Rust', 'Architecture'],
        collections: ['col-1'],
        readingProgress: { percentage: 42, currentLocation: 'chapter-4', updatedAt: Date.now() - 3600000 },
        contentSnippet: 'Rust is a systems programming language that empowers everyone to build reliable and efficient software. Memory safety without garbage collection is its signature achievement.',
        createdAt: Date.now() - 86400000 * 5,
        modifiedAt: Date.now() - 86400000 * 2,
        lastOpenedAt: Date.now() - 3600000,
      },
      {
        id: 'doc-2',
        title: 'Designing Data-Intensive Applications',
        author: 'Martin Kleppmann',
        filename: 'Designing_Data_Intensive_Applications.pdf',
        format: 'pdf',
        mimeType: 'application/pdf',
        size: 14500000,
        hash: 'b12c98d',
        storageProvider: 'gdrive',
        storagePath: 'GoogleDrive://Programming/Architecture & Distributed/Designing_Data_Intensive_Applications.pdf',
        folderId: 'fld-arch',
        isFavorite: true,
        isTrash: false,
        tags: ['Architecture', 'Algorithms'],
        collections: ['col-1'],
        readingProgress: { percentage: 78, currentLocation: 'page-214', updatedAt: Date.now() - 7200000 },
        contentSnippet: 'Data systems are at the heart of modern software. This book explores storage engines, replication, partitioning, transactions, and consensus protocols.',
        createdAt: Date.now() - 86400000 * 12,
        modifiedAt: Date.now() - 86400000 * 4,
        lastOpenedAt: Date.now() - 7200000,
      },
      {
        id: 'doc-3',
        title: 'Attention Is All You Need',
        author: 'Vaswani et al. (Google Brain)',
        filename: 'Attention_Is_All_You_Need.pdf',
        format: 'pdf',
        mimeType: 'application/pdf',
        size: 2200000,
        hash: 'c87d41f',
        storageProvider: 'telegram',
        storagePath: 'Telegram://Research & AI/Attention_Is_All_You_Need.pdf',
        folderId: 'fld-ai',
        isFavorite: false,
        isTrash: false,
        tags: ['AI-Agents', 'Algorithms'],
        collections: ['col-2'],
        readingProgress: { percentage: 100, currentLocation: 'page-1', updatedAt: Date.now() - 86400000 },
        contentSnippet: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose the Transformer, a model architecture eschewing recurrence and relying entirely on an attention mechanism.',
        createdAt: Date.now() - 86400000 * 20,
        modifiedAt: Date.now() - 86400000 * 8,
        lastOpenedAt: Date.now() - 86400000,
      },
      {
        id: 'doc-4',
        title: 'Clean Architecture in Modern Systems',
        author: 'Robert C. Martin',
        filename: 'Clean_Architecture.epub',
        format: 'epub',
        mimeType: 'application/epub+zip',
        size: 3800000,
        hash: 'd45e12a',
        storageProvider: 'mega',
        storagePath: 'MEGA://Programming/Clean_Architecture.epub',
        folderId: 'fld-prog',
        isFavorite: false,
        isTrash: false,
        tags: ['Architecture'],
        collections: ['col-1'],
        readingProgress: { percentage: 18, currentLocation: 'chapter-2', updatedAt: Date.now() - 86400000 * 3 },
        contentSnippet: 'The center of your application is not the database. Nor is it one of the frameworks you may be using. The center of your application is the use cases of your application.',
        createdAt: Date.now() - 86400000 * 15,
        modifiedAt: Date.now() - 86400000 * 3,
        lastOpenedAt: Date.now() - 86400000 * 3,
      },
      {
        id: 'doc-5',
        title: 'Meditationes de Prima Philosophia',
        author: 'René Descartes',
        filename: 'Meditations_on_First_Philosophy.md',
        format: 'markdown',
        mimeType: 'text/markdown',
        size: 98000,
        hash: 'e99b33c',
        storageProvider: 'local',
        storagePath: '/Philosophy/Meditations_on_First_Philosophy.md',
        folderId: 'fld-phil',
        isFavorite: true,
        isTrash: false,
        tags: ['Epistemology'],
        collections: ['col-3'],
        readingProgress: { percentage: 65, currentLocation: 'line-420', updatedAt: Date.now() - 86400000 * 2 },
        contentSnippet: 'Cogito, ergo sum. I noticed that while I was wishing to think everything false, it was necessarily true that I who thought so was something.',
        createdAt: Date.now() - 86400000 * 30,
        modifiedAt: Date.now() - 86400000 * 2,
        lastOpenedAt: Date.now() - 86400000 * 2,
      },
      {
        id: 'doc-6',
        title: 'Decentralized Vector Indexes & RAG Architecture',
        author: 'Librix Research Group',
        filename: 'Decentralized_RAG_Architecture.md',
        format: 'markdown',
        mimeType: 'text/markdown',
        size: 142000,
        hash: 'f00a77b',
        storageProvider: 'terabox',
        storagePath: 'TeraBox://Research & AI/RAG & Knowledge Graphs/Decentralized_RAG_Architecture.md',
        folderId: 'fld-rag',
        isFavorite: true,
        isTrash: false,
        tags: ['AI-Agents', 'Architecture', 'Privacy'],
        collections: ['col-2'],
        readingProgress: { percentage: 90, currentLocation: 'section-5', updatedAt: Date.now() - 14400000 },
        contentSnippet: 'Privacy-preserving Retrieval-Augmented Generation requires local vector embeddings and chunk-level similarity scoring without broadcasting sensitive vaults to public clouds.',
        createdAt: Date.now() - 86400000 * 7,
        modifiedAt: Date.now() - 14400000,
        lastOpenedAt: Date.now() - 14400000,
      }
    ];
    docs.forEach(d => this.documents.set(d.id, d));

    // Seed Notes (Obsidian-Style Knowledge Management)
    const notes: Note[] = [
      {
        id: 'note-1',
        title: 'Universal Storage Architecture',
        slug: 'universal-storage-architecture',
        folderId: 'fld-arch',
        content: `# Universal Storage Architecture\n\nLibrix implements a high-performance, decoupled storage provider abstraction that bridges [[Local Storage]], [[Google Drive]], [[MEGA]], [[TeraBox]], and [[Telegram Storage]].\n\n## Key Architectural Tenets\n- **Zero Single-Platform Assumption**: Works equally well on Linux, Windows, macOS, Android SAF, and iOS Files.\n- **Unified Library Concept**: The user views documents seamlessly regardless of whether they reside in local flash or remote cloud buckets.\n- **Offline First**: All metadata, notes, and cached books remain instantly queryable via [[SQLite Universal Engine]].\n\n#Architecture #Privacy`,
        frontmatter: {
          title: 'Universal Storage Architecture',
          tags: ['Architecture', 'Privacy'],
          status: 'verified',
          created: '2026-08-20',
        },
        tags: ['Architecture', 'Privacy'],
        wikilinks: ['Local Storage', 'Google Drive', 'MEGA', 'TeraBox', 'Telegram Storage', 'SQLite Universal Engine'],
        backlinks: ['note-2', 'note-3'],
        createdAt: Date.now() - 86400000 * 4,
        modifiedAt: Date.now() - 3600000 * 2,
      },
      {
        id: 'note-2',
        title: 'Libris AI & Document RAG',
        slug: 'libris-ai-and-document-rag',
        folderId: 'fld-rag',
        content: `# Libris AI & Document RAG\n\nLibris is the private, intelligent knowledge companion in Librix. Built to interact with books, papers, and personal notes without violating data privacy.\n\n## Core Capabilities\n- **Local AI Provider**: Native integration with [[Ollama]] and [[LM Studio]] running locally.\n- **Document-Aware RAG**: Paragraph-level chunking with TF-IDF and vector cosine similarity search.\n- **Source Citations**: Every answer directly links back to the exact page or CFI location in the document.\n\nSee also: [[Universal Storage Architecture]] and [[Knowledge Graph Physics]].\n\n#AI-Agents #Privacy`,
        frontmatter: {
          title: 'Libris AI & Document RAG',
          tags: ['AI-Agents', 'Privacy'],
          status: 'in-progress',
          created: '2026-08-22',
        },
        tags: ['AI-Agents', 'Privacy'],
        wikilinks: ['Ollama', 'LM Studio', 'Universal Storage Architecture', 'Knowledge Graph Physics'],
        backlinks: ['note-1'],
        createdAt: Date.now() - 86400000 * 2,
        modifiedAt: Date.now() - 3600000,
      },
      {
        id: 'note-3',
        title: 'Knowledge Graph Physics',
        slug: 'knowledge-graph-physics',
        folderId: 'fld-rag',
        content: `# Knowledge Graph Physics\n\nLibrix renders relationships between notes, books, tags, and authors via a high-performance 2D Canvas force-directed simulation.\n\n## Link Types\n1. **Wikilinks**: Explicit bidirectional connections \`[[Target]]\`.\n2. **Tag Clusters**: Implicit semantic grouping via shared \`#tags\`.\n3. **Document Attachments**: Notes citing or summarizing specific books in the library.\n\nConnected to: [[Universal Storage Architecture]] and [[Libris AI & Document RAG]].\n\n#Graph #KnowledgeManagement`,
        frontmatter: {
          title: 'Knowledge Graph Physics',
          tags: ['Graph', 'KnowledgeManagement'],
          status: 'verified',
          created: '2026-08-23',
        },
        tags: ['Graph', 'KnowledgeManagement'],
        wikilinks: ['Universal Storage Architecture', 'Libris AI & Document RAG'],
        backlinks: ['note-2'],
        createdAt: Date.now() - 86400000,
        modifiedAt: Date.now() - 1800000,
      }
    ];
    notes.forEach(n => this.notes.set(n.id, n));

    // Seed Custom AI Providers (Generic Architecture)
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
      {
        id: 'ai-custom-remote',
        name: 'Custom Research Server',
        baseUrl: 'https://ai.example.com/v1',
        modelName: 'deepseek-r1-70b',
        isLocal: false,
        isDefault: false,
        temperature: 0.6,
        maxTokens: 2048,
      },
    ];
    initialAIProviders.forEach(p => this.aiProviders.set(p.id, p));

    // Seed Initial Annotations (Persistent Multi-Highlighting)
    const initialAnnots: Annotation[] = [
      {
        id: 'annot-1',
        documentId: 'doc-1',
        location: 'chapter-4',
        selectedText: 'Memory safety without garbage collection is its signature achievement.',
        note: 'Key insight for low-overhead cross-platform workers.',
        style: 'box',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 86400000,
      },
      {
        id: 'annot-2',
        documentId: 'doc-2',
        location: 'page-214',
        selectedText: 'Data systems are at the heart of modern software.',
        note: 'Foundation of Librix multi-cloud metadata engine.',
        style: 'underline',
        createdAt: Date.now() - 3600000 * 5,
        updatedAt: Date.now() - 3600000 * 5,
      },
    ];
    initialAnnots.forEach(a => this.annotations.set(a.id, a));

    // Seed Cloud Connections
    const clouds: CloudConnection[] = [
      { id: 'cloud-1', providerId: 'local', providerType: 'local', name: 'Local Workstation Flash', status: 'connected', quotaTotal: 512000000000, quotaUsed: 84000000000, isDefault: true, config: { path: '/home/librix/library' } },
      { id: 'cloud-2', providerId: 'gdrive-main', providerType: 'gdrive', name: 'Google Drive Sync', accountEmail: 'operator@librix.terminal', status: 'connected', quotaTotal: 15000000000, quotaUsed: 6200000000, isDefault: false, config: {} },
      { id: 'cloud-3', providerId: 'telegram-vault', providerType: 'telegram', name: 'Telegram Document Stream', accountEmail: '@librix_research_vault', status: 'connected', quotaTotal: 0, quotaUsed: 430000000, isDefault: false, config: { channelId: '-1004928192' } },
      { id: 'cloud-4', providerId: 'mega-store', providerType: 'mega', name: 'MEGA Encrypted Vault', accountEmail: 'archive@librix.terminal', status: 'connected', quotaTotal: 20000000000, quotaUsed: 3800000000, isDefault: false, config: {} },
    ];
    clouds.forEach(c => this.cloudConnections.set(c.id, c));

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
    return Array.from(this.notes.values()).sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  public async getNoteById(id: string): Promise<Note | null> {
    await this.initialize();
    return this.notes.get(id) || null;
  }

  public async saveNote(note: Note): Promise<void> {
    await this.initialize();
    note.modifiedAt = Date.now();
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
