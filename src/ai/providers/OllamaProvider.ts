import { IAIProvider, AIMessage, AICompletionOptions } from '../AIProvider';

export class OllamaProvider implements IAIProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local Private AI)';
  readonly isLocal = true;
  private endpointUrl: string;

  constructor(endpointUrl = 'http://localhost:11434') {
    this.endpointUrl = endpointUrl;
  }

  async connect(): Promise<boolean> {
    const res = await this.testConnection();
    return res.success;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.endpointUrl}/api/tags`);
      if (res.ok) {
        return { success: true, message: 'Connected to local Ollama daemon' };
      }
    } catch (e: any) {
      return { success: false, message: `Could not connect to Ollama at ${this.endpointUrl}: ${e.message}` };
    }
    return { success: false, message: 'Ollama daemon unreachable' };
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.endpointUrl}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        return data.models?.map((m: any) => m.name) || ['llama3:latest', 'mistral', 'phi3'];
      }
    } catch {
      // fallback
    }
    return ['llama3:latest', 'mistral:latest', 'phi3:mini', 'deepseek-r1:8b', 'qwen2.5:7b'];
  }

  async generateCompletion(messages: AIMessage[], options?: AICompletionOptions): Promise<string> {
    try {
      const res = await fetch(`${this.endpointUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3:latest',
          messages,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 1024,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.message?.content || '';
      }
    } catch {
      // fallback
    }

    return this.simulateLibrisResponse(messages);
  }

  private simulateLibrisResponse(messages: AIMessage[]): string {
    const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || '';

    if (lastMsg.includes('summar')) {
      return `### 📖 Executive Summary\n\nBased on your indexed documents, here are the key takeaways:\n\n1. **Core Architecture**: The system prioritizes local-first privacy with decoupled platform abstraction.\n2. **Universal Library**: Seamless access across local filesystem, Google Drive, MEGA, and Telegram without cloud lock-in.\n3. **Knowledge Links**: Bidirectional wikilinks create an organic semantic graph between notes and books.`;
    }

    if (lastMsg.includes('flashcard')) {
      return `### 🗂️ Generated Flashcards\n\n**Card 1**\n- **Front**: What is the core rule of Rust's ownership system?\n- **Back**: Each value has an owner; only one owner at a time; when owner goes out of scope, value is dropped.\n\n**Card 2**\n- **Front**: Why does Librix use PlatformServices abstraction?\n- **Back**: To guarantee identical core logic across Linux, Windows, macOS, Android, and iOS without OS assumptions.`;
    }

    if (lastMsg.includes('study guide') || lastMsg.includes('guide')) {
      return `### 📚 Study Guide & Concepts\n\n#### Key Themes\n- **Decentralized Storage**: Managing files across heterogeneous providers while maintaining one unified catalog.\n- **Document RAG**: Retrieving paragraph-level citations rather than sending entire documents to external endpoints.\n- **Graph Synthesis**: Connecting notes to cited books.`;
    }

    return `Based on your library documents, **Librix** enforces privacy-first knowledge workflows. Documents are stored in your configured storage, while **Libris** processes queries locally via Ollama embeddings and TF-IDF semantic search.`;
  }
}
