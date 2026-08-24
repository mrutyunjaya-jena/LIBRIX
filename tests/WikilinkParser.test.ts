import { describe, it, expect } from 'vitest';
import { parseNoteContent } from '../src/notes/WikilinkParser';

describe('WikilinkParser', () => {
  it('should parse YAML frontmatter correctly', () => {
    const raw = `---
title: My Obsidian Note
tags: [Architecture, Systems]
author: Librix Team
---
# Content starts here
Body paragraph.`;

    const parsed = parseNoteContent(raw);
    expect(parsed.title).toBe('My Obsidian Note');
    expect(parsed.frontmatter.title).toBe('My Obsidian Note');
    expect(parsed.frontmatter.author).toBe('Librix Team');
    expect(parsed.tags).toContain('Architecture');
    expect(parsed.tags).toContain('Systems');
  });

  it('should extract [[Wikilinks]] and body #tags', () => {
    const raw = `Connecting [[Universal Storage Architecture]] with [[Libris AI & Document RAG]] for #Privacy.`;
    const parsed = parseNoteContent(raw);

    expect(parsed.wikilinks).toHaveLength(2);
    expect(parsed.wikilinks).toContain('Universal Storage Architecture');
    expect(parsed.wikilinks).toContain('Libris AI & Document RAG');
    expect(parsed.tags).toContain('Privacy');
  });

  it('should handle [[target|alias]] formatting', () => {
    const raw = `Check [[Designing Data-Intensive Applications|DDIA Book]] for details.`;
    const parsed = parseNoteContent(raw);

    expect(parsed.wikilinks).toContain('Designing Data-Intensive Applications');
  });
});
