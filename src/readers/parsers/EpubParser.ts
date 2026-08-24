import JSZip from 'jszip';
import { TocItem } from '../ReaderInterface';

export interface ParsedEpubChapter {
  id: string;
  title: string;
  content: string;
}

export interface ParsedEpubBook {
  title: string;
  author: string;
  chapters: ParsedEpubChapter[];
  toc: TocItem[];
  coverDataUrl?: string;
}

export class EpubParser {
  private static getAttribute(tag: string, attr: string): string | null {
    const m = tag.match(new RegExp(`\\b${attr}\\s*=\\s*["']([^"']*)["']`, 'i'));
    return m ? m[1] : null;
  }

  private static safeDecode(href: string): string {
    try {
      return decodeURIComponent(href);
    } catch {
      return href;
    }
  }

  private static resolveZipPath(baseDir: string, href: string): string {
    const decoded = EpubParser.safeDecode(href);
    const segments = (baseDir + decoded).split('/');
    const stack: string[] = [];
    for (const seg of segments) {
      if (!seg || seg === '.') continue;
      if (seg === '..') stack.pop();
      else stack.push(seg);
    }
    return stack.join('/');
  }

  private static findZipEntry(zip: JSZip, candidates: string[]): JSZip.JSZipObject | null {
    for (const c of candidates) {
      const f = zip.file(c);
      if (f) return f;
    }
    const lowerMap = new Map<string, string>();
    Object.keys(zip.files).forEach(k => lowerMap.set(k.toLowerCase(), k));
    for (const c of candidates) {
      const hit = lowerMap.get(c.toLowerCase());
      if (hit && !zip.files[hit].dir) return zip.file(hit)!;
    }
    return null;
  }

