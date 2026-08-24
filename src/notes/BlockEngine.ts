/**
 * LIBRIX Block Engine
 * Handles bidirectional conversion between CanvasBlock[] and Markdown,
 * block creation, deletion, reordering, and type transformations.
 */

export type BlockType =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'todo'
  | 'bullet'
  | 'number'
  | 'toggle'
  | 'callout'
  | 'code'
  | 'quote'
  | 'divider'
  | 'table'
  | 'image'
  | 'math'
  | 'file'
  | 'bookmark';

// Backward compatibility alias
export type NotionBlockType = BlockType;

export interface CanvasBlock {
  id: string;
  type: BlockType;
  content: string;
  properties?: {
    checked?: boolean;
    icon?: string;
    calloutType?: 'tip' | 'warning' | 'info' | 'important' | 'feature';
    language?: string;
    isOpen?: boolean;
    subContent?: string;
    tableData?: string[][]; // For table blocks
    url?: string; // For image, file, bookmark blocks
    caption?: string; // For image blocks
    formula?: string; // For LaTeX / Math blocks
    fileName?: string; // For file/document blocks
    fileSize?: string; // For file/document blocks
    fileType?: string; // For file/document blocks
    title?: string; // For bookmark/URL blocks
    domain?: string; // For bookmark/URL blocks
    description?: string; // For bookmark/URL blocks
  };
}

// Backward compatibility alias
export type NotionBlock = CanvasBlock;

