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
    <header className="app-adaptive-header">
      {/* Sci-Fi Brand Logo & Platform Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
        <div
          className="scifi-glitch-hover"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(0.9rem, 3.5vw, 1.05rem)',
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
              width: 13,
              height: 13,
              border: '2px solid var(--text-primary)',
              transform: 'rotate(45deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{ width: 3.5, height: 3.5, background: 'var(--text-primary)' }} />
          </div>
          <span>LIBRIX</span>
        </div>

        <span className="badge sidebar-rail-hide" style={{ fontSize: '0.58rem', letterSpacing: '0.04em' }}>
          {platform.platform.os.toUpperCase()}
        </span>
      </div>

      {/* Global Quick Search / Command Launcher */}
      <div
        onClick={onOpenCommandPalette}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 8px',
          flex: '1 1 auto',
          maxWidth: 320,
          minWidth: 0,
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-xs)',
          transition: 'all var(--transition-fast)',
          margin: '0 4px',
        }}
        className="card-interactive"
        title="Search library, notes and documents (Ctrl+K)"
      >
        <Search size={13} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
          Search library, notes...
        </span>
        <span className="palette-shortcut sidebar-rail-hide">Ctrl+K</span>
      </div>

      {/* Action Controls (Always Visible on Android) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {/* Sync Trigger / Refresh Button */}
        <button
          className={`btn-icon btn-sm ${isSyncing ? 'active' : ''}`}
          onClick={onTriggerSync}
          title={isSyncing ? 'Syncing...' : 'Sync Storage'}
          aria-label="Sync Storage"
          style={{ flexShrink: 0, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <RefreshCw size={14} className={isSyncing ? 'spinning' : ''} />
        </button>

        {/* Strict 2-Theme Switcher (Dark <-> Light) */}
        <button
          className="btn-icon btn-sm"
          onClick={onToggleTheme}
          title={activeTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
          style={{ flexShrink: 0, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {activeTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Libris AI Assistant Button (Desktop Only • Mobile uses Bottom Bar) */}
        <button
          className="btn btn-primary btn-sm sidebar-rail-hide hide-on-mobile"
          onClick={onOpenLibris}
          title="Open Libris AI Research Assistant"
          aria-label="Open Libris AI"
          style={{ flexShrink: 0 }}
        >
          <Sparkles size={13} />
          <span>Libris AI</span>
        </button>
      </div>
    </header>
  );
};
