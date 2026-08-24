import React, { useState } from 'react';
import {
  BookOpen,
  HardDrive,
  Cloud,
  FolderPlus,
  FolderOpen,
  Check,
  ArrowRight,
  Shield,
  Sparkles,
} from 'lucide-react';
import { usePlatform } from '../../platform/PlatformContext';

interface FirstRunOnboardingProps {
  onComplete: () => void;
}

export const FirstRunOnboarding: React.FC<FirstRunOnboardingProps> = ({ onComplete }) => {
  const platform = usePlatform();
  const [step, setStep] = useState<'welcome' | 'choice' | 'local_setup' | 'cloud_setup'>('welcome');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [connectedClouds, setConnectedClouds] = useState<string[]>([]);

  const handleSelectLocalFolder = async () => {
    const res = await platform.filePicker.pickFolder();
    if (res) {
      setSelectedFolder(res.path);
    } else {
      setSelectedFolder('/default_librix_vault');
    }
  };

  const handleCreateNewFolder = async () => {
    setSelectedFolder('/new_librix_library');
  };

  const toggleCloudProvider = (id: string) => {
    if (connectedClouds.includes(id)) {
      setConnectedClouds(connectedClouds.filter(c => c !== id));
    } else {
      setConnectedClouds([...connectedClouds, id]);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        padding: 'max(12px, var(--sal)) max(12px, var(--sar))',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="modal-content scifi-box"
        style={{
          maxWidth: 560,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-elevated)',
          padding: 'clamp(16px, 4vw, 28px)',
          textAlign: 'center',
          boxSizing: 'border-box',
          margin: 'auto',
        }}
      >
        {/* Step 1: Welcome Hero */}
        {step === 'welcome' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--btn-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--btn-primary-text)',
                border: '1px solid var(--border-medium)',
              }}
            >
              <BookOpen size={28} />
            </div>

            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.25rem, 5vw, 1.6rem)',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                LIBRIX // WORKSTATION
              </h1>
              <div
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  maxWidth: 420,
                  margin: '0 auto',
                }}
              >
                <p style={{ margin: '2px 0' }}>Universal Library & Reading Engine.</p>
                <p style={{ margin: '2px 0' }}>Personal Knowledge Vault.</p>
                <p style={{ margin: '2px 0' }}>Document-Aware Local AI.</p>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
                  Zero telemetry. 100% Sovereign.
                </p>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-input)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              <Shield size={14} style={{ flexShrink: 0 }} />
              <span style={{ overflowWrap: 'break-word', wordBreak: 'break-word', textAlign: 'left' }}>
                Running on {platform.platform.os.toUpperCase()} with Hardware Keyring encryption
              </span>
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ marginTop: 4, width: '100%', maxWidth: 320, justifyContent: 'center' }}
              onClick={() => setStep('choice')}
            >
              <span>Initialize Workstation</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Step 2: Storage Choice (Local vs Cloud) */}
        {step === 'choice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.1rem, 4.5vw, 1.35rem)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                STORAGE ARCHITECTURE
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                Librix gives you full sovereignty over where your library is stored.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-3)',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {/* Option A: Local */}
              <div
                className="card card-interactive scifi-box"
                onClick={() => setStep('local_setup')}
                style={{
                  padding: 'var(--space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--bg-input)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    marginBottom: 2,
                  }}
                >
                  <HardDrive size={24} />
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>
                  LOCAL STORAGE
                </h3>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '2px 0 10px 0' }}>
                  Store all books, notes, and indexes directly on your device filesystem.
                </p>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
                >
                  Select Local Folder
                </button>
              </div>

              {/* Option B: Google Drive Cloud */}
              <div
                className="card card-interactive scifi-box"
                onClick={() => setStep('cloud_setup')}
                style={{
                  padding: 'var(--space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--bg-input)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    marginBottom: 2,
                  }}
                >
                  <Cloud size={24} />
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>
                  GOOGLE DRIVE CLOUD
                </h3>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '2px 0 10px 0' }}>
                  Sync your library and notes across Android, tablet, and PC via Google Drive.
                </p>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
                >
                  Connect Google Drive
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep('welcome')}>
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Local Setup */}
        {step === 'local_setup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.1rem, 4.5vw, 1.35rem)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                CONFIGURE LOCAL VAULT
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                Choose where your library documents and notes will live.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div
                className="card card-interactive"
                onClick={handleSelectLocalFolder}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  border: selectedFolder ? '1px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                  background: selectedFolder ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <FolderOpen size={22} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedFolder ? 'Selected: ' + selectedFolder : 'Select Existing Folder'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Scan and index your current ebook or documents folder.
                  </div>
                </div>
              </div>

              <div
                className="card card-interactive"
                onClick={handleCreateNewFolder}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <FolderPlus size={22} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Create New Dedicated Librix Vault
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Initializes a structured folder with books, notes, and annotations.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep('choice')}>
                ← Back
              </button>
              <button className="btn btn-primary btn-sm" onClick={onComplete}>
                <span>Continue to Workstation</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Cloud Setup */}
        {step === 'cloud_setup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.1rem, 4.5vw, 1.35rem)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                CONNECT GOOGLE DRIVE
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                Synchronize your library books and note vault with Google Drive.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div
                className="card card-interactive scifi-box"
                onClick={() => toggleCloudProvider('Google Drive')}
                style={{
                  padding: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: connectedClouds.includes('Google Drive') ? '1px solid var(--text-primary)' : '1px solid var(--border-medium)',
                  background: connectedClouds.includes('Google Drive') ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-xs)',
                      background: 'var(--bg-input)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Cloud size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Google Drive Sync</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Official OAuth 2.0 • Bidirectional Library Sync
                    </div>
                  </div>
                </div>

                <span className={`badge ${connectedClouds.includes('Google Drive') ? 'badge-primary' : ''}`} style={{ fontSize: '0.65rem' }}>
                  {connectedClouds.includes('Google Drive') ? 'SELECTED' : 'TAP TO SELECT'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep('choice')}>
                ← Back
              </button>
              <button className="btn btn-primary btn-sm" onClick={onComplete}>
                <span>Continue to Workstation</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
