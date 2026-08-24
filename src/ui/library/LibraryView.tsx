import React, { useState, useEffect } from 'react';
import {
  Plus,
  LayoutGrid,
  List,
  Folder as FolderIcon,
  FolderPlus,
  Search,
  Upload,
  ChevronRight,
  Edit2,
  FolderInput,
  FolderTree as FolderTreeIcon,
  Trash2,
} from 'lucide-react';
import { Document, Folder, DocumentFormat, StorageProviderType } from '../../core/types';
import { DocumentCard } from './DocumentCard';
import { FolderTree } from './FolderTree';
import { ContextMenu, ContextMenuState } from './ContextMenu';
import { usePlatform } from '../../platform/PlatformContext';
import { fileBinaryStore } from '../../core/storage/FileBinaryStore';
import { db } from '../../core/db/DatabaseEngine';
import { EpubParser } from '../../readers/parsers/EpubParser';
import { PdfParser } from '../../readers/parsers/PdfParser';
import { storageRegistry } from '../../storage/StorageRegistry';
import { cloudVaultSyncService } from '../../storage/sync/CloudVaultSyncService';

interface LibraryViewProps {
  documents: Document[];
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onOpenDocument: (doc: Document) => void;
  onToggleFavorite: (doc: Document) => void;
  onDeleteRequest: (doc: Document) => void;
  onOpenLibris: (doc?: Document) => void;
  onImportDocuments: (docs: Partial<Document>[]) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameDocument: (docId: string, newTitle: string, newFilename?: string) => void;
  onMoveDocumentToFolder: (docId: string, folderId: string | null) => void;
  onDuplicateDocument: (docId: string) => void;
  onDocumentsUpdated?: () => void;
  activeCollectionTitle?: string;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  documents,
  folders,
  selectedFolderId,
  onSelectFolder,
  onOpenDocument,
  onToggleFavorite,
  onDeleteRequest,
  onOpenLibris,
  onImportDocuments,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onRenameDocument,
  onMoveDocumentToFolder,
  onDuplicateDocument,
  onDocumentsUpdated,
  activeCollectionTitle,
}) => {
  const platform = usePlatform();

  // Layout & Filter State
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [showFolderSidebar, setShowFolderSidebar] = useState(true);
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'author' | 'progress'>('recent');
  const [searchFilter, setSearchFilter] = useState('');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Modals State
  const [renameDocTarget, setRenameDocTarget] = useState<Document | null>(null);
  const [renameDocTitle, setRenameDocTitle] = useState('');
  const [renameDocFilename, setRenameDocFilename] = useState('');

  const [createFolderParentId, setCreateFolderParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');

  const [renameFolderTarget, setRenameFolderTarget] = useState<Folder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');

  const [moveDocTarget, setMoveDocTarget] = useState<Document | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);

  // Retroactively generate cover thumbnails for existing documents without covers
  useEffect(() => {
    let isCancelled = false;

    const generateMissingThumbnails = async () => {
      const docsNeedingCovers = documents.filter(
        d => !d.coverImage && (d.format === 'pdf' || d.format === 'epub')
      );
      if (docsNeedingCovers.length === 0) return;

      for (const doc of docsNeedingCovers) {
        if (isCancelled) break;
        try {
          const bytes = await fileBinaryStore.getFileBytes(doc.id);
          if (!bytes || bytes.length === 0) continue;

          let cover: string | undefined = undefined;
          if (doc.format === 'pdf') {
            cover = await PdfParser.generateThumbnail(bytes);
          } else if (doc.format === 'epub') {
            const parsed = await EpubParser.parse(bytes);
            cover = parsed.coverDataUrl;
          }

          if (cover && !isCancelled) {
            const updatedDoc: Document = { ...doc, coverImage: cover };
            await db.saveDocument(updatedDoc);
            if (onDocumentsUpdated) {
              onDocumentsUpdated();
            }
          }
        } catch {
          // ignore corrupted files
        }
      }
    };

    generateMissingThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [documents.length, onDocumentsUpdated]);

  // Filter Documents by Active Folder & Filters
  let filtered = documents.filter(doc => !doc.isTrash);

  if (selectedFolderId !== null) {
    filtered = filtered.filter(doc => doc.folderId === selectedFolderId);
  }

  if (formatFilter !== 'all') {
    filtered = filtered.filter(doc => doc.format === formatFilter);
  }

  if (providerFilter !== 'all') {
    filtered = filtered.filter(doc => doc.storageProvider === providerFilter);
  }

  if (searchFilter) {
    const q = searchFilter.toLowerCase();
    filtered = filtered.filter(
      doc =>
        doc.title.toLowerCase().includes(q) ||
        doc.author.toLowerCase().includes(q) ||
        doc.filename.toLowerCase().includes(q) ||
        doc.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  filtered.sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'author') return a.author.localeCompare(b.author);
    if (sortBy === 'progress') return (b.readingProgress?.percentage || 0) - (a.readingProgress?.percentage || 0);
    return (b.lastOpenedAt || b.modifiedAt) - (a.lastOpenedAt || a.modifiedAt);
  });

  // Breadcrumbs calculation
  const getBreadcrumbTrail = (): Folder[] => {
    if (!selectedFolderId) return [];
    const trail: Folder[] = [];
    let currentId: string | null = selectedFolderId;
    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (!folder) break;
      trail.unshift(folder);
      currentId = folder.parentId;
    }
    return trail;
  };

  const breadcrumbs = getBreadcrumbTrail();
  const currentFolder = folders.find(f => f.id === selectedFolderId);

  const processImportedFiles = async (
    files: Array<{ name: string; data?: Uint8Array }>
  ) => {
    const imported: Partial<Document>[] = [];

    const FORMAT_BY_EXT: Record<string, DocumentFormat> = {
      pdf: 'pdf',
      epub: 'epub',
      md: 'markdown',
      markdown: 'markdown',
      txt: 'txt',
      mobi: 'mobi',
      azw3: 'azw3',
      cbz: 'cbz',
      cbr: 'cbr',
      docx: 'docx',
      json: 'json',
      csv: 'csv',
      yaml: 'yaml',
      yml: 'yaml',
    };

    const MIME_BY_FORMAT: Partial<Record<DocumentFormat, string>> = {
      pdf: 'application/pdf',
      epub: 'application/epub+zip',
      markdown: 'text/markdown',
      txt: 'text/plain',
      mobi: 'application/x-mobipocket-ebook',
      azw3: 'application/vnd.amazon.ebook',
      cbz: 'application/vnd.comicbook+zip',
      cbr: 'application/vnd.comicbook-rar',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      json: 'application/json',
      csv: 'text/csv',
      yaml: 'text/yaml',
    };

    for (const p of files) {
      const ext = p.name.split('.').pop()?.toLowerCase() || 'unknown';
      const docId = `doc_import_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const format: DocumentFormat = FORMAT_BY_EXT[ext] || 'unknown';
      const mimeType = MIME_BY_FORMAT[format] || 'application/octet-stream';

      let docTitle = p.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      let docAuthor = 'Imported Author';
      let snippet = `Imported document ${p.name}.`;
      let coverImage: string | undefined = undefined;

      if (p.data && p.data.length > 0) {
        // 1. Save raw binary payload into IndexedDB
        await fileBinaryStore.saveFileBlob(docId, p.data, mimeType, p.name);

        // 2. Parse EPUB/PDF metadata and cover
        if (format === 'epub') {
          try {
            const parsed = await EpubParser.parse(p.data);
            if (parsed.title && parsed.title !== 'Imported Document') docTitle = parsed.title;
            if (parsed.author && parsed.author !== 'Unknown Author') docAuthor = parsed.author;
            if (parsed.coverDataUrl) coverImage = parsed.coverDataUrl;
            if (parsed.chapters[0]?.content) {
              snippet = parsed.chapters[0].content.replace(/<[^>]+>/g, '').slice(0, 500);
            }
          } catch (e) {
            // fallback
          }
        } else if (format === 'pdf') {
          try {
            const thumb = await PdfParser.generateThumbnail(p.data);
            if (thumb) coverImage = thumb;
          } catch (e) {
            // fallback
          }
        } else if (format === 'markdown' || format === 'txt' || format === 'csv') {
          try {
            const decoded = new TextDecoder('utf-8').decode(p.data);
            snippet = decoded.slice(0, 10000);
          } catch (e) {
            // fallback
          }
        }
      }

      // Upload to default storage provider (e.g. Google Drive) if configured and connected
      const defaultProvider = storageRegistry.getDefaultProvider();
      let docStorageProvider: StorageProviderType = 'local';
      let docStoragePath = selectedFolderId ? `/library/${selectedFolderId}/${p.name}` : `/library/${p.name}`;
      let cloudFileId: string | undefined = undefined;

      if (defaultProvider && defaultProvider.type !== 'local' && defaultProvider.isConnected() && p.data) {
        try {
          const targetFolderPath = await cloudVaultSyncService.getFolderPathString(selectedFolderId, '/LIBRIX/Library');
          const uploadRes = await defaultProvider.upload(targetFolderPath, p.name, p.data, mimeType);
          docStorageProvider = defaultProvider.type;
          docStoragePath = uploadRes.path || `${targetFolderPath}/${uploadRes.name}`;
          cloudFileId = uploadRes.id;
          await cloudVaultSyncService.saveMasterVaultCatalog(defaultProvider).catch(() => {});
        } catch (cloudUpErr) {
          console.warn(`Could not upload ${p.name} directly to ${defaultProvider.name}:`, cloudUpErr);
        }
      }

      imported.push({
        id: docId,
        title: docTitle,
        author: docAuthor,
        filename: p.name,
        format,
        mimeType,
        size: p.data?.length || 1024000,
        hash: 'hash_' + Date.now(),
        storageProvider: docStorageProvider,
        storagePath: docStoragePath,
        cloudFileId,
        folderId: selectedFolderId,
        isFavorite: false,
        isTrash: false,
        tags: ['Imported', format.toUpperCase()],
        collections: [],
        coverImage,
        contentSnippet: snippet,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });
    }

    if (imported.length > 0) {
      onImportDocuments(imported);
    }
  };

  const handlePickAndImport = async () => {
    const picked = await platform.filePicker.pickDocument(
      [{ name: 'Ebooks & Documents', extensions: ['epub', 'pdf', 'md', 'txt', 'mobi', 'cbz'] }],
      true
    );

    if (picked.length > 0) {
      await processImportedFiles(picked);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDropFiles = async (e: React.DragEvent) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      const filesList = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const buffer = await file.arrayBuffer();
        filesList.push({
          name: file.name,
          data: new Uint8Array(buffer),
        });
      }
      await processImportedFiles(filesList);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* 1. Collapsible Nested Folder Tree Drawer */}
      {showFolderSidebar && (
        <aside
          style={{
            width: 220,
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
              FOLDERS & VAULT
            </span>
            <button
              className="btn-icon btn-sm"
              onClick={() => {
                setCreateFolderParentId(selectedFolderId);
                setNewFolderName('');
              }}
              title="New Folder"
            >
              <FolderPlus size={13} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            <FolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              onCreateFolder={parentId => {
                setCreateFolderParentId(parentId);
                setNewFolderName('');
              }}
              onContextMenu={(e, folder) => {
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'folder', folder });
              }}
              onDropDocumentOnFolder={(docId, folderId) => {
                onMoveDocumentToFolder(docId, folderId);
              }}
            />
          </div>
        </aside>
      )}

      {/* 2. Main Content & File Grid (Supports Drag & Drop of real files) */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDropFiles}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      >
        {/* Header & Controls Toolbar */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-5)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            background: 'var(--bg-app)',
          }}
        >
          {/* Breadcrumb & Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)' }}>
              <button
                className="btn-icon btn-sm"
                onClick={() => setShowFolderSidebar(!showFolderSidebar)}
                title="Toggle Folder Tree"
              >
                <FolderTreeIcon size={14} />
              </button>

              {/* Breadcrumb Trail */}
              <button
                className="btn-ghost btn-sm"
                onClick={() => onSelectFolder(null)}
                style={{ fontWeight: selectedFolderId === null ? 700 : 400 }}
              >
                Library
              </button>

              {breadcrumbs.map(b => (
                <React.Fragment key={b.id}>
                  <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => onSelectFolder(b.id)}
                    style={{ fontWeight: selectedFolderId === b.id ? 700 : 400 }}
                  >
                    {b.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setCreateFolderParentId(selectedFolderId);
                  setNewFolderName('');
                }}
              >
                <FolderPlus size={13} />
                <span>New Folder</span>
              </button>

              <button className="btn btn-primary btn-sm" onClick={handlePickAndImport}>
                <Plus size={14} />
                <span>Import File</span>
              </button>
            </div>
          </div>

          {/* Filter Pills & Sort Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {/* Format Pills */}
            <div style={{ display: 'flex', gap: 3 }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'epub', label: 'EPUB' },
                { id: 'pdf', label: 'PDF' },
                { id: 'markdown', label: 'Markdown' },
              ].map(f => (
                <button
                  key={f.id}
                  className={`btn btn-sm ${formatFilter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFormatFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Storage, Sort, Layout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <select
                value={providerFilter}
                onChange={e => setProviderFilter(e.target.value)}
                style={{ fontSize: 'var(--text-2xs)', padding: '3px 6px' }}
              >
                <option value="all">ALL STORAGE</option>
                <option value="local">LOCAL DISK</option>
                <option value="gdrive">GOOGLE DRIVE</option>
                <option value="telegram">TELEGRAM</option>
                <option value="mega">MEGA</option>
                <option value="terabox">TERABOX</option>
              </select>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{ fontSize: 'var(--text-2xs)', padding: '3px 6px' }}
              >
                <option value="recent">RECENT</option>
                <option value="title">TITLE (A-Z)</option>
                <option value="author">AUTHOR</option>
                <option value="progress">PROGRESS</option>
              </select>

              <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 1, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-medium)' }}>
                <button
                  className={`btn-icon btn-sm ${viewLayout === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewLayout('grid')}
                  title="Grid View"
                  style={{ padding: '2px 5px' }}
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  className={`btn-icon btn-sm ${viewLayout === 'list' ? 'active' : ''}`}
                  onClick={() => setViewLayout('list')}
                  title="List View"
                  style={{ padding: '2px 5px' }}
                >
                  <List size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* File Grid / Table View */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)' }}>
          {filtered.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-3)',
                color: 'var(--text-muted)',
              }}
            >
              <FolderIcon size={42} style={{ opacity: 0.3 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {selectedFolderId ? `Folder "${currentFolder?.name}" is empty` : 'No documents in this view'}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                  Import books, drop documents here, or create a note.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button className="btn btn-secondary btn-sm" onClick={handlePickAndImport}>
                  <Upload size={13} />
                  <span>Import File</span>
                </button>
              </div>
            </div>
          ) : viewLayout === 'grid' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              {filtered.map(doc => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onOpen={onOpenDocument}
                  onToggleFavorite={onToggleFavorite}
                  onDeleteRequest={onDeleteRequest}
                  onOpenLibris={onOpenLibris}
                  onContextMenu={(e, d) => {
                    setContextMenu({ x: e.clientX, y: e.clientY, type: 'document', document: d });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-xs)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>
                    <th style={{ padding: '10px 14px' }}>TITLE</th>
                    <th style={{ padding: '10px 14px' }}>AUTHOR</th>
                    <th style={{ padding: '10px 14px' }}>FORMAT</th>
                    <th style={{ padding: '10px 14px' }}>STORAGE</th>
                    <th style={{ padding: '10px 14px' }}>PROGRESS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => (
                    <tr
                      key={doc.id}
                      onClick={() => onOpenDocument(doc)}
                      onContextMenu={e => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, type: 'document', document: doc });
                      }}
                      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                      className="palette-item"
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {doc.title}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                        {doc.author}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className="badge">{doc.format.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className="badge">{doc.storageProvider.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                        {doc.readingProgress?.percentage || 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 3. Context Menu */}
      <ContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(null)}
        onOpenDocument={onOpenDocument}
        onRenameDocument={doc => {
          setRenameDocTarget(doc);
          setRenameDocTitle(doc.title);
          setRenameDocFilename(doc.filename);
        }}
        onMoveDocument={doc => {
          setMoveDocTarget(doc);
          setMoveTargetFolderId(doc.folderId || null);
        }}
        onDuplicateDocument={doc => onDuplicateDocument(doc.id)}
        onToggleFavorite={onToggleFavorite}
        onAskLibris={onOpenLibris}
        onDeleteDocument={onDeleteRequest}
        onOpenFolder={f => onSelectFolder(f.id)}
        onCreateSubfolder={parentFolder => {
          setCreateFolderParentId(parentFolder.id);
          setNewFolderName('');
        }}
        onRenameFolder={folder => {
          setRenameFolderTarget(folder);
          setRenameFolderName(folder.name);
        }}
        onDeleteFolder={folder => onDeleteFolder(folder.id)}
      />

      {/* 4. Rename Document Modal */}
      {renameDocTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">Rename Document</h3>
              <button className="btn-icon btn-sm" onClick={() => setRenameDocTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Document Title</label>
                <input
                  type="text"
                  value={renameDocTitle}
                  onChange={e => setRenameDocTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Storage Filename</label>
                <input
                  type="text"
                  value={renameDocFilename}
                  onChange={e => setRenameDocFilename(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRenameDocTarget(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!renameDocTitle.trim()}
                onClick={() => {
                  onRenameDocument(renameDocTarget.id, renameDocTitle, renameDocFilename);
                  setRenameDocTarget(null);
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Create Folder / Subfolder Modal */}
      {createFolderParentId !== undefined && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">{createFolderParentId ? 'New Subfolder' : 'New Folder'}</h3>
              <button className="btn-icon btn-sm" onClick={() => setCreateFolderParentId(undefined)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Folder Name</label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Systems"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setCreateFolderParentId(undefined)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!newFolderName.trim()}
                onClick={() => {
                  onCreateFolder(newFolderName.trim(), createFolderParentId || null);
                  setCreateFolderParentId(undefined);
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Rename Folder Modal */}
      {renameFolderTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Rename Folder</h3>
              <button className="btn-icon btn-sm" onClick={() => setRenameFolderTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Folder Name</label>
                <input
                  type="text"
                  value={renameFolderName}
                  onChange={e => setRenameFolderName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRenameFolderTarget(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!renameFolderName.trim()}
                onClick={() => {
                  onRenameFolder(renameFolderTarget.id, renameFolderName.trim());
                  setRenameFolderTarget(null);
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Move Document to Folder Modal */}
      {moveDocTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">Move to Folder</h3>
              <button className="btn-icon btn-sm" onClick={() => setMoveDocTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Select target folder for <strong>{moveDocTarget.title}</strong>:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
                <div
                  className={`palette-item ${moveTargetFolderId === null ? 'active' : ''}`}
                  onClick={() => setMoveTargetFolderId(null)}
                >
                  <FolderIcon size={14} />
                  <span>[Root Library]</span>
                </div>
                {folders.map(f => (
                  <div
                    key={f.id}
                    className={`palette-item ${moveTargetFolderId === f.id ? 'active' : ''}`}
                    onClick={() => setMoveTargetFolderId(f.id)}
                  >
                    <FolderIcon size={14} />
                    <span>{f.path || f.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setMoveDocTarget(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onMoveDocumentToFolder(moveDocTarget.id, moveTargetFolderId);
                  setMoveDocTarget(null);
                }}
              >
                Move Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
