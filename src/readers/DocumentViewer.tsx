import React from 'react';
import { Document } from '../core/types';
import { EpubReader } from './EpubReader';
import { PdfReader } from './PdfReader';
import { MarkdownReader } from './MarkdownReader';
import { ArrowLeft, ExternalLink, FileQuestion, Download } from 'lucide-react';
import { usePlatform } from '../platform/PlatformContext';

interface DocumentViewerProps {
  document: Document;
  onClose: () => void;
  onProgressUpdate: (percentage: number, location: string) => void;
  onOpenLibris?: (selectedText?: string) => void;
  onNavigateWikilink?: (title: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  onClose,
  onProgressUpdate,
  onOpenLibris,
  onNavigateWikilink,
}) => {
  const platform = usePlatform();

  // EPUB
  if (document.format === 'epub' || document.format === 'mobi' || document.format === 'azw3') {
    return (
      <EpubReader
        document={document}
        onClose={onClose}
        onProgressUpdate={onProgressUpdate}
        onOpenLibris={onOpenLibris}
      />
    );
  }

  // PDF
  if (document.format === 'pdf') {
    return (
      <PdfReader
        document={document}
        onClose={onClose}
        onProgressUpdate={onProgressUpdate}
        onOpenLibris={onOpenLibris}
      />
    );
  }

  // Markdown / Plain Text
  if (document.format === 'markdown' || document.format === 'txt') {
    return (
      <MarkdownReader
        document={document}
        onClose={onClose}
        onProgressUpdate={onProgressUpdate}
        onOpenLibris={onOpenLibris}
        onNavigateWikilink={onNavigateWikilink}
      />
    );
  }

  // Universal Fallback for unsupported / exotic formats (Section 14: Unsupported formats must never crash the application)
  return (
    <div className="reader-container theme-dark">
      <header className="reader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button className="btn-icon" onClick={onClose} title="Back">
            <ArrowLeft size={18} />
          </button>
          <div className="reader-title-area">
            <div className="reader-doc-title">{document.title}</div>
            <div className="reader-chapter-title">{document.format.toUpperCase()} Document</div>
          </div>
        </div>
      </header>

      <div className="reader-viewport">
        <main className="reader-stage">
          <div
            className="card card-elevated"
            style={{
              maxWidth: 480,
              textAlign: 'center',
              padding: 'var(--space-8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-4)',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-400)',
              }}
            >
              <FileQuestion size={32} />
            </div>

            <div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 8 }}>
                {document.filename}
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                This file format (<strong>{document.format.toUpperCase()}</strong>) is stored in your {document.storageProvider.toUpperCase()} storage. You can open it in an external application or export it.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', width: '100%', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  platform.notifications.show('Opening Document', {
                    body: `Dispatching ${document.filename} to native OS handler.`,
                  });
                }}
              >
                <ExternalLink size={15} />
                Open Externally
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => {
                  platform.filePicker.saveDocument(
                    document.filename,
                    new TextEncoder().encode(document.contentSnippet || ''),
                    document.mimeType
                  );
                }}
              >
                <Download size={15} />
                Export File
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
