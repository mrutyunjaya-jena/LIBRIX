import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  GripVertical,
  ChevronRight,
  Copy,
  Check,
  Trash2,
  Image as ImageIcon,
  Sigma,
  ExternalLink,
  Edit3,
  Paperclip,
  Globe,
  FileText,
} from 'lucide-react';
import { CanvasBlock, BlockType } from './BlockEngine';
import { BlockActionMenu } from './BlockActionMenu';

interface LiveBlockItemProps {
  block: CanvasBlock;
  index: number;
  isFocused: boolean;
  onUpdate: (updated: CanvasBlock) => void;
  onEnter: (index: number) => void;
  onBackspace: (index: number) => void;
  onFocusNext: (index: number) => void;
  onFocusPrev: (index: number) => void;
  onOpenSlashMenu: (index: number, rect: DOMRect) => void;
  onOpenBlockMenu?: (index: number, rect: DOMRect) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onNavigateWikilink?: (target: string) => void;
}

const CALLOUT_ICONS = ['💡', '⚠️', 'ℹ️', '🎯', '🚀', '🔥', '📌', '⭐', '🧠'];
const CODE_LANGUAGES = ['typescript', 'javascript', 'python', 'sql', 'html', 'css', 'json', 'bash', 'rust', 'go'];

export const LiveBlockItem: React.FC<LiveBlockItemProps> = ({
  block,
  index,
  isFocused,
  onUpdate,
  onEnter,
  onBackspace,
  onFocusNext,
  onFocusPrev,
  onOpenSlashMenu,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onNavigateWikilink,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [blockMenuPos, setBlockMenuPos] = useState({ top: 0, left: 0 });
  const [showCalloutIconPicker, setShowCalloutIconPicker] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Media & Attachment edit states
  const [tempImageUrl, setTempImageUrl] = useState(block.properties?.url || '');
  const [isEditingImage, setIsEditingImage] = useState(!block.properties?.url && block.type === 'image');
  const [tempFileUrl, setTempFileUrl] = useState(block.properties?.url || '');
  const [tempFileName, setTempFileName] = useState(block.properties?.fileName || '');
  const [isEditingFile, setIsEditingFile] = useState(!block.properties?.url && block.type === 'file');
  const [tempBookmarkUrl, setTempBookmarkUrl] = useState(block.properties?.url || '');
  const [isEditingBookmark, setIsEditingBookmark] = useState(!block.properties?.url && block.type === 'bookmark');

  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const blockContainerRef = useRef<HTMLDivElement>(null);

  // Auto-focus when directed
  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isFocused]);

  // Auto-resize textarea
  const adjustHeight = () => {
    if (inputRef.current && inputRef.current.tagName === 'TEXTAREA') {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [block.content, block.type]);

  // Handle inline markdown shortcuts (e.g. typing '# ' or '- [ ] ')
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const val = e.target.value;

    // Check for inline markdown type triggers
    if (block.type === 'text') {
      if (val.startsWith('# ')) {
        onUpdate({ ...block, type: 'h1', content: val.substring(2) });
        return;
      }
      if (val.startsWith('## ')) {
        onUpdate({ ...block, type: 'h2', content: val.substring(3) });
        return;
      }
      if (val.startsWith('### ')) {
        onUpdate({ ...block, type: 'h3', content: val.substring(4) });
        return;
      }
      if (val.startsWith('- [ ] ') || val.startsWith('[] ')) {
        const text = val.startsWith('- [ ] ') ? val.substring(6) : val.substring(3);
        onUpdate({ ...block, type: 'todo', content: text, properties: { ...block.properties, checked: false } });
        return;
      }
      if (val.startsWith('- ') || val.startsWith('* ')) {
        onUpdate({ ...block, type: 'bullet', content: val.substring(2) });
        return;
      }
      if (/^\d+\.\s+/.test(val)) {
        onUpdate({ ...block, type: 'number', content: val.replace(/^\d+\.\s+/, '') });
        return;
      }
      if (val.startsWith('> ')) {
        onUpdate({ ...block, type: 'quote', content: val.substring(2) });
        return;
      }
      if (val.startsWith('$$')) {
        onUpdate({ ...block, type: 'math', content: val.substring(2).trim() });
        return;
      }
      if (val.startsWith('---')) {
        onUpdate({ ...block, type: 'divider', content: '' });
        return;
      }
    }

    // Slash command trigger
    if (val.endsWith('/')) {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        onOpenSlashMenu(index, rect);
      }
    }

    onUpdate({ ...block, content: val });
  };

  // Keyboard navigation & behavior
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (block.type === 'code' || block.type === 'math') return; // Enter creates newline in code/math block
      e.preventDefault();
      onEnter(index);
    } else if (e.key === 'Backspace') {
      const target = e.target as HTMLTextAreaElement | HTMLInputElement;
      if (target && target.selectionStart === 0 && target.selectionEnd === 0) {
        if (block.type !== 'text') {
          e.preventDefault();
          onUpdate({ ...block, type: 'text' });
        } else if (!block.content) {
          e.preventDefault();
          onBackspace(index);
        }
      }
    } else if (e.key === 'ArrowUp') {
      const target = e.target as HTMLTextAreaElement | HTMLInputElement;
      if (target && target.selectionStart === 0) {
        e.preventDefault();
        onFocusPrev(index);
      }
    } else if (e.key === 'ArrowDown') {
      const target = e.target as HTMLTextAreaElement | HTMLInputElement;
      if (target && target.selectionStart === target.value.length) {
        e.preventDefault();
        onFocusNext(index);
      }
    }
  };

  // Copy code/math to clipboard
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Table cell updater
  const handleTableCellChange = (rIdx: number, cIdx: number, val: string) => {
    const tableData = block.properties?.tableData ? [...block.properties.tableData.map(r => [...r])] : [['']];
    if (tableData[rIdx]) {
      tableData[rIdx][cIdx] = val;
      onUpdate({ ...block, properties: { ...block.properties, tableData } });
    }
  };

  // Add Table Row
  const handleAddTableRow = () => {
    const tableData = block.properties?.tableData ? [...block.properties.tableData.map(r => [...r])] : [['Header 1', 'Header 2']];
    const colsCount = tableData[0]?.length || 2;
    tableData.push(new Array(colsCount).fill(''));
    onUpdate({ ...block, properties: { ...block.properties, tableData } });
  };

  // Add Table Column
  const handleAddTableCol = () => {
    const tableData = block.properties?.tableData ? [...block.properties.tableData.map(r => [...r])] : [['Header 1', 'Header 2']];
    tableData.forEach((row, idx) => {
      row.push(idx === 0 ? `Col ${row.length + 1}` : '');
    });
    onUpdate({ ...block, properties: { ...block.properties, tableData } });
  };

  // Open Block Action Menu
  const handleOpenGripMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setBlockMenuPos({ top: rect.bottom + 4, left: rect.left });
    setShowBlockMenu(true);
  };

  // Open Slash Inserter
  const handleOpenPlusMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onOpenSlashMenu(index, rect);
  };

  return (
    <div
      ref={blockContainerRef}
      className="notion-block-row"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowCalloutIconPicker(false);
      }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        width: '100%',
        margin: '2px 0',
        minHeight: 28,
      }}
    >
      {/* Left Gutter Handle (+ and ⋮⋮) */}
      <div
        className="notion-gutter"
        style={{
          width: 46,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 2,
          paddingRight: 6,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.12s ease',
          userSelect: 'none',
          marginTop: block.type === 'h1' ? 10 : block.type === 'h2' ? 8 : 4,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="notion-handle-btn"
          onClick={handleOpenPlusMenu}
          title="Add block below"
        >
          <Plus size={13} />
        </button>

        <button
          type="button"
          className="notion-handle-btn"
          onClick={handleOpenGripMenu}
          title="Block options & turn into"
        >
          <GripVertical size={13} />
        </button>
      </div>

      {/* Block Content Body */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* H1 Block */}
        {block.type === 'h1' && (
          <textarea
            ref={inputRef as any}
            value={block.content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Heading 1"
            className="notion-block-input notion-input-h1"
            rows={1}
          />
        )}

        {/* H2 Block */}
        {block.type === 'h2' && (
          <textarea
            ref={inputRef as any}
            value={block.content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Heading 2"
            className="notion-block-input notion-input-h2"
            rows={1}
          />
        )}

        {/* H3 Block */}
        {block.type === 'h3' && (
          <textarea
            ref={inputRef as any}
            value={block.content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Heading 3"
            className="notion-block-input notion-input-h3"
            rows={1}
          />
        )}

        {/* Todo Checklist Block */}
        {block.type === 'todo' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
            <input
              type="checkbox"
              checked={!!block.properties?.checked}
              onChange={e =>
                onUpdate({
                  ...block,
                  properties: { ...block.properties, checked: e.target.checked },
                })
              }
              className="notion-task-checkbox"
              style={{ marginTop: 6 }}
            />
            <textarea
              ref={inputRef as any}
              value={block.content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="To-do"
              className={`notion-block-input ${block.properties?.checked ? 'notion-task-checked-text' : ''}`}
              rows={1}
            />
          </div>
        )}

        {/* Bullet List Block */}
        {block.type === 'bullet' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
            <span style={{ fontSize: '1.2rem', lineHeight: '1.5rem', color: 'var(--text-primary)', userSelect: 'none' }}>•</span>
            <textarea
              ref={inputRef as any}
              value={block.content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="List item"
              className="notion-block-input"
              rows={1}
            />
          </div>
        )}

        {/* Numbered List Block */}
        {block.type === 'number' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
            <span style={{ fontSize: '0.88rem', lineHeight: '1.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)', minWidth: 16, userSelect: 'none' }}>
              {index + 1}.
            </span>
            <textarea
              ref={inputRef as any}
              value={block.content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Numbered item"
              className="notion-block-input"
              rows={1}
            />
          </div>
        )}

        {/* Toggle List Block */}
        {block.type === 'toggle' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="btn-icon btn-sm"
                style={{ width: 22, height: 22, padding: 0 }}
                onClick={() =>
                  onUpdate({
                    ...block,
                    properties: { ...block.properties, isOpen: !block.properties?.isOpen },
                  })
                }
              >
                <ChevronRight
                  size={14}
                  style={{
                    transform: block.properties?.isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                  }}
                />
              </button>
              <textarea
                ref={inputRef as any}
                value={block.content}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Toggle header"
                className="notion-block-input"
                style={{ fontWeight: 600 }}
                rows={1}
              />
            </div>
            {block.properties?.isOpen && (
              <div style={{ paddingLeft: 28, marginTop: 4, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                <textarea
                  value={block.properties?.subContent || ''}
                  onChange={e =>
                    onUpdate({
                      ...block,
                      properties: { ...block.properties, subContent: e.target.value },
                    })
                  }
                  placeholder="Toggle sub-notes and details..."
                  className="notion-block-input"
                  rows={2}
                />
              </div>
            )}
          </div>
        )}

        {/* Callout Box Block */}
        {block.type === 'callout' && (
          <div
            className={`notion-callout notion-callout-${block.properties?.calloutType || 'tip'}`}
            style={{ position: 'relative', width: '100%', margin: '4px 0' }}
          >
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowCalloutIconPicker(!showCalloutIconPicker)}
                style={{
                  fontSize: '1.2rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1,
                }}
                title="Change Icon"
              >
                {block.properties?.icon || '💡'}
              </button>

              {showCalloutIconPicker && (
                <div
                  style={{
                    position: 'absolute',
                    top: 28,
                    left: 0,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-xs)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    zIndex: 100,
                    padding: 6,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 4,
                  }}
                >
                  {CALLOUT_ICONS.map(ico => (
                    <button
                      key={ico}
                      type="button"
                      onClick={() => {
                        onUpdate({
                          ...block,
                          properties: { ...block.properties, icon: ico },
                        });
                        setShowCalloutIconPicker(false);
                      }}
                      style={{ fontSize: '1.1rem', padding: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      {ico}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              ref={inputRef as any}
              value={block.content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Callout note or key insight..."
              className="notion-block-input"
              rows={1}
            />
          </div>
        )}

        {/* Code Block */}
        {block.type === 'code' && (
          <div
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              margin: '6px 0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 10px',
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: '0.7rem',
              }}
            >
              <select
                value={block.properties?.language || 'typescript'}
                onChange={e =>
                  onUpdate({
                    ...block,
                    properties: { ...block.properties, language: e.target.value },
                  })
                }
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-tech)',
                  outline: 'none',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {CODE_LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => handleCopyText(block.content)}
                style={{ height: 20, padding: '0 6px', fontSize: '0.68rem', gap: 4 }}
              >
                {copiedCode ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <textarea
              ref={inputRef as any}
              value={block.content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="// Write code here..."
              className="notion-block-input notion-code-input"
              rows={3}
            />
          </div>
        )}

        {/* Image Block */}
        {block.type === 'image' && (
          <div
            style={{
              width: '100%',
              margin: '8px 0',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-surface)',
            }}
          >
            {isEditingImage || !block.properties?.url ? (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  <ImageIcon size={16} color="#0ea5e9" />
                  <span style={{ fontWeight: 600 }}>Embed Image</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={tempImageUrl}
                    onChange={e => setTempImageUrl(e.target.value)}
                    placeholder="Paste image URL (https://...)..."
                    style={{ flex: 1, fontSize: '0.78rem', padding: '6px 10px' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      onUpdate({
                        ...block,
                        properties: { ...block.properties, url: tempImageUrl },
                      });
                      setIsEditingImage(false);
                    }}
                  >
                    Embed
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={block.properties.url}
                    alt={block.properties.caption || 'Image'}
                    style={{ width: '100%', maxHeight: 450, objectFit: 'cover', display: 'block' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      display: 'flex',
                      gap: 4,
                      background: 'rgba(0,0,0,0.6)',
                      borderRadius: 'var(--radius-xs)',
                      padding: 2,
                    }}
                  >
                    <button
                      type="button"
                      className="btn-icon btn-sm"
                      onClick={() => setIsEditingImage(true)}
                      style={{ color: '#fff', width: 22, height: 22 }}
                      title="Replace Image URL"
                    >
                      <Edit3 size={11} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-sm"
                      onClick={() =>
                        onUpdate({
                          ...block,
                          properties: { ...block.properties, url: '' },
                        })
                      }
                      style={{ color: '#fff', width: 22, height: 22 }}
                      title="Remove Image"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Caption */}
                <input
                  type="text"
                  value={block.properties.caption || ''}
                  onChange={e =>
                    onUpdate({
                      ...block,
                      properties: { ...block.properties, caption: e.target.value },
                    })
                  }
                  placeholder="Add a caption..."
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    padding: '6px 8px',
                    fontStyle: 'italic',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* File / Document Attachment Block */}
        {block.type === 'file' && (
          <div
            style={{
              width: '100%',
              margin: '6px 0',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-surface)',
            }}
          >
            {isEditingFile || !block.properties?.url ? (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  <Paperclip size={16} color="#10b981" />
                  <span style={{ fontWeight: 600 }}>Attach File / Document</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={tempFileName}
                    onChange={e => setTempFileName(e.target.value)}
                    placeholder="Document Name (e.g. Quantum_Theory.pdf)..."
                    style={{ flex: 1, fontSize: '0.78rem', padding: '6px 10px' }}
                  />
                  <input
                    type="text"
                    value={tempFileUrl}
                    onChange={e => setTempFileUrl(e.target.value)}
                    placeholder="File URL or path..."
                    style={{ flex: 1.5, fontSize: '0.78rem', padding: '6px 10px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      onUpdate({
                        ...block,
                        properties: {
                          ...block.properties,
                          url: tempFileUrl,
                          fileName: tempFileName || 'Document.pdf',
                          fileSize: 'Document',
                        },
                      });
                      setIsEditingFile(false);
                    }}
                  >
                    Attach
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-surface-elevated)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-xs)',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981',
                    }}
                  >
                    <FileText size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                      {block.properties?.fileName || 'Attached Document'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>
                      {block.properties?.fileSize || '2.4 MB'} • {block.properties?.url?.slice(0, 35)}...
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <a
                    href={block.properties?.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ height: 24, fontSize: '0.7rem', padding: '0 8px', gap: 4 }}
                  >
                    <ExternalLink size={11} />
                    <span>Open</span>
                  </a>
                  <button
                    type="button"
                    className="btn-icon btn-sm"
                    onClick={() => setIsEditingFile(true)}
                    style={{ width: 24, height: 24 }}
                    title="Edit File Link"
                  >
                    <Edit3 size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Web Bookmark / URL Block */}
        {block.type === 'bookmark' && (
          <div
            style={{
              width: '100%',
              margin: '6px 0',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-surface)',
            }}
          >
            {isEditingBookmark || !block.properties?.url ? (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  <Globe size={16} color="#6366f1" />
                  <span style={{ fontWeight: 600 }}>Embed Web Bookmark</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={tempBookmarkUrl}
                    onChange={e => setTempBookmarkUrl(e.target.value)}
                    placeholder="Enter URL (https://...)..."
                    style={{ flex: 1, fontSize: '0.78rem', padding: '6px 10px' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      let domain = 'link';
                      try { domain = new URL(tempBookmarkUrl).hostname; } catch {}
                      onUpdate({
                        ...block,
                        properties: {
                          ...block.properties,
                          url: tempBookmarkUrl,
                          domain,
                          title: block.properties?.title || domain,
                        },
                      });
                      setIsEditingBookmark(false);
                    }}
                  >
                    Embed Link
                  </button>
                </div>
              </div>
            ) : (
              <a
                href={block.properties.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  textDecoration: 'none',
                  background: 'var(--bg-surface-elevated)',
                  borderLeft: '3px solid #6366f1',
                }}
                className="card-interactive"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {block.properties.title || block.properties.domain || 'Web Resource'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {block.properties.description || 'Web documentation and research reference'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>
                    <Globe size={11} color="#6366f1" />
                    <span>{block.properties.domain || block.properties.url}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 14 }}>
                  <button
                    type="button"
                    className="btn-icon btn-sm"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsEditingBookmark(true);
                    }}
                    style={{ width: 24, height: 24 }}
                    title="Edit Bookmark URL"
                  >
                    <Edit3 size={12} />
                  </button>
                  <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </a>
            )}
          </div>
        )}

        {/* LaTeX Math Equation Block */}
        {block.type === 'math' && (
          <div
            style={{
              width: '100%',
              margin: '8px 0',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-surface)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 10px',
                background: 'var(--bg-surface-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: '0.7rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ec4899', fontWeight: 600 }}>
                <Sigma size={13} />
                <span>LaTeX Equation</span>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => handleCopyText(block.content || block.properties?.formula || '')}
                style={{ height: 20, padding: '0 6px', fontSize: '0.68rem', gap: 4 }}
              >
                {copiedCode ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Live Formula Display Preview */}
            <div
              style={{
                padding: '16px 20px',
                textAlign: 'center',
                fontSize: '1.15rem',
                fontFamily: 'serif',
                letterSpacing: '0.04em',
                background: 'var(--bg-input)',
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                overflowX: 'auto',
              }}
            >
              {block.content || block.properties?.formula || 'f(x) = \\int_{-\\infty}^\\infty \\hat{f}(\\xi) e^{2 \\pi i \\xi x} d\\xi'}
            </div>

            {/* Equation Input Editor */}
            <textarea
              ref={inputRef as any}
              value={block.content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter LaTeX formula e.g. E = mc^2"
              className="notion-block-input notion-code-input"
              rows={2}
              style={{ padding: '8px 12px', fontSize: '0.82rem' }}
            />
          </div>
        )}

        {/* Quote Block */}
        {block.type === 'quote' && (
          <div style={{ borderLeft: '3px solid var(--text-primary)', paddingLeft: 12, margin: '4px 0', width: '100%' }}>
            <textarea
              ref={inputRef as any}
              value={block.content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Quote text..."
              className="notion-block-input"
              style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}
              rows={1}
            />
          </div>
        )}

        {/* Divider Block */}
        {block.type === 'divider' && (
          <div style={{ padding: '8px 0', width: '100%' }}>
            <hr className="notion-divider" style={{ margin: 0 }} />
          </div>
        )}

        {/* Table Block */}
        {block.type === 'table' && (
          <div className="notion-table-wrapper" style={{ margin: '6px 0', width: '100%' }}>
            <table className="notion-table">
              <tbody>
                {(block.properties?.tableData || [['Header 1', 'Header 2']]).map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          background: rIdx === 0 ? 'var(--bg-surface-elevated)' : 'transparent',
                          fontWeight: rIdx === 0 ? 700 : 400,
                          padding: '4px 8px',
                        }}
                      >
                        <input
                          type="text"
                          value={cell}
                          onChange={e => handleTableCellChange(rIdx, cIdx, e.target.value)}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '0.84rem',
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleAddTableRow}
                style={{ fontSize: '0.68rem', height: 22 }}
              >
                + Add Row
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleAddTableCol}
                style={{ fontSize: '0.68rem', height: 22 }}
              >
                + Add Column
              </button>
            </div>
          </div>
        )}

        {/* Standard Text Block */}
        {block.type === 'text' && (
          <textarea
            ref={inputRef as any}
            value={block.content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type / for blocks, /image, /latex, /file, /url..."
            className="notion-block-input"
            rows={1}
          />
        )}
      </div>

      {/* Block Action Context Menu */}
      <BlockActionMenu
        isOpen={showBlockMenu}
        position={blockMenuPos}
        currentType={block.type}
        onTurnInto={newType => onUpdate({ ...block, type: newType })}
        onDuplicate={() => onDuplicate(index)}
        onDelete={() => onDelete(index)}
        onMoveUp={() => onMoveUp(index)}
        onMoveDown={() => onMoveDown(index)}
        onClose={() => setShowBlockMenu(false)}
      />
    </div>
  );
};
