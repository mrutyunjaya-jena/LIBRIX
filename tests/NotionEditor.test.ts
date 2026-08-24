import { describe, it, expect } from 'vitest';
import { WikilinkParser, parseNoteContent } from '../src/notes/WikilinkParser';
import { SLASH_MENU_ITEMS, NOTION_SLASH_ITEMS } from '../src/notes/SlashMenu';
import { BlockEngine, NotionBlockEngine } from '../src/notes/BlockEngine';

describe('Notion-Style Rich Note Vault System', () => {
  it('should parse frontmatter icon, cover, and status properties correctly', () => {
    const rawMarkdown = `---
title: "Distributed Systems Architecture"
icon: "⚡"
status: "In Progress"
cover: "linear-gradient(135deg, #0ea5e9, #8b5cf6)"
tags: ["Architecture", "Storage"]
---

# Distributed Systems Architecture

Note content here with [[Storage Engine]].`;

    const parsed = parseNoteContent(rawMarkdown);
    expect(parsed.title).toBe('Distributed Systems Architecture');
    expect(parsed.icon).toBe('⚡');
    expect(parsed.status).toBe('In Progress');
    expect(parsed.cover).toBe('linear-gradient(135deg, #0ea5e9, #8b5cf6)');
    expect(parsed.tags).toContain('Architecture');
    expect(parsed.tags).toContain('Storage');
    expect(parsed.wikilinks).toContain('Storage Engine');
  });

  it('should render Notion-style Callout boxes (Tip, Warning, Info, Objective)', () => {
    const markdown = `> 💡 **Tip:** Optimize index lookups for faster retrieval.
> ⚠️ **Warning:** Ensure data replication is confirmed before commit.
> 🎯 **Key Objective:** Deliver sub-50ms latency.`;

    const html = WikilinkParser.renderToHtml(markdown);
    expect(html).toContain('notion-callout-tip');
    expect(html).toContain('💡');
    expect(html).toContain('notion-callout-warning');
    expect(html).toContain('⚠️');
    expect(html).toContain('notion-callout-important');
    expect(html).toContain('🎯');
  });

  it('should render interactive task checkboxes with line indices', () => {
    const markdown = `### Project Tasks
- [ ] Implement vector index
- [x] Complete SQLite schema migration`;

    const html = WikilinkParser.renderToHtml(markdown);
    expect(html).toContain('notion-task-checkbox');
    expect(html).toContain('data-task-line="1"');
    expect(html).toContain('data-task-line="2"');
    expect(html).toContain('checked');
    expect(html).toContain('line-through');
  });

  it('should format markdown tables into styled HTML tables', () => {
    const markdown = `| Feature | Notion Mode | Obsidian Mode |
|---|---|---|
| Slash Commands | Yes | Yes |
| Graph Backlinks | Yes | Yes |`;

    const html = WikilinkParser.renderToHtml(markdown);
    expect(html).toContain('notion-table-wrapper');
    expect(html).toContain('<table class="notion-table">');
    expect(html).toContain('<th>Feature</th>');
    expect(html).toContain('<td>Slash Commands</td>');
  });

  it('should render highlights and strikethroughs correctly', () => {
    const markdown = `Here is ==important highlighted text== and ~~deprecated text~~.`;
    const html = WikilinkParser.renderToHtml(markdown);
    expect(html).toContain('<mark class="notion-highlight">important highlighted text</mark>');
    expect(html).toContain('<del>deprecated text</del>');
  });

  it('should have all standard Notion slash menu items with valid templates', () => {
    expect(NOTION_SLASH_ITEMS.length).toBeGreaterThanOrEqual(15);

    const h1 = NOTION_SLASH_ITEMS.find(i => i.id === 'h1');
    expect(h1).toBeDefined();
    expect(h1?.template).toBe('# ');

    const todo = NOTION_SLASH_ITEMS.find(i => i.id === 'todo');
    expect(todo).toBeDefined();
    expect(todo?.template).toBe('- [ ] ');

    const callout = NOTION_SLASH_ITEMS.find(i => i.id === 'callout_tip');
    expect(callout).toBeDefined();
    expect(typeof callout?.template).toBe('string');
    expect(callout?.template).toContain('💡');

    const table = NOTION_SLASH_ITEMS.find(i => i.id === 'table');
    expect(table).toBeDefined();
    expect(table?.template).toContain('|');

    const aiSummarize = NOTION_SLASH_ITEMS.find(i => i.id === 'ai_summarize');
    expect(aiSummarize).toBeDefined();
    expect(aiSummarize?.isAi).toBe(true);

    const toggle = NOTION_SLASH_ITEMS.find(i => i.id === 'toggle');
    expect(toggle).toBeDefined();
    expect(toggle?.template).toContain('[!TOGGLE]');

    const imageItem = NOTION_SLASH_ITEMS.find(i => i.id === 'image');
    expect(imageItem).toBeDefined();
    expect(imageItem?.template).toContain('![');

    const latexItem = NOTION_SLASH_ITEMS.find(i => i.id === 'latex');
    expect(latexItem).toBeDefined();
    expect(latexItem?.template).toContain('$$');

    const fileItem = NOTION_SLASH_ITEMS.find(i => i.id === 'file');
    expect(fileItem).toBeDefined();
    expect(fileItem?.template).toContain('[📎');

    const bookmarkItem = NOTION_SLASH_ITEMS.find(i => i.id === 'bookmark');
    expect(bookmarkItem).toBeDefined();
    expect(bookmarkItem?.template).toContain('[🔗');
  });

  it('should render clean markdown toggle lists as interactive HTML details/summary widgets', () => {
    const markdown = `> [!TOGGLE] Research Methodology
> Detailed steps and empirical data here.`;

    const html = WikilinkParser.renderToHtml(markdown);
    expect(html).toContain('<details class="notion-toggle">');
    expect(html).toContain('<summary>Research Methodology</summary>');
  });

  it('should parse markdown into structured blocks and serialize back accurately including image, latex, file, and bookmark', () => {
    const md = `# Quantum Storage Architecture

> 💡 Key insight on distributed vector caches

- [x] Initial design review
- [ ] Implement benchmark suite

\`\`\`typescript
console.log("Storage Online");
\`\`\`

![System Diagram](https://example.com/diagram.png)

$$
E = mc^2
$$

[📎 Distributed_Systems_Paper.pdf (4.8 MB)](https://example.com/paper.pdf)

[🔗 ArXiv Research Papers](https://arxiv.org)`;

    const blocks = NotionBlockEngine.markdownToBlocks(md);
    expect(blocks.length).toBe(9);
    expect(blocks[0].type).toBe('h1');
    expect(blocks[0].content).toBe('Quantum Storage Architecture');
    expect(blocks[1].type).toBe('callout');
    expect(blocks[2].type).toBe('todo');
    expect(blocks[2].properties?.checked).toBe(true);
    expect(blocks[3].type).toBe('todo');
    expect(blocks[3].properties?.checked).toBe(false);
    expect(blocks[4].type).toBe('code');
    expect(blocks[5].type).toBe('image');
    expect(blocks[5].properties?.url).toBe('https://example.com/diagram.png');
    expect(blocks[5].properties?.caption).toBe('System Diagram');
    expect(blocks[6].type).toBe('math');
    expect(blocks[6].properties?.formula).toContain('E = mc^2');
    expect(blocks[7].type).toBe('file');
    expect(blocks[7].properties?.fileName).toBe('Distributed_Systems_Paper.pdf');
    expect(blocks[7].properties?.url).toBe('https://example.com/paper.pdf');
    expect(blocks[8].type).toBe('bookmark');
    expect(blocks[8].properties?.title).toBe('ArXiv Research Papers');
    expect(blocks[8].properties?.url).toBe('https://arxiv.org');

    const serialized = NotionBlockEngine.blocksToMarkdown(blocks);
    expect(serialized).toContain('# Quantum Storage Architecture');
    expect(serialized).toContain('- [x] Initial design review');
    expect(serialized).toContain('- [ ] Implement benchmark suite');
    expect(serialized).toContain('```typescript');
    expect(serialized).toContain('![System Diagram](https://example.com/diagram.png)');
    expect(serialized).toContain('$$');
    expect(serialized).toContain('E = mc^2');
    expect(serialized).toContain('[📎 Distributed_Systems_Paper.pdf (4.8 MB)](https://example.com/paper.pdf)');
    expect(serialized).toContain('[🔗 ArXiv Research Papers](https://arxiv.org)');
  });
});
