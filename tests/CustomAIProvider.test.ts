import { describe, it, expect } from 'vitest';
import { CustomAIProvider } from '../src/ai/providers/CustomAIProvider';
import { CustomAIProviderConfig } from '../src/core/types';

describe('Generic Custom AI Provider Architecture', () => {
  it('initializes custom provider with arbitrary endpoint and model', () => {
    const config: CustomAIProviderConfig = {
      id: 'ai-custom-test',
      name: 'Private Research LLM',
      baseUrl: 'https://ai.lab.internal/v1',
      modelName: 'deepseek-r1-671b',
      apiKey: 'sk-custom-secret-key',
      isLocal: false,
      temperature: 0.6,
      maxTokens: 2048,
    };

    const provider = new CustomAIProvider(config);
    expect(provider.id).toBe('ai-custom-test');
    expect(provider.name).toBe('Private Research LLM');
    expect(provider.isLocal).toBe(false);
  });

  it('connects to endpoint test fallback without crashing', async () => {
    const config: CustomAIProviderConfig = {
      id: 'ai-ollama-test',
      name: 'Local Ollama Node',
      baseUrl: 'http://localhost:11434',
      modelName: 'llama3:latest',
      isLocal: true,
    };

    const provider = new CustomAIProvider(config);
    const result = await provider.testConnection();
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});
