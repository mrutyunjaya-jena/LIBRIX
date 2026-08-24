import { AIMessage } from '../AIProvider';
import { vectorStore } from './VectorStore';
import { LibrisSourceCitation } from '../../core/types';

export interface RAGContextResult {
  systemPrompt: string;
  sources: LibrisSourceCitation[];
}

export class ContextAssembler {
  public static async assembleContext(
    userQuery: string,
    options?: {
      documentId?: string;
      maxContextChars?: number;
    }
  ): Promise<RAGContextResult> {
    const maxChars = options?.maxContextChars || 4000;
    const searchResults = await vectorStore.searchRelevantChunks(userQuery, {
      documentId: options?.documentId,
      topK: 4,
    });

    const sources = vectorStore.toSourceCitations(searchResults);

    if (searchResults.length === 0) {
      return {
        systemPrompt: `You are Libris, an intelligent, privacy-first AI knowledge assistant for Librix.
You help users explore books, documents, and notes. Be clear, concise, and structured.`,
        sources: [],
      };
    }

    let contextText = '';
    for (const res of searchResults) {
      const block = `\n--- SOURCE: "${res.documentTitle}" (Page/Location: ${res.chunk.pageNumber ? 'Page ' + res.chunk.pageNumber : 'Chunk ' + res.chunk.chunkIndex}) ---\n${res.chunk.textContent}\n`;
      if ((contextText + block).length > maxChars) break;
      contextText += block;
    }

    const systemPrompt = `You are Libris, an intelligent, privacy-first AI knowledge assistant built into Librix.
Below are relevant verified excerpts retrieved from the user's personal library.
Answer the user's question accurately using ONLY this context where applicable. Cite the sources where appropriate.

RETRIEVED LIBRARY CONTEXT:
${contextText}
`;

    return { systemPrompt, sources };
  }
}
