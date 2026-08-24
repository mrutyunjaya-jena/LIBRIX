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
    <aside className="app-adaptive-sidebar">
      {/* Top Navigation Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <div
          className="sidebar-section-title"
          style={{
            fontFamily: 'var(--font-tech)',
            fontSize: '0.62rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            padding: '4px 8px',
            letterSpacing: '0.05em',
          }}
        >
          WORKSTATION
        </div>

        <button
          className={`palette-item ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => onSelectTab('library')}
          title="Library (Books & Documents)"
          style={{ position: 'relative' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} />
            <span className="sidebar-label" style={{ fontSize: 'var(--text-xs)' }}>Library</span>
          </div>
          <span className="badge">{documentCount}</span>
        </button>

        <button
          className={`palette-item ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => onSelectTab('notes')}
          title="Notes Vault"
          style={{ position: 'relative' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} />
            <span className="sidebar-label" style={{ fontSize: 'var(--text-xs)' }}>Notes Vault</span>
          </div>
          <span className="badge">{noteCount}</span>
        </button>

        <button
          className={`palette-item ${activeTab === 'graph' ? 'active' : ''}`}
          onClick={() => onSelectTab('graph')}
          title="Knowledge Graph"
          style={{ position: 'relative' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={16} />
            <span className="sidebar-label" style={{ fontSize: 'var(--text-xs)' }}>Knowledge Graph</span>
          </div>
        </button>

        <button
          className={`palette-item ${activeTab === 'cloud' ? 'active' : ''}`}
          onClick={() => onSelectTab('cloud')}
          title="Multi-Cloud Storage"
          style={{ position: 'relative' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cloud size={16} />
            <span className="sidebar-label" style={{ fontSize: 'var(--text-xs)' }}>Multi-Cloud</span>
          </div>
          <span className="badge">{cloudCount}</span>
        </button>
      </div>

      {/* Bottom Section: Settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', width: '100%' }}>
        <button
          className={`palette-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
          title="Settings & System Configuration"
          style={{ position: 'relative' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={16} />
            <span className="sidebar-label" style={{ fontSize: 'var(--text-xs)' }}>Settings</span>
          </div>
        </button>
      </div>
    </aside>
  );
};
