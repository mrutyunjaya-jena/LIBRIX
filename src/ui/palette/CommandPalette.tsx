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
  Share2,
  FileText,
  Settings,
} from 'lucide-react';
import { Document, Note } from '../../core/types';

interface CommandPaletteProps {
  documents: Document[];
  notes: Note[];
  onClose: () => void;
  onSelectDocument: (doc: Document) => void;
  onSelectNote: (note: Note) => void;
  onTriggerAction: (action: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  documents,
  notes,
  onClose,
  onSelectDocument,
  onSelectNote,
  onTriggerAction,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Base workstation actions
  const baseCommands = [
    {
      id: 'cmd-new-note',
      title: 'Create New Note',
      category: 'Notes Vault',
      icon: <FilePlus size={14} />,
      shortcut: 'N',
      run: () => onTriggerAction('new_note'),
    },
    {
      id: 'cmd-libris',
      title: 'Ask Libris AI Research Assistant',
      category: 'AI Assistant',
      icon: <Sparkles size={14} />,
      shortcut: 'L',
      run: () => onTriggerAction('libris'),
    },
    {
      id: 'cmd-graph',
      title: 'Open Knowledge Graph',
      category: 'Knowledge',
      icon: <Share2 size={14} />,
      shortcut: 'G',
      run: () => onTriggerAction('graph'),
    },
    {
      id: 'cmd-sync',
      title: 'Sync All Storage Providers',
      category: 'Sync',
      icon: <RefreshCw size={14} />,
      shortcut: 'S',
      run: () => onTriggerAction('sync'),
    },
    {
      id: 'cmd-settings',
      title: 'Open Settings & AI Configuration',
      category: 'Configuration',
      icon: <Settings size={14} />,
      shortcut: ',',
      run: () => onTriggerAction('settings'),
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
      category: `Document (${d.format.toUpperCase()})`,
      icon: <BookOpen size={14} />,
      shortcut: d.author,
      run: () => onSelectDocument(d),
    }));

  const matchedNotes = notes
    .filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    .slice(0, 5)
    .map(n => ({
      id: `note-${n.id}`,
      title: n.title,
      category: 'Note',
      icon: <FileText size={14} />,
      shortcut: n.tags.map(t => `#${t}`).join(' '),
      run: () => onSelectNote(n),
    }));

  const matchedCommands = baseCommands.filter(
    c => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
  );

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
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
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
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
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
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>{item.title}</div>
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{item.category}</div>
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
