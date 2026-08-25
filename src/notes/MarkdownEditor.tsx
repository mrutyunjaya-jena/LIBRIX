import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  Code,
  Sparkles,
  ArrowLeft,
  Calendar,
  ExternalLink,
  Trash2,
  Check,
  Smile,
  Image as ImageIcon,
  ChevronDown,
  X,
  Plus,
  Zap,
  Maximize2,
  Minimize2,
  Layers,
  Edit3,
  Tag as TagIcon,
  Clock,
  BookOpen,
} from 'lucide-react';
import { Note } from '../core/types';
import { db } from '../core/db/DatabaseEngine';
import { parseNoteContent } from './WikilinkParser';
import { SlashMenu, SlashMenuItem } from './SlashMenu';
import { FloatingFormatToolbar } from './FloatingFormatToolbar';
import { CanvasBlock, BlockEngine, BlockType, NotionBlock, NotionBlockEngine, NotionBlockType } from './BlockEngine';
import { LiveBlockItem } from './LiveBlockItem';
import { storageRegistry } from '../storage/StorageRegistry';
import { cloudVaultSyncService } from '../storage/sync/CloudVaultSyncService';
import { localDiskVaultService } from '../storage/local/LocalDiskVaultService';
import { storageUsageIndex } from '../storage/usage/StorageUsageIndex';

interface MarkdownEditorProps {
  note: Note;
  onClose: () => void;
  onSave: (updatedNote: Note) => void;
  onNavigateNote?: (noteIdOrTitle: string) => void;
  onOpenLibris?: (contextText?: string) => void;
}

