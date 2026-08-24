import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './Sidebar';
import { Header } from './Header';
import { MobileNavigation } from './MobileNavigation';
import { LibraryView } from '../library/LibraryView';
import { NotesListView } from '../notes/NotesListView';
import { KnowledgeGraph } from '../../notes/KnowledgeGraph';
import { CloudManagerView } from '../cloud/CloudManagerView';
import { SettingsView } from '../settings/SettingsView';
import { DocumentViewer } from '../../readers/DocumentViewer';
import { MarkdownEditor } from '../../notes/MarkdownEditor';
import { LibrisAssistant } from '../../ai/LibrisAssistant';
import { CommandPalette } from '../palette/CommandPalette';
import { FirstRunOnboarding } from '../onboarding/FirstRunOnboarding';
import { DeleteSafetyModal } from '../library/DeleteSafetyModal';
import { ConflictResolutionModal } from '../cloud/ConflictResolutionModal';
import { db } from '../../core/db/DatabaseEngine';
import { Document, Note, Collection, CloudConnection, SyncConflict, KnowledgeGraphNode } from '../../core/types';
import { usePlatform } from '../../platform/PlatformContext';

export const AppShell: React.FC = () => {
  const platform = usePlatform();

  // State
  const [activeTab, setActiveTab] = useState<NavTab>('library');
  const [theme, setTheme] = useState<string>('dark');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [cloudConnections, setCloudConnections] = useState<CloudConnection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Active Readers & Editors
  const [activeDocument, setActiveDocument] = useState<Document | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);

  // Libris AI Drawer
  const [isLibrisOpen, setIsLibrisOpen] = useState(false);
  const [librisInitialQuery, setLibrisInitialQuery] = useState('');

  // Modals
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Document | null>(null);
  const [activeConflict, setActiveConflict] = useState<SyncConflict | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load Database Records on Startup
  const refreshData = async () => {
    await db.initialize();
    const docs = await db.getDocuments({ filterTrash: activeTab === 'trash', favoritesOnly: activeTab === 'favorites' });
    const allNotes = await db.getNotes();
    const cols = await db.getCollections();
    const clouds = await db.getCloudConnections();
    const conflicts = await db.getSyncConflicts();

    setDocuments(docs);
    setNotes(allNotes);
    setCollections(cols);
    setCloudConnections(clouds);
    if (conflicts.length > 0) {
      setActiveConflict(conflicts[0]);
    }
  };

  useEffect(() => {
    refreshData();
    // Check first-run onboarding flag
    const completed = localStorage.getItem('librix_onboarding_done');
    if (!completed) {
      setShowOnboarding(true);
    }
  }, [activeTab]);

  // Set Theme Class on Body
  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  // Global Keyboard Shortcuts (Ctrl/Cmd + K, Escape, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        setIsLibrisOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync simulation
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    platform.notifications.show('Starting Multi-Cloud Sync', { body: 'Checking Google Drive, MEGA, Telegram, and TeraBox for updates.' });
    setTimeout(async () => {
      setIsSyncing(false);
      await refreshData();
      platform.notifications.show('Sync Complete', { body: 'All storage providers are up to date.' });
    }, 1800);
  };

  // Favorite toggle
  const handleToggleFavorite = async (doc: Document) => {
    doc.isFavorite = !doc.isFavorite;
    await db.saveDocument(doc);
    await refreshData();
  };

  // Delete handling
  const handleDeleteRequest = (doc: Document) => {
    setDeleteCandidate(doc);
  };

  const handleConfirmMoveToTrash = async () => {
    if (deleteCandidate) {
      await db.deleteDocument(deleteCandidate.id, false);
      setDeleteCandidate(null);
      await refreshData();
    }
  };

  const handleConfirmDeletePermanently = async () => {
    if (deleteCandidate) {
      await db.deleteDocument(deleteCandidate.id, true);
      setDeleteCandidate(null);
      await refreshData();
    }
  };

  // Create new note
  const handleCreateNote = async () => {
    const newNote: Note = {
      id: `note_${Date.now()}`,
      title: 'Untitled Note',
      slug: `untitled-note-${Date.now()}`,
      content: `# Untitled Note\n\nWrite your thoughts here. Connect to other notes with [[Wikilinks]] and categorize with #tags.`,
      frontmatter: {
        title: 'Untitled Note',
        created: new Date().toISOString().split('T')[0],
        tags: [],
      },
      tags: [],
      wikilinks: [],
      backlinks: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveNote(newNote);
    await refreshData();
    setActiveNote(newNote);
  };

  // Create daily note
  const handleCreateDailyNote = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const existing = notes.find(n => n.title === todayStr || n.slug === todayStr);
    if (existing) {
      setActiveNote(existing);
      return;
    }

    const dailyNote: Note = {
      id: `daily_${Date.now()}`,
      title: todayStr,
      slug: todayStr,
      content: `# Daily Note — ${todayStr}\n\n## 🎯 Today's Goals & Readings\n- [ ] Read 1 chapter from [[The Rust Programming Language]]\n- [ ] Explore [[Universal Storage Architecture]]\n\n## 📝 Notes & Reflections\n\n#DailyJournal #Reflections`,
      frontmatter: {
        title: todayStr,
        type: 'daily-note',
        date: todayStr,
        tags: ['DailyJournal'],
      },
      tags: ['DailyJournal'],
      wikilinks: ['The Rust Programming Language', 'Universal Storage Architecture'],
      backlinks: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveNote(dailyNote);
    await refreshData();
    setActiveNote(dailyNote);
  };

  // Graph Node Click
  const handleGraphNodeSelect = async (node: KnowledgeGraphNode) => {
    if (node.type === 'note') {
      const noteId = node.id.replace('note_', '');
      const target = await db.getNoteById(noteId);
      if (target) setActiveNote(target);
    } else if (node.type === 'book') {
      const docId = node.id.replace('doc_', '');
      const target = await db.getDocumentById(docId);
      if (target) setActiveDocument(target);
    }
  };

  // Import documents
  const handleImportDocuments = async (newDocs: Partial<Document>[]) => {
    for (const doc of newDocs) {
      await db.saveDocument(doc as Document);
    }
    await refreshData();
  };

  // Create Collection
  const handleCreateCollection = async () => {
    const name = prompt('Enter Collection Name:');
    if (name && name.trim()) {
      const newCol: Collection = {
        id: `col_${Date.now()}`,
        name: name.trim(),
        color: '#6366f1',
        createdAt: Date.now(),
      };
      await db.saveCollection(newCol);
      await refreshData();
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 1. Desktop Sidebar */}
      {!platform.platform.isMobile && (
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={setSelectedCollectionId}
          onCreateCollection={handleCreateCollection}
          onOpenLibris={() => setIsLibrisOpen(true)}
          documentCount={documents.length}
          noteCount={notes.length}
        />
      )}

      {/* 2. Main Content Viewport */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
        {/* Header */}
        <Header
          onOpenPalette={() => setIsPaletteOpen(true)}
          onOpenLibris={() => setIsLibrisOpen(true)}
          currentTheme={theme}
          onToggleTheme={setTheme}
          isSyncing={isSyncing}
          onTriggerSync={handleTriggerSync}
        />

        {/* Tab Content Router */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {(activeTab === 'library' || activeTab === 'favorites' || activeTab === 'trash') && (
            <LibraryView
              documents={documents}
              onOpenDocument={doc => setActiveDocument(doc)}
              onToggleFavorite={handleToggleFavorite}
              onDeleteRequest={handleDeleteRequest}
              onOpenLibris={doc => {
                setActiveDocument(doc || null);
                setIsLibrisOpen(true);
              }}
              onImportDocuments={handleImportDocuments}
              activeCollectionTitle={
                selectedCollectionId
                  ? collections.find(c => c.id === selectedCollectionId)?.name
                  : activeTab === 'favorites'
                  ? 'Favorites'
                  : activeTab === 'trash'
                  ? 'Trash Safety'
                  : 'Library'
              }
            />
          )}

          {activeTab === 'notes' && (
            <NotesListView
              notes={notes}
              onOpenNote={n => setActiveNote(n)}
              onCreateNote={handleCreateNote}
              onCreateDailyNote={handleCreateDailyNote}
              onDeleteNote={async id => {
                await db.deleteNote(id);
                await refreshData();
              }}
              onOpenLibris={() => setIsLibrisOpen(true)}
            />
          )}

          {activeTab === 'graph' && (
            <KnowledgeGraph
              onSelectNode={handleGraphNodeSelect}
              onOpenLibris={() => setIsLibrisOpen(true)}
            />
          )}

          {activeTab === 'cloud' && (
            <CloudManagerView
              connections={cloudConnections}
              onAddConnection={async conn => {
                await db.saveCloudConnection(conn);
                await refreshData();
              }}
              onRemoveConnection={async id => {
                await db.deleteCloudConnection(id);
                await refreshData();
              }}
              onTriggerSync={handleTriggerSync}
              isSyncing={isSyncing}
            />
          )}

          {activeTab === 'settings' && <SettingsView />}

          {/* Libris AI Chat Drawer */}
          {isLibrisOpen && (
            <LibrisAssistant
              activeDocument={activeDocument}
              initialQuery={librisInitialQuery}
              onClose={() => {
                setIsLibrisOpen(false);
                setLibrisInitialQuery('');
              }}
              onNavigateToDocument={async docId => {
                const doc = await db.getDocumentById(docId);
                if (doc) setActiveDocument(doc);
              }}
            />
          )}
        </div>

        {/* 3. Mobile Bottom Navigation Bar */}
        {platform.platform.isMobile && (
          <MobileNavigation
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onOpenLibris={() => setIsLibrisOpen(true)}
          />
        )}
      </div>

      {/* 4. Fullscreen Document Reader Modal */}
      {activeDocument && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          <DocumentViewer
            document={activeDocument}
            onClose={() => setActiveDocument(null)}
            onProgressUpdate={async (percent, loc) => {
              await db.updateReadingProgress(activeDocument.id, { percentage: percent, currentLocation: loc });
            }}
            onOpenLibris={text => {
              setLibrisInitialQuery(text || '');
              setIsLibrisOpen(true);
            }}
            onNavigateWikilink={async targetTitle => {
              const note = notes.find(n => n.title.toLowerCase() === targetTitle.toLowerCase());
              if (note) {
                setActiveDocument(null);
                setActiveNote(note);
              }
            }}
          />
        </div>
      )}

      {/* 5. Fullscreen Markdown Note Editor Modal */}
      {activeNote && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          <MarkdownEditor
            note={activeNote}
            onClose={() => setActiveNote(null)}
            onSave={async updated => {
              await db.saveNote(updated);
              await refreshData();
            }}
            onNavigateNote={async idOrTitle => {
              const target = notes.find(n => n.id === idOrTitle || n.title.toLowerCase() === idOrTitle.toLowerCase());
              if (target) setActiveNote(target);
            }}
            onOpenLibris={contextText => {
              setLibrisInitialQuery(contextText || '');
              setIsLibrisOpen(true);
            }}
          />
        </div>
      )}

      {/* 6. Command Palette (Ctrl/Cmd + K) */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        documents={documents}
        notes={notes}
        onOpenDocument={doc => setActiveDocument(doc)}
        onOpenNote={note => setActiveNote(note)}
        onCreateNote={handleCreateNote}
        onCreateCollection={handleCreateCollection}
        onOpenLibris={() => setIsLibrisOpen(true)}
        onOpenCloudManager={() => setActiveTab('cloud')}
        onOpenGraph={() => setActiveTab('graph')}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'sepia' : 'dark')}
        onTriggerSync={handleTriggerSync}
      />

      {/* 7. First-Run Onboarding Modal */}
      {showOnboarding && (
        <FirstRunOnboarding
          onComplete={() => {
            localStorage.setItem('librix_onboarding_done', 'true');
            setShowOnboarding(false);
          }}
        />
      )}

      {/* 8. Delete Safety Modal */}
      {deleteCandidate && (
        <DeleteSafetyModal
          document={deleteCandidate}
          onCancel={() => setDeleteCandidate(null)}
          onMoveToTrash={handleConfirmMoveToTrash}
          onDeletePermanently={handleConfirmDeletePermanently}
        />
      )}

      {/* 9. Sync Conflict Modal */}
      {activeConflict && (
        <ConflictResolutionModal
          conflict={activeConflict}
          onCancel={() => setActiveConflict(null)}
          onResolve={async resolution => {
            if (resolution === 'copy') {
              platform.notifications.show('Conflict Resolved', { body: 'Created a local conflicted copy.' });
            } else if (resolution === 'local') {
              platform.notifications.show('Conflict Resolved', { body: 'Local version kept.' });
            } else {
              platform.notifications.show('Conflict Resolved', { body: 'Cloud version kept.' });
            }
            setActiveConflict(null);
          }}
        />
      )}
    </div>
  );
};
