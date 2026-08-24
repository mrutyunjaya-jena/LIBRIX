import React from 'react';
import { BookOpen, FileText, Share2, Cloud, Settings, Sparkles } from 'lucide-react';
import { NavTab } from './Sidebar';

interface MobileNavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenLibris?: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenLibris,
}) => {
  return (
    <nav
      style={{
        height: 56,
        background: 'var(--bg-surface-elevated)',
        borderTop: '1px solid var(--border-subtle)',
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
          color: activeTab === 'library' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.68rem',
        }}
      >
        <BookOpen size={17} />
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
          color: activeTab === 'notes' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.68rem',
        }}
      >
        <FileText size={17} />
        <span>Notes</span>
      </button>

      {/* Floating Center Libris Trigger */}
      {onOpenLibris && (
        <button
          onClick={onOpenLibris}
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            transform: 'translateY(-8px)',
            border: '2px solid var(--bg-surface-elevated)',
          }}
        >
          <Sparkles size={18} />
        </button>
      )}

      <button
        className="btn-ghost"
        onClick={() => onSelectTab('graph')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: activeTab === 'graph' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.68rem',
        }}
      >
        <Share2 size={17} />
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
          color: activeTab === 'cloud' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.68rem',
        }}
      >
        <Cloud size={17} />
        <span>Clouds</span>
      </button>
    </nav>
  );
};
