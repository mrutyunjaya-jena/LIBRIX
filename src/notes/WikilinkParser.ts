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

    return {
      title,
      frontmatter,
      body,
      wikilinks,
      tags,
      headers,
    };
  }

  /**
   * Render HTML preview replacing [[Wikilinks]] with clickable links
   */
  public static renderToHtml(markdown: string, onWikilinkClick?: (target: string) => void): string {
    const { body } = WikilinkParser.parse(markdown);

    let html = body
      // Bold & Italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>')
      // Blockquotes
      .replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>')
      // Code blocks
      .replace(/```([a-z]*)\n([\s\S]*?)```/gm, '<pre class="md-code-block"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
      // Lists
      .replace(/^\- (.*$)/gim, '<li class="md-li">$1</li>')
      // Paragraph breaks
      .replace(/\n\n/g, '</p><p>')
      // Wikilinks: [[Target|Alias]] or [[Target]]
      .replace(/\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g, (match, target, alias) => {
        const displayText = alias || target;
        return `<a href="#wikilink" class="wikilink-badge" data-target="${target}" style="color: var(--text-primary); text-decoration: underline; text-underline-offset: 3px; font-weight: 600; cursor: pointer;">[[${displayText}]]</a>`;
      })
      // Tags
      .replace(/(?:^|\s)#([a-zA-Z0-9_\-\/]+)/g, ' <span class="badge" style="font-family: var(--font-tech);">#$1</span>');

    return `<div class="md-rendered-container"><p>${html}</p></div>`;
  }
}

export const parseNoteContent = (content: string): ParsedMarkdown => {
  return WikilinkParser.parse(content);
};
