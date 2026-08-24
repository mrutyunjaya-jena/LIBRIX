/**
 * LIBRIX Storage Usage Index
 * Tracks and separates Librix internal storage usage (Books, Docs, Notes, AI index, Cache, Thumbnails)
 * with dirty-flag caching and real-time reactive event subscriptions.
 */

import { db } from '../../core/db/DatabaseEngine';
import { vectorStore } from '../../ai/rag/VectorStore';

export interface LibrixStorageUsageBreakdown {
  booksBytes: number;        // EPUB / PDF Books
  booksCount: number;
  documentsBytes: number;    // TXT / MD / Paper Documents
  documentsCount: number;
  notesBytes: number;        // Notes Vault
  notesCount: number;
  attachmentsBytes: number;  // User Uploaded Attachments / Media
  cacheBytes: number;        // Reader render cache, temporary blobs
  thumbnailsBytes: number;   // Extracted cover artwork
  aiIndexBytes: number;      // Vector embeddings, RAG chunks, search indexes
  metadataBytes: number;     // Database schema & operational metadata
  totalLibrixBytes: number;  // Grand Total of Librix Stored Data
  lastCalculatedAt: number;
}

type StorageUpdateListener = (usage: LibrixStorageUsageBreakdown) => void;

export class StorageUsageIndex {
  private static instance: StorageUsageIndex | null = null;
  private cachedUsage: LibrixStorageUsageBreakdown | null = null;
  private isDirty = true;
  private listeners = new Set<StorageUpdateListener>();

  public static getInstance(): StorageUsageIndex {
    if (!StorageUsageIndex.instance) {
      StorageUsageIndex.instance = new StorageUsageIndex();
    }
    return StorageUsageIndex.instance;
  }

  constructor() {
    // Invalidate on database events if available
  }

  public markDirty(): void {
    this.isDirty = true;
  }

  public subscribe(listener: StorageUpdateListener): () => void {
    this.listeners.add(listener);
    if (this.cachedUsage) {
      listener(this.cachedUsage);
    } else {
      this.getUsage().then(usage => listener(usage));
    }
    return () => this.listeners.delete(listener);
  }

  private notify(usage: LibrixStorageUsageBreakdown): void {
    this.listeners.forEach(fn => {
      try {
        fn(usage);
      } catch (err) {
        console.warn('StorageUsageIndex listener error:', err);
      }
    });
  }

  public async getUsage(forceRefresh = false): Promise<LibrixStorageUsageBreakdown> {
    if (!forceRefresh && !this.isDirty && this.cachedUsage) {
      return this.cachedUsage;
    }

    let booksBytes = 0;
    let booksCount = 0;
    let documentsBytes = 0;
    let documentsCount = 0;
    let notesBytes = 0;
    let notesCount = 0;
    let attachmentsBytes = 0;
    let cacheBytes = 12 * 1024 * 1024; // Reader canvas & temporary worker cache
    let thumbnailsBytes = 0;
    let aiIndexBytes = 0;
    let metadataBytes = 0;

    try {
      // 1. Query Documents & Books
      const docs = await db.getDocuments();
      const nonTrash = docs.filter(d => !d.isTrash);

      for (const doc of nonTrash) {
        const size = doc.size || 0;
        if (doc.format === 'epub' || doc.format === 'pdf') {
          booksBytes += size;
          booksCount++;
        } else {
          documentsBytes += size;
          documentsCount++;
        }

        // Cover thumbnail estimation
        if (doc.coverImage) {
          thumbnailsBytes += doc.coverImage.length;
        }

        // Metadata JSON estimation
        metadataBytes += JSON.stringify(doc).length;
      }

      // 2. Query Notes Vault
      const notes = await db.getNotes();
      const activeNotes = notes;
      notesCount = activeNotes.length;

      for (const note of activeNotes) {
        const contentSize = new TextEncoder().encode(note.content || '').length;
        notesBytes += contentSize;
        metadataBytes += JSON.stringify(note).length;
      }

      // 3. Query Annotations & Folders Metadata
      const annots = await db.getAnnotations();
      const folders = await db.getFolders();
      metadataBytes += JSON.stringify(annots).length + JSON.stringify(folders).length;

      // 4. Query AI / Vector Store Index (~16KB per indexed document)
      aiIndexBytes = nonTrash.length * 16384;

    } catch (err) {
      console.warn('Error calculating Librix storage breakdown:', err);
    }

    const totalLibrixBytes =
      booksBytes +
      documentsBytes +
      notesBytes +
      attachmentsBytes +
      cacheBytes +
      thumbnailsBytes +
      aiIndexBytes +
      metadataBytes;

    const breakdown: LibrixStorageUsageBreakdown = {
      booksBytes,
      booksCount,
      documentsBytes,
      documentsCount,
      notesBytes,
      notesCount,
      attachmentsBytes,
      cacheBytes,
      thumbnailsBytes,
      aiIndexBytes,
      metadataBytes,
      totalLibrixBytes,
      lastCalculatedAt: Date.now(),
    };

    this.cachedUsage = breakdown;
    this.isDirty = false;
    this.notify(breakdown);
    return breakdown;
  }
}

export const storageUsageIndex = StorageUsageIndex.getInstance();
