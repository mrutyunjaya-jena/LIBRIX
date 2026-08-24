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
  Edit2,
  Clock,
} from 'lucide-react';
import { Note } from '../../core/types';
import { db } from '../../core/db/DatabaseEngine';
import { MarkdownEditor } from '../../notes/MarkdownEditor';

interface NotesListViewProps {
  notes: Note[];
  onOpenNote?: (note: Note) => void;
  onNotesUpdated: () => void;
}

export const NotesListView: React.FC<NotesListViewProps> = ({
  notes,
  onNotesUpdated,
}) => {
  const [activeNote, setActiveNote] = useState<Note | null>(null);
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

  const handleCreateNewNote = async () => {
    const newNote: Note = {
      id: `note_${Date.now()}`,
      title: 'Untitled Note',
      slug: 'untitled-note',
      content: `# Untitled Note\n\nWrite your thoughts here. Connect to other ideas with [[Wikilinks]] and #tags.\n\n#Research`,
      frontmatter: { title: 'Untitled Note', created: new Date().toISOString().slice(0, 10) },
      tags: ['Research'],
      wikilinks: [],
      backlinks: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveNote(newNote);
    onNotesUpdated();
    setActiveNote(newNote);
  };

  const handleCreateDailyNote = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const existing = notes.find(n => n.title === `Daily Note: ${today}`);
    if (existing) {
      setActiveNote(existing);
      return;
    }

    const dailyNote: Note = {
      id: `daily_${Date.now()}`,
      title: `Daily Note: ${today}`,
      slug: `daily-note-${today}`,
      content: `# Daily Note: ${today}\n\n## Objectives\n- [ ] Review systems literature\n- [ ] Cross-link ideas with [[Universal Storage Architecture]]\n\n## Notes & Thoughts\n\n#DailyJournal`,
      frontmatter: { title: `Daily Note: ${today}`, date: today, tags: ['DailyJournal'] },
      tags: ['DailyJournal'],
      wikilinks: ['Universal Storage Architecture'],
      backlinks: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveNote(dailyNote);
    onNotesUpdated();
    setActiveNote(dailyNote);
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this note permanently?')) {
      await db.deleteNote(id);
      if (activeNote?.id === id) setActiveNote(null);
      onNotesUpdated();
    }
  };

  // If a note is currently open in editor, render full-height MarkdownEditor directly without double header
  if (activeNote) {
    return (
      <MarkdownEditor
        note={activeNote}
        onSave={async updated => {
          await db.saveNote(updated);
          onNotesUpdated();
          setActiveNote(updated);
        }}
        onClose={() => setActiveNote(null)}
        onNavigateNote={target => {
          const match = notes.find(
            n => n.title.toLowerCase() === target.toLowerCase() || n.id === target
          );
          if (match) setActiveNote(match);
        }}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-5)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          background: 'var(--bg-app)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '0.04em' }}>
              NOTES VAULT
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Markdown knowledge vault with live [[Wikilinks]], #tags, and bidirectional backlinks.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleCreateDailyNote}>
              <Calendar size={13} />
              <span>Daily Note</span>
            </button>

            <button className="btn btn-primary btn-sm" onClick={handleCreateNewNote}>
              <Plus size={13} />
              <span>New Note</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="input-with-icon" style={{ width: 240 }}>
            <Search size={13} />
            <input
              type="text"
              placeholder="Search notes content..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: 'var(--text-xs)', height: 30 }}
            />
          </div>

          {/* Tag Filter Pills */}
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${selectedTag === null ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedTag(null)}
            >
              All Tags
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                className={`btn btn-sm ${selectedTag === tag ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
            <FileText size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-md)', fontWeight: 700 }}>
              No notes found in vault
            </div>
            <div style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>
              Create a new note or generate a daily journal.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {filtered.map(note => (
              <div
                key={note.id}
                className="card card-interactive scifi-box"
                onClick={() => setActiveNote(note)}
                style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', minHeight: 170 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                    {note.title}
                  </div>
                  <button
                    className="btn-icon btn-sm"
                    onClick={e => handleDeleteNote(note.id, e)}
                    title="Delete Note"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Excerpt */}
                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                    flex: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {note.content.replace(/^#+ .*\n/, '').trim()}
                </p>

                {/* Tags & Links */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6, borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)' }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {note.tags.slice(0, 2).map(t => (
                      <span key={t} className="badge">#{t}</span>
                    ))}
                  </div>

                  {note.wikilinks.length > 0 && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {note.wikilinks.length} links
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