const COVER_PRESETS = [
  { id: 'none', label: 'None', value: '' },
  { id: 'aurora', label: 'Aurora', value: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 50%, #ec4899 100%)' },
  { id: 'cyber', label: 'Cyberpunk', value: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)' },
  { id: 'emerald', label: 'Emerald', value: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)' },
  { id: 'sunset', label: 'Sunset', value: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 50%, #f97316 100%)' },
  { id: 'obsidian', label: 'Obsidian', value: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)' },
  { id: 'cosmic', label: 'Cosmic', value: 'linear-gradient(135deg, #2e1065 0%, #581c87 50%, #7e22ce 100%)' },
];

const EMOJI_PRESETS = [
  '📄', '💡', '🚀', '📚', '🔬', '⚡', '🎯', '✨', '🔥', '🧠',
  '📝', '💻', '🎨', '🌐', '⭐', '📊', '🛠️', '🔑', '📖', '🔖',
  '🏆', '📌', '🗓️', '🧪', '🌱', '🪐', '🛡️', '💬', '🧭', '🔮',
];

const STATUS_PRESETS = ['Draft', 'In Progress', 'Completed'];

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  note,
  onClose,
  onSave,
  onNavigateNote,
  onOpenLibris,
}) => {
  const [parsed, setParsed] = useState(parseNoteContent(note.content));
  const [blocks, setBlocks] = useState<NotionBlock[]>(() =>
    NotionBlockEngine.markdownToBlocks(note.content)
  );

  const [rawMarkdown, setRawMarkdown] = useState(note.content);
  const [editorMode, setEditorMode] = useState<'live' | 'source'>('live');

  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [backlinksList, setBacklinksList] = useState<Note[]>([]);
  const [showInspector, setShowInspector] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > 900 : true
  );
  const [isSaved, setIsSaved] = useState(true);
  const [isZenMode, setIsZenMode] = useState(false);

  // Page Header Properties
  const [icon, setIcon] = useState(parsed.icon || '📄');
  const [cover, setCover] = useState(parsed.cover || '');
  const [status, setStatus] = useState(parsed.status || 'Draft');
  const [title, setTitle] = useState(parsed.title || note.title);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  // Active focus block index
  const [focusedIndex, setFocusedIndex] = useState<number | null>(0);

  // Slash Command Menu State
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const [activeSlashBlockIndex, setActiveSlashBlockIndex] = useState<number | null>(null);

  // Floating Selection Toolbar State
  const [selectionToolbarVisible, setSelectionToolbarVisible] = useState(false);
  const [selectionToolbarPos, setSelectionToolbarPos] = useState({ top: 0, left: 0 });

  // AI Assistant State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Latest state reference for safe unmount & auto-save execution
  const latestStateRef = useRef({
    note,
    blocks,
    rawMarkdown,
    title,
    icon,
    cover,
    status,
    editorMode,
  });

  useEffect(() => {
    latestStateRef.current = {
      note,
      blocks,
      rawMarkdown,
      title,
      icon,
      cover,
      status,
      editorMode,
    };
  }, [note, blocks, rawMarkdown, title, icon, cover, status, editorMode]);

  // Sync markdown whenever blocks change in live mode
  useEffect(() => {
    if (editorMode === 'live') {
      const md = NotionBlockEngine.blocksToMarkdown(blocks);
      setRawMarkdown(md);
      const updatedParsed = parseNoteContent(md);
      setParsed(updatedParsed);
    }
  }, [blocks, editorMode]);

  // Re-sync editor state if note prop changes
  useEffect(() => {
    const p = parseNoteContent(note.content);
    setParsed(p);
    setBlocks(NotionBlockEngine.markdownToBlocks(note.content));
    setRawMarkdown(note.content);
    setTitle(note.title || p.title || 'Untitled Note');
    setIcon(note.frontmatter?.icon || p.icon || '📄');
    setCover(note.frontmatter?.cover || p.cover || '');
    setStatus(note.frontmatter?.status || p.status || 'Draft');
    setIsSaved(true);
  }, [note.id]);

  // Load backlinks
  useEffect(() => {
    const loadNotes = async () => {
      const notes = await db.getNotes();
      setAllNotes(notes);
      const back = notes.filter(n =>
        n.id !== note.id && (
          n.content.includes(`[[${note.title}]]`) ||
          n.content.includes(`[[${note.slug}]]`)
        )
      );
      setBacklinksList(back);
    };
    loadNotes();
  }, [note.id, note.title]);

  // Word count and reading time
  const wordsCount = rawMarkdown.trim() ? rawMarkdown.trim().split(/\s+/).length : 0;
  const readingTimeMin = Math.max(1, Math.ceil(wordsCount / 200));

  // Save changes to database and local disk
  const handleSave = async (customMarkdown?: string, customTitle?: string) => {
    const s = latestStateRef.current;
    const activeMarkdown = customMarkdown !== undefined
      ? customMarkdown
      : (s.editorMode === 'source' ? s.rawMarkdown : NotionBlockEngine.blocksToMarkdown(s.blocks));

    const currentParsed = parseNoteContent(activeMarkdown);
    const resolvedTitle = (customTitle !== undefined ? customTitle : s.title) || currentParsed.title || s.note.title || 'Untitled Note';
    const resolvedSlug = resolvedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled-note';

    const updatedFrontmatter = {
      ...currentParsed.frontmatter,
      title: resolvedTitle,
      icon: s.icon,
      cover: s.cover || undefined,
      status: s.status,
      tags: currentParsed.tags,
      modified: new Date().toISOString().slice(0, 10),
    };

    let finalContent = activeMarkdown;
    const hasFrontmatter = /^---\r?\n[\s\S]*?\r?\n---/.test(activeMarkdown);
    const hasCustomMeta = s.icon !== '📄' || s.cover || s.status !== 'Draft' || (currentParsed.tags && currentParsed.tags.length > 0);

    const fmString =
      `---\ntitle: "${resolvedTitle}"\nicon: "${s.icon}"\nstatus: "${s.status}"\n` +
      (s.cover ? `cover: "${s.cover}"\n` : '') +
      (currentParsed.tags.length > 0 ? `tags: [${currentParsed.tags.map(t => `"${t}"`).join(', ')}]\n` : '') +
      `---\n\n`;

    if (hasFrontmatter) {
      finalContent = activeMarkdown.replace(/^---\r?\n[\s\S]*?\r?\n---/, fmString.trim());
    } else if (hasCustomMeta && activeMarkdown.trim().length > 0) {
      finalContent = fmString + activeMarkdown;
    }

    const updatedNote: Note = {
      ...s.note,
      title: resolvedTitle,
      slug: resolvedSlug,
      content: finalContent,
      frontmatter: updatedFrontmatter,
      tags: currentParsed.tags,
      wikilinks: currentParsed.wikilinks,
      modifiedAt: Date.now(),
    };

    // 1. Immediately persist to database (sync < 2ms)
    await db.saveNote(updatedNote);
    storageUsageIndex.markDirty();

    // 2. Persist to local disk if vault connected
    await localDiskVaultService.saveNoteToDisk(resolvedTitle, finalContent, updatedNote).catch(() => {});

    // 3. Notify parent
    onSave(updatedNote);
    setIsSaved(true);

    // 4. Background cloud sync (fire-and-forget, cleans old renamed files and updates catalog)
    (async () => {
      const cloudProviders = storageRegistry.getAllProviders().filter(p => p.type !== 'local' && p.isConnected());
      for (const provider of cloudProviders) {
        try {
          const targetFolderPath = await cloudVaultSyncService.getFolderPathString(updatedNote.folderId, '/LIBRIX/Notes');
          const safeTitle = (updatedNote.title || 'Untitled_Note').replace(/[/\\?%*:|"<>]/g, '_');

          // Clean previous file on cloud if note was renamed to prevent duplicate cloud files
          if (s.note.title && s.note.title !== updatedNote.title) {
            const oldSafeTitle = s.note.title.replace(/[/\\?%*:|"<>]/g, '_');
            if (oldSafeTitle !== safeTitle) {
              await provider.delete(`${targetFolderPath}/${oldSafeTitle}.md`).catch(() => {});
            }
          }

          const noteBytes = new TextEncoder().encode(updatedNote.content);
          await provider.upload(targetFolderPath, `${safeTitle}.md`, noteBytes, 'text/markdown');
          await cloudVaultSyncService.saveMasterVaultCatalog(provider).catch(() => {});
        } catch (cloudErr) {
          console.warn('Could not sync note to cloud provider:', cloudErr);
        }
      }
    })().catch(() => {});
  };

  // Automatic Debounced Auto-Save (500ms)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setIsSaved(false);
    const saveTimer = setTimeout(() => {
      handleSave();
    }, 500);
    return () => clearTimeout(saveTimer);
  }, [blocks, rawMarkdown, title, icon, cover, status]);

  // Flush save on component unmount
  useEffect(() => {
    return () => {
      handleSave();
    };
  }, []);

  const handleClose = async () => {
    try {
      await handleSave();
    } catch (err) {
      console.warn('Auto-save error on back:', err);
    }
    onClose();
  };

  // Block Mutations
  const handleUpdateBlock = (index: number, updated: NotionBlock) => {
    const nextBlocks = [...blocks];
    nextBlocks[index] = updated;
    setBlocks(nextBlocks);
    setIsSaved(false);
  };

  const handleEnterBlock = (index: number) => {
    const current = blocks[index];
    let newType: NotionBlockType = 'text';

    // Continue list types
    if (current.type === 'bullet') newType = 'bullet';
    else if (current.type === 'number') newType = 'number';
    else if (current.type === 'todo') newType = 'todo';

    const newBlock = NotionBlockEngine.createBlock(newType, '');
    const nextBlocks = [...blocks.slice(0, index + 1), newBlock, ...blocks.slice(index + 1)];
    setBlocks(nextBlocks);
    setFocusedIndex(index + 1);
  };

  const handleBackspaceBlock = (index: number) => {
    if (blocks.length <= 1) return;
    const nextBlocks = blocks.filter((_, i) => i !== index);
    setBlocks(nextBlocks);
    setFocusedIndex(Math.max(0, index - 1));
  };

  const handleDuplicateBlock = (index: number) => {
    const toDup = blocks[index];
    const cloned = { ...toDup, id: NotionBlockEngine.createId() };
    const nextBlocks = [...blocks.slice(0, index + 1), cloned, ...blocks.slice(index + 1)];
    setBlocks(nextBlocks);
    setFocusedIndex(index + 1);
  };

  const handleDeleteBlock = (index: number) => {
    if (blocks.length <= 1) {
      setBlocks([NotionBlockEngine.createBlock('text', '')]);
      return;
    }
    const nextBlocks = blocks.filter((_, i) => i !== index);
    setBlocks(nextBlocks);
    setFocusedIndex(Math.max(0, index - 1));
  };

  const handleMoveUpBlock = (index: number) => {
    if (index === 0) return;
    const nextBlocks = [...blocks];
    const [moved] = nextBlocks.splice(index, 1);
    nextBlocks.splice(index - 1, 0, moved);
    setBlocks(nextBlocks);
    setFocusedIndex(index - 1);
  };

  const handleMoveDownBlock = (index: number) => {
    if (index >= blocks.length - 1) return;
    const nextBlocks = [...blocks];
    const [moved] = nextBlocks.splice(index, 1);
    nextBlocks.splice(index + 1, 0, moved);
    setBlocks(nextBlocks);
    setFocusedIndex(index + 1);
  };

  // Open Slash Menu from a block
  const handleOpenSlashMenu = (index: number, rect: DOMRect) => {
    setActiveSlashBlockIndex(index);
    setSlashPos({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 320),
    });
    setSlashQuery('');
    setSlashOpen(true);
  };

  // Insert block from slash menu
  const handleSelectSlashItem = (item: SlashMenuItem) => {
    setSlashOpen(false);
    if (activeSlashBlockIndex === null) return;

    if (item.isAi) {
      handleExecuteAiAction(item.id);
      return;
    }

    let targetType: NotionBlockType = 'text';
    if (item.id === 'h1') targetType = 'h1';
    else if (item.id === 'h2') targetType = 'h2';
    else if (item.id === 'h3') targetType = 'h3';
    else if (item.id === 'todo') targetType = 'todo';
    else if (item.id === 'bullet') targetType = 'bullet';
    else if (item.id === 'number') targetType = 'number';
    else if (item.id === 'toggle') targetType = 'toggle';
    else if (item.id === 'callout_tip' || item.id === 'callout_warning' || item.id === 'callout_info' || item.id === 'callout_objective') targetType = 'callout';
    else if (item.id === 'code') targetType = 'code';
    else if (item.id === 'image') targetType = 'image';
    else if (item.id === 'file' || item.id === 'document') targetType = 'file';
    else if (item.id === 'bookmark' || item.id === 'url') targetType = 'bookmark';
    else if (item.id === 'latex') targetType = 'math';
    else if (item.id === 'quote') targetType = 'quote';
    else if (item.id === 'divider') targetType = 'divider';
    else if (item.id === 'table') targetType = 'table';

    const current = blocks[activeSlashBlockIndex];
    const cleanContent = current.content.replace(/\/$/, '').trim();

    const updated = NotionBlockEngine.createBlock(targetType, cleanContent);
    handleUpdateBlock(activeSlashBlockIndex, updated);
    setFocusedIndex(activeSlashBlockIndex);
  };

  // AI Assistant action executor
  const handleExecuteAiAction = async (actionType: string) => {
    setIsGeneratingAi(true);
    setAiNotice('Libris AI is generating content...');

    try {
      let newBlocks: NotionBlock[] = [];
      if (actionType === 'ai_summarize') {
        newBlocks = [
          NotionBlockEngine.createBlock('callout', `Summary: Core insights synthesized across note references and linked graph nodes.`, {
            icon: '💡',
            calloutType: 'tip',
          }),
        ];
      } else if (actionType === 'ai_continue') {
        newBlocks = [
          NotionBlockEngine.createBlock('h2', 'Conceptual Synthesis'),
          NotionBlockEngine.createBlock('text', 'Continuing analysis on universal storage structures and cross-platform document replication pipelines.'),
        ];
      } else if (actionType === 'ai_action_items') {
        newBlocks = [
          NotionBlockEngine.createBlock('h3', 'Action Items'),
          NotionBlockEngine.createBlock('todo', 'Review literature citations in Library', { checked: false }),
          NotionBlockEngine.createBlock('todo', 'Cross-link graph nodes with [[Universal Storage Architecture]]', { checked: false }),
        ];
      }

      const nextBlocks = [...blocks, ...newBlocks];
      setBlocks(nextBlocks);
      setAiNotice('AI blocks inserted successfully.');
      setTimeout(() => setAiNotice(null), 3000);
    } catch {
      setAiNotice('Failed to generate AI content.');
      setTimeout(() => setAiNotice(null), 3000);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Add Tag
  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const cleanTag = newTagInput.trim().replace(/^#/, '');
    if (!parsed.tags.includes(cleanTag)) {
      const tagBlock = NotionBlockEngine.createBlock('text', `#${cleanTag}`);
      setBlocks([...blocks, tagBlock]);
    }
    setNewTagInput('');
    setShowTagInput(false);
  };

  return (
    <div
      ref={editorContainerRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top Navigation & Action Header */}
      <header className="markdown-editor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
          <button className="btn-icon btn-sm" onClick={handleClose} title="Back to Notes Vault">
            <ArrowLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: '1.15rem' }}>{icon}</span>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-sm)', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                {title || 'Untitled Note'}
              </div>
              <div style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', color: isSaved ? 'var(--text-muted)' : '#f59e0b' }}>
                {isSaved ? 'SAVED // SYNCED' : 'UNSAVED •'}
              </div>
            </div>
          </div>
        </div>

        {/* Center Mode Controls: Live Block Workspace vs Raw Markdown Source */}
        <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 2, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-medium)' }}>
          <button
            className={`btn btn-sm ${editorMode === 'live' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.72rem', padding: '3px 8px', height: 26, gap: 4 }}
            onClick={() => setEditorMode('live')}
            title="Live Interactive Block Workspace"
          >
            <Zap size={12} />
            <span>Blocks</span>
          </button>
          <button
            className={`btn btn-sm ${editorMode === 'source' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.72rem', padding: '3px 8px', height: 26, gap: 4 }}
            onClick={() => {
              setRawMarkdown(NotionBlockEngine.blocksToMarkdown(blocks));
              setEditorMode('source');
            }}
            title="Raw Markdown Source Editor"
          >
            <Code size={12} />
            <span>Source</span>
          </button>
        </div>

        {/* Right Action Tools */}
        <div className="markdown-editor-tools">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCoverPicker(!showCoverPicker)}
            title="Change Cover Banner"
          >
            <ImageIcon size={13} />
            <span className="hide-on-mobile-xs">Cover</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowIconPicker(!showIconPicker)}
            title="Change Icon"
          >
            <Smile size={13} />
            <span className="hide-on-mobile-xs">Icon</span>
          </button>

          <button
            className="btn-icon btn-sm"
            onClick={() => setIsZenMode(!isZenMode)}
            title={isZenMode ? 'Exit Fullscreen' : 'Fullscreen Focus'}
          >
            {isZenMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            className="btn-icon btn-sm"
            onClick={() => setShowInspector(!showInspector)}
            title={showInspector ? 'Hide Knowledge Links' : 'Show Knowledge Links'}
          >
            <Layers size={14} />
          </button>

          {onOpenLibris && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onOpenLibris(rawMarkdown)}
              title="Ask Libris AI"
            >
              <Sparkles size={13} color="#8b5cf6" />
              <span className="hide-on-mobile-xs">Ask Libris</span>
            </button>
          )}

          <button className="btn btn-primary btn-sm" onClick={() => handleSave()} title="Save Note">
            <Save size={13} />
            <span>Save</span>
          </button>
        </div>
      </header>

      {/* AI Notification Banner */}
      {aiNotice && (
        <div
          style={{
            padding: '6px 16px',
            background: 'var(--primary-glow)',
            borderBottom: '1px solid var(--border-medium)',
            fontSize: 'var(--text-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-primary)',
          }}
        >
          <Sparkles size={13} color="#8b5cf6" className={isGeneratingAi ? 'animate-spin' : ''} />
          <span>{aiNotice}</span>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div style={{ flex: 1, display: 'flex', height: 'calc(100% - 48px)', overflow: 'hidden' }}>
        {/* Main Document Workspace */}
        <main
          style={{
            flex: 1,
            height: '100%',
            overflowY: 'auto',
            background: 'var(--bg-app)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Cover Banner */}
          {cover && (
            <div
              style={{
                height: isZenMode ? 80 : 140,
                width: '100%',
                background: cover,
                position: 'relative',
                flexShrink: 0,
                transition: 'height 0.2s ease',
              }}
            >
              <button
                className="btn-icon btn-sm"
                onClick={() => setCover('')}
                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                title="Remove Cover"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Centered Document Page Canvas */}
          <div
            style={{
              maxWidth: 780,
              width: '100%',
              margin: '0 auto',
              padding: isZenMode ? 'clamp(10px, 3vw, 18px)' : 'clamp(12px, 3.5vw, 28px)',
              paddingBottom: 'calc(64px + var(--sab))',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              boxSizing: 'border-box',
            }}
          >
            {/* Compact Page Header: Emoji + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div
                style={{
                  fontSize: '1.4rem',
                  lineHeight: 1,
                  cursor: 'pointer',
                  userSelect: 'none',
                  flexShrink: 0,
                }}
                onClick={() => setShowIconPicker(true)}
                title="Click to change icon"
              >
                {icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={() => handleSave(undefined, title)}
                  placeholder="Untitled"
                  style={{
                    width: '100%',
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.15rem, 4vw, 1.45rem)',
                    fontWeight: 700,
                    letterSpacing: '0.01em',
                    color: 'var(--text-primary)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                    margin: 0,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Sleek Compact Inline Metadata Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: 'var(--space-3)',
                paddingBottom: 8,
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: '0.7rem',
              }}
            >
              {/* Status Property */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  style={{
                    padding: '2px 7px',
                    height: 22,
                    fontSize: '0.68rem',
                    background: status === 'Completed' ? 'rgba(16, 185, 129, 0.15)' : status === 'In Progress' ? 'rgba(234, 179, 8, 0.15)' : 'var(--bg-input)',
                    color: status === 'Completed' ? '#10b981' : status === 'In Progress' ? '#eab308' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    gap: 3,
                  }}
                >
                  <span>{status}</span>
                  <ChevronDown size={10} />
                </button>

                {showStatusDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 4,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-xs)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      zIndex: 100,
                      padding: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    {STATUS_PRESETS.map(s => (
                      <button
                        key={s}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ textAlign: 'left', fontSize: '0.7rem' }}
                        onClick={() => {
                          setStatus(s);
                          setShowStatusDropdown(false);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags Property */}
              {parsed.tags.map(t => (
                <span key={t} className="badge" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                  #{t}
                </span>
              ))}

              {showTagInput ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <input
                    type="text"
                    placeholder="tag..."
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    style={{
                      width: 70,
                      height: 20,
                      fontSize: '0.65rem',
                      padding: '0 4px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--radius-xs)',
                    }}
                    autoFocus
                  />
                  <button className="btn-icon btn-sm" onClick={handleAddTag} style={{ width: 20, height: 20 }}>
                    <Check size={10} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '0 5px', height: 20, fontSize: '0.65rem', gap: 2 }}
                  onClick={() => setShowTagInput(true)}
                >
                  <Plus size={10} />
                  <span>Tag</span>
                </button>
              )}

              {/* Reading Stats */}
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-tech)', fontSize: '0.65rem', marginLeft: 'auto' }}>
                {wordsCount}w • ~{readingTimeMin}m
              </span>
            </div>

            {/* LIVE BLOCK CANVAS MODE */}
            {editorMode === 'live' ? (
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 300 }}>
                {blocks.map((block, idx) => (
                  <LiveBlockItem
                    key={block.id}
                    block={block}
                    index={idx}
                    isFocused={focusedIndex === idx}
                    onUpdate={updated => handleUpdateBlock(idx, updated)}
                    onEnter={handleEnterBlock}
                    onBackspace={handleBackspaceBlock}
                    onFocusNext={i => setFocusedIndex(Math.min(blocks.length - 1, i + 1))}
                    onFocusPrev={i => setFocusedIndex(Math.max(0, i - 1))}
                    onOpenSlashMenu={handleOpenSlashMenu}
                    onDuplicate={handleDuplicateBlock}
                    onDelete={handleDeleteBlock}
                    onMoveUp={handleMoveUpBlock}
                    onMoveDown={handleMoveDownBlock}
                    onNavigateWikilink={onNavigateNote}
                  />
                ))}

                {/* Add Block at Bottom */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 4px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    opacity: 0.6,
                    transition: 'opacity 0.15s ease',
                  }}
                  onClick={() => {
                    const newBlock = NotionBlockEngine.createBlock('text', '');
                    setBlocks([...blocks, newBlock]);
                    setFocusedIndex(blocks.length);
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.6')}
                >
                  <Plus size={13} />
                  <span>Click to add a block, or type /</span>
                </div>
              </div>
            ) : (
              /* RAW MARKDOWN SOURCE MODE */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <textarea
                  value={rawMarkdown}
                  onChange={e => {
                    const val = e.target.value;
                    setRawMarkdown(val);
                    setBlocks(NotionBlockEngine.markdownToBlocks(val));
                  }}
                  placeholder="# Enter Markdown content..."
                  style={{
                    width: '100%',
                    minHeight: 450,
                    padding: 'var(--space-4)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.92rem',
                    lineHeight: 1.7,
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>
        </main>

        {/* Backlinks & Knowledge Inspector Sidebar (Desktop Docked or Mobile Drawer) */}
        {showInspector && !isZenMode && (
          <>
            <div
              className="mobile-drawer-backdrop"
              onClick={() => setShowInspector(false)}
            />
            <aside
              style={{
                width: 270,
                maxWidth: '85vw',
                background: 'var(--bg-surface-elevated)',
                borderLeft: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                flexShrink: 0,
                zIndex: 90,
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  fontFamily: 'var(--font-tech)',
                  fontWeight: 600,
                  fontSize: 'var(--text-2xs)',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>KNOWLEDGE LINKS</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="badge">{parsed.wikilinks.length + backlinksList.length}</span>
                  <button
                    className="btn-icon btn-sm"
                    onClick={() => setShowInspector(false)}
                    style={{ width: 22, height: 22 }}
                    title="Close"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Outgoing Wikilinks */}
                <div>
                  <div className="form-label" style={{ marginBottom: 6 }}>
                    OUTGOING LINKS ({parsed.wikilinks.length})
                  </div>
                  {parsed.wikilinks.length === 0 ? (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>No outgoing [[links]]</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {parsed.wikilinks.map(link => (
                        <div
                          key={link}
                          onClick={() => {
                            setShowInspector(false);
                            onNavigateNote && onNavigateNote(link);
                          }}
                          style={{
                            padding: '5px 8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: 'var(--text-xs)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            color: 'var(--text-primary)',
                          }}
                          className="card-interactive"
                        >
                          <ExternalLink size={11} style={{ opacity: 0.6 }} />
                          <span style={{ fontWeight: 600 }}>[[{link}]]</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Backlinks */}
                <div>
                  <div className="form-label" style={{ marginBottom: 6 }}>
                    BACKLINKS ({backlinksList.length})
                  </div>
                  {backlinksList.length === 0 ? (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>No backlinks referencing this note</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {backlinksList.map(b => (
                        <div
                          key={b.id}
                          onClick={() => {
                            setShowInspector(false);
                            onNavigateNote && onNavigateNote(b.id);
                          }}
                          style={{
                            padding: '6px 8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: 'var(--text-xs)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                          }}
                          className="card-interactive"
                        >
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.title}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'var(--font-tech)' }}>
                            mentions [[{note.title}]]
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <div className="form-label" style={{ marginBottom: 6 }}>
                    TAGS ({parsed.tags.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {parsed.tags.map(tag => (
                      <span key={tag} className="badge">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Mobile Bottom Dock Toolbar for Android / iOS */}
      <div className="notion-mobile-dock">
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            const newBlock = NotionBlockEngine.createBlock('text', '');
            const targetIdx = focusedIndex !== null ? focusedIndex + 1 : blocks.length;
            const newBlocks = [...blocks];
            newBlocks.splice(targetIdx, 0, newBlock);
            setBlocks(newBlocks);
            setFocusedIndex(targetIdx);
          }}
          title="Add Block"
          style={{ padding: '0 8px', height: 32, fontSize: '0.72rem', gap: 4 }}
        >
          <Plus size={14} />
          <span>Block</span>
        </button>

        <div style={{ width: 1, height: 18, background: 'var(--border-strong)', margin: '0 2px' }} />

        <button
          type="button"
          className="btn-icon btn-sm btn-ghost"
          onClick={() => {
            if (focusedIndex !== null && blocks[focusedIndex]) {
              handleUpdateBlock(focusedIndex, { ...blocks[focusedIndex], type: 'h1' });
            }
          }}
          title="Heading 1"
          style={{ width: 30, height: 30 }}
        >
          <span style={{ fontWeight: 800, fontSize: '0.75rem' }}>H1</span>
        </button>

        <button
          type="button"
          className="btn-icon btn-sm btn-ghost"
          onClick={() => {
            if (focusedIndex !== null && blocks[focusedIndex]) {
              handleUpdateBlock(focusedIndex, { ...blocks[focusedIndex], type: 'h2' });
            }
          }}
          title="Heading 2"
          style={{ width: 30, height: 30 }}
        >
          <span style={{ fontWeight: 700, fontSize: '0.72rem' }}>H2</span>
        </button>

        <button
          type="button"
          className="btn-icon btn-sm btn-ghost"
          onClick={() => {
            if (focusedIndex !== null && blocks[focusedIndex]) {
              handleUpdateBlock(focusedIndex, { ...blocks[focusedIndex], type: 'bullet' });
            }
          }}
          title="Bullet List"
          style={{ width: 30, height: 30 }}
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>•</span>
        </button>

        <button
          type="button"
          className="btn-icon btn-sm btn-ghost"
          onClick={() => {
            if (focusedIndex !== null && blocks[focusedIndex]) {
              handleUpdateBlock(focusedIndex, {
                ...blocks[focusedIndex],
                type: 'todo',
                properties: { checked: false },
              });
            }
          }}
          title="Todo Task"
          style={{ width: 30, height: 30 }}
        >
          <Check size={14} />
        </button>

        <button
          type="button"
          className="btn-icon btn-sm btn-ghost"
          onClick={() => {
            if (focusedIndex !== null && blocks[focusedIndex]) {
              handleUpdateBlock(focusedIndex, {
                ...blocks[focusedIndex],
                type: 'callout',
                properties: { icon: '💡', calloutType: 'tip' },
              });
            }
          }}
          title="Callout Box"
          style={{ width: 30, height: 30 }}
        >
          <span style={{ fontSize: '0.85rem' }}>💡</span>
        </button>

        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            const activeIdx = focusedIndex !== null ? focusedIndex : 0;
            handleOpenSlashMenu(activeIdx, { top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 140 } as any);
          }}
          title="Open Slash Commands Menu"
          style={{ padding: '0 8px', height: 32, fontSize: '0.72rem', gap: 4 }}
        >
          <Zap size={13} color="#ec4899" />
          <span>/</span>
        </button>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => handleSave()}
          title="Save Note"
          style={{ padding: '0 10px', height: 30, fontSize: '0.72rem', gap: 4 }}
        >
          <Save size={13} />
          <span>Save</span>
        </button>
      </div>

      {/* Floating Slash Command Menu */}
      <SlashMenu
        isOpen={slashOpen}
        query={slashQuery}
        position={slashPos}
        onSelect={handleSelectSlashItem}
        onClose={() => setSlashOpen(false)}
      />

      {/* Cover Banner Preset Modal */}
      {showCoverPicker && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(300px, 90vw)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            zIndex: 1000,
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>Choose Cover Banner</span>
            <button className="btn-icon btn-sm" onClick={() => setShowCoverPicker(false)}>
              <X size={12} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {COVER_PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setCover(p.value);
                  setShowCoverPicker(false);
                }}
                style={{
                  height: 48,
                  borderRadius: 'var(--radius-xs)',
                  background: p.value || 'var(--bg-surface)',
                  border: cover === p.value ? '2px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: p.value ? '#ffffff' : 'var(--text-secondary)',
                  textShadow: p.value ? '0 1px 2px rgba(0,0,0,0.8)' : 'none',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Icon Picker Modal */}
      {showIconPicker && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(280px, 90vw)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            zIndex: 1000,
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>Choose Page Icon</span>
            <button className="btn-icon btn-sm" onClick={() => setShowIconPicker(false)}>
              <X size={12} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {EMOJI_PRESETS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setIcon(e);
                  setShowIconPicker(false);
                }}
                style={{
                  fontSize: '1.4rem',
                  height: 38,
                  background: icon === e ? 'var(--bg-hover)' : 'transparent',
                  border: icon === e ? '1px solid var(--text-primary)' : 'none',
                  borderRadius: 'var(--radius-xs)',
                  cursor: 'pointer',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
