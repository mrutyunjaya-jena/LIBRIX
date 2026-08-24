import React from 'react';
import {
  Search,
  Sparkles,
  Sun,
  Moon,
  RefreshCw,
  Cpu,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { usePlatform } from '../../platform/PlatformContext';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onOpenLibris: () => void;
  activeTheme: 'dark' | 'light';
  onToggleTheme: () => void;
  isSyncing: boolean;
  onTriggerSync: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCommandPalette,
  onOpenLibris,
  activeTheme,
  onToggleTheme,
  isSyncing,
  onTriggerSync,
}) => {
  const platform = usePlatform();

  return (
    <header
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-4)',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-subtle)',
        userSelect: 'none',
        zIndex: 40,
      }}
    >
      {/* Sci-Fi Brand Logo & Platform Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div
          className="scifi-glitch-hover"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.05rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              border: '2px solid var(--text-primary)',
              transform: 'rotate(45deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 4, height: 4, background: 'var(--text-primary)' }} />
          </div>
          <span>LIBRIX</span>
        </div>

        <span className="badge" style={{ fontSize: '0.62rem', letterSpacing: '0.04em' }}>
          {platform.platform.os.toUpperCase()} // SYS
        </span>
      </div>

      {/* Global Quick Search / Command Launcher */}
      <div
        onClick={onOpenCommandPalette}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 12px',
          width: '100%',
          maxWidth: 380,
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-xs)',
          transition: 'all var(--transition-fast)',
        }}
        className="card-interactive"
      >
        <Search size={13} />
        <span style={{ flex: 1 }}>Search library, notes, commands...</span>
        <span className="palette-shortcut">Ctrl+K</span>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        {/* Sync Trigger */}
        <button
          className={`btn-icon btn-sm ${isSyncing ? 'active' : ''}`}
          onClick={onTriggerSync}
          title={isSyncing ? 'Syncing...' : 'Sync Storage'}
        >
          <RefreshCw size={14} className={isSyncing ? 'spinning' : ''} />
        </button>

        {/* Strict 2-Theme Switcher (Dark <-> Light) */}
        <button
          className="btn-icon btn-sm"
          onClick={onToggleTheme}
          title={activeTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {activeTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Libris AI Assistant Button */}
        <button
          className="btn btn-primary btn-sm"
          onClick={onOpenLibris}
          title="Open Libris AI Research Assistant"
        >
          <Sparkles size={13} />
          <span>Libris AI</span>
        </button>
      </div>
    </header>
  );
};
