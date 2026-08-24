import React from 'react';
import { BookOpen, FileText, Network, Cloud, Settings, Sparkles } from 'lucide-react';
import { NavTab } from './Sidebar';

interface MobileNavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenLibris: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenLibris,
}) => {
  return (
    <nav
      style={{
        height: 60,
        background: 'var(--bg-surface-elevated)',
        borderTop: '1px solid var(--border-medium)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 var(--space-2)',
        zIndex: 50,
      }}
    >
      <button
        className="btn-ghost"
        onClick={() => onSelectTab('library')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: activeTab === 'library' ? 'var(--brand-400)' : 'var(--text-muted)',
          fontSize: '0.68rem',
        }}
      >
        <BookOpen size={18} />
        <span>Library</span>
      </button>

      <button
        className="btn-ghost"
        onClick={() => onSelectTab('notes')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: activeTab === 'notes' ? 'var(--brand-400)' : 'var(--text-muted)',
          fontSize: '0.68rem',
        }}
      >
        <FileText size={18} />
        <span>Notes</span>
      </button>

      {/* Floating Center Libris Trigger */}
      <button
        onClick={onOpenLibris}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--brand-gradient)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--brand-glow)',
          transform: 'translateY(-10px)',
          border: '2px solid var(--bg-surface-elevated)',
        }}
      >
        <Sparkles size={20} />
      </button>

      <button
        className="btn-ghost"
        onClick={() => onSelectTab('graph')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: activeTab === 'graph' ? 'var(--brand-400)' : 'var(--text-muted)',
          fontSize: '0.68rem',
        }}
      >
        <Network size={18} />
        <span>Graph</span>
      </button>

      <button
        className="btn-ghost"
        onClick={() => onSelectTab('cloud')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: activeTab === 'cloud' ? 'var(--brand-400)' : 'var(--text-muted)',
          fontSize: '0.68rem',
        }}
      >
        <Cloud size={18} />
        <span>Clouds</span>
      </button>
    </nav>
  );
};
