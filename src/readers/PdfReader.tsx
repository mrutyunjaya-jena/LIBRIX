import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Search,
  Sparkles,
  Bookmark as BookmarkIcon,
  Highlighter,
  LayoutGrid,
  FileText,
} from 'lucide-react';
import { IReaderProps } from './ReaderInterface';
import { db } from '../core/db/DatabaseEngine';
import { Bookmark, Annotation, HighlightColor } from '../core/types';

export const PdfReader: React.FC<IReaderProps> = ({
  document,
  onClose,
  onProgressUpdate,
  onOpenLibris,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 24; // Simulated 24-page academic PDF
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    const load = async () => {
      setBookmarks(await db.getBookmarks(document.id));
      setAnnotations(await db.getAnnotations(document.id));
    };
    load();
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

  const createHighlight = async (color: HighlightColor) => {
    if (!selectedText) return;
    const annot: Annotation = {
      id: `pdf_annot_${Date.now()}`,
      documentId: document.id,
      location: `page-${currentPage}`,
      highlightedText: selectedText,
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.saveAnnotation(annot);
    setAnnotations([annot, ...annotations]);
    setSelectionPos(null);
    setSelectedText('');
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

  return (
    <div className="reader-container theme-dark" onMouseUp={handleMouseUp}>
      {/* Floating Selection Toolbar */}
      {selectionPos && (
        <div
          className="selection-toolbar"
          style={{ left: `${selectionPos.x}px`, top: `${selectionPos.y}px`, transform: 'translateX(-50%)' }}
        >
          <button className="btn-icon" onClick={() => createHighlight('yellow')} title="Yellow">
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#eab308' }} />
          </button>
          <button className="btn-icon" onClick={() => createHighlight('green')} title="Green">
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#22c55e' }} />
          </button>
          <button className="btn-icon" onClick={() => createHighlight('blue')} title="Blue">
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#3b82f6' }} />
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--border-medium)', margin: '0 4px' }} />
          {onOpenLibris && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                onOpenLibris(selectedText);
                setSelectionPos(null);
              }}
            >
              <Sparkles size={13} />
              Ask Libris
            </button>
          )}
        </div>
      )}

      {/* PDF Header Controls */}
      <header className="reader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button className="btn-icon" onClick={onClose} title="Back">
            <ArrowLeft size={18} />
          </button>
          <div className="reader-title-area">
            <div className="reader-doc-title">{document.title}</div>
            <div className="reader-chapter-title">Page {currentPage} of {totalPages}</div>
          </div>
        </div>

        {/* Center Zoom & Page Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button className="btn-icon btn-sm" onClick={() => setZoom(Math.max(50, zoom - 15))} title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          <span style={{ fontSize: 'var(--text-xs)', minWidth: 44, textAlign: 'center' }}>{zoom}%</span>
          <button className="btn-icon btn-sm" onClick={() => setZoom(Math.min(200, zoom + 15))} title="Zoom In">
            <ZoomIn size={16} />
          </button>
          <button className="btn-icon btn-sm" onClick={() => setRotation((rotation + 90) % 360)} title="Rotate">
            <RotateCw size={16} />
          </button>
        </div>

        {/* Right Actions */}
        <div className="reader-actions">
          <button
            className={`btn-icon ${showThumbnails ? 'active' : ''}`}
            onClick={() => setShowThumbnails(!showThumbnails)}
            title="Page Thumbnails"
          >
            <LayoutGrid size={18} />
          </button>

          <button
            className={`btn-icon ${isBookmarked ? 'active' : ''}`}
            onClick={toggleBookmark}
            style={{ color: isBookmarked ? 'var(--brand-400)' : 'inherit' }}
            title="Bookmark Page"
          >
            <BookmarkIcon size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>

          {onOpenLibris && (
            <button className="btn btn-sm btn-primary" onClick={() => onOpenLibris()}>
              <Sparkles size={14} />
              Libris RAG
            </button>
          )}
        </div>
      </header>

      {/* PDF Main Viewport */}
      <div className="reader-viewport">
        {/* Thumbnails Sidebar */}
        {showThumbnails && (
          <aside className="reader-sidebar left" style={{ width: 220 }}>
            <div className="reader-sidebar-header">
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Thumbnails</span>
              <button className="btn-icon btn-sm" onClick={() => setShowThumbnails(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-3)' }}>
              {Array.from({ length: totalPages }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  style={{
                    padding: 'var(--space-2)',
                    background: currentPage === i + 1 ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface)',
                    border: `1px solid ${currentPage === i + 1 ? 'var(--brand-500)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: 110,
                      background: 'var(--bg-input)',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <FileText size={24} />
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>Page {i + 1}</span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* PDF Page Stage */}
        <main
          className="reader-stage"
          style={{
            background: 'var(--bg-app)',
          }}
        >
          <div
            className="card card-elevated selectable"
            style={{
              width: `${(680 * zoom) / 100}px`,
              minHeight: `${(900 * zoom) / 100}px`,
              background: '#ffffff',
              color: '#0f172a',
              padding: `${(48 * zoom) / 100}px`,
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 15px 40px rgba(0, 0, 0, 0.5)',
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease, width 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: 8, marginBottom: 24, fontSize: '0.8rem', color: '#64748b' }}>
                <span>{document.title}</span>
                <span>Page {currentPage}</span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 16, color: '#0f172a' }}>
                {activePageData.title}
              </h2>
              <p style={{ fontSize: '1.05rem', lineHeight: 1.8, color: '#334155', textAlign: 'justify' }}>
                {activePageData.text}
              </p>
              <div style={{ marginTop: 24, padding: 16, background: '#f8fafc', borderRadius: 8, borderLeft: '4px solid #6366f1' }}>
                <p style={{ fontSize: '0.92rem', color: '#475569', margin: 0 }}>
                  <strong>Key Finding:</strong> Attention mechanisms calculate dynamic dependencies across all tokens simultaneously without recurrence overhead.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 32, fontSize: '0.75rem', color: '#94a3b8' }}>
              - {currentPage} -
            </div>
          </div>
        </main>
      </div>

      {/* PDF Footer Bar */}
      <footer className="reader-footer">
        <button
          className="btn btn-sm btn-ghost"
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          <ChevronLeft size={16} />
          Previous Page
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
          <span>{totalPages} Pages</span>
        </div>

        <button
          className="btn btn-sm btn-ghost"
          disabled={currentPage >= totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          Next Page
          <ChevronRight size={16} />
        </button>
      </footer>
    </div>
  );
};
