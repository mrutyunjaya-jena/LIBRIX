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
  LayoutGrid,
  List as ListIcon,
  BookOpen,
} from 'lucide-react';
import { Note } from '../../core/types';
import { db } from '../../core/db/DatabaseEngine';
import { MarkdownEditor } from '../../notes/MarkdownEditor';
import { storageRegistry } from '../../storage/StorageRegistry';
import { cloudVaultSyncService } from '../../storage/sync/CloudVaultSyncService';

interface NotesListViewProps {
  notes: Note[];
  onOpenNote?: (note: Note) => void;
  onNotesUpdated: () => void;
}

// Clean markdown syntax for aesthetic card preview excerpt
function cleanNoteExcerpt(raw: string): string {
  if (!raw) return 'Empty note...';
  let text = raw
    .replace(/^---[\s\S]*?---/, '') // Remove YAML frontmatter
    .replace(/^#+\s+.*$/gm, '') // Remove Headings
    .replace(/^>\s*\[!.*?\]\s*/gm, '') // Remove callout tags
    .replace(/^>\s*[💡⚠️ℹ️🎯🚀🔥]?\s*/gm, '') // Remove callout markers
    .replace(/^[-*]\s*\[[ xX]\]\s*/gm, '') // Remove checkboxes
    .replace(/^[-*]\s+/gm, '') // Remove bullet points
    .replace(/^\d+\.\s+/gm, '') // Remove numbered points
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`([^`]+)`/g, '$1') // Remove inline code ticks
    .replace(/\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g, (_, target, alias) => alias || target) // Clean wikilinks
    .replace(/[#*_~=]/g, '') // Remove formatting tokens
    .trim();

  return text || 'No additional text content...';
}

export const NotesListView: React.FC<NotesListViewProps> = ({
  notes,
  onNotesUpdated,
}) => {
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');

  // Extract all unique tags
  const allTags = Array.from(new Set(notes.flatMap(n => n.tags)));
  const allStatuses = ['Draft', 'In Progress', 'Completed'];

  let filtered = notes;
  if (selectedStatus) {
    filtered = filtered.filter(n => (n.frontmatter?.status || 'Draft') === selectedStatus);
  }
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
      content: `# Untitled Note\n\n> 💡 **Tip:** Type \`/\` anywhere to insert blocks, callouts & AI actions.\n\n### Objectives\n- [ ] Define research scope\n- [ ] Connect with [[Universal Storage Architecture]]\n\n### Notes & Synthesis\n\n#Research`,
      frontmatter: {
        title: 'Untitled Note',
        icon: '📄',
        status: 'Draft',
        created: new Date().toISOString().slice(0, 10),
      },
      tags: ['Research'],
      wikilinks: ['Universal Storage Architecture'],
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
      content: `# Daily Note: ${today}\n\n> 🎯 **Daily Focus:** Focus on critical milestones.\n\n### Priority Tasks\n- [ ] Review literature & library books\n- [ ] Cross-link ideas with [[Universal Storage Architecture]]\n\n### Notes & Reflections\n\n#DailyJournal`,
      frontmatter: {
        title: `Daily Note: ${today}`,
        icon: '🗓️',
        status: 'In Progress',
        date: today,
        tags: ['DailyJournal'],
      },
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
      const noteToDelete = await db.getNoteById(id);
      await db.deleteNote(id);

      // Remove from connected cloud providers
      try {
        const cloudProviders = storageRegistry.getAllProviders().filter(p => p.type !== 'local' && p.isConnected());
        for (const provider of cloudProviders) {
          const safeTitle = (noteToDelete?.title || 'Untitled_Note').replace(/[/\\?%*:|"<>]/g, '_');
          await provider.delete(`${safeTitle}.md`).catch(() => {});
          await cloudVaultSyncService.saveMasterVaultCatalog(provider).catch(() => {});
        }
      } catch (cloudErr) {
        console.warn('Could not delete note from cloud storage:', cloudErr);
      }

      if (activeNote?.id === id) setActiveNote(null);
      onNotesUpdated();
    }
  };

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
              KNOWLEDGE VAULT
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Interactive block canvas with slash commands (<code style={{ color: 'var(--text-primary)' }}>/</code>), callout blocks, checklists, [[Wikilinks]], and graph backlinks.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {/* View Layout Switcher */}
            <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 2, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-medium)', marginRight: 4 }}>
              <button
                className={`btn-icon btn-sm ${viewLayout === 'grid' ? 'active' : ''}`}
                style={{ width: 26, height: 26 }}
                onClick={() => setViewLayout('grid')}
                title="Gallery Grid View"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                className={`btn-icon btn-sm ${viewLayout === 'list' ? 'active' : ''}`}
                style={{ width: 26, height: 26 }}
                onClick={() => setViewLayout('list')}
                title="List Table View"
              >
                <ListIcon size={13} />
              </button>
            </div>

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
          <div className="input-with-icon" style={{ width: 220 }}>
            <Search size={13} />
            <input
              type="text"
              placeholder="Search notes & content..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: 'var(--text-xs)', height: 30 }}
            />
          </div>

          {/* Status Filter Pills */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', borderRight: '1px solid var(--border-subtle)', paddingRight: 8 }}>
            <button
              className={`btn btn-sm ${selectedStatus === null ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.7rem' }}
              onClick={() => setSelectedStatus(null)}
            >
              All
            </button>
            {allStatuses.map(st => (
              <button
                key={st}
                className={`btn btn-sm ${selectedStatus === st ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.7rem' }}
                onClick={() => setSelectedStatus(selectedStatus === st ? null : st)}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Tag Filter Pills */}
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {allTags.map(tag => (
              <button
                key={tag}
                className={`btn btn-sm ${selectedTag === tag ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.7rem' }}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes Container */}
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
        ) : viewLayout === 'grid' ? (
          /* GALLERY GRID VIEW: Refined Aesthetic Cards */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            {filtered.map(note => {
              const noteIcon = note.frontmatter?.icon || '📄';
              const noteCover = note.frontmatter?.cover;
              const noteStatus = note.frontmatter?.status || 'Draft';
              const wordCount = note.content ? note.content.trim().split(/\s+/).length : 0;
              const excerpt = cleanNoteExcerpt(note.content);

              return (
                <div
                  key={note.id}
                  className="card card-interactive"
                  onClick={() => setActiveNote(note)}
                  style={{
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    height: 220,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-surface)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                  }}
                >
                  {/* Top Thumbnail Cover Banner */}
                  <div
                    style={{
                      height: 64,
                      width: '100%',
                      background: noteCover || 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                      borderBottom: '1px solid var(--border-subtle)',
                      position: 'relative',
                    }}
                  >
                    {/* Floating Avatar Emoji */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -14,
                        left: 14,
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-medium)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        zIndex: 2,
                      }}
                    >
                      {noteIcon}
                    </div>

                    {/* Delete Note Button on Hover */}
                    <button
                      className="btn-icon btn-sm"
                      onClick={e => handleDeleteNote(note.id, e)}
                      title="Delete Note"
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'rgba(0,0,0,0.5)',
                        color: '#fff',
                        width: 22,
                        height: 22,
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div style={{ padding: '18px 14px 12px 14px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    {/* Note Title */}
                    <div
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: 4,
                      }}
                    >
                      {note.title}
                    </div>

                    {/* Excerpt */}
                    <p
                      style={{
                        fontSize: '0.74rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.45,
                        flex: 1,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        margin: '0 0 8px 0',
                      }}
                    >
                      {excerpt}
                    </p>

                    {/* Metadata Footer */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 'auto',
                        paddingTop: 6,
                        borderTop: '1px solid var(--border-subtle)',
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-tech)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span
                          style={{
                            padding: '1px 5px',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.62rem',
                            fontWeight: 600,
                            background:
                              noteStatus === 'Completed'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : noteStatus === 'In Progress'
                                ? 'rgba(234, 179, 8, 0.15)'
                                : 'var(--bg-surface-elevated)',
                            color:
                              noteStatus === 'Completed'
                                ? '#10b981'
                                : noteStatus === 'In Progress'
                                ? '#eab308'
                                : 'var(--text-muted)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {noteStatus}
                        </span>

                        {note.tags.slice(0, 1).map(t => (
                          <span key={t} className="badge" style={{ fontSize: '0.62rem', padding: '1px 4px' }}>
                            #{t}
                          </span>
                        ))}
                      </div>

                      <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                        {wordCount}w • {note.wikilinks.length} links
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST TABLE VIEW */
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', width: 40 }}></th>
                  <th style={{ padding: '8px 12px' }}>TITLE</th>
                  <th style={{ padding: '8px 12px', width: 120 }}>STATUS</th>
                  <th style={{ padding: '8px 12px', width: 140 }}>TAGS</th>
                  <th style={{ padding: '8px 12px', width: 90 }}>WORDS</th>
                  <th style={{ padding: '8px 12px', width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(note => {
                  const noteIcon = note.frontmatter?.icon || '📄';
                  const noteStatus = note.frontmatter?.status || 'Draft';
                  const wordCount = note.content ? note.content.trim().split(/\s+/).length : 0;

                  return (
                    <tr
                      key={note.id}
                      onClick={() => setActiveNote(note)}
                      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                      className="card-interactive"
                    >
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '1.1rem' }}>{noteIcon}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{note.title}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            background:
                              noteStatus === 'Completed'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : noteStatus === 'In Progress'
                                ? 'rgba(234, 179, 8, 0.15)'
                                : 'var(--bg-surface-elevated)',
                            color:
                              noteStatus === 'Completed'
                                ? '#10b981'
                                : noteStatus === 'In Progress'
                                ? '#eab308'
                                : 'var(--text-muted)',
                          }}
                        >
                          {noteStatus}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {note.tags.slice(0, 2).map(t => (
                            <span key={t} className="badge" style={{ fontSize: '0.62rem' }}>#{t}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>{wordCount}w</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button
                          className="btn-icon btn-sm"
                          onClick={e => handleDeleteNote(note.id, e)}
                          title="Delete Note"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
