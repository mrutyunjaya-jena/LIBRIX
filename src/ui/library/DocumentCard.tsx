import React from 'react';
import {
  BookOpen,
  Star,
  MoreVertical,
  Cloud,
  HardDrive,
  Sparkles,
  GripVertical,
} from 'lucide-react';
import { Document, StorageProviderType } from '../../core/types';

interface DocumentCardProps {
  document: Document;
  onOpen: (doc: Document) => void;
  onToggleFavorite: (doc: Document) => void;
  onDeleteRequest: (doc: Document) => void;
  onOpenLibris: (doc: Document) => void;
  onContextMenu: (e: React.MouseEvent, doc: Document) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onOpen,
  onToggleFavorite,
  onDeleteRequest,
  onOpenLibris,
  onContextMenu,
}) => {
  const getProviderLabel = (provider: StorageProviderType) => {
    switch (provider) {
      case 'gdrive': return 'DRIVE';
      case 'telegram': return 'TELEGRAM';
      case 'mega': return 'MEGA';
      case 'terabox': return 'TERABOX';
      default: return 'LOCAL';
    }
  };

  const progressPercent = document.readingProgress?.percentage || 0;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', document.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="doc-card"
      draggable
      onDragStart={handleDragStart}
      onContextMenu={e => {
        e.preventDefault();
        onContextMenu(e, document);
      }}
    >
      {/* Cover / Preview Area */}
      <div className="doc-cover-container" onClick={() => onOpen(document)}>
        {document.coverImage ? (
          <img src={document.coverImage} alt={document.title} className="doc-cover-img" />
        ) : (
          <div className="doc-cover-fallback">
            <div style={{ marginBottom: 6, color: 'var(--text-secondary)' }}>
              <BookOpen size={30} />
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '0.02em',
                padding: '0 8px',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {document.title}
            </div>
          </div>
        )}

        {/* Format Badge (Top Right) */}
        <div className="doc-format-badge">{document.format}</div>

        {/* Storage Badge (Top Left) */}
        <div className="doc-storage-badge">
          {document.storageProvider === 'local' ? <HardDrive size={10} /> : <Cloud size={10} />}
          <span>{getProviderLabel(document.storageProvider)}</span>
        </div>

        {/* Progress Bar (Bottom) */}
        {progressPercent > 0 && (
          <div className="doc-progress-bar" style={{ width: `${progressPercent}%` }} />
        )}
      </div>

      {/* Info Body */}
      <div className="doc-info">
        <div className="doc-title" onClick={() => onOpen(document)} title={document.title}>
          {document.title}
        </div>
        <div className="doc-author">{document.author || 'Unknown Author'}</div>

        {/* Tags */}
        {document.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
            {document.tags.slice(0, 2).map(t => (
              <span key={t} className="badge" style={{ fontSize: '0.62rem', padding: '1px 4px' }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="doc-footer">
          <span>{progressPercent > 0 ? `${progressPercent}%` : 'UNREAD'}</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <button
              className="btn-icon btn-sm"
              onClick={e => {
                e.stopPropagation();
                onToggleFavorite(document);
              }}
              title={document.isFavorite ? 'Remove Favorite' : 'Favorite'}
              style={{ color: document.isFavorite ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              <Star size={13} fill={document.isFavorite ? 'currentColor' : 'none'} />
            </button>

            <button
              className="btn-icon btn-sm"
              onClick={e => {
                e.stopPropagation();
                onOpenLibris(document);
              }}
              title="Ask Libris AI"
            >
              <Sparkles size={13} />
            </button>

            <button
              className="btn-icon btn-sm"
              onClick={e => {
                e.stopPropagation();
                onContextMenu(e, document);
              }}
              title="More Options"
            >
              <MoreVertical size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
