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
    <div className="modal-overlay">
      <div
        className="modal-content scifi-box"
        style={{
          maxWidth: 580,
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-elevated)',
          padding: 'var(--space-8)',
          textAlign: 'center',
        }}
      >
        {/* Step 1: Welcome Hero */}
        {step === 'welcome' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-5)' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--btn-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--btn-primary-text)',
                border: '1px solid var(--border-medium)',
              }}
            >
              <BookOpen size={32} />
            </div>

            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 800, letterSpacing: '0.06em', marginBottom: 8 }}>
                LIBRIX // WORKSTATION
              </h1>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 420 }}>
                <p>Universal Library.</p>
                <p>Personal Knowledge Vault.</p>
                <p>Document-Aware Local AI.</p>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                  Zero telemetry. Zero lock-in.
                </p>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-input)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Shield size={14} />
              <span>Running on {platform.platform.os.toUpperCase()} with Hardware Keyring encryption</span>
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
              onClick={() => setStep('choice')}
            >
              <span>Initialize Workstation</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Step 2: Storage Choice (Local vs Cloud) */}
        {step === 'choice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700 }}>
                STORAGE ARCHITECTURE
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4 }}>
                Librix gives you full sovereignty over where your library is stored.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              {/* Option A: Local */}
              <div
                className="card card-interactive scifi-box"
                onClick={() => setStep('local_setup')}
                style={{
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <HardDrive size={36} />
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
                  LOCAL STORAGE
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Store all books, notes, and indexes directly on your device filesystem.
                </p>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 'auto' }}>
                  Select Local Folder
                </button>
              </div>

              {/* Option B: Multi-Cloud */}
              <div
                className="card card-interactive scifi-box"
                onClick={() => setStep('cloud_setup')}
                style={{
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <Cloud size={36} />
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
                  MULTI-CLOUD
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Connect Google Drive, MEGA, Telegram, or custom cloud endpoints.
                </p>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 'auto' }}>
                  Connect Cloud
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Local Setup */}
        {step === 'local_setup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700 }}>
                CONFIGURE LOCAL VAULT
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4 }}>
                Choose where your library documents and notes will live.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div
                className="card card-interactive"
                onClick={handleSelectLocalFolder}
                style={{
                  padding: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  border: selectedFolder ? '1px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                }}
              >
                <FolderOpen size={22} />
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {selectedFolder ? 'Selected: ' + selectedFolder : 'Select Existing Folder'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Scan and index your current ebook or documents folder.
                  </div>
                </div>
              </div>

              <div
                className="card card-interactive"
                onClick={handleCreateNewFolder}
                style={{
                  padding: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <FolderPlus size={22} />
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    Create New Dedicated Librix Vault
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Initializes a structured folder with books, notes, and annotations.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)' }}>
              <button className="btn btn-ghost" onClick={() => setStep('choice')}>
                Back
              </button>
              <button className="btn btn-primary" onClick={onComplete}>
                Continue to Workstation
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Cloud Setup */}
        {step === 'cloud_setup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700 }}>
                CONNECT STORAGE BACKENDS
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4 }}>
                Select cloud services you want to sync with. You can add more anytime in Settings.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              {['Google Drive', 'Telegram Stream', 'MEGA Encrypted', 'TeraBox'].map(p => {
                const isSelected = connectedClouds.includes(p);
                return (
                  <div
                    key={p}
                    className="card card-interactive"
                    onClick={() => toggleCloudProvider(p)}
                    style={{
                      padding: 'var(--space-4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: isSelected ? '1px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{p}</span>
                    <span className="badge">{isSelected ? 'CONNECTED' : 'DISCONNECTED'}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)' }}>
              <button className="btn btn-ghost" onClick={() => setStep('choice')}>
                Back
              </button>
              <button className="btn btn-primary" onClick={onComplete}>
                Continue to Workstation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
