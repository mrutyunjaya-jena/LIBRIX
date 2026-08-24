import React from 'react';
import {
  BookOpen,
  Star,
  MoreVertical,
  Cloud,
  HardDrive,
  FileText,
  Trash2,
  Sparkles,
  Tag as TagIcon,
} from 'lucide-react';
import { Document, StorageProviderType } from '../../core/types';

interface DocumentCardProps {
  document: Document;
  onOpen: (doc: Document) => void;
  onToggleFavorite: (doc: Document) => void;
  onDeleteRequest: (doc: Document) => void;
  onOpenLibris: (doc: Document) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onOpen,
  onToggleFavorite,
  onDeleteRequest,
  onOpenLibris,
}) => {
  const getProviderBadge = (provider: StorageProviderType) => {
    switch (provider) {
      case 'gdrive':
        return { label: 'Drive', icon: <Cloud size={10} color="#4285F4" /> };
      case 'telegram':
        return { label: 'Telegram', icon: <Cloud size={10} color="#229ED9" /> };
      case 'mega':
        return { label: 'MEGA', icon: <Cloud size={10} color="#D9272E" /> };
      case 'terabox':
        return { label: 'TeraBox', icon: <Cloud size={10} color="#0080FF" /> };
      default:
        return { label: 'Local', icon: <HardDrive size={10} color="var(--success)" /> };
    }
  };

  const badge = getProviderBadge(document.storageProvider);
  const progressPercent = document.readingProgress?.percentage || 0;

  return (
    <div className="doc-card">
      {/* Cover / Preview Area */}
      <div className="doc-cover-container" onClick={() => onOpen(document)}>
        {document.coverImage ? (
          <img src={document.coverImage} alt={document.title} className="doc-cover-img" />
        ) : (
          <div className="doc-cover-fallback">
            <div style={{ marginBottom: 8, color: 'var(--brand-400)' }}>
              <BookOpen size={36} />
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', padding: '0 8px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {document.title}
            </div>
          </div>
        )}

        {/* Format Badge (Top Right) */}
        <div className="doc-format-badge">{document.format}</div>

        {/* Storage Badge (Top Left) */}
        <div className="doc-storage-badge">
          {badge.icon}
          <span>{badge.label}</span>
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
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {document.tags.slice(0, 2).map(t => (
              <span key={t} className="badge badge-cloud" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="doc-footer">
          <span style={{ fontSize: '0.7rem' }}>
            {progressPercent > 0 ? `${progressPercent}% read` : 'Unread'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              className="btn-icon btn-sm"
              onClick={e => {
                e.stopPropagation();
                onToggleFavorite(document);
              }}
              title={document.isFavorite ? 'Remove Favorite' : 'Add Favorite'}
              style={{ color: document.isFavorite ? '#eab308' : 'inherit' }}
            >
              <Star size={14} fill={document.isFavorite ? 'currentColor' : 'none'} />
            </button>

            <button
              className="btn-icon btn-sm"
              onClick={e => {
                e.stopPropagation();
                onOpenLibris(document);
              }}
              title="Ask Libris AI"
              style={{ color: 'var(--brand-400)' }}
            >
              <Sparkles size={14} />
            </button>

            <button
              className="btn-icon btn-sm"
              onClick={e => {
                e.stopPropagation();
                onDeleteRequest(document);
              }}
              title="Delete Document"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
