import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseEngine } from '../src/core/db/DatabaseEngine';
import { Document } from '../src/core/types';

describe('Document Renaming System', () => {
  let db: DatabaseEngine;

  beforeEach(async () => {
    db = DatabaseEngine.getInstance();
    await db.initialize();
  });

  it('renames a document while strictly preserving internal document ID', async () => {
    const originalDoc: Document = {
      id: 'doc_rename_test',
      title: 'Original Title',
      author: 'Author',
      filename: 'original.epub',
      format: 'epub',
      mimeType: 'application/epub+zip',
      size: 1000,
      hash: 'hash1',
      storageProvider: 'local',
      storagePath: '/test/original.epub',
      isFavorite: false,
      isTrash: false,
      tags: [],
      collections: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveDocument(originalDoc);

    const originalId = originalDoc.id;

    const updated = await db.renameDocument(
      originalId,
      'The Rust Systems Handbook (2nd Edition)',
      'The_Rust_Systems_Handbook_2nd_Edition.epub'
    );

    expect(updated).not.toBeNull();
    expect(updated?.id).toBe(originalId);
    expect(updated?.title).toBe('The Rust Systems Handbook (2nd Edition)');
    expect(updated?.filename).toBe('The_Rust_Systems_Handbook_2nd_Edition.epub');

    // Verify search finds document under new title
    const searchResults = await db.getDocuments({ searchQuery: 'Handbook' });
    expect(searchResults.some(d => d.id === originalId)).toBe(true);
  });
});
