import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseEngine } from '../src/core/db/DatabaseEngine';
import { Document, Note, Collection } from '../src/core/types';

describe('DatabaseEngine', () => {
  let db: DatabaseEngine;

  beforeEach(async () => {
    db = DatabaseEngine.getInstance();
    await db.initialize();
  });

  it('should initialize clean workstation vault without demo books', async () => {
    const clouds = await db.getCloudConnections();
    expect(clouds.length).toBeGreaterThan(0);
    const providers = await db.getAIProviders();
    expect(providers.length).toBeGreaterThan(0);
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
    const newCol: Collection = {
      id: 'col_test_1',
      name: 'Test Collection',
      createdAt: Date.now(),
    };
    await db.saveCollection(newCol);
    const cols = await db.getCollections();
    expect(cols.some(c => c.id === 'col_test_1')).toBe(true);

    const newNote: Note = {
      id: 'note_test_1',
      title: 'Unit Note',
      slug: 'unit-note',
      content: 'Unit test content',
      frontmatter: {},
      tags: ['Test'],
      wikilinks: [],
      backlinks: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    await db.saveNote(newNote);
    const notes = await db.getNotes();
    expect(notes.some(n => n.id === 'note_test_1')).toBe(true);
  });
});
