import React, { useState } from 'react';
import {
  BookOpen,
  HardDrive,
  Cloud,
  FolderPlus,
  FolderOpen,
  CheckCircle,
  ArrowRight,
  Shield,
  Sparkles,
} from 'lucide-react';
import { usePlatform } from '../../platform/PlatformContext';
import { storageRegistry } from '../../storage/StorageRegistry';

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
        className="modal-content"
        style={{
          maxWidth: 620,
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
                width: 72,
                height: 72,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--brand-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: 'var(--brand-glow)',
              }}
            >
              <BookOpen size={38} />
            </div>

            <div>
              <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
                Welcome to Librix
              </h1>
              <div style={{ fontSize: 'var(--text-md)', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 420 }}>
                <p>Your books.</p>
                <p>Your documents.</p>
                <p>Your knowledge.</p>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Your storage.</p>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-input)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
              }}
            >
              <Shield size={14} color="var(--success)" />
              <span>Privacy-First • Genuinely Cross-Platform • Zero Telemetry</span>
            </div>

            <button
              className="btn btn-primary btn-lg"
              onClick={() => setStep('choice')}
              style={{ marginTop: 'var(--space-2)' }}
            >
              Get Started
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2: Storage Choice */}
        {step === 'choice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 6 }}>
                Where would you like to store your library?
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                You have complete freedom. Choose a local storage directory or connect cloud storage.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              {/* Local Storage Option */}
              <div
                className="card card-interactive"
                onClick={() => setStep('local_setup')}
                style={{
                  padding: 'var(--space-6)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--brand-400)',
                  }}
                >
                  <HardDrive size={26} />
                </div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>💻 LOCAL STORAGE</h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Keep your books and notes offline on your device’s local filesystem.
                </p>
              </div>

              {/* Cloud Storage Option */}
              <div
                className="card card-interactive"
                onClick={() => setStep('cloud_setup')}
                style={{
                  padding: 'var(--space-6)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'rgba(236, 72, 153, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ec4899',
                  }}
                >
                  <Cloud size={26} />
                </div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>☁️ CLOUD STORAGE</h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Connect Google Drive, MEGA, Telegram, TeraBox, or custom endpoints.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Local Storage Setup */}
        {step === 'local_setup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 6 }}>
                Choose your Librix library location
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Target OS: <strong>{platform.platform.os.toUpperCase()}</strong>. Librix uses the platform abstraction for safe sandbox access.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <button
                className="btn btn-secondary btn-lg"
                onClick={handleCreateNewFolder}
                style={{ flexDirection: 'column', padding: 'var(--space-5)' }}
              >
                <FolderPlus size={24} style={{ color: 'var(--brand-400)' }} />
                <span>Create New Folder</span>
              </button>

              <button
                className="btn btn-secondary btn-lg"
                onClick={handleSelectLocalFolder}
                style={{ flexDirection: 'column', padding: 'var(--space-5)' }}
              >
                <FolderOpen size={24} style={{ color: 'var(--brand-400)' }} />
                <span>Select Existing Folder</span>
              </button>
            </div>

            {selectedFolder && (
              <div
                style={{
                  background: 'var(--bg-input)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <CheckCircle size={16} color="var(--success)" />
                  <span>Selected: <strong>{selectedFolder}</strong></span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
              <button className="btn btn-ghost" onClick={() => setStep('choice')}>Back</button>
              <button
                className="btn btn-primary"
                onClick={onComplete}
                disabled={!selectedFolder}
              >
                Continue to Library
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Cloud Storage Setup */}
        {step === 'cloud_setup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 4 }}>
                Connect Cloud Storage
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Connect your cloud accounts. You can add multiple providers simultaneously.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
              {['Google Drive', 'MEGA', 'Telegram', 'MediaFire', 'OneBox', 'TeraBox'].map(provider => {
                const isSelected = connectedClouds.includes(provider);
                return (
                  <div
                    key={provider}
                    onClick={() => toggleCloudProvider(provider)}
                    className="card card-interactive"
                    style={{
                      padding: 'var(--space-3)',
                      border: `1px solid ${isSelected ? 'var(--brand-500)' : 'var(--border-subtle)'}`,
                      background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? 'var(--success)' : 'var(--text-muted)' }} />
                    <span>{provider}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)' }}>
              <button className="btn btn-ghost" onClick={() => setStep('choice')}>Back</button>
              <button className="btn btn-primary" onClick={onComplete}>
                Continue to Library
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
