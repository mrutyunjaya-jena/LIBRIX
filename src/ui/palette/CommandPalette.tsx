import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  BookOpen,
  FilePlus,
  Plus,
  Cloud,
  Sparkles,
  Sun,
  RefreshCw,
  FolderPlus,
  Network,
  FileText,
} from 'lucide-react';
import { Document, Note } from '../../core/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  documents: Document[];
  notes: Note[];
  onOpenDocument: (doc: Document) => void;
  onOpenNote: (note: Note) => void;
  onCreateNote: () => void;
  onCreateCollection: () => void;
  onOpenLibris: () => void;
  onOpenCloudManager: () => void;
  onOpenGraph: () => void;
  onToggleTheme: () => void;
  onTriggerSync: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  documents,
  notes,
  onOpenDocument,
  onOpenNote,
  onCreateNote,
  onCreateCollection,
  onOpenLibris,
  onOpenCloudManager,
  onOpenGraph,
  onToggleTheme,
  onTriggerSync,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Static command items
  const baseCommands = [
    {
      id: 'cmd-new-note',
      title: 'Create New Note',
      category: 'Actions',
      icon: <FilePlus size={16} />,
      shortcut: 'N',
      run: () => { onCreateNote(); onClose(); },
    },
    {
      id: 'cmd-libris',
      title: 'Ask Libris AI',
      category: 'AI Assistant',
      icon: <Sparkles size={16} />,
      shortcut: 'L',
      run: () => { onOpenLibris(); onClose(); },
    },
    {
      id: 'cmd-graph',
      title: 'Open Knowledge Graph',
      category: 'Knowledge',
      icon: <Network size={16} />,
      shortcut: 'G',
      run: () => { onOpenGraph(); onClose(); },
    },
    {
      id: 'cmd-cloud',
      title: 'Connect & Manage Cloud Storage',
      category: 'Storage',
      icon: <Cloud size={16} />,
      shortcut: 'C',
      run: () => { onOpenCloudManager(); onClose(); },
    },
    {
      id: 'cmd-sync',
      title: 'Start Global Storage Sync',
      category: 'Sync',
      icon: <RefreshCw size={16} />,
      shortcut: 'S',
      run: () => { onTriggerSync(); onClose(); },
    },
    {
      id: 'cmd-theme',
      title: 'Toggle Color Theme (Dark/Light/Sepia)',
      category: 'Preferences',
      icon: <Sun size={16} />,
      shortcut: 'T',
      run: () => { onToggleTheme(); onClose(); },
    },
    {
      id: 'cmd-collection',
      title: 'Create New Collection',
      category: 'Organization',
      icon: <FolderPlus size={16} />,
      shortcut: 'Shift+C',
      run: () => { onCreateCollection(); onClose(); },
    },
  ];

  // Dynamic matching documents & notes
  const q = query.toLowerCase();
  const matchedDocs = documents
    .filter(d => !d.isTrash && (d.title.toLowerCase().includes(q) || d.author.toLowerCase().includes(q)))
    .slice(0, 5)
    .map(d => ({
      id: `doc-${d.id}`,
      title: d.title,
      category: `Book (${d.format.toUpperCase()})`,
      icon: <BookOpen size={16} />,
      shortcut: d.author,
      run: () => { onOpenDocument(d); onClose(); },
    }));

  const matchedNotes = notes
    .filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    .slice(0, 5)
    .map(n => ({
      id: `note-${n.id}`,
      title: n.title,
      category: 'Note',
      icon: <FileText size={16} />,
      shortcut: n.tags.map(t => `#${t}`).join(' '),
      run: () => { onOpenNote(n); onClose(); },
    }));

  const matchedCommands = baseCommands.filter(c => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));

  const allItems = [...matchedCommands, ...matchedDocs, ...matchedNotes];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (allItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % (allItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].run();
      }
    }
  };

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette-container" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="palette-input-wrap">
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Type a command or search documents & notes..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <button className="palette-shortcut" onClick={onClose}>ESC</button>
        </div>

        {/* Results */}
        <div className="palette-results">
          {allItems.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              No commands or documents found for "{query}"
            </div>
          ) : (
            allItems.map((item, index) => (
              <div
                key={item.id}
                className={`palette-item ${selectedIndex === index ? 'active' : ''}`}
                onClick={item.run}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ color: 'inherit' }}>{item.icon}</div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{item.title}</div>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>{item.category}</div>
                  </div>
                </div>

                {item.shortcut && (
                  <span className="palette-shortcut">{item.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
