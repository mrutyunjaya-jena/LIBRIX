import React from 'react';
import { AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';
import { Document } from '../../core/types';

interface DeleteSafetyModalProps {
  document: Document;
  onCancel: () => void;
  onMoveToTrash: () => void;
  onDeletePermanently: () => void;
}

export const DeleteSafetyModal: React.FC<DeleteSafetyModalProps> = ({
  document,
  onCancel,
  onMoveToTrash,
  onDeletePermanently,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 460 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--danger)' }}>
            <AlertTriangle size={20} />
            <h3 className="modal-title">Delete this item?</h3>
          </div>
          <button className="btn-icon btn-sm" onClick={onCancel}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div
            style={{
              background: 'var(--bg-input)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: 6, color: 'var(--text-primary)' }}>
              {document.title}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div><strong>Filename:</strong> {document.filename}</div>
              <div><strong>Provider:</strong> {document.storageProvider.toUpperCase()}</div>
              <div><strong>Location:</strong> {document.storagePath}</div>
              <div><strong>Size:</strong> {(document.size / (1024 * 1024)).toFixed(2)} MB</div>
            </div>
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Moving to Trash allows restoring this document anytime. Deleting permanently removes it from your storage provider without recovery.
          </p>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {!document.isTrash && (
              <button className="btn btn-secondary" onClick={onMoveToTrash}>
                Move to Trash
              </button>
            )}

            <button className="btn btn-danger" onClick={onDeletePermanently}>
              <Trash2 size={14} />
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
