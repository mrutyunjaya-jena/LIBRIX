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
    <nav className="app-adaptive-bottom-nav">
      <button
        className="btn-ghost"
        onClick={() => onSelectTab('library')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          color: activeTab === 'library' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.65rem',
          fontFamily: 'var(--font-sans)',
          minWidth: 48,
          minHeight: 44,
          padding: '4px 2px',
        }}
      >
        <BookOpen size={18} />
        <span style={{ fontWeight: activeTab === 'library' ? 600 : 400 }}>Library</span>
      </button>

      <button
        className="btn-ghost"
        onClick={() => onSelectTab('notes')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          color: activeTab === 'notes' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.65rem',
          fontFamily: 'var(--font-sans)',
          minWidth: 48,
          minHeight: 44,
          padding: '4px 2px',
        }}
      >
        <FileText size={18} />
        <span style={{ fontWeight: activeTab === 'notes' ? 600 : 400 }}>Notes</span>
      </button>

      {/* Floating Center Libris AI Trigger */}
      {onOpenLibris && (
        <button
          onClick={onOpenLibris}
          title="Ask Libris AI"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            transform: 'translateY(-10px)',
            border: '3px solid var(--bg-surface-elevated)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Sparkles size={18} />
        </button>
      )}

      <button
        className="btn-ghost"
        onClick={() => onSelectTab('cloud')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          color: activeTab === 'cloud' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.65rem',
          fontFamily: 'var(--font-sans)',
          minWidth: 48,
          minHeight: 44,
          padding: '4px 2px',
        }}
      >
        <Cloud size={18} />
        <span style={{ fontWeight: activeTab === 'cloud' ? 600 : 400 }}>Clouds</span>
      </button>

      <button
        className="btn-ghost"
        onClick={() => onSelectTab('settings')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          color: activeTab === 'settings' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.65rem',
          fontFamily: 'var(--font-sans)',
          minWidth: 48,
          minHeight: 44,
          padding: '4px 2px',
        }}
      >
        <Settings size={18} />
        <span style={{ fontWeight: activeTab === 'settings' ? 600 : 400 }}>Settings</span>
      </button>
    </nav>
  );
};
