/**
 * LIBRIX AI Provider Interface & Generic Architecture
 * Vendor-agnostic LLM client for local private inference (Ollama, LM Studio, llama.cpp)
 * and custom remote endpoints with streaming and RAG retrieval.
 */

import { CustomAIProviderConfig } from '../core/types';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
}

export interface IAIProvider {
  readonly id: string;
  readonly name: string;
  readonly isLocal: boolean;

  connect(): Promise<boolean>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  listModels?(): Promise<string[]>;
  generateCompletion(messages: AIMessage[], options?: AICompletionOptions): Promise<string>;
  streamCompletion?(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AICompletionOptions
  ): Promise<string>;
}
