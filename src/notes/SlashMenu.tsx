import React, { useState, useEffect, useRef } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  List,
  ListOrdered,
  AlertCircle,
  Lightbulb,
  Info,
  Target,
  Code,
  Table,
  ChevronRight,
  Quote,
  Minus,
  Link,
  Calendar,
  Sparkles,
  Zap,
  Image as ImageIcon,
  Sigma,
  Paperclip,
  Globe,
} from 'lucide-react';

export interface SlashMenuItem {
  id: string;
  category: 'BASIC BLOCKS' | 'FORMATS & MEDIA' | 'ADVANCED' | 'AI ASSISTANT';
  title: string;
  description: string;
  icon: React.ReactNode;
  template: string | ((context?: string) => string);
  keywords: string[];
  isAi?: boolean;
}

export interface SlashMenuProps {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  onSelect: (item: SlashMenuItem) => void;
  onClose: () => void;
}

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  // Basic Blocks
  {
    id: 'h1',
    category: 'BASIC BLOCKS',
    title: 'Heading 1',
    description: 'Large section header',
    icon: <Heading1 size={15} />,
    template: '# ',
    keywords: ['h1', 'heading', 'title', 'large', 'header'],
  },
  {
    id: 'h2',
    category: 'BASIC BLOCKS',
    title: 'Heading 2',
    description: 'Medium section header',
    icon: <Heading2 size={15} />,
    template: '## ',
    keywords: ['h2', 'heading', 'subtitle', 'medium'],
  },
  {
    id: 'h3',
    category: 'BASIC BLOCKS',
    title: 'Heading 3',
    description: 'Small sub-heading',
    icon: <Heading3 size={15} />,
    template: '### ',
    keywords: ['h3', 'heading', 'small'],
  },
  {
    id: 'todo',
    category: 'BASIC BLOCKS',
    title: 'To-do List',
    description: 'Track tasks with interactive checkboxes',
    icon: <CheckSquare size={15} />,
    template: '- [ ] ',
    keywords: ['todo', 'task', 'checkbox', 'checklist', 'done'],
  },
  {
    id: 'bullet',
    category: 'BASIC BLOCKS',
    title: 'Bulleted List',
    description: 'Create a simple bulleted list',
    icon: <List size={15} />,
    template: '- ',
    keywords: ['bullet', 'list', 'unordered'],
  },
  {
    id: 'number',
    category: 'BASIC BLOCKS',
    title: 'Numbered List',
    description: 'Create an ordered sequence',
    icon: <ListOrdered size={15} />,
    template: '1. ',
    keywords: ['number', 'ordered', 'list', 'sequence'],
  },
  {
    id: 'toggle',
    category: 'BASIC BLOCKS',
    title: 'Toggle List',
    description: 'Collapsible section with hidden contents',
    icon: <ChevronRight size={15} />,
    template: '> [!TOGGLE] Toggle Heading\n> Hidden details and notes here...\n\n',
    keywords: ['toggle', 'collapse', 'details', 'accordion', 'fold'],
  },

  // Formats & Media
  {
    id: 'callout_tip',
    category: 'FORMATS & MEDIA',
    title: 'Callout: Tip 💡',
    description: 'Highlighted takeaway or key tip',
    icon: <Lightbulb size={15} color="#eab308" />,
    template: '> 💡 **Tip:** Enter your key insight here.\n\n',
    keywords: ['callout', 'tip', 'idea', 'insight', 'lightbulb'],
  },
  {
    id: 'callout_warning',
    category: 'FORMATS & MEDIA',
    title: 'Callout: Warning ⚠️',
    description: 'Caution or critical notice',
    icon: <AlertCircle size={15} color="#ef4444" />,
    template: '> ⚠️ **Warning:** Note this critical consideration.\n\n',
    keywords: ['callout', 'warning', 'alert', 'caution', 'danger'],
  },
  {
    id: 'callout_info',
    category: 'FORMATS & MEDIA',
    title: 'Callout: Info ℹ️',
    description: 'Contextual information box',
    icon: <Info size={15} color="#3b82f6" />,
    template: '> ℹ️ **Info:** Relevant context and background.\n\n',
    keywords: ['callout', 'info', 'note', 'box'],
  },
  {
    id: 'callout_objective',
    category: 'FORMATS & MEDIA',
    title: 'Callout: Objective 🎯',
    description: 'Goal or mission milestone',
    icon: <Target size={15} color="#10b981" />,
    template: '> 🎯 **Key Objective:** Specific goal to accomplish.\n\n',
    keywords: ['callout', 'objective', 'goal', 'target', 'milestone'],
  },
  {
    id: 'quote',
    category: 'FORMATS & MEDIA',
    title: 'Quote',
    description: 'Capture a quote or citation',
    icon: <Quote size={15} />,
    template: '> "The best way to predict the future is to invent it."\n\n',
    keywords: ['quote', 'citation', 'blockquote'],
  },
  {
    id: 'code',
    category: 'FORMATS & MEDIA',
    title: 'Code Block',
    description: 'Syntax-highlighted code snippet',
    icon: <Code size={15} />,
    template: '```typescript\n// Enter code here\nconsole.log("Hello Librix");\n```\n',
    keywords: ['code', 'snippet', 'syntax', 'typescript', 'javascript', 'python'],
  },
  {
    id: 'table',
    category: 'FORMATS & MEDIA',
    title: 'Table',
    description: 'Formatted markdown data table',
    icon: <Table size={15} />,
    template: '| Item | Category | Status |\n|---|---|---|\n| Concept 1 | Theory | In Progress |\n| Concept 2 | Implementation | Completed |\n\n',
    keywords: ['table', 'grid', 'columns', 'data', 'rows'],
  },
  {
    id: 'image',
    category: 'FORMATS & MEDIA',
    title: 'Image',
    description: 'Embed an image with URL or upload',
    icon: <ImageIcon size={15} color="#0ea5e9" />,
    template: '![Image Description](https://images.unsplash.com/photo-1507842229451-7f01dd8610ad?auto=format&fit=crop&w=1200&q=80)\n',
    keywords: ['image', 'photo', 'picture', 'upload', 'media', 'img', 'artwork'],
  },
  {
    id: 'file',
    category: 'FORMATS & MEDIA',
    title: 'File / Document',
    description: 'Upload or attach a PDF, document, or file',
    icon: <Paperclip size={15} color="#10b981" />,
    template: '[📎 Research_Paper.pdf (2.4 MB)](https://example.com/paper.pdf)\n',
    keywords: ['file', 'attachment', 'upload', 'document', 'pdf', 'paper', 'doc'],
  },
  {
    id: 'bookmark',
    category: 'FORMATS & MEDIA',
    title: 'Web Bookmark / URL',
    description: 'Embed a web link card with preview',
    icon: <Globe size={15} color="#6366f1" />,
    template: '[🔗 Research & Docs](https://arxiv.org)\n',
    keywords: ['url', 'link', 'bookmark', 'web', 'website', 'http', 'embed'],
  },
  {
    id: 'divider',
    category: 'FORMATS & MEDIA',
    title: 'Divider',
    description: 'Visually divide sections',
    icon: <Minus size={15} />,
    template: '\n---\n\n',
    keywords: ['divider', 'line', 'hr', 'separator'],
  },
  {
    id: 'latex',
    category: 'ADVANCED',
    title: 'LaTeX Equation',
    description: 'Render mathematical formula with LaTeX syntax',
    icon: <Sigma size={15} color="#ec4899" />,
    template: '$$\nf(x) = \\int_{-\\infty}^\\infty \\hat{f}(\\xi) e^{2 \\pi i \\xi x} d\\xi\n$$\n',
    keywords: ['latex', 'math', 'equation', 'formula', 'algebra', 'calculus', 'sigma', 'physics'],
  },
  {
    id: 'wikilink',
    category: 'ADVANCED',
    title: 'Wikilink [[ ]]',
    description: 'Link to another book or note in knowledge graph',
    icon: <Link size={15} />,
    template: '[[Note Title]]',
    keywords: ['link', 'wikilink', 'backlink', 'graph', 'connect'],
  },
  {
    id: 'date',
    category: 'ADVANCED',
    title: 'Current Date Stamp',
    description: 'Insert today\'s formatted date',
    icon: <Calendar size={15} />,
    template: () => `📅 ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} `,
    keywords: ['date', 'today', 'calendar', 'now', 'time'],
  },

  // AI Assistant
  {
    id: 'ai_summarize',
    category: 'AI ASSISTANT',
    title: 'AI: Summarize Note',
    description: 'Generate key points summary using Libris AI',
    icon: <Sparkles size={15} color="#8b5cf6" />,
    template: 'ai:summarize',
    keywords: ['ai', 'summarize', 'summary', 'libris', 'bullet'],
    isAi: true,
  },
  {
    id: 'ai_continue',
    category: 'AI ASSISTANT',
    title: 'AI: Continue Writing',
    description: 'Brainstorm next paragraphs and elaboration',
    icon: <Zap size={15} color="#ec4899" />,
    template: 'ai:continue',
    keywords: ['ai', 'continue', 'write', 'generate', 'expand'],
    isAi: true,
  },
  {
    id: 'ai_action_items',
    category: 'AI ASSISTANT',
    title: 'AI: Extract Action Items',
    description: 'Automatically pull out checklist to-dos',
    icon: <CheckSquare size={15} color="#10b981" />,
    template: 'ai:action_items',
    keywords: ['ai', 'action', 'tasks', 'todo', 'extract'],
    isAi: true,
  },
];

