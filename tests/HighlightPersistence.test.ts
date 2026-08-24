import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseEngine } from '../src/core/db/DatabaseEngine';
import { Annotation } from '../src/core/types';

describe('Highlighting & Annotation Persistence', () => {
  let db: DatabaseEngine;

  beforeEach(async () => {
    db = DatabaseEngine.getInstance();
    await db.initialize();
  });

  it('creates, persists, and queries highlights across documents', async () => {
    const annot: Annotation = {
      id: 'annot_test_1',
      documentId: 'doc-1',
      location: 'chapter-4',
      selectedText: 'Each value has an owner. There can only be one owner at a time.',
      note: 'Crucial invariant of the borrow checker.',
      style: 'box',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.saveAnnotation(annot);

    const docAnnots = await db.getAnnotations('doc-1');
    const found = docAnnots.find(a => a.id === 'annot_test_1');

    expect(found).toBeDefined();
    expect(found?.location).toBe('chapter-4');
    expect(found?.selectedText).toContain('Each value has an owner');
    expect(found?.note).toBe('Crucial invariant of the borrow checker.');
  });

  it('updates annotation note and deletes annotation', async () => {
    await db.updateAnnotationNote('annot_test_1', 'Updated note content.');
    let docAnnots = await db.getAnnotations('doc-1');
    let found = docAnnots.find(a => a.id === 'annot_test_1');
    expect(found?.note).toBe('Updated note content.');

    await db.deleteAnnotation('annot_test_1');
    docAnnots = await db.getAnnotations('doc-1');
    found = docAnnots.find(a => a.id === 'annot_test_1');
    expect(found).toBeUndefined();
  });
});
