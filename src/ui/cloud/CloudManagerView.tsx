import React, { useState } from 'react';
import {
  Cloud,
  HardDrive,
  Plus,
  RefreshCw,
  Check,
  AlertCircle,
  Shield,
  Trash2,
  ExternalLink,
  Layers,
  Key,
  Server,
} from 'lucide-react';
import { CloudConnection, StorageProviderType } from '../../core/types';
import { db } from '../../core/db/DatabaseEngine';
import { usePlatform } from '../../platform/PlatformContext';

interface CloudManagerViewProps {
  connections: CloudConnection[];
  onConnectionsUpdated: () => void;
}

export const CloudManagerView: React.FC<CloudManagerViewProps> = ({
  connections,
  onConnectionsUpdated,
}) => {
  const platform = usePlatform();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<StorageProviderType>('gdrive');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSaveProvider = async () => {
    const id = `conn_${Date.now()}`;
    const name = customName || selectedType.toUpperCase() + ' Storage';

    if (customApiKey) {
      await platform.secureStorage.setSecret(`librix_cloud_${id}_key`, customApiKey);
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
      config: { endpointUrl: customUrl || undefined },
    };

    await db.saveCloudConnection(newConn);
    onConnectionsUpdated();
    setShowAddModal(false);
    setCustomName('');
    setCustomUrl('');
    setCustomApiKey('');
  };

  const handleDeleteConnection = async (id: string) => {
    if (confirm('Disconnect this storage account? (No local files will be deleted)')) {
      await db.deleteCloudConnection(id);
      await platform.secureStorage.deleteSecret(`librix_cloud_${id}_key`);
      onConnectionsUpdated();
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 1200));
    setIsSyncing(false);
    onConnectionsUpdated();
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-5)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-app)',
        }}
      >
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '0.04em' }}>
            MULTI-CLOUD STORAGE ACCOUNTS
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Universal storage aggregator across Local Flash, Google Drive, MEGA, Telegram, and Custom endpoints.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleTriggerSync} disabled={isSyncing}>
            <RefreshCw size={13} className={isSyncing ? 'spinning' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync All'}</span>
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <Plus size={13} />
            <span>Connect Provider</span>
          </button>
        </div>
      </div>

      {/* Cloud Accounts List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {connections.map(conn => {
            const used = conn.quotaUsed || 0;
            const total = conn.quotaTotal || 1;
            const percentage = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

            return (
              <div key={conn.id} className="card card-elevated scifi-box" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {conn.providerType === 'local' ? <HardDrive size={18} /> : <Cloud size={18} />}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{conn.name}</div>
                      <div style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                        {conn.accountEmail || conn.providerType.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <span className="badge">CONNECTED</span>
                </div>

                {/* Quota Progress */}
                {total > 0 ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <span>{formatBytes(used)}</span>
                      <span>{formatBytes(total)}</span>
                    </div>
                    <div style={{ width: '100%', height: 4, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--text-primary)' }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)' }}>
                    {formatBytes(used)} (Unlimited Stream)
                  </div>
                )}

                {/* Footer Controls */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                  {!conn.isDefault && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => handleDeleteConnection(conn.id)}
                    >
                      <Trash2 size={12} />
                      <span>Disconnect</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connect Storage Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 460 }}>
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
                  <option value="telegram">Telegram Private Vault (Bot / Channel)</option>
                  <option value="mega">MEGA Encrypted Storage</option>
                  <option value="terabox">TeraBox Cloud</option>
                  <option value="custom">Custom WebDAV / REST Endpoint</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Connection Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Google Drive Sync"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                />
              </div>

              {selectedType === 'custom' && (
                <div className="form-group">
                  <label className="form-label">Server Endpoint URL</label>
                  <input
                    type="text"
                    placeholder="https://storage.mycorp.internal/dav"
                    value={customUrl}
                    onChange={e => setCustomUrl(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">API Key / Token (Saved in Keyring)</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••"
                  value={customApiKey}
                  onChange={e => setCustomApiKey(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
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
