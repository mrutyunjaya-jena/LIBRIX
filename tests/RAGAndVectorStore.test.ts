import { describe, it, expect } from 'vitest';
import { chunkDocumentText } from '../src/ai/rag/DocumentChunker';
import { vectorStore } from '../src/ai/rag/VectorStore';

describe('DocumentChunker & VectorStore', () => {
  it('should split document text into paragraphs with token estimates', () => {
    const text = `Paragraph 1: Systems programming in Rust guarantees safety without runtime garbage collection.

Paragraph 2: Concurrency with fearless concurrency primitives avoids data races at compile time.

Paragraph 3: Decoupled multi-cloud storage architecture ensures privacy.`;

    const chunks = chunkDocumentText('doc_test_1', text, { chunkSize: 200, chunkOverlap: 40 });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].documentId).toBe('doc_test_1');
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('should rank chunks by relevance using cosine similarity', async () => {
    const results = await vectorStore.searchRelevantChunks('Rust memory safety and concurrency', {
      topK: 3,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
  });
});
