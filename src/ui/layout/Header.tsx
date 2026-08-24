import React from 'react';
import {
  Search,
  Sparkles,
  Command,
  Sun,
  Moon,
  Coffee,
  Eye,
  RefreshCw,
  Laptop,
  Smartphone,
  Globe,
  Bell,
} from 'lucide-react';
import { usePlatform } from '../../platform/PlatformContext';

interface HeaderProps {
  onOpenPalette: () => void;
  onOpenLibris: () => void;
  currentTheme: string;
  onToggleTheme: (theme: string) => void;
  isSyncing: boolean;
  onTriggerSync: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenPalette,
  onOpenLibris,
  currentTheme,
  onToggleTheme,
  isSyncing,
  onTriggerSync,
}) => {
  const platform = usePlatform();

  const cycleTheme = () => {
    const themes = ['dark', 'light', 'sepia', 'high-contrast'];
    const nextIdx = (themes.indexOf(currentTheme) + 1) % themes.length;
    onToggleTheme(themes[nextIdx]);
  };

  const getPlatformIcon = () => {
    if (platform.platform.isMobile) return <Smartphone size={13} />;
    if (platform.platform.isDesktop) return <Laptop size={13} />;
    return <Globe size={13} />;
  };

  return (
    <header
      style={{
        height: 56,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-4)',
        zIndex: 40,
      }}
    >
      {/* Search & Command Palette Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, maxWidth: 440 }}>
        <button
          onClick={onOpenPalette}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 12px',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            transition: 'border-color var(--transition-fast)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Search size={15} />
            <span>Search library, notes, authors...</span>
          </div>
          <div className="palette-shortcut" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Command size={11} /> K
          </div>
        </button>
      </div>

      {/* Right Utility & Status Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {/* Platform Indicator */}
        <div
          className="badge badge-cloud"
          style={{
            textTransform: 'uppercase',
            fontSize: '0.68rem',
            letterSpacing: '0.04em',
            padding: '4px 8px',
          }}
        >
          {getPlatformIcon()}
          <span>{platform.platform.os}</span>
        </div>

        {/* Sync Trigger */}
        <button
          className={`btn-icon ${isSyncing ? 'active' : ''}`}
          onClick={onTriggerSync}
          title={isSyncing ? 'Synchronizing with cloud...' : 'Sync Multi-Cloud Storage'}
          style={{ position: 'relative' }}
        >
          <RefreshCw size={17} style={{ animation: isSyncing ? 'spin 1.2s linear infinite' : 'none' }} />
        </button>

        {/* Theme Cycler */}
        <button
          className="btn-icon"
          onClick={cycleTheme}
          title={`Current theme: ${currentTheme}. Click to cycle.`}
        >
          {currentTheme === 'dark' && <Moon size={17} />}
          {currentTheme === 'light' && <Sun size={17} />}
          {currentTheme === 'sepia' && <Coffee size={17} />}
          {currentTheme === 'high-contrast' && <Eye size={17} />}
        </button>

        {/* Libris AI Button */}
        <button
          className="btn btn-primary"
          onClick={onOpenLibris}
          style={{ padding: '6px 14px', fontSize: 'var(--text-xs)' }}
        >
          <Sparkles size={14} />
          <span>Libris</span>
        </button>
      </div>
    </header>
  );
};
