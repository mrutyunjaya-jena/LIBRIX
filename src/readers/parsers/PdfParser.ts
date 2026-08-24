import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure local PDF.js worker without external CDN dependencies
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  } catch {
    // fallback
  }
}

export interface ParsedPdfPage {
  pageNumber: number;
  textContent: string;
  title: string;
}

export interface ParsedPdfDocument {
  numPages: number;
  pages: ParsedPdfPage[];
  title?: string;
  author?: string;
  pdfDoc?: pdfjsLib.PDFDocumentProxy;
}

export class PdfParser {
  public static async loadPdfDocument(data: Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
    });
    return await loadingTask.promise;
  }

  /**
   * Render Page 1 to an off-screen canvas and export a compact base64 thumbnail
   */
  public static async generateThumbnail(data: Uint8Array, targetWidth = 320): Promise<string | undefined> {
    try {
      if (typeof window === 'undefined') return undefined;
      const pdfDoc = await PdfParser.loadPdfDocument(data);
      if (pdfDoc.numPages < 1) return undefined;

      const page = await pdfDoc.getPage(1);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale });

      const canvas = window.document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;

      const renderContext = {
        canvasContext: ctx,
        viewport,
        canvas,
      };

      await page.render(renderContext).promise;
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (err) {
      console.warn('PdfParser thumbnail generation error:', err);
      return undefined;
    }
  }

  public static async parse(data: Uint8Array): Promise<ParsedPdfDocument> {
    try {
      const pdfDoc = await PdfParser.loadPdfDocument(data);
      const numPages = pdfDoc.numPages;
      const pages: ParsedPdfPage[] = [];

      let metaTitle = '';
      let metaAuthor = '';

      try {
        const metadata = await pdfDoc.getMetadata();
        const info = metadata.info as any;
        if (info) {
          if (info.Title) metaTitle = info.Title;
          if (info.Author) metaAuthor = info.Author;
        }
      } catch {
        // metadata optional
      }

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();

          const strings: string[] = [];
          let lastY: number | null = null;

          for (const item of textContent.items as any[]) {
            if ('str' in item) {
              const currentY = item.transform ? item.transform[5] : null;
              if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 8) {
                strings.push('\n\n');
              } else if (strings.length > 0 && !strings[strings.length - 1].endsWith(' ')) {
                strings.push(' ');
              }
              strings.push(item.str);
              lastY = currentY;
            }
          }

          const rawText = strings.join('').replace(/\n{3,}/g, '\n\n').trim();
          const firstLine = rawText.split('\n')[0]?.trim() || `Page ${pageNum}`;

          pages.push({
            pageNumber: pageNum,
            textContent: rawText || `[Page ${pageNum}]`,
            title: firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine,
          });
        } catch {
          pages.push({
            pageNumber: pageNum,
            textContent: `[Page ${pageNum}]`,
            title: `Page ${pageNum}`,
          });
        }
      }

      return {
        numPages,
        pages,
        title: metaTitle,
        author: metaAuthor,
        pdfDoc,
      };
    } catch (err) {
      console.warn('PdfParser error:', err);
      return {
        numPages: 1,
        pages: [
          {
            pageNumber: 1,
            textContent: 'Could not extract PDF text stream.',
            title: 'Page 1',
          },
        ],
      };
    }
  }
}
