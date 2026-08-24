import React, { useState } from 'react';
import {
  Plus,
  LayoutGrid,
  List,
  Filter,
  ArrowUpDown,
  BookOpen,
  FilePlus,
  Search,
  Upload,
  FolderOpen,
} from 'lucide-react';
import { Document, DocumentFormat, StorageProviderType } from '../../core/types';
import { DocumentCard } from './DocumentCard';
import { usePlatform } from '../../platform/PlatformContext';

interface LibraryViewProps {
  documents: Document[];
  onOpenDocument: (doc: Document) => void;
  onToggleFavorite: (doc: Document) => void;
  onDeleteRequest: (doc: Document) => void;
  onOpenLibris: (doc?: Document) => void;
  onImportDocuments: (docs: Partial<Document>[]) => void;
  activeCollectionTitle?: string;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  documents,
  onOpenDocument,
  onToggleFavorite,
  onDeleteRequest,
  onOpenLibris,
  onImportDocuments,
  activeCollectionTitle,
}) => {
  const platform = usePlatform();
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'author' | 'progress'>('recent');
  const [searchFilter, setSearchFilter] = useState('');

  const handlePickAndImport = async () => {
    const picked = await platform.filePicker.pickDocument(
      [
        { name: 'Ebooks & Documents', extensions: ['epub', 'pdf', 'md', 'txt', 'mobi', 'cbz'] },
      ],
      true
    );

    if (picked.length > 0) {
      const imported: Partial<Document>[] = picked.map(p => {
        const ext = p.name.split('.').pop()?.toLowerCase() || 'unknown';
        return {
          id: `doc_import_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: p.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          author: 'Unknown Author',
          filename: p.name,
          format: (['epub', 'pdf', 'markdown', 'txt'].includes(ext) ? ext : 'epub') as DocumentFormat,
          mimeType: ext === 'pdf' ? 'application/pdf' : 'application/epub+zip',
          size: p.data?.length || 1024000,
          hash: 'hash_' + Date.now(),
          storageProvider: 'local' as StorageProviderType,
          storagePath: p.path,
          isFavorite: false,
          isTrash: false,
          tags: ['Imported'],
          collections: [],
          contentSnippet: `Imported document ${p.name}. Instant local vector indexing ready.`,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        };
      });
      onImportDocuments(imported);
    }
  };

  // Filter & Sort
  let filtered = documents.filter(doc => !doc.isTrash);

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
        doc.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  filtered.sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'author') return a.author.localeCompare(b.author);
    if (sortBy === 'progress') return (b.readingProgress?.percentage || 0) - (a.readingProgress?.percentage || 0);
    return (b.lastOpenedAt || b.modifiedAt) - (a.lastOpenedAt || a.modifiedAt);
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* View Header & Toolbar */}
      <div
        style={{
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          background: 'var(--bg-app)',
        }}
      >
        {/* Title Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
              {activeCollectionTitle || 'All Library Documents'}
            </h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Showing {filtered.length} of {documents.length} universal documents across all storage backends
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button className="btn btn-primary" onClick={handlePickAndImport}>
              <Plus size={16} />
              <span>Import Document</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {/* Format Pills */}
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            {[
              { id: 'all', label: 'All Formats' },
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

          {/* Storage Filter & Sort Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {/* Storage Provider Dropdown */}
            <select
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
              style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }}
            >
              <option value="all">All Storage</option>
              <option value="local">💻 Local Storage</option>
              <option value="gdrive">☁️ Google Drive</option>
              <option value="telegram">✈️ Telegram</option>
              <option value="mega">🔴 MEGA</option>
              <option value="terabox">📦 TeraBox</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }}
            >
              <option value="recent">Recently Opened</option>
              <option value="title">Title (A-Z)</option>
              <option value="author">Author</option>
              <option value="progress">Reading Progress</option>
            </select>

            {/* View Layout Toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 2, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
              <button
                className={`btn-icon btn-sm ${viewLayout === 'grid' ? 'active' : ''}`}
                onClick={() => setViewLayout('grid')}
                title="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                className={`btn-icon btn-sm ${viewLayout === 'list' ? 'active' : ''}`}
                onClick={() => setViewLayout('list')}
                title="List View"
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid / List Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)' }}>
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
            <BookOpen size={48} style={{ opacity: 0.4 }} />
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>No documents match your filters</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => { setFormatFilter('all'); setProviderFilter('all'); setSearchFilter(''); }}>
              Reset Filters
            </button>
          </div>
        ) : viewLayout === 'grid' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 'var(--space-5)',
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
              />
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  <th style={{ padding: '12px 16px' }}>TITLE</th>
                  <th style={{ padding: '12px 16px' }}>AUTHOR</th>
                  <th style={{ padding: '12px 16px' }}>FORMAT</th>
                  <th style={{ padding: '12px 16px' }}>STORAGE</th>
                  <th style={{ padding: '12px 16px' }}>PROGRESS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => (
                  <tr
                    key={doc.id}
                    onClick={() => onOpenDocument(doc)}
                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    className="palette-item"
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {doc.title}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {doc.author}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-brand">{doc.format.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-cloud">{doc.storageProvider.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
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
  );
};
