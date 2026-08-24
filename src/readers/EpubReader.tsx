import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  Bookmark as BookmarkIcon,
  Highlighter,
  Type,
  Sparkles,
  Search,
  Check,
  Plus,
  Trash2,
  Edit3,
  Copy,
  FileText,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { IReaderProps, ReaderSettings, TocItem } from './ReaderInterface';
import { db } from '../core/db/DatabaseEngine';
import { Document, Annotation, Bookmark, HighlightStyle } from '../core/types';
import { usePlatform } from '../platform/PlatformContext';
import { DocumentDataLoader } from '../core/storage/DocumentDataLoader';
import { EpubParser, ParsedEpubChapter } from './parsers/EpubParser';

export const EpubReader: React.FC<IReaderProps> = ({
  document,
  onClose,
  onProgressUpdate,
  onOpenLibris,
}) => {
  const platform = usePlatform();

  // Settings
  const [settings, setSettings] = useState<ReaderSettings>({
    theme: 'dark',
    fontFamily: 'serif',
    fontSize: 18,
    lineHeight: 1.8,
    letterSpacing: 0,
    marginHorizontal: 32,
    scrollMode: 'continuous',
    textAlign: 'left',
    brightness: 100,
  });

  const getInitialChapter = (doc: Document, totalChapters: number): number => {
    if (doc.readingProgress?.currentLocation) {
      const parsed = parseInt(doc.readingProgress.currentLocation.replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed >= 1) return Math.min(totalChapters - 1, Math.max(0, parsed - 1));
    }
    if (doc.readingProgress?.percentage && totalChapters > 0) {
      const idx = Math.round((doc.readingProgress.percentage / 100) * totalChapters) - 1;
      return Math.min(totalChapters - 1, Math.max(0, idx));
    }
    return 0;
  };

  // State
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [pageWidthMode, setPageWidthMode] = useState<'compact' | 'standard' | 'wide' | 'fluid'>('standard');
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [chapters, setChapters] = useState<ParsedEpubChapter[]>([]);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [isLoadingBook, setIsLoadingBook] = useState(true);

  // Selection Toolbar State
  const [selectedText, setSelectedText] = useState('');
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInputText, setNoteInputText] = useState('');

  const contentRef = useRef<HTMLDivElement>(null);
  const selectedTextRef = useRef<string>('');

  // Load Book Content (From actual IndexedDB raw binary or document text)
  useEffect(() => {
    const loadBook = async () => {
      setIsLoadingBook(true);
      try {
        const rawBytes = await DocumentDataLoader.loadDocumentBytes(document);
        if (rawBytes && rawBytes.length > 0) {
          const parsed = await EpubParser.parse(rawBytes);
          if (parsed.chapters && parsed.chapters.length > 0) {
            setChapters(parsed.chapters);
            setToc(parsed.toc);
            const targetCh = getInitialChapter(document, parsed.chapters.length);
            setCurrentChapterIndex(targetCh);
            setIsLoadingBook(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Could not parse binary epub:', err);
      }

      // Document snippet fallback or clean empty state
      if (document.contentSnippet && document.contentSnippet.length > 10) {
        setChapters([
          {
            id: 'ch_1',
            title: document.title,
            content: `<p>${document.contentSnippet.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
          },
        ]);
        setToc([{ id: 'toc_1', label: document.title, href: '#ch_1' }]);
        setCurrentChapterIndex(0);
      } else {
        setChapters([
          {
            id: 'ch_1',
            title: document.title,
            content: `<p style="color: var(--text-muted); font-style: italic;">No readable chapter text found in this file. Please import a valid EPUB or Markdown document.</p>`,
          },
        ]);
        setToc([{ id: 'toc_1', label: document.title, href: '#ch_1' }]);
        setCurrentChapterIndex(0);
      }
      setIsLoadingBook(false);
    };

    loadBook();
  }, [document.id]);

  // Load annotations & bookmarks from Database
  const loadAnnotationsAndBookmarks = async () => {
    const ann = await db.getAnnotations(document.id);
    const bmarks = await db.getBookmarks(document.id);
    setAnnotations(ann);
    setBookmarks(bmarks);
  };

  useEffect(() => {
    loadAnnotationsAndBookmarks();
  }, [document.id]);

  // Update progress and reset scroll
  useEffect(() => {
    if (chapters.length === 0) return;
    const progress = Math.min(100, Math.max(1, Math.round(((currentChapterIndex + 1) / chapters.length) * 100)));
    onProgressUpdate(progress, `chapter-${currentChapterIndex + 1}`);
    db.updateReadingProgress(document.id, { percentage: progress, currentLocation: `chapter-${currentChapterIndex + 1}` });
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentChapterIndex, chapters.length, document.id]);

  // Handle Text Selection for Highlighting
  const checkSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectionPos(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 0) {
      selectedTextRef.current = text;
      setSelectedText(text);
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const clampedX = Math.max(160, Math.min(window.innerWidth - 160, rect.left + rect.width / 2));
          const clampedY = rect.top < 85 ? Math.min(window.innerHeight - 60, rect.bottom + 12) : rect.top - 50;
          setSelectionPos({
            x: clampedX,
            y: clampedY,
          });
        }
      } catch (e) {
        // Range fallback
      }
    } else {
      setSelectionPos(null);
    }
  }, []);

  // Listen to document selection changes
  useEffect(() => {
    const onMouseUp = () => setTimeout(checkSelection, 30);
    const onKeyUp = () => setTimeout(checkSelection, 30);
    const onTouchEnd = () => setTimeout(checkSelection, 50);

    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [checkSelection]);

  // Create & Persist Highlight
  const createHighlight = async (style: HighlightStyle = 'box', optionalNote?: string) => {
    const textToHighlight = selectedTextRef.current || selectedText;
    if (!textToHighlight) return;

    const newAnnot: Annotation = {
      id: `annot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      documentId: document.id,
      location: `chapter-${currentChapterIndex + 1}`,
      selectedText: textToHighlight,
      note: optionalNote || undefined,
      style,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.saveAnnotation(newAnnot);
    await loadAnnotationsAndBookmarks();

    // Clear toolbar and selection
    setSelectionPos(null);
    setSelectedText('');
    selectedTextRef.current = '';
    window.getSelection()?.removeAllRanges();
  };

  const deleteHighlight = async (id: string) => {
    await db.deleteAnnotation(id);
    await loadAnnotationsAndBookmarks();
  };

  const saveNoteEdit = async (id: string) => {
    await db.updateAnnotationNote(id, noteInputText);
    setEditingNoteId(null);
    setNoteInputText('');
    await loadAnnotationsAndBookmarks();
  };

  const jumpToAnnotation = (annot: Annotation) => {
    const match = annot.location.match(/chapter-(\d+)/);
    if (match) {
      const chIdx = parseInt(match[1], 10) - 1;
      if (chIdx >= 0 && chIdx < chapters.length) {
        setCurrentChapterIndex(chIdx);
        setActiveHighlightId(annot.id);
        setShowAnnotations(false);
      }
    }
  };

  const toggleBookmark = async () => {
    const chapter = chapters[currentChapterIndex];
    if (!chapter) return;
    const loc = `chapter-${currentChapterIndex + 1}`;
    const existing = bookmarks.find(b => b.location === loc);
    if (existing) {
      await db.deleteBookmark(existing.id);
      setBookmarks(bookmarks.filter(b => b.id !== existing.id));
    } else {
      const newBmark: Bookmark = {
        id: `bmark_${Date.now()}`,
        documentId: document.id,
        title: chapter.title,
        location: loc,
        previewText: chapter.title,
        createdAt: Date.now(),
      };
      await db.saveBookmark(newBmark);
      setBookmarks([newBmark, ...bookmarks]);
    }
  };

  const isBookmarked = bookmarks.some(b => b.location === `chapter-${currentChapterIndex + 1}`);

  // Inject persistent highlight spans into active chapter content with tag-tolerant whitespace resilience
  const renderHighlightedChapterHtml = () => {
    let html = chapters[currentChapterIndex]?.content || '<p>End of preview.</p>';
    const chapterLocation = `chapter-${currentChapterIndex + 1}`;
    const chapterAnnots = annotations.filter(a => a.location === chapterLocation);

    for (const a of chapterAnnots) {
      if (a.selectedText && a.selectedText.trim().length > 1) {
        const words = a.selectedText.trim().split(/\s+/);
        const escapedWords = words.map(w => {
          let escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          escaped = escaped.replace(/['’]/g, "['’]");
          escaped = escaped.replace(/["“”]/g, '["“”]');
          escaped = escaped.replace(/[-—–]/g, '[-—–]');
          return escaped;
        });
        // Tag-tolerant pattern: matches whitespace, &nbsp;, OR tags between words
        const pattern = escapedWords.join('(?:\\s*<[^>]+>\\s*|\\s+|&nbsp;)+');

        try {
          const regex = new RegExp(`(${pattern})`, 'gi');
          const isActive = activeHighlightId === a.id;
          const markHtml = `<mark class="scifi-highlight ${isActive ? 'active' : ''}" data-annot-id="${a.id}" title="${a.note ? 'Note: ' + a.note : 'Highlight (Click to edit note)'}">$1</mark>`;
          html = html.replace(regex, markHtml);
        } catch (e) {
          // fallback
        }
      }
    }

    return html;
  };

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const mark = target.closest('mark.scifi-highlight') as HTMLElement | null;
    if (mark) {
      const annotId = mark.getAttribute('data-annot-id');
      if (annotId) {
        setActiveHighlightId(annotId);
        setShowAnnotations(true);
        const annot = annotations.find(a => a.id === annotId);
        if (annot) {
          setEditingNoteId(annot.id);
          setNoteInputText(annot.note || '');
        }
      }
    }
  };

  const getMaxWidthPx = () => {
    switch (pageWidthMode) {
      case 'compact':
        return 640;
      case 'wide':
        return 980;
      case 'fluid':
        return 1400;
      case 'standard':
      default:
        return 800;
    }
  };

  const activeChapter = chapters[currentChapterIndex];

  return (
    <div
      className="reader-container"
      style={{
        filter: `brightness(${settings.brightness}%)`,
      }}
    >
      {/* Floating Selection Toolbar — with preventDefault onMouseDown so click never deselects */}
      {selectionPos && (
        <div
          className="selection-toolbar scifi-box"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{
            position: 'fixed',
            left: `${selectionPos.x}px`,
            top: `${selectionPos.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 3000,
            background: 'var(--bg-surface-elevated)',
            padding: '4px 6px',
            borderRadius: 'var(--radius-xs)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <button
            className="btn btn-sm btn-primary"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => createHighlight('box')}
            title="Highlight Selected Text"
          >
            <Highlighter size={13} />
            <span>Highlight</span>
          </button>

          <button
            className="btn btn-sm btn-secondary"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => {
              const note = prompt('Add note to highlight:');
              if (note !== null) {
                createHighlight('box', note);
              }
            }}
            title="Add Note to Highlight"
          >
            <MessageSquare size={13} />
            <span>Note</span>
          </button>

          <button
            className="btn btn-sm btn-secondary"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={async () => {
              const text = selectedTextRef.current || selectedText;
              await platform.clipboard.copyText(text);
              setSelectionPos(null);
            }}
            title="Copy Text"
          >
            <Copy size={13} />
          </button>

          {onOpenLibris && (
            <button
              className="btn btn-sm btn-secondary"
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => {
                const text = selectedTextRef.current || selectedText;
                onOpenLibris(text);
                setSelectionPos(null);
              }}
              title="Ask Libris AI"
            >
              <Sparkles size={13} />
              <span>Ask Libris</span>
            </button>
          )}
        </div>
      )}

      {/* Reader Header Bar */}
      <header className="reader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button className="btn-icon btn-sm" onClick={onClose} title="Back to Library">
            <ArrowLeft size={16} />
          </button>
          <div className="reader-title-area">
            <div className="reader-doc-title">{document.title}</div>
            <div className="reader-chapter-title">{activeChapter?.title || 'Loading...'}</div>
          </div>
        </div>

        {/* Reader Action Controls */}
        <div className="reader-actions">
          <button
            className={`btn-icon btn-sm ${showToc ? 'active' : ''}`}
            onClick={() => {
              setShowToc(!showToc);
              setShowSettings(false);
              setShowAnnotations(false);
            }}
            title="Table of Contents"
          >
            <List size={16} />
          </button>

          <button
            className={`btn-icon btn-sm ${isBookmarked ? 'active' : ''}`}
            onClick={toggleBookmark}
            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Chapter'}
          >
            <BookmarkIcon size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>

          <button
            className={`btn-icon btn-sm ${showAnnotations ? 'active' : ''}`}
            onClick={() => {
              setShowAnnotations(!showAnnotations);
              setShowToc(false);
              setShowSettings(false);
            }}
            title="Highlights & Notes Studio"
          >
            <Highlighter size={16} />
          </button>

          <button
            className={`btn-icon btn-sm ${showSettings ? 'active' : ''}`}
            onClick={() => {
              setShowSettings(!showSettings);
              setShowToc(false);
              setShowAnnotations(false);
            }}
            title="Reading Typography"
          >
            <Type size={16} />
          </button>

          {onOpenLibris && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => onOpenLibris()}
              title="Open Libris AI"
            >
              <Sparkles size={13} />
              <span>Libris AI</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Viewport */}
      <div className="reader-viewport">
        {/* Table of Contents Drawer */}
        {showToc && (
          <aside className="reader-sidebar left">
            <div className="reader-sidebar-header">
              <span style={{ fontFamily: 'var(--font-tech)', fontWeight: 600, fontSize: 'var(--text-2xs)', letterSpacing: '0.05em' }}>
                TABLE OF CONTENTS
              </span>
              <button className="btn-icon btn-sm" onClick={() => setShowToc(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body">
              {toc.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setCurrentChapterIndex(index);
                    setShowToc(false);
                  }}
                  className={`palette-item ${currentChapterIndex === index ? 'active' : ''}`}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                    marginBottom: 2,
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Reader Stage */}
        <main
          className="reader-stage selectable"
          ref={contentRef}
          onClick={handleStageClick}
          style={{
            fontFamily:
              settings.fontFamily === 'serif'
                ? 'var(--font-serif)'
                : settings.fontFamily === 'sans'
                ? 'var(--font-sans)'
                : 'var(--font-mono)',
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            textAlign: settings.textAlign,
          }}
        >
          {isLoadingBook ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-muted)' }}>
              <Loader2 size={28} className="animate-spin" />
              <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-xs)' }}>
                PARSING REAL EPUB ARCHIVE...
              </span>
            </div>
          ) : (
            <div
              key={`ch-${currentChapterIndex}`}
              className="reader-content-frame"
              style={{ maxWidth: `${getMaxWidthPx()}px` }}
              dangerouslySetInnerHTML={{ __html: renderHighlightedChapterHtml() }}
            />
          )}
        </main>

        {/* Highlights & Notes Studio Drawer */}
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
                  Select text in the book to create persistent highlights and notes.
                </div>
              ) : (
                annotations.map(a => (
                  <div
                    key={a.id}
                    className="card"
                    style={{
                      padding: 'var(--space-3)',
                      border: activeHighlightId === a.id ? '1px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                      background: activeHighlightId === a.id ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="badge" style={{ textTransform: 'uppercase' }}>{a.location}</span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          className="btn-icon btn-sm"
                          onClick={() => {
                            setEditingNoteId(a.id);
                            setNoteInputText(a.note || '');
                          }}
                          title="Edit Note"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button className="btn-icon btn-sm" onClick={() => deleteHighlight(a.id)}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    <div
                      style={{ fontSize: 'var(--text-xs)', fontStyle: 'italic', cursor: 'pointer', color: 'var(--text-primary)' }}
                      onClick={() => jumpToAnnotation(a)}
                      title="Click to jump to location"
                    >
                      "{a.selectedText}"
                    </div>

                    {editingNoteId === a.id ? (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <textarea
                          value={noteInputText}
                          onChange={e => setNoteInputText(e.target.value)}
                          placeholder="Enter note..."
                          style={{ fontSize: 'var(--text-2xs)', padding: 4, height: 54 }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingNoteId(null)}>Cancel</button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => saveNoteEdit(a.id)}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : a.note ? (
                      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-secondary)', marginTop: 4, padding: '3px 6px', background: 'var(--bg-input)', borderRadius: 2 }}>
                        <strong>Note:</strong> {a.note}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Typography Settings Drawer */}
        {showSettings && (
          <aside className="reader-sidebar">
            <div className="reader-sidebar-header">
              <span style={{ fontFamily: 'var(--font-tech)', fontWeight: 600, fontSize: 'var(--text-2xs)', letterSpacing: '0.05em' }}>
                TYPOGRAPHY & LAYOUT
              </span>
              <button className="btn-icon btn-sm" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Page Width Mode */}
              <div className="form-group">
                <span className="form-label">Page Width</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {(['compact', 'standard', 'wide', 'fluid'] as const).map(mode => (
                    <button
                      key={mode}
                      className={`btn btn-sm ${pageWidthMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPageWidthMode(mode)}
                      style={{ fontSize: '0.65rem', textTransform: 'uppercase', padding: '4px 2px' }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family */}
              <div>
                <div className="form-label" style={{ marginBottom: 4 }}>Font Typeface</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                  <button
                    className={`btn btn-sm ${settings.fontFamily === 'serif' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSettings({ ...settings, fontFamily: 'serif' })}
                  >
                    Serif
                  </button>
                  <button
                    className={`btn btn-sm ${settings.fontFamily === 'sans' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSettings({ ...settings, fontFamily: 'sans' })}
                  >
                    Sans
                  </button>
                  <button
                    className={`btn btn-sm ${settings.fontFamily === 'mono' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSettings({ ...settings, fontFamily: 'mono' })}
                  >
                    Mono
                  </button>
                </div>
              </div>

              {/* Font Size Slider */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label">Font Size</span>
                  <span className="form-label">{settings.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="13"
                  max="30"
                  value={settings.fontSize}
                  onChange={e => setSettings({ ...settings, fontSize: Number(e.target.value) })}
                />
              </div>

              {/* Line Height */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label">Line Spacing</span>
                  <span className="form-label">{settings.lineHeight}x</span>
                </div>
                <input
                  type="range"
                  min="1.3"
                  max="2.4"
                  step="0.1"
                  value={settings.lineHeight}
                  onChange={e => setSettings({ ...settings, lineHeight: Number(e.target.value) })}
                />
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Reader Footer Navigation */}
      <footer className="reader-footer">
        <button
          className="btn btn-sm btn-ghost"
          disabled={currentChapterIndex === 0}
          onClick={() => setCurrentChapterIndex(Math.max(0, currentChapterIndex - 1))}
        >
          <ChevronLeft size={14} />
          <span>PREV</span>
        </button>

        <div className="reader-progress-slider-wrap">
          <span>{Math.round(((currentChapterIndex + 1) / Math.max(1, chapters.length)) * 100)}%</span>
          <input
            type="range"
            min="0"
            max={Math.max(0, chapters.length - 1)}
            value={currentChapterIndex}
            onChange={e => setCurrentChapterIndex(Number(e.target.value))}
            className="reader-progress-slider"
          />
          <span>CH {currentChapterIndex + 1} / {chapters.length}</span>
        </div>

        <button
          className="btn btn-sm btn-ghost"
          disabled={currentChapterIndex >= chapters.length - 1}
          onClick={() => setCurrentChapterIndex(Math.min(chapters.length - 1, currentChapterIndex + 1))}
        >
          <span>NEXT</span>
          <ChevronRight size={14} />
        </button>
      </footer>
    </div>
  );
};
