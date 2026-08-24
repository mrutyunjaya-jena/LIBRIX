import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseEngine } from '../src/core/db/DatabaseEngine';
import { Document, Note, Collection } from '../src/core/types';

describe('DatabaseEngine', () => {
  let db: DatabaseEngine;

  beforeEach(async () => {
    db = DatabaseEngine.getInstance();
    await db.initialize();
  });

  it('should initialize and load default library documents', async () => {
    const docs = await db.getDocuments();
    expect(docs.length).toBeGreaterThan(0);
    const rustDoc = docs.find(d => d.title.includes('Rust'));
    expect(rustDoc).toBeDefined();
    expect(rustDoc?.format).toBe('epub');
  });

  it('should support document CRUD operations and progress updates', async () => {
    const newDoc: Document = {
      id: 'doc_test_unit',
      title: 'Unit Test Book',
      author: 'Test Author',
      filename: 'test.epub',
      format: 'epub',
      mimeType: 'application/epub+zip',
      size: 1024,
      hash: 'testhash',
      storageProvider: 'local',
      storagePath: '/test/test.epub',
      isFavorite: false,
      isTrash: false,
      tags: ['Test'],
      collections: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    await db.saveDocument(newDoc);
    const retrieved = await db.getDocumentById('doc_test_unit');
    expect(retrieved?.title).toBe('Unit Test Book');

    // Update Reading Progress
    await db.updateReadingProgress('doc_test_unit', { percentage: 55, currentLocation: 'ch-3' });
    const updated = await db.getDocumentById('doc_test_unit');
    expect(updated?.readingProgress?.percentage).toBe(55);

    // Trash safety
    await db.deleteDocument('doc_test_unit', false);
    const trashed = await db.getDocuments({ filterTrash: true });
    expect(trashed.some(d => d.id === 'doc_test_unit')).toBe(true);

    // Permanent delete
    await db.deleteDocument('doc_test_unit', true);
    const deleted = await db.getDocumentById('doc_test_unit');
    expect(deleted).toBeNull();
  });

  it('should manage notes and collections', async () => {
    const cols = await db.getCollections();
    expect(cols.length).toBeGreaterThan(0);

    const notes = await db.getNotes();
    expect(notes.length).toBeGreaterThan(0);
  });
});
