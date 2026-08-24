import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar, NavTab } from './Sidebar';
import { MobileNavigation } from './MobileNavigation';
import { LibraryView } from '../library/LibraryView';
import { NotesListView } from '../notes/NotesListView';
import { KnowledgeGraph } from '../../notes/KnowledgeGraph';
import { CloudManagerView } from '../cloud/CloudManagerView';
import { SettingsView } from '../settings/SettingsView';
import { DocumentViewer } from '../../readers/DocumentViewer';
import { LibrisAssistant } from '../../ai/LibrisAssistant';
import { CommandPalette } from '../palette/CommandPalette';
import { DeleteSafetyModal } from '../library/DeleteSafetyModal';
import { FirstRunOnboarding } from '../onboarding/FirstRunOnboarding';
import { Document, Folder, Note, CloudConnection } from '../../core/types';
import { db } from '../../core/db/DatabaseEngine';
import { usePlatform } from '../../platform/PlatformContext';
import { storageRegistry } from '../../storage/StorageRegistry';
import { cloudVaultSyncService } from '../../storage/sync/CloudVaultSyncService';
import { fileBinaryStore } from '../../core/storage/FileBinaryStore';

export const AppShell: React.FC = () => {
  const platform = usePlatform();

  // Navigation & Theme
  const [activeTab, setActiveTab] = useState<NavTab>('library');
  const [activeTheme, setActiveTheme] = useState<'dark' | 'light'>('dark');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Entities State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [clouds, setClouds] = useState<CloudConnection[]>([]);

  // Reader & Modals
  const [activeReadingDoc, setActiveReadingDoc] = useState<Document | null>(null);
  const [showLibris, setShowLibris] = useState(false);
  const [librisPassage, setLibrisPassage] = useState<string | undefined>(undefined);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [deleteTargetDoc, setDeleteTargetDoc] = useState<Document | null>(null);

  // Initial Data Load with safe error handling
  const reloadData = async () => {
    try {
      await db.initialize();
      await storageRegistry.initializeFromDatabase();
      const docs = await db.getDocuments();
      const flds = await db.getFolders();
      const nts = await db.getNotes();
      const clds = await db.getCloudConnections();

      setDocuments(docs || []);
      setFolders(flds || []);
      setNotes(nts || []);
      setClouds(clds || []);

      // Check first-run onboarding
      const onboarded = localStorage.getItem('librix_onboarded');
      if (!onboarded) {
        setShowOnboarding(true);
      }
    } catch (err) {
      console.error('Error reloading app data in AppShell:', err);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Keyboard Shortcuts (Ctrl+K for Command Palette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Theme Toggler
  const toggleTheme = () => {
    const next = activeTheme === 'dark' ? 'light' : 'dark';
    setActiveTheme(next);
    if (next === 'light') {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
    }
  };

  // Sync Trigger
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      const providers = storageRegistry.getAllProviders().filter(p => p.type !== 'local' && p.isConnected());
      let totalImportedDocs = 0;
      let totalImportedNotes = 0;

      for (const provider of providers) {
        const res = await cloudVaultSyncService.syncFromCloudOnLogin(provider);
        totalImportedDocs += res.importedDocuments;
        totalImportedNotes += res.importedNotes;
      }

      await reloadData();
      if (totalImportedDocs > 0 || totalImportedNotes > 0) {
        platform.notifications.show('Cloud Vault Synchronized', {
          body: `Fetched ${totalImportedDocs} books and ${totalImportedNotes} notes from cloud.`,
        });
      }
    } catch (e) {
      console.warn('Sync error in AppShell:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Folder Actions
  const handleCreateFolder = async (name: string, parentId: string | null) => {
    const newFolder: Folder = {
      id: `fld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      parentId,
      path: parentId ? `/library/${parentId}/${name}` : `/${name}`,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveFolder(newFolder);
    await reloadData();
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    await db.renameFolder(folderId, newName);
    await reloadData();
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (confirm('Delete this folder and its subfolders? Documents inside will be moved to the root library.')) {
      await db.deleteFolder(folderId);
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      await reloadData();
    }
  };

  // Document Actions
  const handleRenameDocument = async (docId: string, newTitle: string, newFilename?: string) => {
    await db.renameDocument(docId, newTitle, newFilename);
    await reloadData();
  };

  const handleMoveDocumentToFolder = async (docId: string, folderId: string | null) => {
    await db.moveDocumentToFolder(docId, folderId);
    await reloadData();
  };

  const handleDuplicateDocument = async (docId: string) => {
    await db.duplicateDocument(docId);
    await reloadData();
  };

  const handleToggleFavorite = async (doc: Document) => {
    doc.isFavorite = !doc.isFavorite;
    await db.saveDocument(doc);
    await reloadData();
  };

  const handleConfirmDeleteDoc = async (docId: string, permanent: boolean) => {
    const doc = await db.getDocumentById(docId);
    if (doc) {
      // 1. Delete binary blob locally
      await fileBinaryStore.deleteFileBlob(docId).catch(() => {});

      // 2. If document is on cloud (or permanent delete), remove from cloud provider
      if (permanent && doc.storageProvider && doc.storageProvider !== 'local') {
        try {
          const provider = storageRegistry.getProvider(doc.storageProvider);
          if (provider && provider.isConnected()) {
            await provider.delete(doc.cloudFileId || doc.storagePath || doc.filename).catch(() => {});
            await cloudVaultSyncService.saveMasterVaultCatalog(provider).catch(() => {});
          }
        } catch (cloudDelErr) {
          console.warn('Could not delete document from cloud:', cloudDelErr);
        }
      }
    }

    await db.deleteDocument(docId, permanent);
    setDeleteTargetDoc(null);
    await reloadData();
  };

  const handleImportDocuments = async (newDocs: Partial<Document>[]) => {
    for (const d of newDocs) {
      await db.saveDocument(d as Document);
    }
    await reloadData();
  };

  const handleOpenDocument = async (doc: Document) => {
    const latestDoc = (await db.getDocumentById(doc.id)) || doc;
    setActiveReadingDoc(latestDoc);
  };

  return (
    <div className="app-safe-container">
      {/* 1. Header */}
      <Header
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onOpenLibris={() => {
          setLibrisPassage(undefined);
          setShowLibris(true);
        }}
        activeTheme={activeTheme}
        onToggleTheme={toggleTheme}
        isSyncing={isSyncing}
        onTriggerSync={handleTriggerSync}
      />

      {/* 2. Main Content Workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Desktop Sidebar / Tablet Navigation Rail */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          documentCount={documents.filter(d => !d.isTrash).length}
          noteCount={notes.length}
          cloudCount={clouds.filter(c => c.status === 'connected').length}
        />

        {/* Dynamic Main Stage */}
        <main className="app-main-content" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {activeTab === 'library' && (
            <LibraryView
              documents={documents}
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onOpenDocument={handleOpenDocument}
              onToggleFavorite={handleToggleFavorite}
              onDeleteRequest={doc => setDeleteTargetDoc(doc)}
              onOpenLibris={doc => {
                setShowLibris(true);
              }}
              onImportDocuments={handleImportDocuments}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              onRenameDocument={handleRenameDocument}
              onMoveDocumentToFolder={handleMoveDocumentToFolder}
              onDuplicateDocument={handleDuplicateDocument}
              onDocumentsUpdated={reloadData}
            />
          )}

          {activeTab === 'notes' && (
            <NotesListView
              notes={notes}
              onOpenNote={note => {
                // Open note in editor
              }}
              onNotesUpdated={reloadData}
            />
          )}

          {activeTab === 'graph' && (
            <KnowledgeGraph
              onOpenDocument={async docId => {
                const doc = await db.getDocumentById(docId);
                if (doc) setActiveReadingDoc(doc);
              }}
              onOpenNote={noteId => {
                setActiveTab('notes');
              }}
            />
          )}

          {activeTab === 'cloud' && (
            <CloudManagerView
              connections={clouds}
              onConnectionsUpdated={reloadData}
            />
          )}

          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* 3. Mobile Navigation Bar */}
      <MobileNavigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenLibris={() => {
          setLibrisPassage(undefined);
          setShowLibris(true);
        }}
      />

      {/* 4. Fullscreen Document Reader Modal */}
      {activeReadingDoc && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200 }}>
          <DocumentViewer
            document={activeReadingDoc}
            onClose={() => setActiveReadingDoc(null)}
            onProgressUpdate={async (percentage, location) => {
              await db.updateReadingProgress(activeReadingDoc.id, { percentage, currentLocation: location });
              await reloadData();
            }}
            onOpenLibris={passage => {
              setLibrisPassage(passage);
              setShowLibris(true);
            }}
          />
        </div>
      )}

      {/* 5. Libris Assistant Workstation Drawer (Top Layer Overlay) */}
      {showLibris && (
        <div
          className="adaptive-libris-panel"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 2500,
            boxShadow: 'var(--shadow-elevated)',
            display: 'flex',
          }}
        >
          <LibrisAssistant
            currentDocument={activeReadingDoc}
            selectedTextPassage={librisPassage}
            onClose={() => setShowLibris(false)}
            onNavigateToCitation={async docId => {
              const doc = await db.getDocumentById(docId);
              if (doc) setActiveReadingDoc(doc);
            }}
          />
        </div>
      )}

      {/* 5. Command Palette (Ctrl+K) */}
      {showCommandPalette && (
        <CommandPalette
          documents={documents}
          notes={notes}
          onClose={() => setShowCommandPalette(false)}
          onSelectDocument={doc => {
            handleOpenDocument(doc);
            setShowCommandPalette(false);
          }}
          onSelectNote={note => {
            setActiveTab('notes');
            setShowCommandPalette(false);
          }}
          onTriggerAction={action => {
            if (action === 'new_note') setActiveTab('notes');
            if (action === 'sync') handleTriggerSync();
            if (action === 'libris') setShowLibris(true);
            if (action === 'settings') setActiveTab('settings');
            setShowCommandPalette(false);
          }}
        />
      )}

      {/* 6. Delete Safety Confirmation Modal */}
      {deleteTargetDoc && (
        <DeleteSafetyModal
          document={deleteTargetDoc}
          onClose={() => setDeleteTargetDoc(null)}
          onConfirm={handleConfirmDeleteDoc}
        />
      )}

      {/* 7. First-Run Welcome Wizard */}
      {showOnboarding && (
        <FirstRunOnboarding
          onComplete={() => {
            localStorage.setItem('librix_onboarded', 'true');
            setShowOnboarding(false);
          }}
        />
      )}
    </div>
  );
};
