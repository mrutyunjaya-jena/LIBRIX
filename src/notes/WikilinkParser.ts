/**
 * LIBRIX Obsidian-Style Wikilink & Graph Parser
 * Extracts YAML frontmatter, [[Wikilinks]], [[Target|Alias]], #tags, and builds bidirectional graph connections.
 */

export interface ParsedMarkdown {
  title?: string;
  frontmatter: Record<string, any>;
  body: string;
  wikilinks: string[]; // Target titles or aliases
  tags: string[];
  headers: { level: number; text: string }[];
  icon?: string;
  cover?: string;
  status?: string;
}

export class WikilinkParser {
  /**
   * Parse a raw Markdown document
   */
  public static parse(content: string): ParsedMarkdown {
    let body = content;
    const frontmatter: Record<string, any> = {};

    // 1. Extract YAML Frontmatter: --- ... ---
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      const rawFm = fmMatch[1];
      body = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim();

      rawFm.split('\n').forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const key = line.substring(0, colonIdx).trim();
          let val: any = line.substring(colonIdx + 1).trim();

          // Handle array [tag1, tag2]
          if (val.startsWith('[') && val.endsWith(']')) {
            val = val
              .slice(1, -1)
              .split(',')
              .map((s: string) => s.trim().replace(/^["']|["']$/g, ''));
          } else if (val.startsWith('"') || val.startsWith("'")) {
            val = val.slice(1, -1);
          }
          frontmatter[key] = val;
        }
      });
    }

    // 2. Extract [[Wikilinks]] and [[Target|Alias]]
    const wikilinkRegex = /\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g;
    const wikilinks: string[] = [];
    let wlMatch;
    while ((wlMatch = wikilinkRegex.exec(body)) !== null) {
      const target = wlMatch[1].trim();
      if (target && !wikilinks.includes(target)) {
        wikilinks.push(target);
      }
    }

