import { DocumentChunk, LibrisSourceCitation } from '../../core/types';
import { db } from '../../core/db/DatabaseEngine';

export class VectorStore {
  private static instance: VectorStore | null = null;

  public static getInstance(): VectorStore {
    if (!VectorStore.instance) {
      VectorStore.instance = new VectorStore();
    }
    return VectorStore.instance;
  }

  // Tokenize string to term frequency vector
  private tokenize(text: string): Map<string, number> {
    const map = new Map<string, number>();
    const words = text.toLowerCase().match(/\b[a-z0-9_\-]{2,}\b/g) || [];
    words.forEach(w => {
      map.set(w, (map.get(w) || 0) + 1);
    });
    return map;
  }

  // Cosine Similarity between two term frequency maps
  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const [term, freq] of a.entries()) {
      normA += freq * freq;
      if (b.has(term)) {
        dotProduct += freq * b.get(term)!;
      }
    }

    for (const freq of b.values()) {
      normB += freq * freq;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Search relevant chunks across document or entire library
  public async searchRelevantChunks(
    query: string,
    options?: {
      documentId?: string;
      topK?: number;
      minScore?: number;
    }
  ): Promise<Array<{ chunk: DocumentChunk; score: number; documentTitle: string }>> {
    const topK = options?.topK || 4;
    const minScore = options?.minScore || 0.05;
    const queryVec = this.tokenize(query);

    let chunks: DocumentChunk[] = [];
    if (options?.documentId) {
      chunks = await db.getDocumentChunks(options.documentId);
    } else {
      chunks = await db.getAllDocumentChunks();
    }

    // If chunks are not yet indexed for documents in DB, create on-the-fly chunks from documents
    if (chunks.length === 0) {
      const docs = await db.getDocuments();
      for (const d of docs) {
        if (!options?.documentId || d.id === options.documentId) {
          const text = d.contentSnippet || `${d.title} by ${d.author}. Format: ${d.format}. Storage: ${d.storageProvider}. Tags: ${d.tags.join(', ')}`;
          chunks.push({
            id: `chunk_${d.id}_1`,
            documentId: d.id,
            chunkIndex: 1,
            textContent: text,
            pageNumber: 1,
            tokenCount: Math.ceil(text.length / 4),
          });
        }
      }
    }

    const scored: Array<{ chunk: DocumentChunk; score: number; documentTitle: string }> = [];

    for (const chunk of chunks) {
      const chunkVec = this.tokenize(chunk.textContent);
      const score = this.cosineSimilarity(queryVec, chunkVec);
      if (score >= minScore) {
        const doc = await db.getDocumentById(chunk.documentId);
        scored.push({
          chunk,
          score,
          documentTitle: doc?.title || 'Unknown Document',
        });
      }
    }

    // Sort descending by relevance score
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  public toSourceCitations(
    results: Array<{ chunk: DocumentChunk; score: number; documentTitle: string }>
  ): LibrisSourceCitation[] {
    return results.map(r => ({
      documentId: r.chunk.documentId,
      documentTitle: r.documentTitle,
      pageOrLocation: r.chunk.pageNumber ? `Page ${r.chunk.pageNumber}` : `Section ${r.chunk.chunkIndex}`,
      snippet: r.chunk.textContent.length > 240 ? r.chunk.textContent.slice(0, 240) + '...' : r.chunk.textContent,
      score: Math.round(r.score * 100) / 100,
    }));
  }
}

export const vectorStore = VectorStore.getInstance();
