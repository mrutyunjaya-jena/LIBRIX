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
  Sun,
  Moon,
  Coffee,
  Eye,
  Search,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import { IReaderProps, ReaderSettings, TocItem, ReaderTheme } from './ReaderInterface';
import { db } from '../core/db/DatabaseEngine';
import { Annotation, Bookmark, HighlightColor } from '../core/types';

export const EpubReader: React.FC<IReaderProps> = ({
  document,
  onClose,
  onProgressUpdate,
  onOpenLibris,
}) => {
  // Settings
  const [settings, setSettings] = useState<ReaderSettings>({
    theme: 'dark',
    fontFamily: 'serif',
    fontSize: 18,
    lineHeight: 1.7,
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
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const [annotationNote, setAnnotationNote] = useState('');

  const contentRef = useRef<HTMLDivElement>(null);

  // Table of contents for the book
  const toc: TocItem[] = [
    { id: 'ch-1', label: '1. Getting Started & Installation', href: '#ch1' },
    { id: 'ch-2', label: '2. Programming a Guessing Game', href: '#ch2' },
    { id: 'ch-3', label: '3. Common Programming Concepts', href: '#ch3' },
    { id: 'ch-4', label: '4. Understanding Ownership & Borrowing', href: '#ch4' },
    { id: 'ch-5', label: '5. Using Structs to Structure Related Data', href: '#ch5' },
    { id: 'ch-6', label: '6. Enums and Pattern Matching', href: '#ch6' },
    { id: 'ch-7', label: '7. Managing Growing Projects with Packages & Crates', href: '#ch7' },
    { id: 'ch-8', label: '8. Generic Types, Traits, and Lifetimes', href: '#ch8' },
    { id: 'ch-9', label: '9. Concurrency, Threads, and Channels', href: '#ch9' },
  ];

  // Book chapters content demo
  const chapters = [
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

  // Load annotations & bookmarks
  useEffect(() => {
    const loadData = async () => {
      const ann = await db.getAnnotations(document.id);
      const bmarks = await db.getBookmarks(document.id);
      setAnnotations(ann);
      setBookmarks(bmarks);
    };
    loadData();
  }, [document.id]);

  // Update progress
  useEffect(() => {
    const totalChapters = chapters.length;
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
        y: rect.top - 50,
      });
    } else {
      setSelectionPos(null);
    }
  };

  const createHighlight = async (color: HighlightColor) => {
    if (!selectedText) return;
    const newAnnot: Annotation = {
      id: `annot_${Date.now()}`,
      documentId: document.id,
      location: `chapter-${currentChapterIndex + 1}`,
      highlightedText: selectedText,
      note: annotationNote || undefined,
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.saveAnnotation(newAnnot);
    setAnnotations([newAnnot, ...annotations]);
    setSelectionPos(null);
    setSelectedText('');
    setAnnotationNote('');
  };

  const toggleBookmark = async () => {
    const chapter = chapters[currentChapterIndex];
    const existing = bookmarks.find(b => b.location === `chapter-${currentChapterIndex + 1}`);
    if (existing) {
      await db.deleteBookmark(existing.id);
      setBookmarks(bookmarks.filter(b => b.id !== existing.id));
    } else {
      const newBmark: Bookmark = {
        id: `bmark_${Date.now()}`,
        documentId: document.id,
        title: chapter.title,
        location: `chapter-${currentChapterIndex + 1}`,
        previewText: chapter.title,
        createdAt: Date.now(),
      };
      await db.saveBookmark(newBmark);
      setBookmarks([newBmark, ...bookmarks]);
    }
  };

  const isBookmarked = bookmarks.some(b => b.location === `chapter-${currentChapterIndex + 1}`);

  return (
    <div
      className={`reader-container theme-${settings.theme}`}
      style={{
        filter: `brightness(${settings.brightness}%)`,
      }}
      onMouseUp={handleMouseUp}
    >
      {/* Selection Toolbar */}
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
            className="btn-icon"
            style={{ color: '#eab308' }}
            title="Yellow Highlight"
            onClick={() => createHighlight('yellow')}
          >
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#eab308' }} />
          </button>
          <button
            className="btn-icon"
            style={{ color: '#22c55e' }}
            title="Green Highlight"
            onClick={() => createHighlight('green')}
          >
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#22c55e' }} />
          </button>
          <button
            className="btn-icon"
            style={{ color: '#3b82f6' }}
            title="Blue Highlight"
            onClick={() => createHighlight('blue')}
          >
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#3b82f6' }} />
          </button>
          <button
            className="btn-icon"
            style={{ color: '#ec4899' }}
            title="Pink Highlight"
            onClick={() => createHighlight('pink')}
          >
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#ec4899' }} />
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

      {/* Reader Header Bar */}
      <header className="reader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button className="btn-icon" onClick={onClose} title="Back to Library">
            <ArrowLeft size={18} />
          </button>
          <div className="reader-title-area">
            <div className="reader-doc-title">{document.title}</div>
            <div className="reader-chapter-title">{chapters[currentChapterIndex]?.title}</div>
          </div>
        </div>

        <div className="reader-actions">
          <button
            className={`btn-icon ${showToc ? 'active' : ''}`}
            onClick={() => {
              setShowToc(!showToc);
              setShowSettings(false);
              setShowAnnotations(false);
            }}
            title="Table of Contents"
          >
            <List size={18} />
          </button>

          <button
            className={`btn-icon ${isBookmarked ? 'active' : ''}`}
            onClick={toggleBookmark}
            title={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
            style={{ color: isBookmarked ? 'var(--brand-400)' : 'inherit' }}
          >
            <BookmarkIcon size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>

          <button
            className={`btn-icon ${showAnnotations ? 'active' : ''}`}
            onClick={() => {
              setShowAnnotations(!showAnnotations);
              setShowToc(false);
              setShowSettings(false);
            }}
            title="Highlights & Notes"
          >
            <Highlighter size={18} />
          </button>

          <button
            className={`btn-icon ${showSettings ? 'active' : ''}`}
            onClick={() => {
              setShowSettings(!showSettings);
              setShowToc(false);
              setShowAnnotations(false);
            }}
            title="Typography & Themes"
          >
            <Type size={18} />
          </button>

          {onOpenLibris && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => onOpenLibris()}
              title="Open Libris AI"
            >
              <Sparkles size={14} />
              Libris AI
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
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Table of Contents</span>
              <button className="btn-icon btn-sm" onClick={() => setShowToc(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body">
              {toc.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (index < chapters.length) {
                      setCurrentChapterIndex(index);
                    }
                    setShowToc(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                    background: currentChapterIndex === index ? 'var(--brand-500)' : 'transparent',
                    color: currentChapterIndex === index ? '#ffffff' : 'var(--text-secondary)',
                    marginBottom: 4,
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
            dangerouslySetInnerHTML={{ __html: chapters[currentChapterIndex]?.content || '<p>End of preview.</p>' }}
          />
        </main>

        {/* Highlights & Notes Drawer */}
        {showAnnotations && (
          <aside className="reader-sidebar">
            <div className="reader-sidebar-header">
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Highlights ({annotations.length})</span>
              <button className="btn-icon btn-sm" onClick={() => setShowAnnotations(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body">
              {annotations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  Select text in the reader to create highlights and notes.
                </div>
              ) : (
                annotations.map(a => (
                  <div key={a.id} className="card" style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div className={`badge highlight-${a.color}`} style={{ textTransform: 'capitalize' }}>
                        {a.color}
                      </div>
                      <button
                        className="btn-icon btn-sm"
                        onClick={async () => {
                          await db.deleteAnnotation(a.id);
                          setAnnotations(annotations.filter(item => item.id !== a.id));
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', fontStyle: 'italic', color: 'var(--text-primary)', marginBottom: 4 }}>
                      "{a.highlightedText}"
                    </div>
                    {a.note && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-400)', marginTop: 4 }}>
                        Note: {a.note}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Typography & Theme Popover / Drawer */}
        {showSettings && (
          <aside className="reader-sidebar">
            <div className="reader-sidebar-header">
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Appearance & Typography</span>
              <button className="btn-icon btn-sm" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Theme selection */}
              <div>
                <div className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Color Theme</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
                  {(['dark', 'light', 'sepia', 'high-contrast'] as ReaderTheme[]).map(t => (
                    <button
                      key={t}
                      className={`btn btn-sm ${settings.theme === t ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ textTransform: 'capitalize' }}
                      onClick={() => setSettings({ ...settings, theme: t })}
                    >
                      {t === 'dark' && <Moon size={12} />}
                      {t === 'light' && <Sun size={12} />}
                      {t === 'sepia' && <Coffee size={12} />}
                      {t === 'high-contrast' && <Eye size={12} />}
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family */}
              <div>
                <div className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Font Family</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
                  <button
                    className={`btn btn-sm ${settings.fontFamily === 'serif' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontFamily: 'var(--font-serif)' }}
                    onClick={() => setSettings({ ...settings, fontFamily: 'serif' })}
                  >
                    Serif
                  </button>
                  <button
                    className={`btn btn-sm ${settings.fontFamily === 'sans' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontFamily: 'var(--font-sans)' }}
                    onClick={() => setSettings({ ...settings, fontFamily: 'sans' })}
                  >
                    Sans
                  </button>
                  <button
                    className={`btn btn-sm ${settings.fontFamily === 'mono' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontFamily: 'var(--font-mono)' }}
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
                  max="32"
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
                  min="1.2"
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
          <ChevronLeft size={16} />
          Previous Chapter
        </button>

        <div className="reader-progress-slider-wrap">
          <span>{Math.round(((currentChapterIndex + 1) / chapters.length) * 100)}%</span>
          <input
            type="range"
            min="0"
            max={chapters.length - 1}
            value={currentChapterIndex}
            onChange={e => setCurrentChapterIndex(Number(e.target.value))}
            className="reader-progress-slider"
          />
          <span>Chapter {currentChapterIndex + 1} of {chapters.length}</span>
        </div>

        <button
          className="btn btn-sm btn-ghost"
          disabled={currentChapterIndex >= chapters.length - 1}
          onClick={() => setCurrentChapterIndex(Math.min(chapters.length - 1, currentChapterIndex + 1))}
        >
          Next Chapter
          <ChevronRight size={16} />
        </button>
      </footer>
    </div>
  );
};
