import { describe, it, expect } from 'vitest';
import { EpubParser } from '../src/readers/parsers/EpubParser';
import { fileBinaryStore } from '../src/core/storage/FileBinaryStore';
import JSZip from 'jszip';

describe('Real EPUB Parsing & Binary Storage', () => {
  it('saves and retrieves binary file payload in FileBinaryStore', async () => {
    const fakePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]); // %PDF-1.5
    await fileBinaryStore.saveFileBlob('doc-test-pdf', fakePdfBytes, 'application/pdf', 'sample.pdf');

    const retrieved = await fileBinaryStore.getFileBytes('doc-test-pdf');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.length).toBe(fakePdfBytes.length);
    expect(retrieved?.[0]).toBe(0x25);
  });

  it('preserves the original MIME type when rebuilding a Blob from IndexedDB', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    await fileBinaryStore.saveFileBlob('doc-test-mime', pdfBytes, 'application/pdf', 'real.pdf');

    const blob = await fileBinaryStore.getFileBlob('doc-test-mime');
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('application/pdf');
    expect(blob!.size).toBe(pdfBytes.length);

    const url = await fileBinaryStore.getFileObjectUrl('doc-test-mime');
    expect(url).toMatch(/^blob:/);
  });

  it('unpacks and parses a real EPUB zip archive with chapters and TOC', async () => {
    // Construct a valid minimal in-memory EPUB
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file(
      'META-INF/container.xml',
      `<?xml version="1.0"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`
    );
    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Designing High-Performance Systems</dc:title>
          <dc:creator>Dr. Elena Rostova</dc:creator>
        </metadata>
        <manifest>
          <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
          <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="ch1"/>
          <itemref idref="ch2"/>
        </spine>
      </package>`
    );
    zip.file(
      'OEBPS/ch1.xhtml',
      `<?xml version="1.0" encoding="utf-8"?>
      <html>
        <head><title>Chapter 1: Concurrent Architecture</title></head>
        <body>
          <h1>Chapter 1: Concurrent Architecture</h1>
          <p>Modern microprocessors require non-blocking asynchronous event loops and zero-copy buffers.</p>
        </body>
      </html>`
    );
    zip.file(
      'OEBPS/ch2.xhtml',
      `<?xml version="1.0" encoding="utf-8"?>
      <html>
        <head><title>Chapter 2: Vector Search & Embeddings</title></head>
        <body>
          <h2>Chapter 2: Vector Search & Embeddings</h2>
          <p>Hierarchical Navigable Small World (HNSW) graphs offer logarithmic time nearest neighbor retrieval.</p>
        </body>
      </html>`
    );

    const epubBytes = await zip.generateAsync({ type: 'uint8array' });
    const parsed = await EpubParser.parse(epubBytes);

    expect(parsed.title).toBe('Designing High-Performance Systems');
    expect(parsed.author).toBe('Dr. Elena Rostova');
    expect(parsed.chapters.length).toBe(2);
    expect(parsed.chapters[0].title).toBe('Chapter 1: Concurrent Architecture');
    expect(parsed.chapters[0].content).toContain('non-blocking asynchronous event loops');
    expect(parsed.chapters[1].title).toBe('Chapter 2: Vector Search & Embeddings');
    expect(parsed.chapters[1].content).toContain('Hierarchical Navigable Small World');
    expect(parsed.toc.length).toBe(2);
  });

  it('parses real-world EPUBs: unordered manifest attrs, URL-encoded hrefs, and ../ relative paths', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file(
      'META-INF/container.xml',
      `<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
      </container>`
    );
    // media-type BEFORE href — attribute order that broke the old regex parser
    zip.file(
      'OEBPS/content.opf',
      `<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Real World Book</dc:title><dc:creator>Author X</dc:creator>
        </metadata>
        <manifest>
          <item id="ncx" media-type="application/x-dtbncx+xml" href="toc.ncx"/>
          <item id="css" media-type="text/css" href="style/main.css"/>
          <item id="ch1" media-type="application/xhtml+xml" href="text/chapter%20one.xhtml"/>
          <item id="ch2" media-type="application/xhtml+xml" href="../weird/outside.xhtml"/>
          <item id="img1" media-type="image/png" href="images/pic.png"/>
        </manifest>
        <spine toc="ncx"><itemref idref="ch1"/><itemref idref="ch2"/></spine>
      </package>`
    );
    zip.file('OEBPS/text/chapter one.xhtml', '<html><body><h1>One</h1><script>alert(1)</script><p>Alpha content.</p></body></html>');
    zip.file('weird/outside.xhtml', '<html><body><h1>Two</h1><p>Beta content.</p></body></html>');

    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const parsed = await EpubParser.parse(bytes);

    expect(parsed.title).toBe('Real World Book');
    expect(parsed.author).toBe('Author X');
    expect(parsed.chapters.length).toBe(2);
    expect(parsed.chapters[0].content).toContain('Alpha content.');
    expect(parsed.chapters[0].title).toBe('One');
    expect(parsed.chapters[0].content).not.toContain('<script>');
    expect(parsed.chapters[1].content).toContain('Beta content.');
    expect(parsed.chapters[1].content).toContain('Two');
  });

  it('inlines embedded images in EPUB chapters as base64 data URLs', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file(
      'META-INF/container.xml',
      `<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles>
      </container>`
    );
    zip.file(
      'content.opf',
      `<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Image Book</dc:title></metadata>
        <manifest>
          <item id="ch1" media-type="application/xhtml+xml" href="ch1.xhtml"/>
          <item id="pic" media-type="image/png" href="img/diagram.png"/>
        </manifest>
        <spine><itemref idref="ch1"/></spine>
      </package>`
    );
    zip.file('img/diagram.png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
    zip.file('ch1.xhtml', '<html><body><img src="img/diagram.png" alt="test" /><p>Chart text.</p></body></html>');

    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const parsed = await EpubParser.parse(bytes);

    expect(parsed.chapters[0].content).toContain('data:image/png;base64,');
  });
});