    // 3. Extract #tags (excluding Markdown headers)
    const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\-\/]+)/g;
    const tags: string[] = [];
    let tagMatch;
    while ((tagMatch = tagRegex.exec(body)) !== null) {
      const tag = tagMatch[1].trim();
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    // Also merge tags from frontmatter if present
    if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
      frontmatter.tags.forEach((t: string) => {
        if (!tags.includes(t)) tags.push(t);
      });
    }

    // 4. Extract Markdown Headings
    const headerRegex = /^(#{1,6})\s+(.+)$/gm;
    const headers: { level: number; text: string }[] = [];
    let hMatch;
    while ((hMatch = headerRegex.exec(body)) !== null) {
      headers.push({
        level: hMatch[1].length,
        text: hMatch[2].trim(),
      });
    }

    const title = frontmatter.title || headers[0]?.text || 'Untitled';
    const icon = frontmatter.icon || '📄';
    const cover = frontmatter.cover || undefined;
    const status = frontmatter.status || 'Draft';

    return {
      title,
      frontmatter,
      body,
      wikilinks,
      tags,
      headers,
      icon,
      cover,
      status,
    };
  }

  /**
   * Render HTML preview replacing [[Wikilinks]], Notion Callouts, Checklists, Tables, Toggles
   */
  public static renderToHtml(markdown: string, _onWikilinkClick?: (target: string) => void): string {
    const { body } = WikilinkParser.parse(markdown);

    const lines = body.split('\n');
    const processedLines: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];

    const flushTable = () => {
      if (tableRows.length === 0) return;
      let tableHtml = '<div class="notion-table-wrapper"><table class="notion-table">';
      tableRows.forEach((r, idx) => {
        const cells = r.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());
        if (idx === 1 && cells.every(c => /^[-:]+$/.test(c))) {
          // Separator row, ignore
          return;
        }
        const tag = idx === 0 ? 'th' : 'td';
        tableHtml += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
      });
      tableHtml += '</table></div>';
      processedLines.push(tableHtml);
      tableRows = [];
      inTable = false;
    };

    lines.forEach((line, lineIndex) => {
      // Table detection
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        tableRows.push(line.trim());
        return;
      } else if (inTable) {
        flushTable();
      }

      // Notion Callout Boxes & Toggles: > 💡 Tip: or > [!TIP] or > ⚠️ Warning: or > [!TOGGLE]
      const calloutMatch = line.match(/^>\s*(💡|⚠️|ℹ️|🎯|🚀|🔥|\[!TIP\]|\[!WARNING\]|\[!NOTE\]|\[!IMPORTANT\]|\[!TOGGLE\])\s*(.*)$/i);
      if (calloutMatch) {
        let type = 'info';
        let icon = '💡';
        const marker = calloutMatch[1].toUpperCase();
        if (marker.includes('TOGGLE')) {
          processedLines.push(
            `<details class="notion-toggle"><summary>${calloutMatch[2] || 'Toggle Section'}</summary><div class="notion-toggle-content">`
          );
          return;
        } else if (marker.includes('⚠️') || marker.includes('WARNING')) {
          type = 'warning';
          icon = '⚠️';
        } else if (marker.includes('💡') || marker.includes('TIP')) {
          type = 'tip';
          icon = '💡';
        } else if (marker.includes('🎯') || marker.includes('IMPORTANT')) {
          type = 'important';
          icon = '🎯';
        } else if (marker.includes('🚀') || marker.includes('FIRE')) {
          type = 'feature';
          icon = '🚀';
        }
        processedLines.push(
          `<div class="notion-callout notion-callout-${type}"><span class="notion-callout-icon">${icon}</span><div class="notion-callout-text">${calloutMatch[2]}</div></div>`
        );
        return;
      }

      // Checklists: - [ ] item or - [x] item
      const taskMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.*)$/);
      if (taskMatch) {
        const checked = taskMatch[1].toLowerCase() === 'x';
        processedLines.push(
          `<div class="notion-task-item ${checked ? 'notion-task-checked' : ''}" data-line-index="${lineIndex}">` +
          `<input type="checkbox" ${checked ? 'checked' : ''} class="notion-task-checkbox" data-task-line="${lineIndex}" />` +
          `<span class="notion-task-label ${checked ? 'line-through' : ''}">${taskMatch[2]}</span>` +
          `</div>`
        );
        return;
      }

      // Close open toggle tags if line is not blockquote
      if (line.startsWith('<details') && !line.includes('class="notion-toggle"')) {
        processedLines.push(line.replace('<details', '<details class="notion-toggle"'));
        return;
      }

      processedLines.push(line);
    });

    if (inTable) flushTable();

    let html = processedLines.join('\n')
      // Bold & Italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Strikethrough
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      // Highlight: ==text==
      .replace(/==(.*?)==/g, '<mark class="notion-highlight">$1</mark>')
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="md-h3 notion-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="md-h2 notion-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="md-h1 notion-h1">$1</h1>')
      // Blockquotes
      .replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>')
      // Code blocks
      .replace(/```([a-z]*)\n([\s\S]*?)```/gm, '<pre class="md-code-block"><div class="code-lang-tag">$1</div><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
      // Dividers
      .replace(/^(?:---|___|\*\*\*)$/gm, '<hr class="notion-divider" />')
      // Bullet Lists (standard)
      .replace(/^\- (?!<div class="notion-task)(.*$)/gim, '<li class="md-li">$1</li>')
      // Numbered Lists
      .replace(/^\d+\.\s+(.*$)/gim, '<li class="md-oli">$1</li>')
      // Paragraph breaks
      .replace(/\n\n/g, '</p><p>')
      // Wikilinks: [[Target|Alias]] or [[Target]]
      .replace(/\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g, (_match, target, alias) => {
        const displayText = alias || target;
        return `<a href="#wikilink" class="wikilink-badge" data-target="${target}" style="color: var(--text-primary); text-decoration: underline; text-underline-offset: 3px; font-weight: 600; cursor: pointer;">[[${displayText}]]</a>`;
      })
      // Tags
      .replace(/(?:^|\s)#([a-zA-Z0-9_\-\/]+)/g, ' <span class="badge" style="font-family: var(--font-tech);">#$1</span>');

    return `<div class="md-rendered-container notion-rendered-page"><p>${html}</p></div>`;
  }
}

export const parseNoteContent = (content: string): ParsedMarkdown => {
  return WikilinkParser.parse(content);
};
