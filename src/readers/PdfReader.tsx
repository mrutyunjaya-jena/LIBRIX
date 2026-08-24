import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sparkles,
  Bookmark as BookmarkIcon,
  Highlighter,
  LayoutGrid,
  FileText,
  Trash2,
  Edit3,
  Copy,
  MessageSquare,
} from 'lucide-react';
import { IReaderProps } from './ReaderInterface';
import { db } from '../core/db/DatabaseEngine';
import { Bookmark, Annotation, HighlightStyle } from '../core/types';
import { usePlatform } from '../platform/PlatformContext';

export const PdfReader: React.FC<IReaderProps> = ({
  document,
  onClose,
  onProgressUpdate,
  onOpenLibris,
}) => {
  const platform = usePlatform();
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 24;
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Simulated pages content
  const pagesContent = [
    {
      page: 1,
      title: 'Abstract & Introduction',
      text: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
    },
    {
      page: 2,
      title: 'Background & Related Work',
      text: 'The goal of reducing sequential computation also forms the foundation of the Extended Neural GPU, ByteNet and ConvS2S, all of which use convolutional neural networks as basic building blocks. In these models, the number of operations required to relate signals from two arbitrary input or output positions grows in the distance between positions.',
    },
    {
      page: 3,
      title: 'Model Architecture - Scaled Dot-Product Attention',
      text: 'An attention function can be described as mapping a query and a set of key-value pairs to an output, where the query, keys, values, and output are all vectors. The output is computed as a weighted sum of the values, where the weight assigned to each value is computed by a compatibility function of the query with the corresponding key.',
    },
    {
      page: 4,
      title: 'Multi-Head Attention & Positional Encoding',
      text: 'Instead of performing a single attention function with d_model-dimensional keys, values and queries, we found it beneficial to linearly project the queries, keys and values h times with different, learned linear projections. Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions.',
    },
  ];

  const loadData = async () => {
    setBookmarks(await db.getBookmarks(document.id));
    setAnnotations(await db.getAnnotations(document.id));
  };

  useEffect(() => {
    loadData();
  }, [document.id]);

  useEffect(() => {
    const progress = Math.round((currentPage / totalPages) * 100);
    onProgressUpdate(progress, `page-${currentPage}`);
  }, [currentPage]);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      const text = sel.toString().trim();
      setSelectedText(text);
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPos({ x: rect.left + rect.width / 2, y: rect.top - 45 });
    } else {
      setSelectionPos(null);
    }
  };

  const createHighlight = async (style: HighlightStyle = 'box', noteText?: string) => {
    if (!selectedText) return;
    const annot: Annotation = {
      id: `pdf_annot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      documentId: document.id,
      location: `page-${currentPage}`,
      selectedText,
      note: noteText || undefined,
      style,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.saveAnnotation(annot);
    await loadData();
    setSelectionPos(null);
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
  };

  const deleteHighlight = async (id: string) => {
    await db.deleteAnnotation(id);
    await loadData();
  };

  const isBookmarked = bookmarks.some(b => b.location === `page-${currentPage}`);

  const toggleBookmark = async () => {
    if (isBookmarked) {
      const existing = bookmarks.find(b => b.location === `page-${currentPage}`);
      if (existing) {
        await db.deleteBookmark(existing.id);
        setBookmarks(bookmarks.filter(b => b.id !== existing.id));
      }
    } else {
      const bmark: Bookmark = {
        id: `pdf_bmark_${Date.now()}`,
        documentId: document.id,
        title: `Page ${currentPage}`,
        location: `page-${currentPage}`,
        previewText: pagesContent.find(p => p.page === currentPage)?.text.substring(0, 80) || `Page ${currentPage}`,
        createdAt: Date.now(),
      };
      await db.saveBookmark(bmark);
      setBookmarks([bmark, ...bookmarks]);
    }
  };

  const activePageData = pagesContent.find(p => p.page === currentPage) || {
    page: currentPage,
    title: `Section ${currentPage}`,
    text: `Page ${currentPage} content stream. Librix provides high-performance document rendering and offline local vector indexing for instant full-text analysis.`,
  };

  // Render highlighted text in page
  const renderHighlightedPageText = (rawText: string) => {
    let rendered = rawText;
    const pageLocation = `page-${currentPage}`;
    const pageAnnots = annotations.filter(a => a.location === pageLocation);

    for (const a of pageAnnots) {
      if (a.selectedText && a.selectedText.length > 2) {
        const safeRegex = a.selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${safeRegex})`, 'gi');
        rendered = rendered.replace(regex, `<mark class="scifi-highlight" title="${a.note ? 'Note: ' + a.note : 'Highlight'}">$1</mark>`);
      }
    }
    return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
  };

  return (
    <div className="reader-container" onMouseUp={handleMouseUp}>
      {/* Floating Selection Toolbar */}
      {selectionPos && (
        <div
          className="selection-toolbar"
          style={{ left: `${selectionPos.x}px`, top: `${selectionPos.y}px`, transform: 'translateX(-50%)' }}
        >
          <button className="btn btn-sm btn-secondary" onClick={() => createHighlight('box')}>
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
          >
            <Copy size={13} />
          </button>

          {onOpenLibris && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                onOpenLibris(selectedText);
                setSelectionPos(null);
              }}
            >
              <Sparkles size={13} />
              <span>Ask Libris</span>
            </button>
          )}
        </div>
      )}

      {/* PDF Header Controls */}
      <header className="reader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button className="btn-icon btn-sm" onClick={onClose} title="Back">
            <ArrowLeft size={16} />
          </button>
          <div className="reader-title-area">
            <div className="reader-doc-title">{document.title}</div>
            <div className="reader-chapter-title">PAGE {currentPage} / {totalPages}</div>
          </div>
        </div>

        {/* Center Zoom & Rotation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <button className="btn-icon btn-sm" onClick={() => setZoom(Math.max(50, zoom - 15))} title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', minWidth: 40, textAlign: 'center' }}>
            {zoom}%
          </span>
          <button className="btn-icon btn-sm" onClick={() => setZoom(Math.min(200, zoom + 15))} title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <button className="btn-icon btn-sm" onClick={() => setRotation((rotation + 90) % 360)} title="Rotate">
            <RotateCw size={14} />
          </button>
        </div>

        {/* Right Actions */}
        <div className="reader-actions">
          <button
            className={`btn-icon btn-sm ${showThumbnails ? 'active' : ''}`}
            onClick={() => {
              setShowThumbnails(!showThumbnails);
              setShowAnnotations(false);
            }}
            title="Page Thumbnails"
          >
            <LayoutGrid size={16} />
          </button>

          <button
            className={`btn-icon btn-sm ${isBookmarked ? 'active' : ''}`}
            onClick={toggleBookmark}
            title="Bookmark Page"
          >
            <BookmarkIcon size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>

          <button
            className={`btn-icon btn-sm ${showAnnotations ? 'active' : ''}`}
            onClick={() => {
              setShowAnnotations(!showAnnotations);
              setShowThumbnails(false);
            }}
            title="Annotations"
          >
            <Highlighter size={16} />
          </button>

          {onOpenLibris && (
            <button className="btn btn-sm btn-primary" onClick={() => onOpenLibris()}>
              <Sparkles size={13} />
              <span>Libris AI</span>
            </button>
          )}
        </div>
      </header>

      {/* PDF Main Viewport */}
      <div className="reader-viewport">
        {/* Thumbnails Sidebar */}
        {showThumbnails && (
          <aside className="reader-sidebar left" style={{ width: 200 }}>
            <div className="reader-sidebar-header">
              <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', fontWeight: 600, letterSpacing: '0.05em' }}>
                THUMBNAILS
              </span>
              <button className="btn-icon btn-sm" onClick={() => setShowThumbnails(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-2)' }}>
              {Array.from({ length: totalPages }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`palette-item ${currentPage === i + 1 ? 'active' : ''}`}
                  style={{
                    padding: '6px',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: 80,
                      background: 'var(--bg-input)',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <FileText size={20} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', marginTop: 4 }}>
                    PAGE {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* PDF Page Stage */}
        <main className="reader-stage">
          <div
            className="card card-elevated selectable"
            style={{
              width: `${(640 * zoom) / 100}px`,
              minHeight: `${(860 * zoom) / 100}px`,
              background: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
              padding: `${(40 * zoom) / 100}px`,
              borderRadius: 'var(--radius-sm)',
              transform: `rotate(${rotation}deg)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: '1px solid var(--border-strong)',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6, marginBottom: 20, fontFamily: 'var(--font-tech)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>{document.title}</span>
                <span>PAGE {currentPage}</span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)' }}>
                {activePageData.title}
              </h2>
              <p style={{ fontSize: '1rem', lineHeight: 1.8, color: 'var(--text-primary)', textAlign: 'justify' }}>
                {renderHighlightedPageText(activePageData.text)}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginTop: 24, fontFamily: 'var(--font-tech)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              - {currentPage} -
            </div>
          </div>
        </main>

        {/* Annotations Drawer */}
        {showAnnotations && (
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
                  No annotations on this document yet.
                </div>
              ) : (
                annotations.map(a => (
                  <div key={a.id} className="card" style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="badge" style={{ textTransform: 'uppercase' }}>{a.location}</span>
                      <button className="btn-icon btn-sm" onClick={() => deleteHighlight(a.id)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div
                      style={{ fontSize: 'var(--text-xs)', fontStyle: 'italic', cursor: 'pointer' }}
                      onClick={() => {
                        const pageNum = parseInt(a.location.replace('page-', ''), 10);
                        if (!isNaN(pageNum)) setCurrentPage(pageNum);
                        setShowAnnotations(false);
                      }}
                      title="Click to jump to page"
                    >
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
        )}
      </div>

      {/* PDF Footer Bar */}
      <footer className="reader-footer">
        <button
          className="btn btn-sm btn-ghost"
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          <ChevronLeft size={14} />
          <span>PREV</span>
        </button>

        <div className="reader-progress-slider-wrap">
          <span>{currentPage}</span>
          <input
            type="range"
            min="1"
            max={totalPages}
            value={currentPage}
            onChange={e => setCurrentPage(Number(e.target.value))}
            className="reader-progress-slider"
          />
          <span>{totalPages} PAGES</span>
        </div>

        <button
          className="btn btn-sm btn-ghost"
          disabled={currentPage >= totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          <span>NEXT</span>
          <ChevronRight size={14} />
        </button>
      </footer>
    </div>
  );
};
