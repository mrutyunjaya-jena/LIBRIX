import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Calendar,
  Search,
  Tag as TagIcon,
  Link,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Note } from '../../core/types';
import { db } from '../../core/db/DatabaseEngine';

interface NotesListViewProps {
  notes: Note[];
  onOpenNote: (note: Note) => void;
  onCreateNote: () => void;
  onCreateDailyNote: () => void;
  onDeleteNote: (noteId: string) => void;
  onOpenLibris: () => void;
}

export const NotesListView: React.FC<NotesListViewProps> = ({
  notes,
  onOpenNote,
  onCreateNote,
  onCreateDailyNote,
  onDeleteNote,
  onOpenLibris,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Extract all unique tags
  const allTags = Array.from(new Set(notes.flatMap(n => n.tags)));

  let filtered = notes;
  if (selectedTag) {
    filtered = filtered.filter(n => n.tags.includes(selectedTag));
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          background: 'var(--bg-app)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
              Notes & Knowledge Vault
            </h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Obsidian-compatible Markdown files with live [[Wikilinks]], #tags, and bidirectional backlinks
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary" onClick={onCreateDailyNote}>
              <Calendar size={15} />
              <span>Daily Note</span>
            </button>

            <button className="btn btn-primary" onClick={onCreateNote}>
              <Plus size={16} />
              <span>New Note</span>
            </button>
          </div>
        </div>

        {/* Filter & Tags Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="input-with-icon" style={{ width: 260 }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Search notes content..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: 'var(--text-xs)' }}
            />
          </div>

          {/* Tag Pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              className={`badge ${selectedTag === null ? 'badge-brand' : 'badge-cloud'}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedTag(null)}
            >
              All Tags
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                className={`badge ${selectedTag === tag ? 'badge-brand' : 'badge-cloud'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          {filtered.map(note => (
            <div
              key={note.id}
              className="card card-interactive"
              onClick={() => onOpenNote(note)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 180,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                  <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {note.title}
                  </h3>
                  <button
                    className="btn-icon btn-sm"
                    onClick={e => {
                      e.stopPropagation();
                      onDeleteNote(note.id);
                    }}
                    title="Delete Note"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    marginBottom: 12,
                  }}
                >
                  {note.content.replace(/^#+\s+/gm, '').replace(/\[\[(.*?)\]\]/g, '$1')}
                </p>
              </div>

              <div>
                {/* Tags */}
                {note.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {note.tags.map(t => (
                      <span key={t} className="badge badge-brand" style={{ fontSize: '0.65rem' }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer Metadata */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Link size={11} />
                    <span>{note.wikilinks.length} links • {note.backlinks.length} backlinks</span>
                  </div>
                  <span>{new Date(note.modifiedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
