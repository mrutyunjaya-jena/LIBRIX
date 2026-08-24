/**
 * LIBRIX Universal Core Types & Interfaces
 */

export type DocumentFormat =
  | 'epub'
  | 'pdf'
  | 'markdown'
  | 'txt'
  | 'docx'
  | 'mobi'
  | 'azw3'
  | 'cbz'
  | 'cbr'
  | 'csv'
  | 'json'
  | 'yaml'
  | 'code'
  | 'image'
  | 'unknown';

export type StorageProviderType =
  | 'local'
  | 'gdrive'
  | 'mega'
  | 'mediafire'
  | 'onebox'
  | 'terabox'
  | 'telegram'
  | 'custom';

export interface Document {
  id: string;
  title: string;
  author: string;
  filename: string;
  format: DocumentFormat;
  mimeType: string;
  size: number;
  hash: string;
  storageProvider: StorageProviderType;
  storagePath: string;
  cloudFileId?: string;
  isFavorite: boolean;
  isTrash: boolean;
  coverImage?: string;
  tags: string[];
  collections: string[];
  readingProgress?: ReadingProgress;
  contentSnippet?: string;
  createdAt: number;
  modifiedAt: number;
  lastOpenedAt?: number;
}

export interface ReadingProgress {
  percentage: number;
  currentLocation: string; // CFI string or page number
  totalLocations?: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface Bookmark {
  id: string;
  documentId: string;
  title: string;
  location: string;
  previewText?: string;
  createdAt: number;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface Annotation {
  id: string;
  documentId: string;
  location: string;
  highlightedText: string;
  note?: string;
  color: HighlightColor;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  title: string;
  slug: string;
  content: string;
  frontmatter: Record<string, any>;
  tags: string[];
  wikilinks: string[]; // Target note titles or ids
  backlinks: string[]; // Source note ids
  createdAt: number;
  modifiedAt: number;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'note' | 'book' | 'tag' | 'author' | 'collection';
  val: number;
  color?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface KnowledgeGraphLink {
  source: string;
  target: string;
  type: 'wikilink' | 'tag' | 'author' | 'collection';
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
}

export interface CloudConnection {
  id: string;
  providerId: string;
  providerType: StorageProviderType;
  name: string;
  accountEmail?: string;
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  quotaTotal?: number;
  quotaUsed?: number;
  isDefault: boolean;
  config: Record<string, any>;
}

export type SyncOperationType = 'upload' | 'download' | 'delete' | 'move';
export type SyncStatusType = 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict';

export interface SyncQueueItem {
  id: string;
  documentId: string;
  operation: SyncOperationType;
  providerId: string;
  status: SyncStatusType;
  attempts: number;
  errorMessage?: string;
  createdAt: number;
}

export interface SyncConflict {
  id: string;
  documentId: string;
  documentTitle: string;
  localVersion: {
    modifiedAt: number;
    size: number;
    hash: string;
  };
  cloudVersion: {
    modifiedAt: number;
    size: number;
    hash: string;
  };
  status: 'unresolved' | 'resolved_local' | 'resolved_cloud' | 'resolved_copy';
  createdAt: number;
}

export interface LibrisSourceCitation {
  documentId: string;
  documentTitle: string;
  pageOrLocation: string;
  snippet: string;
  score: number;
}

export interface LibrisChatMessage {
  id: string;
  sender: 'user' | 'libris';
  content: string;
  sources?: LibrisSourceCitation[];
  timestamp: number;
}

export interface LibrisChatSession {
  id: string;
  documentId?: string;
  title: string;
  mode: 'general' | 'document' | 'summarize' | 'study_guide' | 'flashcards';
  messages: LibrisChatMessage[];
  createdAt: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  textContent: string;
  pageNumber?: number;
  tokenCount: number;
  embedding?: number[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  documentId?: string;
}
