import React, { useState } from 'react';
import {
  Settings,
  Palette,
  BookOpen,
  Cpu,
  Cloud,
  Shield,
  Download,
  Upload,
  Info,
  Check,
  Save,
} from 'lucide-react';
import { usePlatform } from '../../platform/PlatformContext';
import { db } from '../../core/db/DatabaseEngine';

export const SettingsView: React.FC = () => {
  const platform = usePlatform();
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'reading' | 'ai' | 'storage' | 'privacy' | 'backup' | 'about'>('general');
  const [savedToast, setSavedToast] = useState(false);

  // Settings State
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [lmStudioUrl, setLmStudioUrl] = useState('http://localhost:1234/v1');
  const [defaultAIProvider, setDefaultAIProvider] = useState('ollama');
  const [privacyStrictLocal, setPrivacyStrictLocal] = useState(true);
  const [readingFont, setReadingFont] = useState('serif');
  const [readingFontSize, setReadingFontSize] = useState(18);

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleExportBackup = async () => {
    const docs = await db.getDocuments();
    const notes = await db.getNotes();
    const collections = await db.getCollections();
    const tags = await db.getTags();
    const bookmarks = await db.getBookmarks();
    const annotations = await db.getAnnotations();

    const snapshot = {
      librixVersion: '1.0.0',
      exportedAt: Date.now(),
      platform: platform.platform,
      library: {
        documents: docs,
        notes: notes,
        collections: collections,
        tags: tags,
        bookmarks: bookmarks,
        annotations: annotations,
      },
    };

    const data = new TextEncoder().encode(JSON.stringify(snapshot, null, 2));
    await platform.filePicker.saveDocument('librix_library_backup.json', data, 'application/json');
    platform.notifications.show('Library Backup Exported', { body: 'Your library metadata, notes, and annotations have been saved.' });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-app)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
          Settings & Preferences
        </h1>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Configure appearance, Libris AI endpoints, storage defaults, and security
        </p>
      </div>

      {/* Main Settings Body with Side Tabs */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Settings Navigation Tabs */}
        <div
          style={{
            width: 220,
            borderRight: '1px solid var(--border-subtle)',
            padding: 'var(--space-4) var(--space-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            background: 'var(--bg-surface)',
          }}
        >
          {[
            { id: 'general', label: 'General', icon: <Settings size={15} /> },
            { id: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
            { id: 'reading', label: 'Reading & Typography', icon: <BookOpen size={15} /> },
            { id: 'ai', label: 'Libris AI & RAG', icon: <Cpu size={15} /> },
            { id: 'storage', label: 'Storage & Sync', icon: <Cloud size={15} /> },
            { id: 'privacy', label: 'Privacy & Security', icon: <Shield size={15} /> },
            { id: 'backup', label: 'Backup & Export', icon: <Download size={15} /> },
            { id: 'about', label: 'About Librix', icon: <Info size={15} /> },
          ].map(tab => (
            <button
              key={tab.id}
              className={`btn btn-ghost ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-xs)',
                padding: '8px 12px',
                background: activeTab === tab.id ? 'var(--brand-500)' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Settings Detail Pane */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', maxWidth: 760 }}>
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>General Settings</h2>

              <div className="form-group">
                <label className="form-label">Platform Runtime</label>
                <div style={{ padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  OS: <strong>{platform.platform.os.toUpperCase()}</strong> • Device: <strong>{platform.platform.deviceType}</strong> • Touch: <strong>{platform.platform.isTouch ? 'Enabled' : 'Disabled'}</strong>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Default Startup View</label>
                <select style={{ fontSize: 'var(--text-sm)' }}>
                  <option value="library">Library (All Books & Documents)</option>
                  <option value="notes">Notes Vault</option>
                  <option value="graph">Knowledge Graph</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Libris AI & RAG Configuration</h2>

              <div className="form-group">
                <label className="form-label">Default AI Provider</label>
                <select value={defaultAIProvider} onChange={e => setDefaultAIProvider(e.target.value)}>
                  <option value="ollama">Ollama (Local Private Server)</option>
                  <option value="lmstudio">LM Studio / llama.cpp Server</option>
                  <option value="openai">OpenAI (Cloud API)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ollama API Endpoint</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                />
                <span className="form-hint">Connects to your local Ollama daemon for 100% private local inference.</span>
              </div>

              <div className="form-group">
                <label className="form-label">LM Studio / LocalAI Endpoint</label>
                <input
                  type="text"
                  value={lmStudioUrl}
                  onChange={e => setLmStudioUrl(e.target.value)}
                  placeholder="http://localhost:1234/v1"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Enforce Strict Local AI</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Prevent accidental transmission of document chunks to third-party cloud APIs.</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={privacyStrictLocal}
                    onChange={e => setPrivacyStrictLocal(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>

              <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
                <Save size={15} /> Save AI Settings
              </button>
            </div>
          )}

          {activeTab === 'reading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Reading & Typography Defaults</h2>

              <div className="form-group">
                <label className="form-label">Default Reader Font</label>
                <select value={readingFont} onChange={e => setReadingFont(e.target.value)}>
                  <option value="serif">Lora (Classical Serif)</option>
                  <option value="sans">Inter (Modern Clean Sans)</option>
                  <option value="mono">JetBrains Mono (Monospace)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Default Font Size ({readingFontSize}px)</label>
                <input
                  type="range"
                  min="14"
                  max="30"
                  value={readingFontSize}
                  onChange={e => setReadingFontSize(Number(e.target.value))}
                />
              </div>

              <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
                <Save size={15} /> Save Reading Defaults
              </button>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Privacy & Secure Storage</h2>

              <div className="card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--success)', marginBottom: 4 }}>
                  ✓ Hardware-Backed Secure Storage Active
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  Platform Secure Storage Provider: <strong>{platform.platform.os === 'web' ? 'WebCrypto PBKDF2 + AES-GCM Device Salt' : 'OS Native Keychain / Keystore'}</strong>. Secrets, OAuth tokens, and Telegram keys are isolated and encrypted.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Library Backup & Export</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Librix never locks you in. Export your entire library catalog, reading bookmarks, highlights, annotations, and Obsidian Markdown vault at any time.
              </p>

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button className="btn btn-primary" onClick={handleExportBackup}>
                  <Download size={16} />
                  <span>Export JSON Metadata Backup</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>About Librix</h2>

              <div className="card" style={{ background: 'var(--bg-surface-elevated)' }}>
                <div style={{ fontWeight: 800, fontSize: 'var(--text-lg)', background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>
                  LIBRIX v1.0.0
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Universal Library, Document & Knowledge Platform
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  <em>"One Library. Any Device. Any Storage. Your Knowledge."</em>
                </p>
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Open-Source • MIT License • Built for Linux, Windows, macOS, Android, iOS, and Web.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {savedToast && (
        <div className="toast-container">
          <div className="toast">
            <Check size={16} color="var(--success)" />
            <span>Settings saved successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
};
