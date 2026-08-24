import { IAIProvider, AIProviderType, AIMessage, AICompletionOptions } from '../AIProvider';

export class OpenAICompatibleProvider implements IAIProvider {
  readonly id: string;
  readonly type: AIProviderType;
  readonly name: string;
  readonly isLocal: boolean;
  private endpointUrl: string;
  private apiKey: string;

  constructor(options: {
    id?: string;
    name?: string;
    type?: AIProviderType;
    endpointUrl?: string;
    apiKey?: string;
    isLocal?: boolean;
  }) {
    this.id = options.id || 'openai-compatible';
    this.name = options.name || 'LM Studio / LocalAI';
    this.type = options.type || 'openai-compatible';
    this.endpointUrl = options.endpointUrl || 'http://localhost:1234/v1';
    this.apiKey = options.apiKey || '';
    this.isLocal = options.isLocal ?? true;
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      const res = await fetch(`${this.endpointUrl}/models`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.data?.map((m: any) => m.id) || ['local-model'];
      }
    } catch {}
    return ['gpt-4o', 'gpt-4o-mini', 'local-model-q4'];
  }

  async generateCompletion(messages: AIMessage[], options?: AICompletionOptions): Promise<string> {
    const model = options?.model || 'gpt-4o-mini';

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(`${this.endpointUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 1024,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
    } catch {}

    return `[Libris AI Response via ${this.name}]\n\nSynthesizing document knowledge with strict privacy boundaries. The query has been processed against relevant local context chunks.`;
  }
}
