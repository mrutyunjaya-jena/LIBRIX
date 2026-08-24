import { DocumentChunk } from '../../core/types';

export interface ChunkOptions {
  chunkSize?: number; // approx chars per chunk (default 800)
  chunkOverlap?: number; // overlap in chars (default 150)
}

export function chunkDocumentText(
  documentId: string,
  text: string,
  options: ChunkOptions = {}
): DocumentChunk[] {
  const chunkSize = options.chunkSize || 800;
  const chunkOverlap = options.chunkOverlap || 150;

  const chunks: DocumentChunk[] = [];
  if (!text || text.trim().length === 0) return chunks;

  // Split by double newlines (paragraphs) first for natural semantic boundaries
  const paragraphs = text.split(/\n\s*\n/);
  let currentBuffer = '';
  let chunkIdx = 0;
  let estimatedPage = 1;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((currentBuffer + '\n\n' + trimmed).length > chunkSize && currentBuffer.length > 0) {
      chunks.push({
        id: `${documentId}_chunk_${chunkIdx++}`,
        documentId,
        chunkIndex: chunkIdx,
        textContent: currentBuffer.trim(),
        pageNumber: estimatedPage,
        tokenCount: Math.ceil(currentBuffer.length / 4),
      });

      // Keep overlap from end of current buffer
      currentBuffer = currentBuffer.slice(-chunkOverlap) + '\n\n' + trimmed;
      if (chunkIdx % 4 === 0) {
        estimatedPage++;
      }
    } else {
      currentBuffer = currentBuffer ? currentBuffer + '\n\n' + trimmed : trimmed;
    }
  }

  if (currentBuffer.trim().length > 0) {
    chunks.push({
      id: `${documentId}_chunk_${chunkIdx++}`,
      documentId,
      chunkIndex: chunkIdx,
      textContent: currentBuffer.trim(),
      pageNumber: estimatedPage,
      tokenCount: Math.ceil(currentBuffer.length / 4),
    });
  }

  return chunks;
}