  /**
   * Generates a sleek grayscale sci-fi SVG cover for books without embedded images
   */
  public static generateFallbackCover(title: string, author: string): string {
    const cleanTitle = (title || 'Untitled Document').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cleanAuthor = (author || 'Unknown Author').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="100%" height="100%">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#141414"/>
          <stop offset="100%" stop-color="#0a0a0a"/>
        </linearGradient>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#222222" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="400" height="560" fill="url(#bg)"/>
      <rect width="400" height="560" fill="url(#grid)" opacity="0.6"/>
      <rect x="16" y="16" width="368" height="528" fill="none" stroke="#333333" stroke-width="1.5"/>
      <path d="M 16 32 L 32 16 M 384 528 L 368 544" stroke="#ffffff" stroke-width="2"/>
      
      <!-- Tech Accents -->
      <rect x="28" y="28" width="6" height="6" fill="#ffffff"/>
      <text x="42" y="34" fill="#888888" font-family="monospace" font-size="9" letter-spacing="2">LIBRIX ARCHIVE // EPUB</text>
      
      <!-- Title -->
      <foreignObject x="32" y="140" width="336" height="200">
        <div xmlns="http://www.w3.org/1999/xhtml" style="color:#ffffff;font-family:serif;font-size:24px;font-weight:700;line-height:1.25;text-transform:capitalize;word-break:break-word;">
          ${cleanTitle}
        </div>
      </foreignObject>
      
      <!-- Author -->
      <line x1="32" y1="420" x2="120" y2="420" stroke="#ffffff" stroke-width="1.5"/>
      <text x="32" y="445" fill="#aaaaaa" font-family="sans-serif" font-size="13" font-weight="600" letter-spacing="1">
        ${cleanAuthor.toUpperCase()}
      </text>
      <text x="32" y="515" fill="#555555" font-family="monospace" font-size="8" letter-spacing="1">ENCRYPTED LOCAL STORAGE // SEC-01</text>
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  public static async parse(data: Uint8Array): Promise<ParsedEpubBook> {
    try {
      const zip = await JSZip.loadAsync(data);

      // 1. Locate rootfile from META-INF/container.xml
      let opfPath = 'OEBPS/content.opf';
      const containerEntry = EpubParser.findZipEntry(zip, ['META-INF/container.xml']);
      if (containerEntry) {
        const containerXml = await containerEntry.async('text');
        const match = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i);
        if (match) {
          opfPath = EpubParser.safeDecode(match[1]);
        }
      }

      // 2. Read OPF
      let opfEntry = EpubParser.findZipEntry(zip, [opfPath]);
      if (!opfEntry) {
        const anyOpf = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.opf'));
        if (anyOpf) {
          opfPath = anyOpf;
          opfEntry = zip.file(anyOpf);
        }
      }

      if (!opfEntry) {
        return EpubParser.fallbackParse(data);
      }

      const opfXml = await opfEntry.async('text');
      const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

      // 3. Extract Metadata
      const titleMatch = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
      const authorMatch = opfXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Imported Book';
      const author = authorMatch ? authorMatch[1].replace(/<[^>]+>/g, '').trim() : 'Unknown Author';

      // 4. Extract Manifest Items
      const manifest: Record<string, { href: string; mediaType: string; properties?: string }> = {};
      const itemTags = opfXml.match(/<item\b[^>]*>/gi) || [];
      for (const tag of itemTags) {
        const id = EpubParser.getAttribute(tag, 'id');
        const href = EpubParser.getAttribute(tag, 'href');
        if (!id || !href) continue;
        manifest[id] = {
          href,
          mediaType: EpubParser.getAttribute(tag, 'media-type') || '',
          properties: EpubParser.getAttribute(tag, 'properties') || '',
        };
      }

      // 5. Extract Cover Image — Multi-Strategy Resolver
      let coverDataUrl: string | undefined = undefined;
      let candidateCoverFile: JSZip.JSZipObject | null = null;
      let candidateMime = 'image/jpeg';

      // Strategy A: EPUB 3 properties="cover-image"
      for (const [, item] of Object.entries(manifest)) {
        if (item.properties && item.properties.includes('cover-image')) {
          const coverPath = EpubParser.resolveZipPath(opfDir, item.href);
          candidateCoverFile = EpubParser.findZipEntry(zip, [coverPath, opfDir + item.href, item.href]);
          if (candidateCoverFile) {
            candidateMime = item.mediaType || 'image/jpeg';
            break;
          }
        }
      }

      // Strategy B: EPUB 2 <meta name="cover" content="id"/>
      if (!candidateCoverFile) {
        const coverMetaMatch =
          opfXml.match(/<meta\b[^>]*name=["']cover["'][^>]*content=["']([^"']+)["']/i) ||
          opfXml.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']cover["']/i);
        if (coverMetaMatch) {
          const coverId = coverMetaMatch[1];
          if (manifest[coverId]) {
            const coverItem = manifest[coverId];
            const coverPath = EpubParser.resolveZipPath(opfDir, coverItem.href);
            candidateCoverFile = EpubParser.findZipEntry(zip, [coverPath, opfDir + coverItem.href, coverItem.href]);
            if (candidateCoverFile) {
              candidateMime = coverItem.mediaType || 'image/jpeg';
            }
          }
        }
      }

      // Strategy C: Manifest items matching "cover" in id or href
      if (!candidateCoverFile) {
        for (const [id, item] of Object.entries(manifest)) {
          if (item.mediaType.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg)$/i.test(item.href)) {
            if (/cover/i.test(id) || /cover/i.test(item.href)) {
              const coverPath = EpubParser.resolveZipPath(opfDir, item.href);
              candidateCoverFile = EpubParser.findZipEntry(zip, [coverPath, opfDir + item.href, item.href]);
              if (candidateCoverFile) {
                candidateMime = item.mediaType || 'image/jpeg';
                break;
              }
            }
          }
        }
      }

      // Strategy D: Global zip files scan for cover or front images
      if (!candidateCoverFile) {
        const allImageFiles: { name: string; score: number; obj: JSZip.JSZipObject }[] = [];
        zip.forEach((path, entry) => {
          if (!entry.dir && /\.(jpe?g|png|webp|svg)$/i.test(path)) {
            let score = 10;
            const lower = path.toLowerCase();
            if (lower.includes('cover')) score += 100;
            if (lower.includes('titlepage') || lower.includes('title_page') || lower.includes('front')) score += 60;
            if (lower.includes('jacket') || lower.includes('poster')) score += 40;
            allImageFiles.push({ name: path, score, obj: entry });
          }
        });

        allImageFiles.sort((a, b) => b.score - a.score);
        if (allImageFiles.length > 0 && allImageFiles[0].score > 10) {
          candidateCoverFile = allImageFiles[0].obj;
          const ext = allImageFiles[0].name.split('.').pop()?.toLowerCase();
          candidateMime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        }
      }

      // Convert Candidate File to Base64
      if (candidateCoverFile) {
        try {
          const b64 = await candidateCoverFile.async('base64');
          coverDataUrl = `data:${candidateMime};base64,${b64}`;
        } catch {
          // fallback
        }
      }

      // Fallback: Generate SVG Graphic Cover if EPUB contains no image files
      if (!coverDataUrl) {
        coverDataUrl = EpubParser.generateFallbackCover(title, author);
      }

      // 6. Extract Spine (Chapter Order)
      const spineIdrefs: string[] = [];
      const itemrefTags = opfXml.match(/<itemref\b[^>]*>/gi) || [];
      for (const tag of itemrefTags) {
        const idref = EpubParser.getAttribute(tag, 'idref');
        if (idref) spineIdrefs.push(idref);
      }

      // 7. Extract Chapter Contents and Inline Images
      const chapters: ParsedEpubChapter[] = [];
      const toc: TocItem[] = [];

      for (let i = 0; i < spineIdrefs.length; i++) {
        const idref = spineIdrefs[i];
        const item = manifest[idref];
        if (!item || /^(image|font|css|video|audio)\//i.test(item.mediaType)) continue;

        const resolvedPath = EpubParser.resolveZipPath(opfDir, item.href);
        const decodedRaw = EpubParser.safeDecode(item.href);
        const chapterFile = EpubParser.findZipEntry(zip, [
          resolvedPath,
          opfDir + item.href,
          decodedRaw,
          item.href,
        ]);

        if (chapterFile) {
          let rawHtml = await chapterFile.async('text');

          // Extract Chapter Title
          let chapterTitle = `Chapter ${i + 1}`;
          const hMatch = rawHtml.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
          if (hMatch) {
            chapterTitle = hMatch[1].replace(/<[^>]+>/g, '').trim();
          } else {
            const tMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (tMatch && tMatch[1].trim()) {
              chapterTitle = tMatch[1].replace(/<[^>]+>/g, '').trim();
            }
          }
          if (!chapterTitle) chapterTitle = `Chapter ${i + 1}`;

          // Clean body content
          const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          let cleanBody = bodyMatch ? bodyMatch[1] : rawHtml;

          // Strip unsafe scripts
          cleanBody = cleanBody.replace(/<script[\s\S]*?<\/script>/gi, '');

          // Inline images: convert <img src="..."> to data URLs from zip
          const chapterDir = resolvedPath.includes('/')
            ? resolvedPath.substring(0, resolvedPath.lastIndexOf('/') + 1)
            : opfDir;

          const imgMatches = Array.from(cleanBody.matchAll(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi));
          for (const imgMatch of imgMatches) {
            const originalSrc = imgMatch[1];
            if (!originalSrc.startsWith('data:') && !originalSrc.startsWith('http')) {
              const imgPath = EpubParser.resolveZipPath(chapterDir, originalSrc);
              const imgFile = EpubParser.findZipEntry(zip, [imgPath, originalSrc]);
              if (imgFile) {
                try {
                  const b64 = await imgFile.async('base64');
                  const ext = originalSrc.split('.').pop()?.toLowerCase() || 'jpeg';
                  const mime =
                    ext === 'png'
                      ? 'image/png'
                      : ext === 'svg'
                      ? 'image/svg+xml'
                      : ext === 'webp'
                      ? 'image/webp'
                      : 'image/jpeg';
                  const dataUrl = `data:${mime};base64,${b64}`;
                  cleanBody = cleanBody.split(originalSrc).join(dataUrl);
                } catch {
                  // fallback
                }
              }
            }
          }

          chapters.push({
            id: `ch_${i + 1}`,
            title: chapterTitle,
            content: cleanBody,
          });

          toc.push({
            id: `toc_${i + 1}`,
            label: `${chapters.length}. ${chapterTitle}`,
            href: `#ch_${chapters.length}`,
          });
        }
      }

      if (chapters.length === 0) {
        return EpubParser.fallbackParse(data);
      }

      return {
        title,
        author,
        chapters,
        toc,
        coverDataUrl,
      };
    } catch (err) {
      return EpubParser.fallbackParse(data);
    }
  }

  private static fallbackParse(data: Uint8Array): ParsedEpubBook {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    const cleanText = text.replace(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g, '');

    const parts = cleanText.split(/(?=(?:Chapter\s+\d+|SECTION\s+\d+|#\s+Chapter))/i);
    const chapters: ParsedEpubChapter[] = [];
    const toc: TocItem[] = [];

    let title = 'Imported Document';
    const author = 'Unknown Author';

    if (parts.length > 1) {
      parts.forEach((p, idx) => {
        const lines = p.trim().split('\n');
        const chapterTitle = lines[0].replace(/[#*]/g, '').trim() || `Chapter ${idx + 1}`;
        if (idx === 0 && chapterTitle) title = chapterTitle;
        chapters.push({
          id: `ch_${idx + 1}`,
          title: chapterTitle,
          content: `<p>${p.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
        });
        toc.push({
          id: `toc_${idx + 1}`,
          label: `${idx + 1}. ${chapterTitle}`,
          href: `#ch_${idx + 1}`,
        });
      });
    } else {
      chapters.push({
        id: 'ch_1',
        title: 'Document Content',
        content: `<p>${cleanText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
      });
      toc.push({
        id: 'toc_1',
        label: '1. Document Content',
        href: '#ch_1',
      });
    }

    return {
      title,
      author,
      chapters,
      toc,
      coverDataUrl: EpubParser.generateFallbackCover(title, author),
    };
  }
}
