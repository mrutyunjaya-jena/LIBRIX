import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  BookOpen,
  FileText,
  HelpCircle,
  Zap,
  Trash2,
  Lock,
  ChevronDown,
  ExternalLink,
  Cpu,
  Bookmark,
  Check,
} from 'lucide-react';
import {
  Document,
  LibrisChatMessage,
  LibrisSourceCitation,
  CustomAIProviderConfig,
} from '../core/types';
import { db } from '../core/db/DatabaseEngine';
import { chunkDocumentText } from './rag/DocumentChunker';
import { ContextAssembler } from './rag/ContextAssembler';
import { CustomAIProvider } from './providers/CustomAIProvider';
import { usePlatform } from '../platform/PlatformContext';

interface LibrisAssistantProps {
  currentDocument?: Document | null;
  selectedTextPassage?: string;
  onClose: () => void;
  onNavigateToCitation?: (docId: string, location: string) => void;
}

export const LibrisAssistant: React.FC<LibrisAssistantProps> = ({
  currentDocument,
  selectedTextPassage,
  onClose,
  onNavigateToCitation,
}) => {
  const platform = usePlatform();

  // State
  const [messages, setMessages] = useState<LibrisChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSources, setStreamingSources] = useState<LibrisSourceCitation[]>([]);

  // Providers & Context
  const [providers, setProviders] = useState<CustomAIProviderConfig[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string>('');
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [selectedContextDocId, setSelectedContextDocId] = useState<string>(
    currentDocument?.id || 'library'
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Database Providers, Documents, and Chunks
  useEffect(() => {
    const initData = async () => {
      const dbProviders = await db.getAIProviders();
      setProviders(dbProviders);
      const def = dbProviders.find(p => p.isDefault) || dbProviders[0];
      if (def) setActiveProviderId(def.id);

      const docs = await db.getDocuments();
      setAllDocs(docs);

      // Index chunks for database
      for (const d of docs) {
        if (d.contentSnippet) {
          const chunks = chunkDocumentText(d.id, d.contentSnippet);
          await db.saveDocumentChunks(d.id, chunks);
        }
      }

      // Initial welcome message
      setMessages([
        {
          id: 'welcome-1',
          sender: 'libris',
          content: currentDocument
            ? `Libris Research Terminal active. Context loaded: **${currentDocument.title}** (${currentDocument.format.toUpperCase()}).\n\nAsk questions, generate flashcards, or extract key points with local RAG citations.`
            : `Libris Research Terminal active. Universal Library Knowledge Base loaded.\n\nAsk anything about your books, papers, and personal notes.`,
          timestamp: Date.now(),
        },
      ]);
    };

    initData();
  }, [currentDocument]);

  useEffect(() => {
    if (selectedTextPassage) {
      setInputQuery(`Explain this excerpt: "${selectedTextPassage}"`);
    }
  }, [selectedTextPassage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Execute RAG Query & Stream AI Response
  const handleSendMessage = async (customPrompt?: string) => {
    const query = customPrompt || inputQuery;
    if (!query.trim() || isStreaming) return;

    const userMsg: LibrisChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      content: query,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingSources([]);

    // 1. Assemble RAG Context & Source Citations
    const activeDocFilter = selectedContextDocId !== 'library' ? selectedContextDocId : undefined;
    const { systemPrompt, sources } = await ContextAssembler.assembleContext(query, {
      documentId: activeDocFilter,
    });

    setStreamingSources(sources);

    // 2. Invoke Active AI Provider
    const activeConfig = providers.find(p => p.id === activeProviderId) || providers[0];
    const providerClient = new CustomAIProvider(
      activeConfig || {
        id: 'fallback',
        name: 'Local Ollama',
        baseUrl: 'http://localhost:11434',
        modelName: 'llama3',
        isLocal: true,
      }
    );

    try {
      let accumulatedResponse = '';
      await providerClient.streamCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        chunk => {
          accumulatedResponse += chunk;
          setStreamingContent(accumulatedResponse);
        }
      );

      const assistantMsg: LibrisChatMessage = {
        id: `msg_libris_${Date.now()}`,
        sender: 'libris',
        content: accumulatedResponse || 'Analysis completed with source citations.',
        sources,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: 'libris',
          content: `Unable to complete AI query: ${e.message || 'Endpoint connection failed'}. Check Settings > AI Providers.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingSources([]);
    }
  };

  const activeProvider = providers.find(p => p.id === activeProviderId);

  return (
    <div
      className="card card-elevated scifi-box"
      style={{
        width: 380,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderLeft: '1px solid var(--border-strong)',
        background: 'var(--bg-surface-elevated)',
        zIndex: 50,
      }}
    >
      {/* 1. Technical Header */}
      <div
        style={{
          padding: 'max(10px, var(--sat)) 14px 10px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={15} />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em' }}>
              LIBRIS // AI WORKSTATION
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
              {activeProvider?.isLocal ? '● LOCAL PRIVATE INFERENCE' : '○ REMOTE ENDPOINT'}
            </div>
          </div>
        </div>

        <button className="btn-icon btn-sm" onClick={onClose} title="Close Assistant">
          ✕
        </button>
      </div>

      {/* 2. Context & Provider Configuration Bar */}
      <div
        style={{
          padding: '6px 12px',
          background: 'var(--bg-input)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 'var(--text-2xs)',
        }}
      >
        {/* Context Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>CONTEXT:</span>
          <select
            value={selectedContextDocId}
            onChange={e => setSelectedContextDocId(e.target.value)}
            style={{ fontSize: 'var(--text-2xs)', padding: '2px 4px', maxWidth: '75%' }}
          >
            <option value="library">[ Entire Library Index ]</option>
            {allDocs.map(d => (
              <option key={d.id} value={d.id}>
                {d.title.length > 28 ? d.title.substring(0, 26) + '…' : d.title}
              </option>
            ))}
          </select>
        </div>

        {/* Provider Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>PROVIDER:</span>
          <select
            value={activeProviderId}
            onChange={e => setActiveProviderId(e.target.value)}
            style={{ fontSize: 'var(--text-2xs)', padding: '2px 4px', maxWidth: '75%' }}
          >
            {providers.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.modelName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Research Quick Action Chips */}
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
          background: 'var(--bg-surface)',
        }}
      >
        <button
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.65rem', padding: '2px 6px' }}
          onClick={() => handleSendMessage('Generate an executive summary of this document with key takeaways.')}
        >
          Summarize
        </button>
        <button
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.65rem', padding: '2px 6px' }}
          onClick={() => handleSendMessage('Extract 5 core concepts and provide study flashcards with Q&A.')}
        >
          Flashcards
        </button>
        <button
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.65rem', padding: '2px 6px' }}
          onClick={() => handleSendMessage('Create a structured study guide highlighting main arguments and architecture.')}
        >
          Study Guide
        </button>
      </div>

      {/* 4. Chat Messages Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '92%',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-2xs)',
                fontFamily: 'var(--font-tech)',
                color: 'var(--text-muted)',
                marginBottom: 2,
                textAlign: msg.sender === 'user' ? 'right' : 'left',
              }}
            >
              {msg.sender === 'user' ? 'OPERATOR' : 'LIBRIS // RAG'}
            </div>

            <div
              className="card"
              style={{
                padding: '8px 12px',
                fontSize: 'var(--text-xs)',
                lineHeight: 1.5,
                background: msg.sender === 'user' ? 'var(--btn-primary-bg)' : 'var(--bg-surface)',
                color: msg.sender === 'user' ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

              {/* Source Citations */}
              {msg.sources && msg.sources.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: 'var(--font-tech)', fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    VERIFIED SOURCES:
                  </span>
                  {msg.sources.map((src, i) => (
                    <div
                      key={i}
                      onClick={() => onNavigateToCitation?.(src.documentId, src.pageOrLocation)}
                      style={{
                        fontSize: '0.65rem',
                        fontFamily: 'var(--font-tech)',
                        padding: '3px 6px',
                        background: 'var(--bg-input)',
                        borderRadius: 2,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      title="Click to jump to document excerpt"
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        [{i + 1}] {src.documentTitle} • {src.pageOrLocation}
                      </span>
                      <ExternalLink size={10} style={{ opacity: 0.6 }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live Streaming Message */}
        {isStreaming && (
          <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', maxWidth: '92%' }}>
            <div style={{ fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)', marginBottom: 2 }}>
              LIBRIS // STREAMING...
            </div>
            <div className="card" style={{ padding: '8px 12px', fontSize: 'var(--text-xs)', background: 'var(--bg-surface)' }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {streamingContent}
                <span className="terminal-cursor" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 5. Input Area */}
      <div
        style={{
          padding: '10px 12px calc(var(--sab) + 12px) 12px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex',
          gap: 6,
        }}
      >
        <input
          type="text"
          placeholder="Ask Libris about documents..."
          value={inputQuery}
          onChange={e => setInputQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={isStreaming}
          style={{ flex: 1, fontSize: 'var(--text-xs)', padding: '8px 12px' }}
        />
        <button
          className="btn btn-primary"
          onClick={() => handleSendMessage()}
          disabled={!inputQuery.trim() || isStreaming}
          style={{ padding: '8px 14px' }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};
