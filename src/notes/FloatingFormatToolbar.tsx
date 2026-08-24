import React from 'react';
import { Bold, Italic, Strikethrough, Code, Highlighter, Link, Sparkles } from 'lucide-react';

interface FloatingFormatToolbarProps {
  isVisible: boolean;
  position: { top: number; left: number };
  onApplyFormat: (prefix: string, suffix?: string) => void;
  onAskAiWithSelection?: () => void;
}

export const FloatingFormatToolbar: React.FC<FloatingFormatToolbarProps> = ({
  isVisible,
  position,
  onApplyFormat,
  onAskAiWithSelection,
}) => {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: Math.max(10, position.top - 42),
        left: Math.max(8, Math.min(position.left - 100, Math.max(8, window.innerWidth - 270))),
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-xs)',
        padding: '3px 4px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        zIndex: 1000,
        backdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.15s ease-out',
        maxWidth: 'calc(100vw - 16px)',
        overflowX: 'auto',
      }}
      onMouseDown={e => e.preventDefault()} // Prevent textarea blur
    >
      <button
        type="button"
        className="btn-icon btn-sm"
        onClick={() => onApplyFormat('**', '**')}
        title="Bold (Ctrl+B)"
        style={{ width: 26, height: 26 }}
      >
        <Bold size={13} />
      </button>

      <button
        type="button"
        className="btn-icon btn-sm"
        onClick={() => onApplyFormat('*', '*')}
        title="Italic (Ctrl+I)"
        style={{ width: 26, height: 26 }}
      >
        <Italic size={13} />
      </button>

      <button
        type="button"
        className="btn-icon btn-sm"
        onClick={() => onApplyFormat('~~', '~~')}
        title="Strikethrough"
        style={{ width: 26, height: 26 }}
      >
        <Strikethrough size={13} />
      </button>

      <button
        type="button"
        className="btn-icon btn-sm"
        onClick={() => onApplyFormat('`', '`')}
        title="Inline Code"
        style={{ width: 26, height: 26 }}
      >
        <Code size={13} />
      </button>

      <button
        type="button"
        className="btn-icon btn-sm"
        onClick={() => onApplyFormat('==', '==')}
        title="Highlight"
        style={{ width: 26, height: 26 }}
      >
        <Highlighter size={13} />
      </button>

      <button
        type="button"
        className="btn-icon btn-sm"
        onClick={() => onApplyFormat('[[', ']]')}
        title="Convert to [[Wikilink]]"
        style={{ width: 26, height: 26 }}
      >
        <Link size={13} />
      </button>

      {onAskAiWithSelection && (
        <>
          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 2px' }} />
          <button
            type="button"
            className="btn btn-sm"
            onClick={onAskAiWithSelection}
            title="Ask Libris AI about selection"
            style={{
              height: 26,
              padding: '0 8px',
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'var(--primary-glow)',
              color: 'var(--text-primary)',
              border: 'none',
            }}
          >
            <Sparkles size={12} color="#8b5cf6" />
            <span>Ask AI</span>
          </button>
        </>
      )}
    </div>
  );
};
