import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Bookmark as BookmarkIcon,
  Copy,
  Check,
  Tag as TagIcon,
  Highlighter,
  Trash2,
  Edit3,
  MessageSquare,
} from 'lucide-react';
import { IReaderProps } from './ReaderInterface';
import { db } from '../core/db/DatabaseEngine';
import { Annotation, Bookmark, HighlightStyle } from '../core/types';
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
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const selectedTextRef = useRef<string>('');
  const stageRef = useRef<HTMLElement>(null);

  const loadData = async () => {
    const bmarks = await db.getBookmarks(document.id);
    if (bmarks.length > 0) {
      setIsBookmarked(true);
      setBookmarkId(bmarks[0].id);
    }
    const annots = await db.getAnnotations(document.id);
    setAnnotations(annots);

    // Restore saved scroll position
    if (document.readingProgress?.percentage && stageRef.current) {
      const stage = stageRef.current;
      setTimeout(() => {
        const targetScroll = (document.readingProgress!.percentage / 100) * (stage.scrollHeight - stage.clientHeight);
        stage.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }, 100);
    }
  };

  useEffect(() => {
    loadData();
  }, [document.id]);

  const handleScroll = () => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    const totalScroll = stage.scrollHeight - stage.clientHeight;
    if (totalScroll <= 0) return;
    const progress = Math.min(100, Math.max(1, Math.round((stage.scrollTop / totalScroll) * 100)));
    onProgressUpdate(progress, `scroll-${progress}%`);
    db.updateReadingProgress(document.id, { percentage: progress, currentLocation: `scroll-${progress}%` });
  };

  const handleSelectionChange = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setSelectionPos(null);
      return;
    }

    const text = sel.toString().trim();
    if (text.length > 0) {
      selectedTextRef.current = text;
      setSelectedText(text);
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setSelectionPos({
            x: Math.max(120, Math.min(window.innerWidth - 120, rect.left + rect.width / 2)),
            y: Math.max(60, rect.top - 50),
          });
        }
      } catch (e) {
        // Range bounding box fallback
      }
    } else {
      setSelectionPos(null);
    }
  };

  const createHighlight = async (style: HighlightStyle = 'box', noteText?: string) => {
    const textToHighlight = selectedTextRef.current || selectedText;
    if (!textToHighlight) return;

    const annot: Annotation = {
      id: `md_annot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      documentId: document.id,
      location: 'markdown',
      selectedText: textToHighlight,
      note: noteText || undefined,
      style,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.saveAnnotation(annot);
    await loadData();

    setSelectionPos(null);
    setSelectedText('');
    selectedTextRef.current = '';
    window.getSelection()?.removeAllRanges();
  };

  const deleteHighlight = async (id: string) => {
    await db.deleteAnnotation(id);
    await loadData();
  };

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
      const newBmark: Bookmark = {
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

  const sampleContent =
    document.contentSnippet ||
    `# ${document.title}\n\nBy ${document.author}\n\nLibrix supports first-class **Obsidian-style Markdown documents** with live preview, [[Wikilinks]], #tags, YAML frontmatter, and bidirectional backlinks.\n\n## Overview\nThis document is synced from **${document.storageProvider.toUpperCase()}** storage and is available completely offline.\n\n#Notes #KnowledgeManagement`;

  // Render markdown text with persistent highlights
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('# ')) {
        return <h1 key={index} style={{ fontSize: '1.8rem', fontWeight: 800, margin: '24px 0 16px', color: 'var(--text-primary)' }}>{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} style={{ fontSize: '1.4rem', fontWeight: 700, margin: '20px 0 12px', color: 'var(--text-primary)' }}>{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={index} style={{ fontSize: '1.15rem', fontWeight: 600, margin: '16px 0 8px', color: 'var(--text-primary)' }}>{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const itemText = line.substring(2);
        return (
          <li key={index} style={{ marginLeft: 20, marginBottom: 8, color: 'var(--text-primary)' }}>
            {parseInlineWikilinksAndHighlights(itemText)}
          </li>
        );
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={index} style={{ borderLeft: '3px solid var(--text-primary)', paddingLeft: 16, margin: '16px 0', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
            {line.replace('> ', '')}
          </blockquote>
        );
      }
      if (!line.trim()) {
        return <div key={index} style={{ height: 12 }} />;
      }
      return (
        <p key={index} style={{ marginBottom: 16, lineHeight: 1.8, fontSize: '1rem', color: 'var(--text-primary)' }}>
          {parseInlineWikilinksAndHighlights(line)}
        </p>
      );
    });
  };

  const parseInlineWikilinksAndHighlights = (line: string) => {
    let rendered = line;

    // Apply persistent highlights first with whitespace resilience
    for (const a of annotations) {
      if (a.selectedText && a.selectedText.trim().length > 1) {
        const words = a.selectedText.trim().split(/\s+/);
        const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = escapedWords.join('\\s+');
        try {
          const regex = new RegExp(`(${pattern})`, 'gi');
          rendered = rendered.replace(regex, `<mark class="scifi-highlight" title="${a.note ? 'Note: ' + a.note : 'Highlight'}">$1</mark>`);
        } catch (e) {
          // fallback
        }
      }
    }

    const parts = rendered.split(/(\[\[.*?\]\]|#\w+|<mark.*?<\/mark>)/g);
    return parts.map((part, i) => {
      if (part.startsWith('<mark') && part.endsWith('</mark>')) {
        return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />;
      }
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const linkTarget = part.slice(2, -2);
        return (
          <span
            key={i}
            onClick={() => onNavigateWikilink && onNavigateWikilink(linkTarget)}
            className="wikilink-badge"
          >
            [[{linkTarget}]]
          </span>
        );
      }
      if (part.startsWith('#') && part.length > 1) {
        return (
          <span key={i} className="badge" style={{ margin: '0 2px' }}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div
      className="reader-container"
      onMouseUp={handleSelectionChange}
      onTouchEnd={handleSelectionChange}
    >
      {/* Floating Selection Toolbar */}
      {selectionPos && (
        <div
          className="selection-toolbar scifi-box"
          onMouseDown={e => e.preventDefault()}
          style={{
            position: 'fixed',
            left: `${Math.max(10, Math.min(window.innerWidth - 220, selectionPos.x))}px`,
            top: `${Math.max(10, selectionPos.y)}px`,
            transform: 'translateX(-50%)',
            zIndex: 1500,
            background: 'var(--bg-surface-elevated)',
            padding: '3px 6px',
            borderRadius: 'var(--radius-xs)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            maxWidth: 'calc(100vw - 20px)',
            overflowX: 'auto',
          }}
        >
          <button className="btn btn-sm btn-primary" onClick={() => createHighlight('box')} title="Highlight">
            <Highlighter size={13} />
            <span>Highlight</span>
          </button>

          <button
            className="btn btn-sm btn-secondary"
            onClick={() => {
              const note = prompt('Add note to highlight:');
              if (note !== null) {
                createHighlight('box', note);
              }
            }}
            title="Note"
          >
            <MessageSquare size={13} />
            <span>Note</span>
          </button>

          <button
            className="btn btn-sm btn-secondary"
            onClick={async () => {
              await platform.clipboard.copyText(selectedText);
              setSelectionPos(null);
            }}
            title="Copy"
          >
            <Copy size={13} />
          </button>

          {onOpenLibris && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                onOpenLibris(selectedText);
                setSelectionPos(null);
              }}
              title="Ask Libris"
            >
              <Sparkles size={13} />
              <span>Ask Libris</span>
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <header className="reader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0, flex: 1 }}>
          <button className="btn-icon btn-sm" onClick={onClose} title="Back" style={{ flexShrink: 0 }}>
            <ArrowLeft size={16} />
          </button>
          <div className="reader-title-area" style={{ minWidth: 0 }}>
            <div className="reader-doc-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {document.title}
            </div>
            <div className="reader-chapter-title">
              {document.author} • {document.storageProvider.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="reader-actions" style={{ flexShrink: 0 }}>
          <button className="btn-icon btn-sm" onClick={handleCopy} title="Copy Content">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>

          <button
            className={`btn-icon btn-sm ${isBookmarked ? 'active' : ''}`}
            onClick={toggleBookmark}
            title="Bookmark"
          >
            <BookmarkIcon size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>

          <button
            className={`btn-icon btn-sm ${showAnnotations ? 'active' : ''}`}
            onClick={() => setShowAnnotations(!showAnnotations)}
            title="Annotations"
          >
            <Highlighter size={16} />
          </button>

          {onOpenLibris && (
            <button className="btn btn-sm btn-primary" onClick={() => onOpenLibris()}>
              <Sparkles size={13} />
              <span className="hide-on-mobile-xs">Libris AI</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content & Annotations Drawer */}
      <div className="reader-viewport">
        <main className="reader-stage selectable" ref={stageRef as any} onScroll={handleScroll}>
          <div className="reader-content-frame" style={{ maxWidth: 780, padding: 'clamp(14px, 4vw, 32px)' }}>
            {/* Tag Pills */}
            {document.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                {document.tags.map(t => (
                  <span key={t} className="badge">
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

        {/* Annotations Drawer */}
        {showAnnotations && (
          <>
            <div className="mobile-drawer-backdrop" onClick={() => setShowAnnotations(false)} />
            <aside className="reader-sidebar">
            <div className="reader-sidebar-header">
              <span style={{ fontFamily: 'var(--font-tech)', fontWeight: 600, fontSize: 'var(--text-2xs)', letterSpacing: '0.05em' }}>
                ANNOTATIONS ({annotations.length})
              </span>
              <button className="btn-icon btn-sm" onClick={() => setShowAnnotations(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {annotations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  No annotations on this markdown file yet. Select text to create one.
                </div>
              ) : (
                annotations.map(a => (
                  <div key={a.id} className="card" style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="badge">HIGHLIGHT</span>
                      <button className="btn-icon btn-sm" onClick={() => deleteHighlight(a.id)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', fontStyle: 'italic' }}>
                      "{a.selectedText}"
                    </div>
                    {a.note && (
                      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-secondary)', marginTop: 4, padding: '3px 6px', background: 'var(--bg-input)' }}>
                        Note: {a.note}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
          </>
        )}
      </div>
    </div>
  );
};
