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
  Clock,
  ExternalLink,
  FileText,
  Trash2,
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
  const [parsed, setParsed] = useState(parseNoteContent(note.content, note.title));
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [backlinksList, setBacklinksList] = useState<Note[]>([]);
  const [showInspector, setShowInspector] = useState(true);

  useEffect(() => {
    const updated = parseNoteContent(content, note.title);
    setParsed(updated);
  }, [content, note.title]);

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
      title: parsed.title,
      content,
      frontmatter: parsed.frontmatter,
      tags: parsed.tags,
      wikilinks: parsed.wikilinks,
      modifiedAt: Date.now(),
    };
    await db.saveNote(updated);
    onSave(updated);
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
  };

  const insertWikilink = () => {
    insertFormatting('[[', ']]');
  };

  const insertTag = () => {
    insertFormatting('#', '');
  };

  return (
    <div className="reader-container theme-dark">
      {/* Editor Header */}
      <header className="reader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button className="btn-icon" onClick={onClose} title="Back to Notes">
            <ArrowLeft size={18} />
          </button>
          <div className="reader-title-area">
            <div className="reader-doc-title">{parsed.title || 'Untitled Note'}</div>
            <div className="reader-chapter-title">
              {parsed.tags.map(t => `#${t}`).join(' ') || 'Markdown Vault'}
            </div>
          </div>
        </div>

        {/* Center Mode Controls */}
        <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 2, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <button
            className={`btn btn-sm ${viewMode === 'edit' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('edit')}
            title="Edit Mode"
          >
            <Edit3 size={14} />
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'split' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('split')}
            title="Split Mode"
          >
            <Columns size={14} />
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('preview')}
            title="Live Preview"
          >
            <Eye size={14} />
          </button>
        </div>

        {/* Right Actions */}
        <div className="reader-actions">
          <button className="btn btn-sm btn-ghost" onClick={insertWikilink} title="Insert [[Wikilink]]">
            <Link size={14} />
            [[Link]]
          </button>

          <button className="btn btn-sm btn-ghost" onClick={insertTag} title="Insert #tag">
            <TagIcon size={14} />
            #Tag
          </button>

          {onOpenLibris && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => onOpenLibris(content)}
              title="Ask Libris about Note"
            >
              <Sparkles size={14} />
              Libris AI
            </button>
          )}

          <button className="btn btn-sm btn-primary" onClick={handleSave} title="Save Note">
            <Save size={14} />
            Save
          </button>
        </div>
      </header>

      {/* Editor Body */}
      <div className="reader-viewport">
        {/* Editor Main Canvas */}
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
              }}
            >
              <textarea
                id="note-textarea"
                className="note-editor"
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
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  resize: 'none',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Preview Pane */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div
              className="reader-stage selectable"
              style={{
                flex: 1,
                background: 'var(--bg-app)',
                overflowY: 'auto',
                padding: 'var(--space-6)',
              }}
            >
              <div className="reader-content-frame" style={{ maxWidth: 720, margin: '0 auto' }}>
                {/* Properties Header Box */}
                {Object.keys(parsed.frontmatter).length > 0 && (
                  <div
                    className="card"
                    style={{
                      marginBottom: 'var(--space-5)',
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      PROPERTIES
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 'var(--text-sm)' }}>
                      {Object.entries(parsed.frontmatter).map(([k, v]) => (
                        <React.Fragment key={k}>
                          <span style={{ color: 'var(--text-secondary)' }}>{k}:</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {Array.isArray(v) ? v.join(', ') : String(v)}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rendered Preview */}
                {renderMarkdownContent(parsed.cleanContent, onNavigateNote)}
              </div>
            </div>
          )}
        </div>

        {/* Backlinks & Inspector Drawer */}
        {showInspector && (
          <aside className="reader-sidebar" style={{ width: 280 }}>
            <div className="reader-sidebar-header">
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Knowledge Links</span>
            </div>
            <div className="reader-sidebar-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Outgoing Wikilinks */}
              <div>
                <div className="form-label" style={{ marginBottom: 6 }}>
                  OUTGOING LINKS ({parsed.wikilinks.length})
                </div>
                {parsed.wikilinks.length === 0 ? (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>No outgoing [[links]]</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {parsed.wikilinks.map(link => (
                      <div
                        key={link}
                        onClick={() => onNavigateNote && onNavigateNote(link)}
                        style={{
                          padding: '6px 10px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--text-xs)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          color: 'var(--brand-400)',
                        }}
                      >
                        <ExternalLink size={12} />
                        [[{link}]]
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
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>No backlinks yet</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {backlinksList.map(b => (
                      <div
                        key={b.id}
                        onClick={() => onNavigateNote && onNavigateNote(b.id)}
                        style={{
                          padding: '8px 10px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--text-xs)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.title}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          Mentions [[{note.title}]]
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
                    <span key={tag} className="badge badge-brand">
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
      return <h1 key={idx} style={{ fontSize: '1.8rem', fontWeight: 800, margin: '20px 0 12px' }}>{line.replace('# ', '')}</h1>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={idx} style={{ fontSize: '1.4rem', fontWeight: 700, margin: '16px 0 8px' }}>{line.replace('## ', '')}</h2>;
    }
    if (line.startsWith('### ')) {
      return <h3 key={idx} style={{ fontSize: '1.15rem', fontWeight: 600, margin: '12px 0 6px' }}>{line.replace('### ', '')}</h3>;
    }
    if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      const checked = line.startsWith('- [x] ');
      const text = line.replace(/- \[[ x]\] /, '');
      return (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
          <input type="checkbox" checked={checked} readOnly />
          <span style={{ textDecoration: checked ? 'line-through' : 'none', color: checked ? 'var(--text-muted)' : 'inherit' }}>
            {text}
          </span>
        </div>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={idx} style={{ marginLeft: 20, marginBottom: 4 }}>
          {parseInlineLinks(line.substring(2), onNavigate)}
        </li>
      );
    }
    if (line.startsWith('> ')) {
      return (
        <blockquote key={idx} style={{ borderLeft: '3px solid var(--brand-500)', paddingLeft: 12, margin: '12px 0', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
          {line.replace('> ', '')}
        </blockquote>
      );
    }
    if (!line.trim()) {
      return <div key={idx} style={{ height: 10 }} />;
    }
    return (
      <p key={idx} style={{ marginBottom: 12, lineHeight: 1.7, color: 'var(--text-primary)' }}>
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
            color: 'var(--brand-400)',
            background: 'rgba(99, 102, 241, 0.15)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            cursor: 'pointer',
            fontWeight: 500,
            borderBottom: '1px dashed var(--brand-500)',
          }}
        >
          [[{target}]]
        </span>
      );
    }
    if (part.startsWith('#') && part.length > 1) {
      return (
        <span key={i} className="badge badge-brand" style={{ margin: '0 2px' }}>
          {part}
        </span>
      );
    }
    return part;
  });
}
