import React from 'react';
import { GitCompare, Check, Copy, ArrowRight } from 'lucide-react';
import { SyncConflict } from '../../core/types';

interface ConflictResolutionModalProps {
  conflict: SyncConflict;
  onResolve: (resolution: 'local' | 'cloud' | 'copy') => void;
  onCancel: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  conflict,
  onResolve,
  onCancel,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 580 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <GitCompare size={20} color="var(--warning)" />
            <h3 className="modal-title">Sync Conflict Detected</h3>
          </div>
          <button className="btn-icon btn-sm" onClick={onCancel}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Changes were made to <strong>{conflict.documentTitle}</strong> simultaneously on this device and in the cloud. How would you like to resolve this conflict?
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', margin: 'var(--space-2) 0' }}>
            {/* Local Version Card */}
            <div className="card" style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-input)' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--brand-400)', marginBottom: 8 }}>
                💻 LOCAL VERSION
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>Modified: <strong>{new Date(conflict.localVersion.modifiedAt).toLocaleTimeString()}</strong></div>
                <div>Size: {(conflict.localVersion.size / 1024).toFixed(1)} KB</div>
                <div>Hash: {conflict.localVersion.hash}</div>
              </div>
            </div>

            {/* Cloud Version Card */}
            <div className="card" style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-input)' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#ec4899', marginBottom: 8 }}>
                ☁️ CLOUD VERSION
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>Modified: <strong>{new Date(conflict.cloudVersion.modifiedAt).toLocaleTimeString()}</strong></div>
                <div>Size: {(conflict.cloudVersion.size / 1024).toFixed(1)} KB</div>
                <div>Hash: {conflict.cloudVersion.hash}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" onClick={onCancel}>
            Dismiss
          </button>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onResolve('copy')}>
              <Copy size={13} />
              Create Copy
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onResolve('cloud')}>
              Keep Cloud
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => onResolve('local')}>
              Keep Local
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
