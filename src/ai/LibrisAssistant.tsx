import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Layers,
  FileText,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Document, LibrisChatMessage, LibrisSourceCitation } from '../core/types';
import { OllamaProvider } from './providers/OllamaProvider';
import { OpenAICompatibleProvider } from './providers/OpenAICompatibleProvider';
import { ContextAssembler } from './rag/ContextAssembler';
import { IAIProvider, AIMessage } from './AIProvider';
import { db } from '../core/db/DatabaseEngine';

interface LibrisAssistantProps {
  activeDocument?: Document | null;
  initialQuery?: string;
  onClose: () => void;
  onNavigateToDocument?: (docId: string) => void;
}

export const LibrisAssistant: React.FC<LibrisAssistantProps> = ({
  activeDocument,
  initialQuery = '',
  onClose,
  onNavigateToDocument,
}) => {
  const [providerType, setProviderType] = useState<'ollama' | 'lmstudio' | 'openai'>('ollama');
  const [currentProvider, setCurrentProvider] = useState<IAIProvider>(new OllamaProvider());
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('llama3:latest');

  const [inputQuery, setInputQuery] = useState(initialQuery);
  const [messages, setMessages] = useState<LibrisChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'libris',
      content: activeDocument
        ? `Hello! I am **Libris**, your private knowledge companion. I have loaded **${activeDocument.title}** into our document context. How can I assist you with this text?`
        : `Hello! I am **Libris**, your private AI assistant. I can search across your entire universal library, summarize books, create study guides, and synthesize notes with zero telemetry.`,
      timestamp: Date.now(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Provider
  useEffect(() => {
    let p: IAIProvider;
    if (providerType === 'ollama') {
      p = new OllamaProvider();
    } else if (providerType === 'lmstudio') {
      p = new OpenAICompatibleProvider({ name: 'LM Studio / llama.cpp', endpointUrl: 'http://localhost:1234/v1', isLocal: true });
    } else {
      p = new OpenAICompatibleProvider({ name: 'OpenAI Cloud', endpointUrl: 'https://api.openai.com/v1', isLocal: false });
    }
    setCurrentProvider(p);

    p.getAvailableModels().then(models => {
      setAvailableModels(models);
      if (models.length > 0) setSelectedModel(models[0]);
    });
  }, [providerType]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle Initial Query if passed from selection
  useEffect(() => {
    if (initialQuery && initialQuery.trim().length > 0) {
      handleSendMessage(`Explain or analyze this passage: "${initialQuery}"`);
    }
  }, [initialQuery]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || isLoading) return;

    const userMsg: LibrisChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      content: query,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      // 1. RAG Context Retrieval & Assembly
      const { systemPrompt, sources } = await ContextAssembler.assembleContext(query, {
        documentId: activeDocument?.id,
      });

      // 2. Prepare conversation payload
      const aiPayload: AIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-4).map(m => ({
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        })),
        { role: 'user', content: query },
      ];

      // 3. Generate completion from provider
      const responseText = await currentProvider.generateCompletion(aiPayload, {
        model: selectedModel,
        temperature: 0.7,
      });

      const librisMsg: LibrisChatMessage = {
        id: `libris_${Date.now()}`,
        sender: 'libris',
        content: responseText,
        sources: sources.length > 0 ? sources : undefined,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, librisMsg]);
    } catch (e: any) {
      const errorMsg: LibrisChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'libris',
        content: `⚠️ Failed to get response from ${currentProvider.name}: ${e.message || 'Connection error'}. Please check if the local server is running.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const executeQuickTool = (tool: 'summarize' | 'flashcards' | 'study_guide' | 'key_points' | 'concept') => {
    if (!activeDocument) {
      if (tool === 'summarize') handleSendMessage('Summarize key themes across my library.');
      else if (tool === 'flashcards') handleSendMessage('Generate 3 study flashcards from my library documents.');
      else if (tool === 'study_guide') handleSendMessage('Generate an executive study guide of my library topics.');
      else handleSendMessage('Explain the core concepts across my books.');
      return;
    }

    if (tool === 'summarize') {
      handleSendMessage(`Summarize the main arguments and conclusions of "${activeDocument.title}".`);
    } else if (tool === 'flashcards') {
      handleSendMessage(`Generate 3 high-yield study flashcards with front/back based on "${activeDocument.title}".`);
    } else if (tool === 'study_guide') {
      handleSendMessage(`Create a comprehensive study guide and outline for "${activeDocument.title}".`);
    } else if (tool === 'key_points') {
      handleSendMessage(`Extract the top 5 key actionable takeaways from "${activeDocument.title}".`);
    } else {
      handleSendMessage(`Explain the most complex concepts presented in "${activeDocument.title}" simply.`);
    }
  };

  const toggleSource = (msgId: string) => {
    setExpandedSources(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <aside className="reader-sidebar" style={{ width: 380, display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '1px solid var(--border-subtle)' }}>
      {/* Libris Header */}
      <div className="reader-sidebar-header" style={{ background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{ padding: 6, background: 'var(--brand-gradient)', borderRadius: 'var(--radius-sm)', color: '#fff', display: 'flex' }}>
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>LIBRIS AI</div>
            <div style={{ fontSize: '0.68rem', color: currentProvider.isLocal ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {currentProvider.isLocal ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
              {currentProvider.isLocal ? 'Local Private AI (Zero Telemetry)' : 'External Cloud AI'}
            </div>
          </div>
        </div>

        <button className="btn-icon btn-sm" onClick={onClose} title="Close Libris">✕</button>
      </div>

      {/* Provider & Document Context Bar */}
      <div style={{ padding: '8px 12px', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`badge ${providerType === 'ollama' ? 'badge-brand' : 'badge-cloud'}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setProviderType('ollama')}
            >
              Ollama
            </button>
            <button
              className={`badge ${providerType === 'lmstudio' ? 'badge-brand' : 'badge-cloud'}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setProviderType('lmstudio')}
            >
              LM Studio
            </button>
            <button
              className={`badge ${providerType === 'openai' ? 'badge-brand' : 'badge-cloud'}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setProviderType('openai')}
            >
              OpenAI
            </button>
          </div>

          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            style={{ fontSize: '0.72rem', padding: '2px 6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            {availableModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {activeDocument && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--brand-300)', background: 'rgba(99, 102, 241, 0.12)', padding: '3px 8px', borderRadius: 'var(--radius-xs)' }}>
            <BookOpen size={12} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Context: {activeDocument.title}
            </span>
          </div>
        )}
      </div>

      {/* Quick Action Pills */}
      <div style={{ padding: '6px 12px', display: 'flex', gap: 4, overflowX: 'auto', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <button className="btn btn-sm btn-secondary" onClick={() => executeQuickTool('summarize')} style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
          ⚡ Summarize
        </button>
        <button className="btn btn-sm btn-secondary" onClick={() => executeQuickTool('flashcards')} style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
          🗂️ Flashcards
        </button>
        <button className="btn btn-sm btn-secondary" onClick={() => executeQuickTool('study_guide')} style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
          📚 Study Guide
        </button>
        <button className="btn btn-sm btn-secondary" onClick={() => executeQuickTool('key_points')} style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
          🎯 Key Points
        </button>
      </div>

      {/* Chat Messages */}
      <div className="reader-sidebar-body" style={{ flex: 1, padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              className="chat-message-content"
              style={{
                maxWidth: '88%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.5,
                background: msg.sender === 'user' ? 'var(--brand-500)' : 'var(--bg-surface)',
                color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
                border: msg.sender === 'libris' ? '1px solid var(--border-subtle)' : 'none',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

              {/* Source Citations Accordion */}
              {msg.sources && msg.sources.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem' }}>
                  <div
                    onClick={() => toggleSource(msg.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: 'var(--brand-300)', fontWeight: 600 }}
                  >
                    <span>📑 {msg.sources.length} Verified Sources Cited</span>
                    {expandedSources[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </div>

                  {expandedSources[msg.id] && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {msg.sources.map((s, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'var(--bg-input)',
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-xs)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                            <span>{s.documentTitle}</span>
                            <span style={{ color: 'var(--brand-400)' }}>{s.pageOrLocation}</span>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>
                            "{s.snippet}"
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 'var(--text-xs)', padding: '6px 12px' }}>
            <Sparkles size={14} className="glow-brand" />
            Libris is analyzing documents & synthesizing response...
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSendMessage();
        }}
        style={{
          padding: 'var(--space-3)',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: 'var(--space-2)',
        }}
      >
        <input
          type="text"
          placeholder={activeDocument ? `Ask Libris about ${activeDocument.title}...` : 'Ask Libris across your library...'}
          value={inputQuery}
          onChange={e => setInputQuery(e.target.value)}
          style={{ flex: 1, fontSize: 'var(--text-sm)' }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!inputQuery.trim() || isLoading}
          style={{ padding: '0 12px' }}
        >
          <Send size={15} />
        </button>
      </form>
    </aside>
  );
};
