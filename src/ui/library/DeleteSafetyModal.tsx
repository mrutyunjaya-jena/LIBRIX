import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Document } from '../../core/types';

interface DeleteSafetyModalProps {
  document: Document;
  onClose: () => void;
  onConfirm: (docId: string, permanent: boolean) => void;
}

export const DeleteSafetyModal: React.FC<DeleteSafetyModalProps> = ({
  document,
  onClose,
  onConfirm,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content scifi-box" style={{ maxWidth: 460 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertTriangle size={18} />
            <h3 className="modal-title">Delete Document Confirmation</h3>
          </div>
          <button className="btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div
            style={{
              background: 'var(--bg-input)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: 6, color: 'var(--text-primary)' }}>
              {document.title}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-tech)' }}>
              <div><strong>FILENAME:</strong> {document.filename}</div>
              <div><strong>PROVIDER:</strong> {document.storageProvider.toUpperCase()}</div>
              <div><strong>LOCATION:</strong> {document.storagePath}</div>
              <div><strong>SIZE:</strong> {(document.size / (1024 * 1024)).toFixed(2)} MB</div>
            </div>
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Moving to Trash allows restoring this document anytime. Deleting permanently removes it from your storage provider without recovery.
          </p>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {!document.isTrash && (
              <button
                className="btn btn-secondary"
                onClick={() => onConfirm(document.id, false)}
              >
                Move to Trash
              </button>
            )}

            <button
              className="btn btn-danger"
              onClick={() => onConfirm(document.id, true)}
            >
              <Trash2 size={13} />
              <span>Delete Permanently</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
