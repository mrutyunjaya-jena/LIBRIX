import React from 'react';
import {
  BookOpen,
  FileText,
  Share2,
  Cloud,
  Settings,
} from 'lucide-react';

export type NavTab = 'library' | 'notes' | 'graph' | 'cloud' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  documentCount: number;
  noteCount: number;
  cloudCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  documentCount,
  noteCount,
  cloudCount,
}) => {

  return (
    <aside
      style={{
        width: 200,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'var(--space-3)',
        userSelect: 'none',
      }}
    >
      {/* Top Navigation Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px', letterSpacing: '0.05em' }}>
          WORKSTATION
        </div>

        <button
          className={`palette-item ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => onSelectTab('library')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={14} />
            <span style={{ fontSize: 'var(--text-xs)' }}>Library</span>
          </div>
          <span className="badge">{documentCount}</span>
        </button>

        <button
          className={`palette-item ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => onSelectTab('notes')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={14} />
            <span style={{ fontSize: 'var(--text-xs)' }}>Notes Vault</span>
          </div>
          <span className="badge">{noteCount}</span>
        </button>

        <button
          className={`palette-item ${activeTab === 'graph' ? 'active' : ''}`}
          onClick={() => onSelectTab('graph')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={14} />
            <span style={{ fontSize: 'var(--text-xs)' }}>Knowledge Graph</span>
          </div>
        </button>

        <button
          className={`palette-item ${activeTab === 'cloud' ? 'active' : ''}`}
          onClick={() => onSelectTab('cloud')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cloud size={14} />
            <span style={{ fontSize: 'var(--text-xs)' }}>Multi-Cloud</span>
          </div>
          <span className="badge">{cloudCount}</span>
        </button>
      </div>

      {/* Bottom Section: Settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
        <button
          className={`palette-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={14} />
            <span style={{ fontSize: 'var(--text-xs)' }}>Settings</span>
          </div>
        </button>
      </div>
    </aside>
  );
};
