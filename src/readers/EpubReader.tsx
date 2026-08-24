import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { IReaderProps, ReaderSettings, TocItem, ReaderTheme } from './ReaderInterface';
import { db } from '../core/db/DatabaseEngine';
import { Annotation, Bookmark, HighlightStyle } from '../core/types';
import { usePlatform } from '../platform/PlatformContext';

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

  // State
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInputText, setNoteInputText] = useState('');

  const contentRef = useRef<HTMLDivElement>(null);

  // Table of contents for the book
  const toc: TocItem[] = [
    { id: 'ch-1', label: '1. Getting Started & Installation', href: '#ch1' },
    { id: 'ch-2', label: '2. Programming a Guessing Game', href: '#ch2' },
    { id: 'ch-3', label: '3. Common Programming Concepts', href: '#ch3' },
    { id: 'ch-4', label: '4. Understanding Ownership & Borrowing', href: '#ch4' },
    { id: 'ch-5', label: '5. Using Structs to Structure Related Data', href: '#ch5' },
    { id: 'ch-6', label: '6. Enums and Pattern Matching', href: '#ch6' },
  ];

  // Book chapters content
  const rawChapters = [
    {
      title: 'Chapter 1: Getting Started & Installation',
      content: `
        <h2>Getting Started with Systems Programming</h2>
        <p>Welcome to systems programming! This book will guide you on how to write software that combines low-level control over machine resources with high-level ergonomics and compile-time safety guarantees.</p>
        <p>The first step in every developer's journey is installing the toolchain and setting up a build environment. Using modern package managers, managing dependencies, building, and running tests becomes seamless across Linux, macOS, and Windows.</p>
        <blockquote>"Systems programming should feel empowering, not perilous. Zero-cost abstractions allow us to express intent cleanly without runtime penalty."</blockquote>
        <p>Once your environment is configured, writing your first "Hello, World!" program demonstrates the basic anatomy of a compiled binary, standard library linking, and basic output formatting.</p>
      `,
    },
    {
      title: 'Chapter 2: Programming a Guessing Game',
      content: `
        <h2>Hands-on: The Guessing Game</h2>
        <p>To get our hands dirty with real code, let's implement a classic beginner program: a guessing game. The program will generate a random integer between 1 and 100, prompt the player to enter a guess, and indicate whether the guess is too low, too high, or correct.</p>
        <p>In doing so, we explore standard input/output handling, error handling with result types, immutable versus mutable variables, and pattern matching.</p>
        <p>Handling invalid user inputs gracefully rather than crashing with an unhandled panic is the foundation of robust software engineering.</p>
      `,
    },
    {
      title: 'Chapter 3: Common Programming Concepts',
      content: `
        <h2>Variables, Mutability, and Types</h2>
        <p>By default, variables are immutable. This is one of many nudges that encourage you to write code in a way that takes advantage of safety and easy concurrency.</p>
        <p>When a variable is immutable, once a value is bound to a name, you can't change that value. If you need mutability, you explicitly declare it with the mutable keyword.</p>
        <p>Data types are divided into scalar types (integers, floating-point numbers, booleans, characters) and compound types (tuples and fixed-size arrays).</p>
      `,
    },
    {
      title: 'Chapter 4: Understanding Ownership & Borrowing',
      content: `
        <h2>Ownership: Memory Safety without a Garbage Collector</h2>
        <p>Ownership is the most unique feature of modern systems languages, and it enables memory safety guarantees without needing a garbage collector.</p>
        <p>All programs have to manage the way they use a computer's memory while running. Some languages have garbage collection that constantly looks for no-longer-used memory as the program runs; in other languages, the programmer must explicitly allocate and free memory.</p>
        <p>In our architecture, memory is managed through a system of ownership with a set of rules that the compiler checks at compile time. If any of the rules are violated, the program won't compile.</p>
        <blockquote>"Ownership Rules: Each value has an owner. There can only be one owner at a time. When the owner goes out of scope, the value will be dropped."</blockquote>
        <p>References and Borrowing allow code to access data without taking ownership of it. References can be immutable (shared) or mutable (exclusive), governed by the golden rule of aliasing XOR mutability.</p>
      `,
    },
    {
      title: 'Chapter 5: Using Structs to Structure Related Data',
      content: `
        <h2>Structs & Associated Methods</h2>
        <p>A struct, or structure, is a custom data type that lets you package together and name multiple related values that make up a meaningful group.</p>
        <p>Methods are similar to functions: they’re declared with parameters and a return value, and they contain code that runs when called. However, unlike functions, methods are defined within the context of a struct and their first parameter is always a reference to the instance.</p>
      `,
    },
  ];

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

  // Update progress
  useEffect(() => {
    const totalChapters = rawChapters.length;
    const progress = Math.round(((currentChapterIndex + 1) / totalChapters) * 100);
    onProgressUpdate(progress, `chapter-${currentChapterIndex + 1}`);
  }, [currentChapterIndex]);

  // Handle Text Selection for Highlighting & AI
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      setSelectedText(text);
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 45,
      });
    } else {
      setSelectionPos(null);
    }
  };

  // Create & Persist Highlight
  const createHighlight = async (style: HighlightStyle = 'box', optionalNote?: string) => {
    if (!selectedText) return;

    const newAnnot: Annotation = {
      id: `annot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      documentId: document.id,
      location: `chapter-${currentChapterIndex + 1}`,
      selectedText: selectedText,
      note: optionalNote || undefined,
      style,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.saveAnnotation(newAnnot);
    await loadAnnotationsAndBookmarks();
    setSelectionPos(null);
    setSelectedText('');
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
      if (chIdx >= 0 && chIdx < rawChapters.length) {
        setCurrentChapterIndex(chIdx);
        setActiveHighlightId(annot.id);
        setShowAnnotations(false);
      }
    }
  };

  const toggleBookmark = async () => {
    const chapter = rawChapters[currentChapterIndex];
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

  // Inject persistent highlight spans into active chapter content
  const renderHighlightedChapterHtml = () => {
    let html = rawChapters[currentChapterIndex]?.content || '<p>End of preview.</p>';
    const chapterLocation = `chapter-${currentChapterIndex + 1}`;
    const chapterAnnots = annotations.filter(a => a.location === chapterLocation);

    for (const a of chapterAnnots) {
      if (a.selectedText && a.selectedText.length > 2) {
        // Escape special regex chars in selected text
        const safeRegex = a.selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${safeRegex})`, 'gi');
        const isActive = activeHighlightId === a.id;
        const markHtml = `<mark class="scifi-highlight ${isActive ? 'active' : ''}" data-annot-id="${a.id}" title="${a.note ? 'Note: ' + a.note : 'Highlight'}">$1</mark>`;
        html = html.replace(regex, markHtml);
      }
    }

    return html;
  };

  return (
    <div
      className="reader-container"
      style={{ filter: `brightness(${settings.brightness}%)` }}
      onMouseUp={handleMouseUp}
    >
      {/* Floating Selection Toolbar */}
      {selectionPos && (
        <div
          className="selection-toolbar"
          style={{
            left: `${selectionPos.x}px`,
            top: `${selectionPos.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => createHighlight('box')}
            title="Create Highlight"
          >
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
            title="Add Note"
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
            title="Copy Text"
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

      {/* Reader Header Bar */}
      <header className="reader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button className="btn-icon btn-sm" onClick={onClose} title="Back to Library">
            <ArrowLeft size={16} />
          </button>
          <div className="reader-title-area">
            <div className="reader-doc-title">{document.title}</div>
            <div className="reader-chapter-title">{rawChapters[currentChapterIndex]?.title}</div>
          </div>
        </div>

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
            title={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
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
            title="Highlights & Notes"
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
            title="Typography"
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
                    if (index < rawChapters.length) {
                      setCurrentChapterIndex(index);
                    }
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
          <div
            className="reader-content-frame"
            dangerouslySetInnerHTML={{ __html: renderHighlightedChapterHtml() }}
          />
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
                  Select text in the document to create persistent highlights and notes.
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="badge" style={{ textTransform: 'uppercase' }}>
                        {a.location}
                      </span>
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
                        <button
                          className="btn-icon btn-sm"
                          onClick={() => deleteHighlight(a.id)}
                          title="Delete Highlight"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Highlighted text preview */}
                    <div
                      onClick={() => jumpToAnnotation(a)}
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontStyle: 'italic',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        lineHeight: 1.4,
                      }}
                      title="Click to jump to location"
                    >
                      "{a.selectedText}"
                    </div>

                    {/* Attached Note */}
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
                          <button className="btn btn-primary btn-sm" onClick={() => saveNoteEdit(a.id)}>Save</button>
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
                TYPOGRAPHY
              </span>
              <button className="btn-icon btn-sm" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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
          <span>{Math.round(((currentChapterIndex + 1) / rawChapters.length) * 100)}%</span>
          <input
            type="range"
            min="0"
            max={rawChapters.length - 1}
            value={currentChapterIndex}
            onChange={e => setCurrentChapterIndex(Number(e.target.value))}
            className="reader-progress-slider"
          />
          <span>CH {currentChapterIndex + 1} / {rawChapters.length}</span>
        </div>

        <button
          className="btn btn-sm btn-ghost"
          disabled={currentChapterIndex >= rawChapters.length - 1}
          onClick={() => setCurrentChapterIndex(Math.min(rawChapters.length - 1, currentChapterIndex + 1))}
        >
          <span>NEXT</span>
          <ChevronRight size={14} />
        </button>
      </footer>
    </div>
  );
};
