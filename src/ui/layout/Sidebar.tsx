import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  Share2,
  Cloud,
  Settings,
  HardDrive,
} from 'lucide-react';
import { storageRegistry } from '../../storage/StorageRegistry';

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
  const [storageLeftText, setStorageLeftText] = useState('Calculating...');
  const [usedPercent, setUsedPercent] = useState(1);

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let b = bytes;
    while (b >= 1024 && i < units.length - 1) {
      b /= 1024;
      i++;
    }
    return `${b.toFixed(2)} ${units[i]}`;
  };

  useEffect(() => {
    const updateQuota = async () => {
      try {
        const local = storageRegistry.getProvider('local');
        if (local) {
          const q = await local.getQuota();
          setStorageLeftText(`${formatBytes(q.free)} Left`);
          if (q.total > 0) {
            setUsedPercent(Math.max(2, Math.min(100, Math.round((q.used / q.total) * 100))));
          }
        }
      } catch {
        // fallback
      }
    };

    updateQuota();
  }, [documentCount]);

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

      {/* Bottom Section: Live Storage Left Monitor & Settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
        {/* Real-time Storage Remaining Monitor Pill */}
        <div
          onClick={() => onSelectTab('cloud')}
          title="Click to view disk quota and cloud storage"
          style={{
            background: 'var(--bg-input)',
            padding: '6px 8px',
            borderRadius: 'var(--radius-xs)',
            cursor: 'pointer',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <HardDrive size={11} color="var(--text-secondary)" />
              <span style={{ fontFamily: 'var(--font-tech)', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {storageLeftText}
              </span>
            </div>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>
              FREE
            </span>
          </div>

          {/* Mini Capacity Bar */}
          <div style={{ width: '100%', height: 3, background: 'var(--bg-surface)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${usedPercent}%`, height: '100%', background: 'var(--text-primary)' }} />
          </div>
        </div>

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