export class BlockEngine {
  /**
   * Generates unique block ID
   */
  public static createId(): string {
    return 'block_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  }

  /**
   * Create a new block with defaults
   */
  public static createBlock(type: BlockType = 'text', content = '', properties?: Record<string, any>): CanvasBlock {
    const base: CanvasBlock = {
      id: BlockEngine.createId(),
      type,
      content,
      properties: properties || {},
    };

    if (type === 'todo' && base.properties?.checked === undefined) {
      base.properties = { ...base.properties, checked: false };
    } else if (type === 'callout') {
      base.properties = {
        ...base.properties,
        icon: base.properties?.icon || '💡',
        calloutType: base.properties?.calloutType || 'tip',
      };
    } else if (type === 'code') {
      base.properties = {
        ...base.properties,
        language: base.properties?.language || 'typescript',
      };
    } else if (type === 'toggle') {
      base.properties = {
        ...base.properties,
        isOpen: base.properties?.isOpen !== undefined ? base.properties.isOpen : true,
      };
    } else if (type === 'table' && !base.properties?.tableData) {
      base.properties = {
        ...base.properties,
        tableData: [
          ['Item', 'Category', 'Status'],
          ['Concept 1', 'Theory', 'Done'],
          ['Concept 2', 'Implementation', 'In Progress'],
        ],
      };
    } else if (type === 'image') {
      base.properties = {
        ...base.properties,
        url: base.properties?.url || (content.startsWith('http') ? content : ''),
        caption: base.properties?.caption || (!content.startsWith('http') ? content : ''),
      };
    } else if (type === 'math') {
      base.properties = {
        ...base.properties,
        formula: base.properties?.formula || content || 'f(x) = \\int_{-\\infty}^\\infty \\hat{f}(\\xi) e^{2 \\pi i \\xi x} d\\xi',
      };
      if (!base.content) {
        base.content = base.properties.formula || '';
      }
    } else if (type === 'file') {
      base.properties = {
        ...base.properties,
        url: base.properties?.url || (content.startsWith('http') || content.startsWith('blob:') ? content : ''),
        fileName: base.properties?.fileName || (!content.startsWith('http') ? content : '') || 'Document_Attachment.pdf',
        fileSize: base.properties?.fileSize || '2.4 MB',
        fileType: base.properties?.fileType || 'PDF',
      };
    } else if (type === 'bookmark') {
      let domain = 'link';
      if (content.startsWith('http')) {
        try { domain = new URL(content).hostname; } catch {}
      }
      base.properties = {
        ...base.properties,
        url: base.properties?.url || (content.startsWith('http') ? content : ''),
        title: base.properties?.title || (!content.startsWith('http') ? content : '') || 'Web Resource',
        domain: base.properties?.domain || domain,
        description: base.properties?.description || 'Web documentation and research reference',
      };
    }

    return base;
  }

  /**
   * Parse a raw markdown string into an array of CanvasBlocks
   */
  public static markdownToBlocks(markdown: string): CanvasBlock[] {
    const cleanMd = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim();
    if (!cleanMd) {
      return [BlockEngine.createBlock('text', '')];
    }

    const lines = cleanMd.split('\n');
    const blocks: CanvasBlock[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines between blocks
      if (!trimmed) {
        i++;
        continue;
      }

      // Code Block: ```lang ... ```
      if (trimmed.startsWith('```')) {
        const lang = trimmed.substring(3).trim() || 'typescript';
        let codeContent = '';
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeContent += (codeContent ? '\n' : '') + lines[i];
          i++;
        }
        blocks.push(
          BlockEngine.createBlock('code', codeContent, { language: lang })
        );
        i++; // skip closing ```
        continue;
      }

      // LaTeX Math Equation: $$ ... $$
      if (trimmed.startsWith('$$')) {
        let mathFormula = '';
        if (trimmed.length > 2 && trimmed.endsWith('$$') && trimmed !== '$$') {
          mathFormula = trimmed.substring(2, trimmed.length - 2).trim();
          i++;
        } else {
          i++;
          while (i < lines.length && !lines[i].trim().startsWith('$$')) {
            mathFormula += (mathFormula ? '\n' : '') + lines[i];
            i++;
          }
          i++; // skip closing $$
        }
        blocks.push(
          BlockEngine.createBlock('math', mathFormula, { formula: mathFormula })
        );
        continue;
      }

      // File Attachment: [📎 FileName (Size)](url)
      const fileMatch = line.match(/^\[📎\s*(.*?)(?:\s*\((.*?)\))?\]\((.*?)\)$/);
      if (fileMatch) {
        blocks.push(
          BlockEngine.createBlock('file', '', {
            fileName: fileMatch[1],
            fileSize: fileMatch[2] || 'File',
            url: fileMatch[3],
          })
        );
        i++;
        continue;
      }

      // Web Bookmark / URL: [🔗 Title](url)
      const bookmarkMatch = line.match(/^\[🔗\s*(.*?)\]\((.*?)\)$/);
      if (bookmarkMatch) {
        let domain = 'link';
        try { domain = new URL(bookmarkMatch[2]).hostname; } catch {}
        blocks.push(
          BlockEngine.createBlock('bookmark', '', {
            title: bookmarkMatch[1],
            url: bookmarkMatch[2],
            domain,
          })
        );
        i++;
        continue;
      }

      // Image Block: ![caption](url)
      const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        blocks.push(
          BlockEngine.createBlock('image', '', { caption: imgMatch[1], url: imgMatch[2] })
        );
        i++;
        continue;
      }

      // Table Block: | col1 | col2 |
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const tableRows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          const r = lines[i].trim();
          const cells = r.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
          // Ignore separator row |--|--|
          if (cells.every(c => /^[-:]+$/.test(c))) {
            i++;
            continue;
          }
          tableRows.push(cells);
          i++;
        }
        blocks.push(
          BlockEngine.createBlock('table', '', { tableData: tableRows })
        );
        continue;
      }

      // Heading 1: # Title
      if (line.startsWith('# ')) {
        blocks.push(BlockEngine.createBlock('h1', line.substring(2)));
        i++;
        continue;
      }

      // Heading 2: ## Title
      if (line.startsWith('## ')) {
        blocks.push(BlockEngine.createBlock('h2', line.substring(3)));
        i++;
        continue;
      }

      // Heading 3: ### Title
      if (line.startsWith('### ')) {
        blocks.push(BlockEngine.createBlock('h3', line.substring(4)));
        i++;
        continue;
      }

      // Checkbox / Todo: - [ ] or - [x]
      const todoMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.*)$/);
      if (todoMatch) {
        blocks.push(
          BlockEngine.createBlock('todo', todoMatch[2], {
            checked: todoMatch[1].toLowerCase() === 'x',
          })
        );
        i++;
        continue;
      }

      // Bullet List: - item or * item
      if (/^[-*]\s+(.*)$/.test(line)) {
        const itemContent = line.replace(/^[-*]\s+/, '');
        blocks.push(BlockEngine.createBlock('bullet', itemContent));
        i++;
        continue;
      }

      // Numbered List: 1. item
      if (/^\d+\.\s+(.*)$/.test(line)) {
        const itemContent = line.replace(/^\d+\.\s+/, '');
        blocks.push(BlockEngine.createBlock('number', itemContent));
        i++;
        continue;
      }

      // Callouts: > 💡 or > [!TIP] or > ⚠️ or > 🎯 or > [!TOGGLE]
      const calloutMatch = line.match(/^>\s*(💡|⚠️|ℹ️|🎯|🚀|🔥|\[!TIP\]|\[!WARNING\]|\[!NOTE\]|\[!IMPORTANT\]|\[!TOGGLE\])\s*(.*)$/i);
      if (calloutMatch) {
        const marker = calloutMatch[1].toUpperCase();
        if (marker.includes('TOGGLE')) {
          blocks.push(BlockEngine.createBlock('toggle', calloutMatch[2], { isOpen: true }));
        } else {
          let calloutType: 'tip' | 'warning' | 'info' | 'important' | 'feature' = 'tip';
          let icon = '💡';
          if (marker.includes('⚠️') || marker.includes('WARNING')) {
            calloutType = 'warning';
            icon = '⚠️';
          } else if (marker.includes('ℹ️') || marker.includes('NOTE')) {
            calloutType = 'info';
            icon = 'ℹ️';
          } else if (marker.includes('🎯') || marker.includes('IMPORTANT')) {
            calloutType = 'important';
            icon = '🎯';
          } else if (marker.includes('🚀') || marker.includes('FIRE')) {
            calloutType = 'feature';
            icon = '🚀';
          }
          blocks.push(
            BlockEngine.createBlock('callout', calloutMatch[2], { icon, calloutType })
          );
        }
        i++;
        continue;
      }

      // Quote Block: > text
      if (line.startsWith('> ')) {
        blocks.push(BlockEngine.createBlock('quote', line.substring(2)));
        i++;
        continue;
      }

      // Divider: --- or ***
      if (/^(?:---|___|\*\*\*)$/.test(trimmed)) {
        blocks.push(BlockEngine.createBlock('divider', ''));
        i++;
        continue;
      }

      // Standard Text Paragraph
      blocks.push(BlockEngine.createBlock('text', line));
      i++;
    }

    return blocks.length > 0 ? blocks : [BlockEngine.createBlock('text', '')];
  }

  /**
   * Serialize an array of CanvasBlocks into clean Markdown
   */
  public static blocksToMarkdown(blocks: CanvasBlock[]): string {
    const parts: string[] = [];

    blocks.forEach(b => {
      switch (b.type) {
        case 'h1':
          parts.push(`# ${b.content}`);
          break;
        case 'h2':
          parts.push(`## ${b.content}`);
          break;
        case 'h3':
          parts.push(`### ${b.content}`);
          break;
        case 'todo':
          parts.push(`- [${b.properties?.checked ? 'x' : ' '}] ${b.content}`);
          break;
        case 'bullet':
          parts.push(`- ${b.content}`);
          break;
        case 'number':
          parts.push(`1. ${b.content}`);
          break;
        case 'toggle':
          parts.push(`> [!TOGGLE] ${b.content}`);
          break;
        case 'callout': {
          const icon = b.properties?.icon || '💡';
          parts.push(`> ${icon} ${b.content}`);
          break;
        }
        case 'quote':
          parts.push(`> ${b.content}`);
          break;
        case 'code': {
          const lang = b.properties?.language || 'typescript';
          parts.push(`\`\`\`${lang}\n${b.content}\n\`\`\``);
          break;
        }
        case 'image': {
          const url = b.properties?.url || '';
          const cap = b.properties?.caption || b.content || 'Image';
          parts.push(`![${cap}](${url})`);
          break;
        }
        case 'math': {
          const formula = b.content || b.properties?.formula || 'f(x) = \\int_{-\\infty}^\\infty \\hat{f}(\\xi) e^{2 \\pi i \\xi x} d\\xi';
          parts.push(`$$\n${formula}\n$$`);
          break;
        }
        case 'file': {
          const name = b.properties?.fileName || b.content || 'Document_Attachment.pdf';
          const size = b.properties?.fileSize ? ` (${b.properties.fileSize})` : '';
          const url = b.properties?.url || '#';
          parts.push(`[📎 ${name}${size}](${url})`);
          break;
        }
        case 'bookmark': {
          const title = b.properties?.title || b.content || 'Web Resource';
          const url = b.properties?.url || 'https://';
          parts.push(`[🔗 ${title}](${url})`);
          break;
        }
        case 'divider':
          parts.push('---');
          break;
        case 'table': {
          const rows = b.properties?.tableData || [
            ['Header 1', 'Header 2'],
            ['Cell 1', 'Cell 2'],
          ];
          if (rows.length > 0) {
            const header = `| ${rows[0].join(' | ')} |`;
            const separator = `| ${rows[0].map(() => '---').join(' | ')} |`;
            const body = rows.slice(1).map(r => `| ${r.join(' | ')} |`).join('\n');
            parts.push(`${header}\n${separator}\n${body}`);
          }
          break;
        }
        case 'text':
        default:
          parts.push(b.content);
          break;
      }
    });

    return parts.join('\n\n');
  }
}

// Backward compatibility alias
export const NotionBlockEngine = BlockEngine;