// Alias for backwards compatibility
export const NOTION_SLASH_ITEMS = SLASH_MENU_ITEMS;

export const SlashMenu: React.FC<SlashMenuProps> = ({
  isOpen,
  query,
  position,
  onSelect,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const cleanQuery = query.toLowerCase().replace(/^\//, '').trim();

  const filteredItems = SLASH_MENU_ITEMS.filter(item => {
    if (!cleanQuery) return true;
    return (
      item.title.toLowerCase().includes(cleanQuery) ||
      item.description.toLowerCase().includes(cleanQuery) ||
      item.keywords.some(k => k.toLowerCase().includes(cleanQuery))
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [cleanQuery]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        if (filteredItems.length > 0) {
          e.preventDefault();
          onSelect(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onSelect, onClose]);

  if (!isOpen || filteredItems.length === 0) return null;

  const categories = Array.from(new Set(filteredItems.map(i => i.category)));

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: Math.max(10, Math.min(position.top, window.innerHeight - 380)),
        left: Math.max(20, Math.min(position.left, window.innerWidth - 320)),
        width: 300,
        maxHeight: 360,
        overflowY: 'auto',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
        padding: '6px 0',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div
        style={{
          padding: '6px 12px 4px 12px',
          fontSize: '0.65rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '0.06em',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>SLASH BLOCKS</span>
        <span style={{ fontFamily: 'var(--font-tech)', fontSize: '0.6rem' }}>ESC TO CLOSE</span>
      </div>

      <div style={{ padding: '4px 0' }}>
        {categories.map(cat => {
          const itemsInCat = filteredItems.filter(i => i.category === cat);
          return (
            <div key={cat} style={{ marginBottom: 4 }}>
              <div
                style={{
                  padding: '4px 12px 2px 12px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-tech)',
                }}
              >
                {cat}
              </div>

              {itemsInCat.map(item => {
                const globalIdx = filteredItems.indexOf(item);
                const isSelected = globalIdx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 12px',
                      background: isSelected ? 'var(--bg-hover)' : 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.1s ease',
                      outline: 'none',
                    }}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 'var(--radius-xs)',
                        background: isSelected ? 'var(--primary-glow)' : 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-primary)',
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Backwards compatibility alias
export const NotionSlashMenu = SlashMenu;
