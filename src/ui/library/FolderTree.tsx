import React, { useState } from 'react';
import {
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
} from 'lucide-react';
import { Folder } from '../../core/types';

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onContextMenu: (e: React.MouseEvent, folder: Folder) => void;
  onDropDocumentOnFolder?: (docId: string, folderId: string | null) => void;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onContextMenu,
  onDropDocumentOnFolder,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['fld-prog', 'fld-fin', 'fld-ai']));
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const toggleExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    const docId = e.dataTransfer.getData('text/plain');
    if (docId && onDropDocumentOnFolder) {
      onDropDocumentOnFolder(docId, folderId);
    }
  };

  // Render a folder branch recursively
  const renderFolderBranch = (parentId: string | null, depth = 0) => {
    const children = folders.filter(f => f.parentId === parentId);
    if (children.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {children.map(folder => {
          const isExpanded = expandedFolders.has(folder.id);
          const isSelected = selectedFolderId === folder.id;
          const isDragTarget = dragOverFolderId === folder.id;
          const hasSubfolders = folders.some(f => f.parentId === folder.id);

          return (
            <div key={folder.id}>
              <div
                onClick={() => onSelectFolder(folder.id)}
                onContextMenu={e => {
                  e.preventDefault();
                  onContextMenu(e, folder);
                }}
                onDragOver={e => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, folder.id)}
                className={`palette-item ${isSelected ? 'active' : ''}`}
                style={{
                  padding: '4px 6px',
                  paddingLeft: `${depth * 12 + 6}px`,
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  border: isDragTarget ? '1px dashed var(--text-primary)' : '1px solid transparent',
                  background: isSelected ? 'var(--bg-surface-active)' : isDragTarget ? 'var(--bg-surface-hover)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                  {hasSubfolders ? (
                    <button
                      className="btn-icon btn-sm"
                      onClick={e => toggleExpand(folder.id, e)}
                      style={{ padding: 1, color: 'var(--text-muted)' }}
                    >
                      {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </button>
                  ) : (
                    <span style={{ width: 13 }} />
                  )}

                  {isExpanded ? (
                    <FolderOpen size={13} style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                  ) : (
                    <FolderIcon size={13} style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                  )}

                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? 600 : 400 }}>
                    {folder.name}
                  </span>
                </div>

                <button
                  className="btn-icon btn-sm"
                  onClick={e => {
                    e.stopPropagation();
                    onContextMenu(e, folder);
                  }}
                  style={{ padding: 2, opacity: 0.6 }}
                >
                  <MoreVertical size={11} />
                </button>
              </div>

              {/* Recursive Subfolders */}
              {isExpanded && renderFolderBranch(folder.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Root Library Item */}
      <div
        onClick={() => onSelectFolder(null)}
        onDragOver={e => handleDragOver(e, null)}
        onDragLeave={handleDragLeave}
        onDrop={e => handleDrop(e, null)}
        className={`palette-item ${selectedFolderId === null ? 'active' : ''}`}
        style={{
          padding: '4px 6px',
          borderRadius: 'var(--radius-xs)',
          fontSize: 'var(--text-xs)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          border: dragOverFolderId === null ? '1px dashed var(--text-primary)' : '1px solid transparent',
          background: selectedFolderId === null ? 'var(--bg-surface-active)' : 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FolderIcon size={13} />
          <span style={{ fontWeight: selectedFolderId === null ? 600 : 400 }}>Root Library</span>
        </div>

        <button
          className="btn-icon btn-sm"
          onClick={e => {
            e.stopPropagation();
            onCreateFolder(null);
          }}
          title="New Root Folder"
          style={{ padding: 2 }}
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Render Tree */}
      {renderFolderBranch(null, 0)}
    </div>
  );
};
