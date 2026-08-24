import { IAIProvider, AIMessage, AICompletionOptions } from '../AIProvider';

export class OpenAICompatibleProvider implements IAIProvider {
  readonly id = 'openai-compatible';
  readonly name = 'OpenAI Compatible (LM Studio / vLLM / llama.cpp)';
  readonly isLocal = false;
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl = 'http://localhost:1234/v1', apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  async connect(): Promise<boolean> {
    const res = await this.testConnection();
    return res.success;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const res = await fetch(`${this.baseUrl}/models`, { headers });
      if (res.ok) return { success: true, message: `Connected to endpoint ${this.baseUrl}` };
    } catch (e: any) {
      return { success: false, message: `Failed to connect: ${e.message}` };
    }
    return { success: false, message: 'Endpoint unreachable' };
  }

  async listModels(): Promise<string[]> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const res = await fetch(`${this.baseUrl}/models`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.data?.map((m: any) => m.id) || ['default-model'];
      }
    } catch {
      // fallback
    }
    return ['default-model'];
  }

  async generateCompletion(messages: AIMessage[], options?: AICompletionOptions): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'default',
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
    throw new Error(`OpenAI compatible endpoint error: ${res.status}`);
  }
}
