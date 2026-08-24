import React, { useEffect, useRef } from 'react';
import {
  BookOpen,
  Edit2,
  FolderInput,
  Copy,
  Star,
  Tag as TagIcon,
  Sparkles,
  Trash2,
  FolderPlus,
  Info,
} from 'lucide-react';
import { Document, Folder } from '../../core/types';

export interface ContextMenuState {
  x: number;
  y: number;
  type: 'document' | 'folder';
  document?: Document;
  folder?: Folder;
}

interface ContextMenuProps {
  state: ContextMenuState | null;
  onClose: () => void;
  onOpenDocument?: (doc: Document) => void;
  onRenameDocument?: (doc: Document) => void;
  onMoveDocument?: (doc: Document) => void;
  onDuplicateDocument?: (doc: Document) => void;
  onToggleFavorite?: (doc: Document) => void;
  onAskLibris?: (doc: Document) => void;
  onDeleteDocument?: (doc: Document) => void;
  onOpenFolder?: (folder: Folder) => void;
  onCreateSubfolder?: (parentFolder: Folder) => void;
  onRenameFolder?: (folder: Folder) => void;
  onDeleteFolder?: (folder: Folder) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  state,
  onClose,
  onOpenDocument,
  onRenameDocument,
  onMoveDocument,
  onDuplicateDocument,
  onToggleFavorite,
  onAskLibris,
  onDeleteDocument,
  onOpenFolder,
  onCreateSubfolder,
  onRenameFolder,
  onDeleteFolder,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', onClose);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', onClose);
    };
  }, [onClose]);

  if (!state) return null;

  // Ensure menu doesn't overflow screen bounds
  const menuWidth = 200;
  const menuHeight = 260;
  const posX = Math.min(state.x, window.innerWidth - menuWidth - 10);
  const posY = Math.min(state.y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: posX, top: posY }}
      onClick={e => e.stopPropagation()}
    >
      {state.type === 'document' && state.document && (
        <>
          <div
            className="context-menu-item"
            onClick={() => {
              onOpenDocument?.(state.document!);
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={14} />
              <span>Open Document</span>
            </div>
            <span className="palette-shortcut">ENTER</span>
          </div>

          <div
            className="context-menu-item"
            onClick={() => {
              onRenameDocument?.(state.document!);
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Edit2 size={14} />
              <span>Rename</span>
            </div>
            <span className="palette-shortcut">F2</span>
          </div>

          <div
            className="context-menu-item"
            onClick={() => {
              onMoveDocument?.(state.document!);
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderInput size={14} />
              <span>Move to Folder...</span>
            </div>
          </div>

          <div
            className="context-menu-item"
            onClick={() => {
              onDuplicateDocument?.(state.document!);
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Copy size={14} />
              <span>Duplicate</span>
            </div>
          </div>

          <div
            className="context-menu-item"
            onClick={() => {
              onToggleFavorite?.(state.document!);
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={14} fill={state.document.isFavorite ? 'currentColor' : 'none'} />
              <span>{state.document.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}</span>
            </div>
          </div>

          <div className="context-menu-divider" />

          <div
            className="context-menu-item"
            onClick={() => {
              onAskLibris?.(state.document!);
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={14} />
              <span>Ask Libris AI</span>
            </div>
          </div>

          <div className="context-menu-divider" />

          <div
            className="context-menu-item danger"
            onClick={() => {
              onDeleteDocument?.(state.document!);
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 size={14} />
              <span>Delete Document</span>
            </div>
            <span className="palette-shortcut">DEL</span>
          </div>
        </>
      )}

      {state.type === 'folder' && state.folder && (
        <>
          <div
            className="context-menu-item"
            onClick={() => {
              onOpenFolder?.(state.folder!);
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={14} />
              <span>Open Folder</span>
            </div>
          </div>

          <div
            className="context-menu-item"
            onClick={() => {
              onCreateSubfolder?.(state.folder!);
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderPlus size={14} />
              <span>New Subfolder</span>
            </div>
          </div>

          <div
            className="context-menu-item"
            onClick={() => {
              onRenameFolder?.(state.folder!);
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Edit2 size={14} />
              <span>Rename Folder</span>
            </div>
          </div>

          <div className="context-menu-divider" />

          <div
            className="context-menu-item danger"
            onClick={() => {
              onDeleteFolder?.(state.folder!);
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 size={14} />
              <span>Delete Folder</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
