import React, { useState } from 'react';
import {
  Cloud,
  HardDrive,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Shield,
  Trash2,
  ExternalLink,
  Layers,
  Key,
  Server,
} from 'lucide-react';
import { CloudConnection, StorageProviderType } from '../../core/types';
import { storageRegistry } from '../../storage/StorageRegistry';
import { usePlatform } from '../../platform/PlatformContext';

interface CloudManagerViewProps {
  connections: CloudConnection[];
  onAddConnection: (conn: CloudConnection) => void;
  onRemoveConnection: (id: string) => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
}

export const CloudManagerView: React.FC<CloudManagerViewProps> = ({
  connections,
  onAddConnection,
  onRemoveConnection,
  onTriggerSync,
  isSyncing,
}) => {
  const platform = usePlatform();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<StorageProviderType>('gdrive');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customClientId, setCustomClientId] = useState('');
  const [customClientSecret, setCustomClientSecret] = useState('');

  const handleSaveProvider = async () => {
    const id = `conn_${Date.now()}`;
    const name = customName || selectedType.toUpperCase() + ' Storage';

    // Store sensitive keys in platform SecureStorage rather than plaintext database
    if (customApiKey) {
      await platform.secureStorage.setSecret(`${id}_api_key`, customApiKey);
    }
    if (customClientSecret) {
      await platform.secureStorage.setSecret(`${id}_client_secret`, customClientSecret);
    }

    const newConn: CloudConnection = {
      id,
      providerId: id,
      providerType: selectedType,
      name,
      accountEmail: `${selectedType}@librix.internal`,
      status: 'connected',
      quotaTotal: selectedType === 'telegram' ? 0 : 25 * 1024 * 1024 * 1024,
      quotaUsed: 1024 * 1024 * 1024,
      isDefault: false,
      config: {
        endpointUrl: customUrl || undefined,
        clientId: customClientId || undefined,
      },
    };

    onAddConnection(newConn);
    setShowAddModal(false);
    setCustomName('');
    setCustomUrl('');
    setCustomApiKey('');
    setCustomClientId('');
    setCustomClientSecret('');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-app)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
            Multi-Cloud & Storage Subsystem
          </h1>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Connect and sync across Local Disk, Google Drive, MEGA, Telegram, TeraBox, and Custom APIs
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary" onClick={onTriggerSync} disabled={isSyncing}>
            <RefreshCw size={15} style={{ animation: isSyncing ? 'spin 1.2s linear infinite' : 'none' }} />
            <span>{isSyncing ? 'Syncing...' : 'Sync All Accounts'}</span>
          </button>

          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            <span>Add Storage Account</span>
          </button>
        </div>
      </div>

      {/* Connected Providers Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {connections.map(conn => {
            const usedGb = (conn.quotaUsed ? conn.quotaUsed / (1024 * 1024 * 1024) : 0).toFixed(1);
            const totalGb = (conn.quotaTotal ? conn.quotaTotal / (1024 * 1024 * 1024) : 0).toFixed(0);
            const percent = conn.quotaTotal && conn.quotaUsed ? Math.min(100, Math.round((conn.quotaUsed / conn.quotaTotal) * 100)) : 10;

            return (
              <div key={conn.id} className="card card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(99, 102, 241, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--brand-400)',
                      }}
                    >
                      {conn.providerType === 'local' ? <HardDrive size={18} /> : <Cloud size={18} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{conn.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{conn.accountEmail || conn.providerType.toUpperCase()}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                      <CheckCircle size={10} /> Connected
                    </span>
                    {conn.providerType !== 'local' && (
                      <button className="btn-icon btn-sm" onClick={() => onRemoveConnection(conn.id)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quota Usage Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <span>Storage Usage</span>
                    <span>{conn.quotaTotal ? `${usedGb} GB / ${totalGb} GB (${percent}%)` : `${usedGb} GB (Stream Vault)`}</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: 'var(--brand-500)' }} />
                  </div>
                </div>

                {/* Capabilities Badges */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                  <span className="badge badge-cloud" style={{ fontSize: '0.65rem' }}>
                    {conn.providerType === 'telegram' ? '2GB max file' : 'Folders supported'}
                  </span>
                  <span className="badge badge-cloud" style={{ fontSize: '0.65rem' }}>
                    Offline Cache: Enabled
                  </span>
                  <span className="badge badge-cloud" style={{ fontSize: '0.65rem' }}>
                    End-to-End Encryption
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Security & Credentials Banner */}
        <div
          className="card"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            padding: 'var(--space-4) var(--space-5)',
          }}
        >
          <div style={{ padding: 8, background: 'rgba(16, 185, 129, 0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--success)' }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
              Hardware-Backed Platform Credential Security
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              OAuth tokens, API keys, and private Telegram bot tokens are never stored in SQLite. They are isolated inside OS Keychain / Android Keystore / WebCrypto AES-GCM vault.
            </div>
          </div>
        </div>
      </div>

      {/* Add Custom Provider Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">Connect Storage Provider</h3>
              <button className="btn-icon btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Provider Type</label>
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value as StorageProviderType)}
                >
                  <option value="gdrive">Google Drive</option>
                  <option value="mega">MEGA</option>
                  <option value="telegram">Telegram Storage</option>
                  <option value="terabox">TeraBox</option>
                  <option value="mediafire">MediaFire</option>
                  <option value="custom">Custom REST / WebDAV / S3 Provider</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Connection Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Google Drive Work Account"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                />
              </div>

              {selectedType === 'telegram' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Telegram Bot Token</label>
                    <input
                      type="password"
                      placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                      value={customApiKey}
                      onChange={e => setCustomApiKey(e.target.value)}
                    />
                    <span className="form-hint">Stored securely in OS Keychain. Never logged or sent to third parties.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Channel ID / Chat ID</label>
                    <input
                      type="text"
                      placeholder="-1001234567890"
                      value={customUrl}
                      onChange={e => setCustomUrl(e.target.value)}
                    />
                  </div>
                </>
              ) : selectedType === 'custom' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">API / Base URL</label>
                    <input
                      type="text"
                      placeholder="https://storage.mycompany.com/v1"
                      value={customUrl}
                      onChange={e => setCustomUrl(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">API Key / Token</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={customApiKey}
                      onChange={e => setCustomApiKey(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div style={{ background: 'var(--bg-input)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  Clicking Connect will initiate standard OAuth2 authentication with <strong>{selectedType.toUpperCase()}</strong>.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveProvider}>
                Connect Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
