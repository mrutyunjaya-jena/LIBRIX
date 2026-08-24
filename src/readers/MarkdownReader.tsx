import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Bookmark as BookmarkIcon,
  Copy,
  Check,
  Tag as TagIcon,
  Share2,
} from 'lucide-react';
import { IReaderProps } from './ReaderInterface';
import { db } from '../core/db/DatabaseEngine';
import { usePlatform } from '../platform/PlatformContext';

export const MarkdownReader: React.FC<IReaderProps & { onNavigateWikilink?: (title: string) => void }> = ({
  document,
  onClose,
  onProgressUpdate,
  onOpenLibris,
  onNavigateWikilink,
}) => {
  const platform = usePlatform();
  const [copied, setCopied] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);

  useEffect(() => {
    onProgressUpdate(100, 'end');
    const checkBmark = async () => {
      const bmarks = await db.getBookmarks(document.id);
      if (bmarks.length > 0) {
        setIsBookmarked(true);
        setBookmarkId(bmarks[0].id);
      }
    };
    checkBmark();
  }, [document.id]);

  const handleCopy = async () => {
    if (document.contentSnippet) {
      await platform.clipboard.copyText(document.contentSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleBookmark = async () => {
    if (isBookmarked && bookmarkId) {
      await db.deleteBookmark(bookmarkId);
      setIsBookmarked(false);
      setBookmarkId(null);
    } else {
      const newBmark = {
        id: `bmark_md_${Date.now()}`,
        documentId: document.id,
        title: document.title,
        location: 'line-1',
        createdAt: Date.now(),
      };
      await db.saveBookmark(newBmark);
      setIsBookmarked(true);
      setBookmarkId(newBmark.id);
    }
  };

  // Convert raw markdown text with wikilinks [[Target]] into interactive elements
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Header 1
      if (line.startsWith('# ')) {
        return <h1 key={index} style={{ fontSize: '2rem', fontWeight: 800, margin: '24px 0 16px', color: 'var(--text-primary)' }}>{line.replace('# ', '')}</h1>;
      }
      // Header 2
      if (line.startsWith('## ')) {
        return <h2 key={index} style={{ fontSize: '1.5rem', fontWeight: 700, margin: '20px 0 12px', color: 'var(--text-primary)' }}>{line.replace('## ', '')}</h2>;
      }
      // Header 3
      if (line.startsWith('### ')) {
        return <h3 key={index} style={{ fontSize: '1.2rem', fontWeight: 600, margin: '16px 0 8px', color: 'var(--text-primary)' }}>{line.replace('### ', '')}</h3>;
      }
      // Bullet list
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const itemText = line.substring(2);
        return (
          <li key={index} style={{ marginLeft: 20, marginBottom: 8, color: 'var(--text-primary)' }}>
            {parseInlineWikilinksAndTags(itemText)}
          </li>
        );
      }
      // Quote
      if (line.startsWith('> ')) {
        return (
          <blockquote key={index} style={{ borderLeft: '3px solid var(--brand-500)', paddingLeft: 16, margin: '16px 0', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
            {line.replace('> ', '')}
          </blockquote>
        );
      }
      // Empty line
      if (!line.trim()) {
        return <div key={index} style={{ height: 12 }} />;
      }
      // Standard paragraph
      return (
        <p key={index} style={{ marginBottom: 16, lineHeight: 1.8, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
          {parseInlineWikilinksAndTags(line)}
        </p>
      );
    });
  };

  const parseInlineWikilinksAndTags = (line: string) => {
    // Regex for [[wikilink]] and #tags
    const parts = line.split(/(\[\[.*?\]\]|#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const linkTarget = part.slice(2, -2);
        return (
          <span
            key={i}
            onClick={() => onNavigateWikilink && onNavigateWikilink(linkTarget)}
            style={{
              color: 'var(--brand-400)',
              background: 'rgba(99, 102, 241, 0.15)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              fontWeight: 500,
              textDecoration: 'none',
              borderBottom: '1px dashed var(--brand-500)',
            }}
          >
            [[{linkTarget}]]
          </span>
        );
      }
      if (part.startsWith('#') && part.length > 1) {
        return (
          <span
            key={i}
            className="badge badge-brand"
            style={{ margin: '0 2px' }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const sampleContent = document.contentSnippet || `# ${document.title}\n\nBy ${document.author}\n\nLibrix supports first-class **Obsidian-style Markdown documents** with live preview, [[Wikilinks]], #tags, YAML frontmatter, and bidirectional backlinks.\n\n## Overview\nThis document is synced from **${document.storageProvider.toUpperCase()}** storage and is available completely offline.\n\n#Notes #KnowledgeManagement`;

  return (
    <div className="reader-container theme-dark">
      {/* Header */}
      <header className="reader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button className="btn-icon" onClick={onClose} title="Back">
            <ArrowLeft size={18} />
          </button>
          <div className="reader-title-area">
            <div className="reader-doc-title">{document.title}</div>
            <div className="reader-chapter-title">{document.author} • {document.storageProvider.toUpperCase()}</div>
          </div>
        </div>

        <div className="reader-actions">
          <button className="btn-icon" onClick={handleCopy} title="Copy Content">
            {copied ? <Check size={18} color="var(--success)" /> : <Copy size={18} />}
          </button>

          <button
            className={`btn-icon ${isBookmarked ? 'active' : ''}`}
            onClick={toggleBookmark}
            style={{ color: isBookmarked ? 'var(--brand-400)' : 'inherit' }}
            title="Bookmark"
          >
            <BookmarkIcon size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>

          {onOpenLibris && (
            <button className="btn btn-sm btn-primary" onClick={() => onOpenLibris()}>
              <Sparkles size={14} />
              Ask Libris
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="reader-viewport">
        <main className="reader-stage selectable">
          <div className="reader-content-frame" style={{ maxWidth: 780 }}>
            {/* Tag Pills */}
            {document.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                {document.tags.map(t => (
                  <span key={t} className="badge badge-brand">
                    <TagIcon size={11} />
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Formatted Content */}
            {renderFormattedMarkdown(sampleContent)}
          </div>
        </main>
      </div>
    </div>
  );
};
