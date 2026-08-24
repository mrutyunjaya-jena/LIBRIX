/**
 * LIBRIX Wikilink, Tag & Frontmatter Parser
 * Extracts bidirectional relationships for knowledge graph and backlinks.
 */

export interface ParsedNoteContent {
  title: string;
  frontmatter: Record<string, any>;
  wikilinks: string[];
  tags: string[];
  cleanContent: string;
}

export function parseNoteContent(rawContent: string, defaultTitle = 'Untitled'): ParsedNoteContent {
  let content = rawContent;
  const frontmatter: Record<string, any> = {};
  const wikilinks: string[] = [];
  const tags = new Set<string>();

  // 1. Extract YAML Frontmatter
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const fmMatch = content.match(frontmatterRegex);
  if (fmMatch) {
    const yamlBlock = fmMatch[1];
    yamlBlock.split('\n').forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join(':').trim();
        if (key && value) {
          // Parse simple arrays or strings
          if (value.startsWith('[') && value.endsWith(']')) {
            frontmatter[key] = value
              .slice(1, -1)
              .split(',')
              .map(s => s.trim().replace(/^['"]|['"]$/g, ''));
          } else {
            frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
          }
        }
      }
    });
    content = content.replace(frontmatterRegex, '').trim();
  }

  // 2. Extract Title
  let title = defaultTitle;
  if (frontmatter.title) {
    title = frontmatter.title;
  } else {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    }
  }

  // 3. Extract [[Wikilinks]]
  const wikilinkRegex = /\[\[(.*?)\]\]/g;
  let match;
  while ((match = wikilinkRegex.exec(content)) !== null) {
    const target = match[1].split('|')[0].trim(); // Handle [[target|alias]]
    if (target && !wikilinks.includes(target)) {
      wikilinks.push(target);
    }
  }

  // 4. Extract #tags from body and frontmatter
  if (Array.isArray(frontmatter.tags)) {
    frontmatter.tags.forEach(t => tags.add(String(t).replace(/^#/, '')));
  }

  const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\-]+)/g;
  while ((match = tagRegex.exec(content)) !== null) {
    const tag = match[1].trim();
    if (tag) {
      tags.add(tag);
    }
  }

  return {
    title,
    frontmatter,
    wikilinks,
    tags: Array.from(tags),
    cleanContent: content,
  };
}
