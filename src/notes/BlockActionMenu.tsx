import React, { useEffect, useRef } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  List,
  ListOrdered,
  ChevronRight,
  Code,
  Quote,
  Lightbulb,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Type,
  Table,
  Image as ImageIcon,
  Sigma,
  Paperclip,
  Globe,
} from 'lucide-react';
import { BlockType } from './BlockEngine';

interface BlockActionMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  currentType: BlockType;
  onTurnInto: (newType: BlockType) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClose: () => void;
}

export const BlockActionMenu: React.FC<BlockActionMenuProps> = ({
  isOpen,
  position,
  currentType,
  onTurnInto,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const turnIntoOptions: { type: BlockType; label: string; icon: React.ReactNode }[] = [
    { type: 'text', label: 'Text', icon: <Type size={14} /> },
    { type: 'h1', label: 'Heading 1', icon: <Heading1 size={14} /> },
    { type: 'h2', label: 'Heading 2', icon: <Heading2 size={14} /> },
    { type: 'h3', label: 'Heading 3', icon: <Heading3 size={14} /> },
    { type: 'todo', label: 'To-do List', icon: <CheckSquare size={14} /> },
    { type: 'bullet', label: 'Bulleted List', icon: <List size={14} /> },
    { type: 'number', label: 'Numbered List', icon: <ListOrdered size={14} /> },
    { type: 'toggle', label: 'Toggle List', icon: <ChevronRight size={14} /> },
    { type: 'callout', label: 'Callout Box', icon: <Lightbulb size={14} color="#eab308" /> },
    { type: 'code', label: 'Code Block', icon: <Code size={14} /> },
    { type: 'image', label: 'Image', icon: <ImageIcon size={14} color="#0ea5e9" /> },
    { type: 'file', label: 'File / Document', icon: <Paperclip size={14} color="#10b981" /> },
    { type: 'bookmark', label: 'Web Bookmark', icon: <Globe size={14} color="#6366f1" /> },
    { type: 'math', label: 'LaTeX Equation', icon: <Sigma size={14} color="#ec4899" /> },
    { type: 'quote', label: 'Quote', icon: <Quote size={14} /> },
    { type: 'table', label: 'Table', icon: <Table size={14} /> },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: Math.max(10, Math.min(position.top, window.innerHeight - 380)),
        left: Math.max(20, Math.min(position.left, window.innerWidth - 240)),
        width: 210,
        maxHeight: 380,
        overflowY: 'auto',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45), 0 0 1px rgba(255, 255, 255, 0.1)',
        zIndex: 1100,
        padding: '6px 0',
        backdropFilter: 'blur(16px)',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Block Actions */}
      <div style={{ padding: '2px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          className="btn-ghost"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            fontSize: '0.74rem',
            textAlign: 'left',
            color: 'var(--text-primary)',
          }}
          onClick={() => {
            onDuplicate();
            onClose();
          }}
        >
          <Copy size={13} />
          <span>Duplicate</span>
        </button>

        <button
          type="button"
          className="btn-ghost"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            fontSize: '0.74rem',
            textAlign: 'left',
            color: 'var(--text-primary)',
          }}
          onClick={() => {
            onMoveUp();
            onClose();
          }}
        >
          <ArrowUp size={13} />
          <span>Move Up</span>
        </button>

        <button
          type="button"
          className="btn-ghost"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            fontSize: '0.74rem',
            textAlign: 'left',
            color: 'var(--text-primary)',
          }}
          onClick={() => {
            onMoveDown();
            onClose();
          }}
        >
          <ArrowDown size={13} />
          <span>Move Down</span>
        </button>

        <button
          type="button"
          className="btn-ghost"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            fontSize: '0.74rem',
            textAlign: 'left',
            color: '#ef4444',
          }}
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <Trash2 size={13} />
          <span>Delete Block</span>
        </button>
      </div>

      {/* Turn Into Submenu */}
      <div style={{ padding: '4px 0' }}>
        <div
          style={{
            padding: '4px 12px',
            fontSize: '0.62rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-tech)',
          }}
        >
          TURN INTO
        </div>

        {turnIntoOptions.map(opt => {
          const isActive = currentType === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              className="btn-ghost"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 12px',
                fontSize: '0.72rem',
                textAlign: 'left',
                background: isActive ? 'var(--bg-hover)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
              }}
              onClick={() => {
                onTurnInto(opt.type);
                onClose();
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                }}
              >
                {opt.icon}
              </div>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
