/**
 * LIBRIX Universal Core Types & Interfaces — Sci-Fi Workstation Edition
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
  | 'onedrive'
  | 'mega'
  | 'terabox'
  | 'mediafire'
  | 'telegram'
  | 'custom';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null; // null represents root library folder
  path: string;
  createdAt: number;
  modifiedAt: number;
}

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
  folderId?: string | null;
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

export type HighlightStyle = 'underline' | 'box' | 'filled';

export interface Annotation {
  id: string;
  documentId: string;
  location: string; // chapter-1, page-4, etc.
  startOffset?: number;
  endOffset?: number;
  selectedText: string;
  note?: string;
  style?: HighlightStyle;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  title: string;
  slug: string;
  content: string;
  folderId?: string | null;
  frontmatter: Record<string, any>;
  tags: string[];
  wikilinks: string[]; // Target note titles or book titles
  backlinks: string[]; // Source note ids
  createdAt: number;
  modifiedAt: number;
}

export type GraphNodeType = 'note' | 'book' | 'tag' | 'author' | 'topic' | 'folder';
export type GraphNodeShape = 'circle' | 'diamond' | 'square' | 'hexagon';

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  shape?: GraphNodeShape;
  val: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface KnowledgeGraphLink {
  source: string;
  target: string;
  type: 'wikilink' | 'tag' | 'author' | 'folder';
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

export type SyncOperationType = 'upload' | 'download' | 'delete' | 'move' | 'rename';
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

export interface CustomAIProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  modelName: string;
  apiKey?: string;
  organization?: string;
  projectId?: string;
  customHeaders?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
  isLocal: boolean;
  isDefault?: boolean;
}
