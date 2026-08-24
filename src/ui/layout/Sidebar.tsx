import React from 'react';
import {
  BookOpen,
  Bookmark,
  Star,
  FileText,
  Network,
  Cloud,
  Settings,
  Trash2,
  Plus,
  Folder,
  ChevronRight,
  Sparkles,
  HardDrive,
  Share2,
} from 'lucide-react';
import { Collection } from '../../core/types';

export type NavTab = 'library' | 'favorites' | 'notes' | 'graph' | 'cloud' | 'trash' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  collections: Collection[];
  selectedCollectionId: string | null;
  onSelectCollection: (colId: string | null) => void;
  onCreateCollection: () => void;
  onOpenLibris: () => void;
  documentCount: number;
  noteCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
  onOpenLibris,
  documentCount,
  noteCount,
}) => {
  return (
    <aside
      style={{
        width: 260,
        height: '100%',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Brand Logo */}
      <div
        style={{
          height: 56,
          padding: '0 var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: 'var(--brand-glow)',
          }}
        >
          <BookOpen size={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 800, fontSize: 'var(--text-md)', letterSpacing: '0.04em', background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            LIBRIX
          </span>
        </div>
      </div>

      {/* Main Navigation Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* All Documents */}
        <button
          className={`btn btn-ghost ${activeTab === 'library' && !selectedCollectionId ? 'active' : ''}`}
          onClick={() => {
            onSelectCollection(null);
            onSelectTab('library');
          }}
          style={{
            width: '100%',
            justifyContent: 'space-between',
            background: activeTab === 'library' && !selectedCollectionId ? 'var(--bg-surface-hover)' : 'transparent',
            color: activeTab === 'library' && !selectedCollectionId ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <BookOpen size={16} />
            <span>Library</span>
          </div>
          <span className="badge badge-cloud">{documentCount}</span>
        </button>

        {/* Favorites */}
        <button
          className={`btn btn-ghost ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => {
            onSelectCollection(null);
            onSelectTab('favorites');
          }}
          style={{
            width: '100%',
            justifyContent: 'flex-start',
            gap: 'var(--space-2)',
            background: activeTab === 'favorites' ? 'var(--bg-surface-hover)' : 'transparent',
            color: activeTab === 'favorites' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <Star size={16} />
          <span>Favorites</span>
        </button>

        {/* Notes / Markdown Vault */}
        <button
          className={`btn btn-ghost ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => {
            onSelectCollection(null);
            onSelectTab('notes');
          }}
          style={{
            width: '100%',
            justifyContent: 'space-between',
            background: activeTab === 'notes' ? 'var(--bg-surface-hover)' : 'transparent',
            color: activeTab === 'notes' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <FileText size={16} />
            <span>Notes Vault</span>
          </div>
          <span className="badge badge-cloud">{noteCount}</span>
        </button>

        {/* Knowledge Graph */}
        <button
          className={`btn btn-ghost ${activeTab === 'graph' ? 'active' : ''}`}
          onClick={() => {
            onSelectCollection(null);
            onSelectTab('graph');
          }}
          style={{
            width: '100%',
            justifyContent: 'flex-start',
            gap: 'var(--space-2)',
            background: activeTab === 'graph' ? 'var(--bg-surface-hover)' : 'transparent',
            color: activeTab === 'graph' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <Network size={16} />
          <span>Knowledge Graph</span>
        </button>

        {/* Multi-Cloud & Storage */}
        <button
          className={`btn btn-ghost ${activeTab === 'cloud' ? 'active' : ''}`}
          onClick={() => {
            onSelectCollection(null);
            onSelectTab('cloud');
          }}
          style={{
            width: '100%',
            justifyContent: 'flex-start',
            gap: 'var(--space-2)',
            background: activeTab === 'cloud' ? 'var(--bg-surface-hover)' : 'transparent',
            color: activeTab === 'cloud' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <Cloud size={16} />
          <span>Multi-Cloud</span>
        </button>

        {/* Collections Section */}
        <div style={{ marginTop: 'var(--space-4)', padding: '0 var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              COLLECTIONS
            </span>
            <button className="btn-icon btn-sm" onClick={onCreateCollection} title="New Collection">
              <Plus size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {collections.map(col => (
              <button
                key={col.id}
                onClick={() => {
                  onSelectCollection(col.id);
                  onSelectTab('library');
                }}
                className={`btn btn-ghost ${selectedCollectionId === col.id ? 'active' : ''}`}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-xs)',
                  padding: '6px 8px',
                  background: selectedCollectionId === col.id ? 'var(--bg-surface-hover)' : 'transparent',
                  color: selectedCollectionId === col.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color || 'var(--brand-400)' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {col.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Trash */}
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
          <button
            className={`btn btn-ghost ${activeTab === 'trash' ? 'active' : ''}`}
            onClick={() => {
              onSelectCollection(null);
              onSelectTab('trash');
            }}
            style={{
              width: '100%',
              justifyContent: 'flex-start',
              gap: 'var(--space-2)',
              color: activeTab === 'trash' ? 'var(--danger)' : 'var(--text-muted)',
            }}
          >
            <Trash2 size={15} />
            <span>Trash Safety</span>
          </button>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          className={`btn btn-ghost btn-sm ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
          style={{ gap: 'var(--space-2)' }}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>

        <button
          className="btn-icon btn-sm"
          onClick={onOpenLibris}
          title="Open Libris AI"
          style={{ color: 'var(--brand-400)' }}
        >
          <Sparkles size={16} />
        </button>
      </div>
    </aside>
  );
};
