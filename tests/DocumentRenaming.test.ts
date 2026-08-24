import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseEngine } from '../src/core/db/DatabaseEngine';

describe('Document Renaming System', () => {
  let db: DatabaseEngine;

  beforeEach(async () => {
    db = DatabaseEngine.getInstance();
    await db.initialize();
  });

  it('renames a document while strictly preserving internal document ID', async () => {
    const docs = await db.getDocuments();
    const original = docs[0];
    const originalId = original.id;

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
