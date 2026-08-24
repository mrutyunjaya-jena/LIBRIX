import React, { useState, useEffect } from 'react';
import {
  Save,
  Eye,
  Edit3,
  Columns,
  Link,
  Tag as TagIcon,
  Sparkles,
  ArrowLeft,
  Calendar,
  ExternalLink,
  FileText,
  Trash2,
  Check,
  Code,
  List,
  Heading,
} from 'lucide-react';
import { Note } from '../core/types';
import { db } from '../core/db/DatabaseEngine';
import { parseNoteContent } from './WikilinkParser';

interface MarkdownEditorProps {
  note: Note;
  onClose: () => void;
  onSave: (updatedNote: Note) => void;
  onNavigateNote?: (noteIdOrTitle: string) => void;
  onOpenLibris?: (contextText?: string) => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  note,
  onClose,
  onSave,
  onNavigateNote,
  onOpenLibris,
}) => {
  const [content, setContent] = useState(note.content);
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [parsed, setParsed] = useState(parseNoteContent(note.content));
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [backlinksList, setBacklinksList] = useState<Note[]>([]);
  const [showInspector, setShowInspector] = useState(true);
  const [isSaved, setIsSaved] = useState(true);

  useEffect(() => {
    const updated = parseNoteContent(content);
    setParsed(updated);
    setIsSaved(false);
  }, [content]);

  useEffect(() => {
    const loadNotes = async () => {
      const notes = await db.getNotes();
      setAllNotes(notes);
      // Compute backlinks
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

  const handleSave = async () => {
    const updated: Note = {
      ...note,
      title: parsed.title || note.title,
      content,
      frontmatter: parsed.frontmatter,
      tags: parsed.tags,
      wikilinks: parsed.wikilinks,
      modifiedAt: Date.now(),
    };
    await db.saveNote(updated);
    onSave(updated);
    setIsSaved(true);
  };

  const insertFormatting = (prefix: string, suffix = '') => {
    const textarea = document.getElementById('note-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 10);
  };

  const insertWikilink = () => {
    insertFormatting('[[', ']]');
  };

  const insertTag = () => {
    insertFormatting('#', '');
  };

  const insertHeading = () => {
    insertFormatting('## ', '');
  };

  const insertCodeBlock = () => {
    insertFormatting('```\n', '\n```');
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Editor Header Toolbar */}
      <header
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-4)',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button className="btn-icon btn-sm" onClick={onClose} title="Back to Notes Vault">
            <ArrowLeft size={16} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-sm)', letterSpacing: '0.03em' }}>
              {parsed.title || 'Untitled Note'}
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
              {isSaved ? 'SAVED // SYNCED' : 'UNSAVED CHANGES •'}
            </div>
          </div>
        </div>

        {/* Center View Controls (Edit / Split / Preview) */}
        <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 2, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-medium)' }}>
          <button
            className={`btn-icon btn-sm ${viewMode === 'edit' ? 'active' : ''}`}
            onClick={() => setViewMode('edit')}
            title="Edit Mode"
          >
            <Edit3 size={13} />
          </button>
          <button
            className={`btn-icon btn-sm ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
            title="Split Mode"
          >
            <Columns size={13} />
          </button>
          <button
            className={`btn-icon btn-sm ${viewMode === 'preview' ? 'active' : ''}`}
            onClick={() => setViewMode('preview')}
            title="Live Preview"
          >
            <Eye size={13} />
          </button>
        </div>

        {/* Right Formatting & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <button className="btn btn-secondary btn-sm" onClick={insertHeading} title="Heading 2">
            <Heading size={13} />
          </button>

          <button className="btn btn-secondary btn-sm" onClick={insertWikilink} title="Insert [[Wikilink]]">
            <Link size={13} />
            <span>[[Link]]</span>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={insertTag} title="Insert #tag">
            <TagIcon size={13} />
            <span>#Tag</span>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={insertCodeBlock} title="Code Block">
            <Code size={13} />
          </button>

          {onOpenLibris && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onOpenLibris(content)}
              title="Ask Libris AI about this Note"
            >
              <Sparkles size={13} />
              <span>Ask Libris</span>
            </button>
          )}

          <button className="btn btn-primary btn-sm" onClick={handleSave} title="Save Note">
            <Save size={13} />
            <span>Save</span>
          </button>
        </div>
      </header>

      {/* Editor Body */}
      <div style={{ flex: 1, display: 'flex', height: 'calc(100% - 48px)', overflow: 'hidden' }}>
        {/* Main Work Area (Edit + Preview) */}
        <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
          {/* Edit Pane */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                borderRight: viewMode === 'split' ? '1px solid var(--border-subtle)' : 'none',
                background: 'var(--bg-surface)',
                height: '100%',
                overflow: 'hidden',
              }}
            >
              <textarea
                id="note-textarea"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="# Write in Markdown...\n\nUse [[Note Title]] for links and #tags for categories."
                style={{
                  flex: 1,
                  width: '100%',
                  height: '100%',
                  padding: 'var(--space-6)',
                  background: 'transparent',
                  border: 'none',
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

          {/* Preview Pane */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div
              className="selectable"
              style={{
                flex: 1,
                background: 'var(--bg-app)',
                overflowY: 'auto',
                padding: 'var(--space-6)',
                height: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div className="reader-content-frame" style={{ maxWidth: 720, margin: '0 auto' }}>
                {/* Properties Header Box */}
                {Object.keys(parsed.frontmatter).length > 0 && (
                  <div
                    className="card scifi-box"
                    style={{
                      marginBottom: 'var(--space-5)',
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--bg-surface-elevated)',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.05em' }}>
                      PROPERTIES & METADATA
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-tech)' }}>
                      {Object.entries(parsed.frontmatter).map(([k, v]) => (
                        <React.Fragment key={k}>
                          <span style={{ color: 'var(--text-muted)' }}>{k}:</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {Array.isArray(v) ? v.join(', ') : String(v)}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rendered Preview */}
                {renderMarkdownContent(parsed.body, onNavigateNote)}
              </div>
            </div>
          )}
        </div>

        {/* Backlinks & Knowledge Inspector Sidebar */}
        {showInspector && (
          <aside
            style={{
              width: 260,
              background: 'var(--bg-surface-elevated)',
              borderLeft: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden',
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
              }}
            >
              KNOWLEDGE LINKS
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
                        onClick={() => onNavigateNote && onNavigateNote(link)}
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

              {/* Backlinks (Incoming References) */}
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
                        onClick={() => onNavigateNote && onNavigateNote(b.id)}
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
        )}
      </div>
    </div>
  );
};

function renderMarkdownContent(content: string, onNavigate?: (title: string) => void) {
  const lines = content.split('\n');
  return lines.map((line, idx) => {
    if (line.startsWith('# ')) {
      return (
        <h1 key={idx} style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, margin: '20px 0 12px', color: 'var(--text-primary)' }}>
          {line.replace('# ', '')}
        </h1>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h2 key={idx} style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700, margin: '16px 0 8px', color: 'var(--text-primary)' }}>
          {line.replace('## ', '')}
        </h2>
      );
    }
    if (line.startsWith('### ')) {
      return (
        <h3 key={idx} style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600, margin: '12px 0 6px', color: 'var(--text-primary)' }}>
          {line.replace('### ', '')}
        </h3>
      );
    }
    if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      const checked = line.startsWith('- [x] ');
      const text = line.replace(/- \[[ x]\] /, '');
      return (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0', fontSize: '0.95rem' }}>
          <input type="checkbox" checked={checked} readOnly />
          <span style={{ textDecoration: checked ? 'line-through' : 'none', color: checked ? 'var(--text-muted)' : 'inherit' }}>
            {text}
          </span>
        </div>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={idx} style={{ marginLeft: 20, marginBottom: 4, fontSize: '0.95rem', lineHeight: 1.6 }}>
          {parseInlineLinks(line.substring(2), onNavigate)}
        </li>
      );
    }
    if (line.startsWith('> ')) {
      return (
        <blockquote key={idx} style={{ borderLeft: '3px solid var(--text-primary)', paddingLeft: 12, margin: '12px 0', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
          {line.replace('> ', '')}
        </blockquote>
      );
    }
    if (!line.trim()) {
      return <div key={idx} style={{ height: 10 }} />;
    }
    return (
      <p key={idx} style={{ marginBottom: 12, lineHeight: 1.7, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
        {parseInlineLinks(line, onNavigate)}
      </p>
    );
  });
}

function parseInlineLinks(text: string, onNavigate?: (title: string) => void) {
  const parts = text.split(/(\[\[.*?\]\]|#\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const target = part.slice(2, -2);
      return (
        <span
          key={i}
          onClick={() => onNavigate && onNavigate(target)}
          style={{
            color: 'var(--text-primary)',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            padding: '1px 5px',
            borderRadius: 'var(--radius-xs)',
            cursor: 'pointer',
            fontWeight: 600,
            fontFamily: 'var(--font-tech)',
            fontSize: '0.85em',
            margin: '0 2px',
          }}
          title={`Jump to [[${target}]]`}
        >
          [[{target}]]
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
}
