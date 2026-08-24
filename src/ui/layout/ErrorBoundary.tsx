import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Librix UI:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            width: '100vw',
            background: '#080808',
            color: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          <div
            className="card scifi-box"
            style={{
              maxWidth: 580,
              width: '100%',
              background: '#121212',
              border: '1px solid #333333',
              padding: '32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 20px 48px rgba(0,0,0,0.8)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '4px',
                background: '#222222',
                border: '1px solid #444444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f5f5f5',
              }}
            >
              <AlertTriangle size={24} />
            </div>

            <div>
              <h2 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.05em', marginBottom: 6 }}>
                SYS // RUNTIME EXCEPTION RECOVERED
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#888888', lineHeight: 1.5 }}>
                An unexpected exception was caught. Librix state protection prevented data corruption.
              </p>
            </div>

            {this.state.error && (
              <div
                style={{
                  width: '100%',
                  background: '#0a0a0a',
                  border: '1px solid #262626',
                  borderRadius: '4px',
                  padding: '12px',
                  textAlign: 'left',
                  fontSize: '0.72rem',
                  color: '#d4d4d4',
                  overflowX: 'auto',
                  maxHeight: 140,
                }}
              >
                <div><strong>ERROR:</strong> {this.state.error.toString()}</div>
                {this.state.errorInfo?.componentStack && (
                  <pre style={{ marginTop: 6, color: '#666666', whiteSpace: 'pre-wrap' }}>
                    {this.state.errorInfo.componentStack.slice(0, 300)}
                  </pre>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={this.handleReset}
                title="Clear local cached state and reload"
              >
                <Terminal size={13} />
                <span>Reset Cache & Reload</span>
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={this.handleReload}
              >
                <RefreshCw size={13} />
                <span>Reload Workstation</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
