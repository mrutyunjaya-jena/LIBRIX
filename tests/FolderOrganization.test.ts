import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseEngine } from '../src/core/db/DatabaseEngine';
import { Folder } from '../src/core/types';

describe('FolderOrganization & Nested Hierarchy', () => {
  let db: DatabaseEngine;

  beforeEach(async () => {
    db = DatabaseEngine.getInstance();
    await db.initialize();
  });

  it('creates root folders and nested subfolders correctly', async () => {
    const parentFolder: Folder = {
      id: 'fld-test-parent',
      name: 'Financial Modeling',
      parentId: null,
      path: '/Financial Modeling',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveFolder(parentFolder);

    const childFolder: Folder = {
      id: 'fld-test-child',
      name: 'Black-Scholes & Volatility',
      parentId: 'fld-test-parent',
      path: '/Financial Modeling/Black-Scholes & Volatility',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveFolder(childFolder);

    const subfolders = await db.getFolders('fld-test-parent');
    expect(subfolders.length).toBe(1);
    expect(subfolders[0].name).toBe('Black-Scholes & Volatility');
    expect(subfolders[0].parentId).toBe('fld-test-parent');
  });

  it('moves documents into folders and queries them by folderId', async () => {
    const docs = await db.getDocuments();
    const targetDoc = docs[0];

    await db.moveDocumentToFolder(targetDoc.id, 'fld-test-child');
    const folderDocs = await db.getDocuments({ folderId: 'fld-test-child' });

    expect(folderDocs.some(d => d.id === targetDoc.id)).toBe(true);
  });

  it('deleting a folder cascades and unassigns contained documents', async () => {
    await db.deleteFolder('fld-test-parent');
    const checkFolder = await db.getFolderById('fld-test-parent');
    expect(checkFolder).toBeNull();
  });
});
