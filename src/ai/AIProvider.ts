/**
 * LIBRIX AI Provider Interfaces
 * Multi-provider abstraction supporting Local AI (Ollama, LM Studio, llama.cpp) and Cloud AI.
 */

export type AIProviderType = 'ollama' | 'openai-compatible' | 'openai' | 'custom';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onChunk?: (text: string) => void;
}

export interface IAIProvider {
  readonly id: string;
  readonly type: AIProviderType;
  readonly name: string;
  readonly isLocal: boolean; // True if execution stays strictly on user's device / LAN

  getAvailableModels(): Promise<string[]>;
  generateCompletion(messages: AIMessage[], options?: AICompletionOptions): Promise<string>;
}
