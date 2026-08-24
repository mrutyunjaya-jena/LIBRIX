import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sparkles,
  Bookmark as BookmarkIcon,
  Highlighter,
  LayoutGrid,
  FileText,
  Trash2,
  Edit3,
  Copy,
  MessageSquare,
  Maximize2,
  ExternalLink,
  Layers,
  Search,
  Loader2,
  BookOpen,
  Sliders,
  Type,
  AlignLeft,
  AlignJustify,
  Hand,
  MousePointer,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { IReaderProps } from './ReaderInterface';
import { db } from '../core/db/DatabaseEngine';
import { Document, Bookmark, Annotation, HighlightStyle } from '../core/types';
import { usePlatform } from '../platform/PlatformContext';
import { DocumentDataLoader } from '../core/storage/DocumentDataLoader';
import { PdfParser, ParsedPdfPage } from './parsers/PdfParser';

export const PdfReader: React.FC<IReaderProps> = ({
  document,
  onClose,
  onProgressUpdate,
  onOpenLibris,
}) => {
  const platform = usePlatform();

  const getInitialPage = (doc: Document): number => {
    if (doc.readingProgress?.currentLocation) {
      const parsed = parseInt(doc.readingProgress.currentLocation.replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed >= 1) return parsed;
    }
    return 1;
  };

  const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
  const [pages, setPages] = useState<ParsedPdfPage[]>([]);
  const [pageTextMap, setPageTextMap] = useState<Record<number, string>>({});
  const [currentPage, setCurrentPage] = useState<number>(() => getInitialPage(document));
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [isRenderingPage, setIsRenderingPage] = useState(false);

  const [zoom, setZoom] = useState(100);
  const [visualScale, setVisualScale] = useState(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [toolMode, setToolMode] = useState<'pan' | 'select'>('pan');
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [viewMode, setViewMode] = useState<'canvas' | 'text'>('canvas');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInputText, setNoteInputText] = useState('');
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  // Dynamic Typography & Resizable Layout Settings
  const [pageWidthMode, setPageWidthMode] = useState<'compact' | 'standard' | 'wide' | 'fluid'>('standard');
  const [fontSize, setFontSize] = useState<number>(17);
  const [lineHeight, setLineHeight] = useState<number>(1.8);
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans' | 'mono'>('serif');
  const [textAlign, setTextAlign] = useState<'left' | 'justify'>('left');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const selectedTextRef = useRef<string>('');
  const renderTaskRef = useRef<any>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startPanX: number; startPanY: number } | null>(null);
  const touchStartDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(100);
  const visualScaleRef = useRef<number>(1);

  // Mouse Drag / Pan Handlers for Desktop & Trackpad (Free 2D GPU translation)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (toolMode === 'pan' || e.button === 1 || e.altKey) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startPanX: panOffset.x,
        startPanY: panOffset.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current && dragStartRef.current) {
      const deltaX = e.clientX - dragStartRef.current.clientX;
      const deltaY = e.clientY - dragStartRef.current.clientY;
      setPanOffset({
        x: Math.round(dragStartRef.current.startPanX + deltaX),
        y: Math.round(dragStartRef.current.startPanY + deltaY),
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
  };

  // Touch Handlers for Finger Drag & Pinch Zoom on Android
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2-finger pinch zoom gesture
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      initialZoomRef.current = zoom;
      visualScaleRef.current = 1;
      dragStartRef.current = null;
    } else if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
        startPanX: panOffset.x,
        startPanY: panOffset.y,
      };
      touchStartDistRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      // 2-Finger Real-time Visual Pinch Zoom (60fps GPU transform)
      e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = Math.min(3.5, Math.max(0.4, currentDist / touchStartDistRef.current));
      visualScaleRef.current = scale;
      setVisualScale(scale);
    } else if (e.touches.length === 1 && dragStartRef.current && toolMode === 'pan') {
      // Free 1-Finger 2D Drag Panning
      const deltaX = e.touches[0].clientX - dragStartRef.current.clientX;
      const deltaY = e.touches[0].clientY - dragStartRef.current.clientY;
      setPanOffset({
        x: Math.round(dragStartRef.current.startPanX + deltaX),
        y: Math.round(dragStartRef.current.startPanY + deltaY),
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (visualScaleRef.current !== 1) {
      const finalZoom = Math.min(300, Math.max(50, Math.round(initialZoomRef.current * visualScaleRef.current)));
      visualScaleRef.current = 1;
      setVisualScale(1);
      setZoom(finalZoom);
    }

    if (dragStartRef.current && e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - dragStartRef.current.clientX;
      const deltaY = e.changedTouches[0].clientY - dragStartRef.current.clientY;

      // If user only swiped horizontally with no zoom & pan at origin, turn page
      if (toolMode === 'pan' && zoom <= 100 && Math.abs(panOffset.x) < 40 && Math.abs(deltaX) > 75 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
        if (deltaX < 0) {
          setCurrentPage(p => Math.min(totalPages, p + 1));
        } else {
          setCurrentPage(p => Math.max(1, p - 1));
        }
        setPanOffset({ x: 0, y: 0 });
      }
    }

    isDraggingRef.current = false;
    dragStartRef.current = null;
    touchStartDistRef.current = null;
  };

  const handleDoubleClick = () => {
    // Reset view to origin on double click / tap
    setPanOffset({ x: 0, y: 0 });
    setZoom(100);
    setVisualScale(1);
  };

  // Helper to paginate long text if no binary exists
  const splitTextIntoPages = (fullText: string, pageSize = 2000): ParsedPdfPage[] => {
    const paragraphs = fullText.split(/\n\n+/);
    const result: ParsedPdfPage[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;
    let pageIndex = 1;

    for (const p of paragraphs) {
      if (currentLength + p.length > pageSize && currentChunk.length > 0) {
        const text = currentChunk.join('\n\n');
        result.push({
          pageNumber: pageIndex,
          textContent: text,
          title: text.split('\n')[0]?.slice(0, 50) || `Page ${pageIndex}`,
        });
        pageIndex++;
        currentChunk = [p];
        currentLength = p.length;
      } else {
        currentChunk.push(p);
        currentLength += p.length;
      }
    }

    if (currentChunk.length > 0) {
      const text = currentChunk.join('\n\n');
      result.push({
        pageNumber: pageIndex,
        textContent: text,
        title: text.split('\n')[0]?.slice(0, 50) || `Page ${pageIndex}`,
      });
    }

    return result.length > 0 ? result : [{ pageNumber: 1, textContent: fullText, title: 'Page 1' }];
  };

  // Load Real PDF Binary & Extract Pages
  useEffect(() => {
    let isCancelled = false;

    const loadPdfData = async () => {
      setIsLoadingPdf(true);
      try {
        const rawBytes = await DocumentDataLoader.loadDocumentBytes(document);
        if (rawBytes && rawBytes.length > 0) {
          const parsed = await PdfParser.parse(rawBytes);
          if (!isCancelled) {
            if (parsed.pdfDoc) {
              setPdfDocProxy(parsed.pdfDoc);
            }
            if (parsed.pages && parsed.pages.length > 0) {
              setPages(parsed.pages);
              setTotalPages(parsed.numPages);
              const targetPage = Math.min(parsed.numPages, Math.max(1, getInitialPage(document)));
              setCurrentPage(targetPage);
              const initialMap: Record<number, string> = {};
              parsed.pages.forEach(p => {
                initialMap[p.pageNumber] = p.textContent;
              });
              setPageTextMap(initialMap);
              setIsLoadingPdf(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('PdfReader error loading PDF:', err);
      }

      if (!isCancelled) {
        if (document.contentSnippet) {
          const splitPages = splitTextIntoPages(document.contentSnippet);
          setPages(splitPages);
          setTotalPages(splitPages.length);
          const targetPage = Math.min(splitPages.length, Math.max(1, getInitialPage(document)));
          setCurrentPage(targetPage);
          const initialMap: Record<number, string> = {};
          splitPages.forEach(p => {
            initialMap[p.pageNumber] = p.textContent;
          });
          setPageTextMap(initialMap);
        } else {
          setPages([
            {
              pageNumber: 1,
              textContent: 'No text extracted from this PDF. Native Canvas rendering will display page graphics.',
              title: 'Page 1',
            },
          ]);
          setTotalPages(1);
        }
        setIsLoadingPdf(false);
      }
    };

    loadPdfData();
    return () => {
      isCancelled = true;
    };
  }, [document.id]);

  // Load Annotations & Bookmarks
  const loadData = async () => {
    setBookmarks(await db.getBookmarks(document.id));
    setAnnotations(await db.getAnnotations(document.id));
  };

  useEffect(() => {
    loadData();
  }, [document.id]);

  // Progress Update & Scroll Reset
  useEffect(() => {
    if (totalPages <= 0) return;
    const progress = Math.min(100, Math.max(1, Math.round((currentPage / totalPages) * 100)));
    onProgressUpdate(progress, `page-${currentPage}`);
    db.updateReadingProgress(document.id, { percentage: progress, currentLocation: `page-${currentPage}` });
    if (stageRef.current) {
      stageRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, totalPages, document.id]);

  // On-demand Text Extraction for active currentPage
  useEffect(() => {
    if (!pdfDocProxy || pageTextMap[currentPage]) return;

    let isMounted = true;
    const fetchPageText = async () => {
      try {
        const page = await pdfDocProxy.getPage(currentPage);
        if (!isMounted) return;
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
        const text = strings.join('').replace(/\n{3,}/g, '\n\n').trim() || `[Page ${currentPage}]`;
        if (isMounted) {
          setPageTextMap(prev => ({ ...prev, [currentPage]: text }));
        }
      } catch (err) {
        console.warn('Error fetching page text:', err);
      }
    };

    fetchPageText();
    return () => {
      isMounted = false;
    };
  }, [pdfDocProxy, currentPage, pageTextMap]);

  // Render PDF Page to Canvas + Text Layer Overlay with High-DPI Scaling
  useEffect(() => {
    if (!pdfDocProxy || viewMode !== 'canvas') return;

    let isMounted = true;
    const renderPage = async () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancel error
        }
      }

      setIsRenderingPage(true);
      try {
        const page = await pdfDocProxy.getPage(currentPage);
        if (!isMounted) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Calculate auto-fit scale so PDF pages never overflow horizontally on Android/Tablet
        const stageEl = stageRef.current;
        const availableWidth = stageEl ? Math.max(280, stageEl.clientWidth - 16) : (typeof window !== 'undefined' ? window.innerWidth - 16 : 600);
        const unscaledViewport = page.getViewport({ scale: 1.0, rotation });
        let fitScale = 1.35;
        if (unscaledViewport.width > 0 && availableWidth < unscaledViewport.width * 1.35) {
          fitScale = availableWidth / unscaledViewport.width;
        }
        const baseScale = (zoom / 100) * fitScale;
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: baseScale, rotation });

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        const renderContext = {
          canvasContext: ctx,
          viewport,
          canvas,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // Render Text Layer Overlay strictly over the canvas
        const textContent = await page.getTextContent();
        if (!isMounted) return;

        const textLayerDiv = textLayerRef.current;
        if (textLayerDiv) {
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
          textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;

          try {
            if ((pdfjsLib as any).TextLayer) {
              const textLayer = new (pdfjsLib as any).TextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport,
              });
              await textLayer.render();
            }
          } catch (e) {
            console.warn('TextLayer render error:', e);
          }
        }

        if (isMounted) {
          setIsRenderingPage(false);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('Canvas render error:', err);
        }
        if (isMounted) {
          setIsRenderingPage(false);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDocProxy, currentPage, zoom, rotation, viewMode]);

  // Text Selection Listener with Dynamic Boundary Clamping
  const checkSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setSelectionPos(null);
      return;
    }

    const text = sel.toString().trim();
    if (text.length > 0) {
      selectedTextRef.current = text;
      setSelectedText(text);
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const viewportW = window.innerWidth;
          const viewportH = window.innerHeight;
          const toolbarWidth = Math.min(viewportW - 24, 340);
          const halfToolbar = toolbarWidth / 2;

          const rawX = rect.left + rect.width / 2;
          const clampedX = Math.max(halfToolbar + 10, Math.min(viewportW - halfToolbar - 10, rawX));

          // Prefer placing above selection; if too close to top bar (< 70px), place below selection
          let clampedY = rect.top - 54;
          if (clampedY < 64) {
            clampedY = Math.min(viewportH - 120, rect.bottom + 12);
          }

          setSelectionPos({
            x: Math.round(clampedX),
            y: Math.round(clampedY),
          });
        }
      } catch (e) {
        // fallback
      }
    } else {
      setSelectionPos(null);
    }
  }, []);

  useEffect(() => {
    const onMouseUp = () => setTimeout(checkSelection, 30);
    const onKeyUp = () => setTimeout(checkSelection, 30);
    const onTouchEnd = () => setTimeout(checkSelection, 50);

    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [checkSelection]);

  // Create & Persist Highlight
  const createHighlight = async (style: HighlightStyle = 'box', noteText?: string) => {
    const textToHighlight = selectedTextRef.current || selectedText;
    if (!textToHighlight) return;

    const annot: Annotation = {
      id: `pdf_annot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      documentId: document.id,
      location: `page-${currentPage}`,
      selectedText: textToHighlight,
      note: noteText || undefined,
      style,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.saveAnnotation(annot);
    await loadData();

    setSelectionPos(null);
    setSelectedText('');
    selectedTextRef.current = '';
    window.getSelection()?.removeAllRanges();
  };

  const deleteHighlight = async (id: string) => {
    await db.deleteAnnotation(id);
    await loadData();
  };

  const isBookmarked = bookmarks.some(b => b.location === `page-${currentPage}`);

  const toggleBookmark = async () => {
    if (isBookmarked) {
      const existing = bookmarks.find(b => b.location === `page-${currentPage}`);
      if (existing) {
        await db.deleteBookmark(existing.id);
        setBookmarks(bookmarks.filter(b => b.id !== existing.id));
      }
    } else {
      const currentText = pageTextMap[currentPage] || pages.find(p => p.pageNumber === currentPage)?.textContent || `Page ${currentPage}`;
      const bmark: Bookmark = {
        id: `pdf_bmark_${Date.now()}`,
        documentId: document.id,
        title: `Page ${currentPage}`,
        location: `page-${currentPage}`,
        previewText: currentText.slice(0, 80),
        createdAt: Date.now(),
      };
      await db.saveBookmark(bmark);
      setBookmarks([bmark, ...bookmarks]);
    }
  };

  const activePageText = pageTextMap[currentPage] || pages.find(p => p.pageNumber === currentPage)?.textContent || `Page ${currentPage}`;

  // Structured Text Formatter to prevent dense text flooding
  const formatStructuredText = (rawText: string): string => {
    if (/<(p|div|h[1-6]|ul|ol|table|pre|blockquote)/i.test(rawText)) {
      return rawText;
    }

    const blocks = rawText.split(/\n\s*\n+/);
    const formatted: string[] = [];

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      // Detect Headings
      if (/^#{1,3}\s+(.+)$/m.test(trimmed)) {
        const title = trimmed.replace(/^#{1,3}\s+/, '');
        formatted.push(`<h3>${title}</h3>`);
        continue;
      }

      // Detect Code blocks
      if (trimmed.startsWith('```')) {
        const cleanCode = trimmed.replace(/^```[a-z]*\n?|```$/g, '');
        formatted.push(`<pre><code>${cleanCode}</code></pre>`);
        continue;
      }

      // Detect Bullet Lists
      if (/^[\*\-•]\s+/m.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter(l => l.trim().length > 0)
          .map(l => `<li>${l.replace(/^[\*\-•]\s+/, '')}</li>`)
          .join('');
        formatted.push(`<ul>${items}</ul>`);
        continue;
      }

      // Standard formatted paragraph
      const withLineBreaks = trimmed
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');

      formatted.push(`<p>${withLineBreaks}</p>`);
    }

    return formatted.length > 0 ? formatted.join('\n') : `<p>${rawText}</p>`;
  };

  // Render Highlighted Text in Text Mode with Tag, Box, and Symbol Tolerance
  const renderHighlightedPageText = (rawText: string) => {
    let rendered = formatStructuredText(rawText);

    const pageLocation = `page-${currentPage}`;
    const pageAnnots = annotations.filter(a => a.location === pageLocation);

    for (const a of pageAnnots) {
      if (a.selectedText && a.selectedText.trim().length > 1) {
        const words = a.selectedText.trim().split(/\s+/);
        const escapedWords = words.map(w => {
          let escaped = w
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          escaped = escaped.replace(/['’]/g, "['’]");
          escaped = escaped.replace(/["“”]/g, '["“”]');
          escaped = escaped.replace(/[-—–]/g, '[-—–]');
          return escaped;
        });
        const pattern = escapedWords.join('(?:\\s*<[^>]+>\\s*|\\s+|&nbsp;)+');

        try {
          const regex = new RegExp(`(${pattern})`, 'gi');
          const isActive = activeHighlightId === a.id;
          const colorClass =
            a.style === 'underline'
              ? 'color-green'
              : a.style === 'comment'
              ? 'color-purple'
              : a.style === 'box'
              ? 'color-blue'
              : a.style === 'filled'
              ? 'color-red'
              : 'color-yellow';

          rendered = rendered.replace(
            regex,
            `<mark class="scifi-highlight ${colorClass} ${isActive ? 'active' : ''}" data-annot-id="${a.id}" title="${a.note ? 'Note: ' + a.note : 'Highlight (Click to view note)'}">$1</mark>`
          );
        } catch (e) {
          // fallback
        }
      }
    }
    return <div dangerouslySetInnerHTML={{ __html: rendered }} />;
  };

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const mark = target.closest('mark.scifi-highlight') as HTMLElement | null;
    if (mark) {
      const annotId = mark.getAttribute('data-annot-id');
      if (annotId) {
        setActiveHighlightId(annotId);
        setShowAnnotations(true);
        const annot = annotations.find(a => a.id === annotId);
        if (annot) {
          setEditingNoteId(annot.id);
          setNoteInputText(annot.note || '');
        }
      }
    }
  };

  const currentPageAnnotations = annotations.filter(a => a.location === `page-${currentPage}`);

  const getMaxWidthPx = () => {
    switch (pageWidthMode) {
      case 'compact':
        return 640;
      case 'wide':
        return 980;
      case 'fluid':
        return 1400;
      case 'standard':
      default:
        return 800;
    }
  };

  return (
    <div className="reader-container">
      {/* Floating Selection Toolbar */}
      {selectionPos && (
        <div
          className="selection-toolbar scifi-box"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{
            position: 'fixed',
            left: `${selectionPos.x}px`,
            top: `${selectionPos.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 3000,
            background: 'var(--bg-surface-elevated)',
            padding: '4px 6px',
            borderRadius: 'var(--radius-xs)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {/* Color Highlight Presets */}
          <button
            className="btn btn-sm btn-ghost"
            style={{ padding: '3px 6px', background: 'rgba(234, 179, 8, 0.25)', border: '1px solid #eab308' }}
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => createHighlight('highlight')}
            title="Yellow Highlight"
          >
            🟡
          </button>

          <button
            className="btn btn-sm btn-ghost"
            style={{ padding: '3px 6px', background: 'rgba(34, 197, 94, 0.25)', border: '1px solid #22c55e' }}
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => createHighlight('underline')}
            title="Green Highlight"
          >
            🟢
          </button>

          <button
            className="btn btn-sm btn-ghost"
            style={{ padding: '3px 6px', background: 'rgba(59, 130, 246, 0.25)', border: '1px solid #3b82f6' }}
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => createHighlight('box')}
            title="Blue Highlight"
          >
            🔵
          </button>

          <button
            className="btn btn-sm btn-ghost"
            style={{ padding: '3px 6px', background: 'rgba(168, 85, 247, 0.25)', border: '1px solid #a855f7' }}
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => createHighlight('comment')}
            title="Purple Highlight"
          >
            🟣
          </button>

          <button
            className="btn btn-sm btn-secondary"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => {
              const note = prompt('Add note to highlight:');
              if (note !== null) {
                createHighlight('highlight', note);
              }
            }}
            title="Add Note to Highlight"
          >
            <MessageSquare size={13} />
            <span>Note</span>
          </button>

          <button
            className="btn btn-sm btn-secondary"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={async () => {
              const text = selectedTextRef.current || selectedText;
              await platform.clipboard.copyText(text);
              setSelectionPos(null);
            }}
            title="Copy Text"
          >
            <Copy size={13} />
          </button>

          {onOpenLibris && (
            <button
              className="btn btn-sm btn-secondary"
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => {
                const text = selectedTextRef.current || selectedText;
                onOpenLibris(text);
                setSelectionPos(null);
              }}
              title="Ask Libris AI"
            >
              <Sparkles size={13} />
              <span>Ask Libris</span>
            </button>
          )}
        </div>
      )}

      {/* PDF Header Controls */}
      <header className="reader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button className="btn-icon btn-sm" onClick={onClose} title="Back to Library">
            <ArrowLeft size={16} />
          </button>
          <div className="reader-title-area">
            <div className="reader-doc-title">{document.title}</div>
            <div className="reader-chapter-title">
              PAGE {currentPage} / {totalPages}
            </div>
          </div>
        </div>

        {/* View Mode & Zoom - Desktop Only */}
        <div className="reader-desktop-only-control" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          {/* Custom Native Canvas / Text Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 2, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-medium)', marginRight: 4 }}>
            <button
              className={`btn btn-sm ${viewMode === 'canvas' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('canvas')}
              title="Librix Native Canvas & Symbols Engine"
              style={{ padding: '2px 8px', fontSize: 'var(--text-2xs)' }}
            >
              Native Canvas & Symbols
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'text' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('text')}
              title="Distraction-Free Text & Highlights"
              style={{ padding: '2px 8px', fontSize: 'var(--text-2xs)' }}
            >
              Text & Highlights
            </button>
          </div>

          {/* Tool Mode: Pan vs Select */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 2, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-medium)', marginRight: 6 }}>
            <button
              className={`btn btn-sm ${toolMode === 'pan' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setToolMode('pan')}
              title="Move & Drag Tool (Free Panning)"
              style={{ padding: '2px 8px', fontSize: 'var(--text-2xs)', gap: 4 }}
            >
              <Hand size={12} />
              <span>Move</span>
            </button>
            <button
              className={`btn btn-sm ${toolMode === 'select' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setToolMode('select')}
              title="Text Select & Highlight Tool"
              style={{ padding: '2px 8px', fontSize: 'var(--text-2xs)', gap: 4 }}
            >
              <MousePointer size={12} />
              <span>Highlight</span>
            </button>
          </div>

          <button className="btn-icon btn-sm" onClick={() => setZoom(Math.max(50, zoom - 15))} title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', minWidth: 40, textAlign: 'center' }}>
            {zoom}%
          </span>
          <button className="btn-icon btn-sm" onClick={() => setZoom(Math.min(250, zoom + 15))} title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <button className="btn-icon btn-sm" onClick={() => setRotation((rotation + 90) % 360)} title="Rotate 90°">
            <RotateCw size={14} />
          </button>

          {/* Typography & Layout Resizer Trigger */}
          {viewMode === 'text' && (
            <button
              className={`btn-icon btn-sm ${showSettings ? 'active' : ''}`}
              onClick={() => {
                setShowSettings(!showSettings);
                setShowThumbnails(false);
                setShowAnnotations(false);
              }}
              title="Page Width & Typography Settings"
            >
              <Type size={16} />
            </button>
          )}
        </div>

        {/* Right Actions */}
        <div className="reader-actions">
          <button
            className={`btn-icon btn-sm ${showThumbnails ? 'active' : ''}`}
            onClick={() => {
              setShowThumbnails(!showThumbnails);
              setShowAnnotations(false);
              setShowSettings(false);
            }}
            title="Page Navigator"
          >
            <LayoutGrid size={16} />
          </button>

          <button
            className={`btn-icon btn-sm ${isBookmarked ? 'active' : ''}`}
            onClick={toggleBookmark}
            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Page'}
          >
            <BookmarkIcon size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>

          <button
            className={`btn-icon btn-sm ${showAnnotations ? 'active' : ''}`}
            onClick={() => {
              setShowAnnotations(!showAnnotations);
              setShowThumbnails(false);
              setShowSettings(false);
            }}
            title="Annotations & Highlights"
          >
            <Highlighter size={16} />
          </button>

          {onOpenLibris && (
            <button className="btn btn-sm btn-primary" onClick={() => onOpenLibris()} title="Libris AI">
              <Sparkles size={13} />
              <span className="hide-on-mobile-xs">Libris AI</span>
            </button>
          )}
        </div>
      </header>

      {/* PDF Main Viewport */}
      <div className="reader-viewport">
        {/* Thumbnails Sidebar */}
        {showThumbnails && (
          <aside className="reader-sidebar left" style={{ width: 220 }}>
            <div className="reader-sidebar-header">
              <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', fontWeight: 600, letterSpacing: '0.05em' }}>
                PAGES ({totalPages})
              </span>
              <button className="btn-icon btn-sm" onClick={() => setShowThumbnails(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-2)' }}>
              {pages.map(p => (
                <div
                  key={p.pageNumber}
                  onClick={() => {
                    setCurrentPage(p.pageNumber);
                    setShowThumbnails(false);
                  }}
                  className={`palette-item ${currentPage === p.pageNumber ? 'active' : ''}`}
                  style={{
                    padding: '8px',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', fontWeight: 600 }}>
                    <span>PAGE {p.pageNumber}</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                    {p.title}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {(showThumbnails || showAnnotations || showSettings) && (
          <div
            className="mobile-drawer-backdrop"
            onClick={() => {
              setShowThumbnails(false);
              setShowAnnotations(false);
              setShowSettings(false);
            }}
          />
        )}

        {/* PDF Page Stage */}
        <main
          className="reader-stage selectable"
          ref={stageRef}
          onClick={handleStageClick}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            cursor: toolMode === 'pan' ? (isDraggingRef.current ? 'grabbing' : 'grab') : 'text',
          }}
        >
          {isLoadingPdf ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-muted)', margin: 'auto' }}>
              <Loader2 size={28} className="animate-spin" />
              <span style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-xs)' }}>
                RENDERING NATIVE PDF CANVAS & SYMBOLS...
              </span>
            </div>
          ) : viewMode === 'canvas' ? (
            /* Mode 1: Native Canvas Render with Interactive TextLayer & Highlighting Overlay */
            <div
              className="pdf-page-wrapper"
              style={{
                transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${visualScale})`,
                transformOrigin: 'center top',
                transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <div
                className="pdf-page-viewport"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {/* Native HTML5 PDF Canvas with Math, Formulas, Tables & Symbols */}
                <canvas
                  ref={canvasRef}
                  className="pdf-canvas"
                />

                {/* Text Layer Overlay for Direct Text & Symbol Selection */}
                <div
                  ref={textLayerRef}
                  className="textLayer"
                  style={{
                    pointerEvents: toolMode === 'select' ? 'auto' : 'none',
                  }}
                />
              </div>

              {/* Highlighting & Annotations Ribbon for Canvas Mode */}
              {currentPageAnnotations.length > 0 && (
                <div
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-medium)',
                    borderTop: 'none',
                    padding: '8px 12px',
                    borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    PAGE {currentPage} HIGHLIGHTS ({currentPageAnnotations.length})
                  </div>
                  {currentPageAnnotations.map(a => (
                    <div
                      key={a.id}
                      className="card"
                      onClick={() => {
                        setActiveHighlightId(a.id);
                        setShowAnnotations(true);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: 'var(--text-xs)',
                        cursor: 'pointer',
                        background: activeHighlightId === a.id ? 'var(--bg-surface-active)' : 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>"{a.selectedText}"</span>
                      {a.note && <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>— {a.note}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Mode 2: Distraction-Free Text & Highlighting Stage with Dynamically Resizable Page Width & Structured Typography */
            <div
              className="reader-page-sheet"
              key={`text-page-${currentPage}`}
              style={{
                maxWidth: `${Math.min(window.innerWidth - 64, (getMaxWidthPx() * zoom) / 100)}px`,
                padding: `${(40 * zoom) / 100}px ${(48 * zoom) / 100}px`,
                fontSize: `${(fontSize * zoom) / 100}px`,
                lineHeight: lineHeight,
                fontFamily:
                  fontFamily === 'serif'
                    ? 'var(--font-serif)'
                    : fontFamily === 'sans'
                    ? 'var(--font-sans)'
                    : 'var(--font-mono)',
                textAlign: textAlign,
              }}
            >
              {/* Sheet Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 28, fontFamily: 'var(--font-tech)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{document.title}</span>
                <span>PAGE {currentPage} / {totalPages}</span>
              </div>

              {/* Sheet Content — dynamically wraps 100% of text */}
              <div className="reader-sheet-content" style={{ color: 'var(--text-primary)' }}>
                {renderHighlightedPageText(activePageText)}
              </div>

              {/* Sheet Footer */}
              <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 40, fontFamily: 'var(--font-tech)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                - {currentPage} -
              </div>
            </div>
          )}
        </main>

        {/* Page Width & Typography Settings Drawer */}
        {showSettings && viewMode === 'text' && (
          <aside className="reader-sidebar">
            <div className="reader-sidebar-header">
              <span style={{ fontFamily: 'var(--font-tech)', fontWeight: 600, fontSize: 'var(--text-2xs)', letterSpacing: '0.05em' }}>
                PAGE LAYOUT & TYPOGRAPHY
              </span>
              <button className="btn-icon btn-sm" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Page Width Mode */}
              <div className="form-group">
                <span className="form-label">Page Width</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {(['compact', 'standard', 'wide', 'fluid'] as const).map(mode => (
                    <button
                      key={mode}
                      className={`btn btn-sm ${pageWidthMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPageWidthMode(mode)}
                      style={{ fontSize: '0.65rem', textTransform: 'uppercase', padding: '4px 2px' }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family */}
              <div className="form-group">
                <span className="form-label">Typeface</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                  {(['serif', 'sans', 'mono'] as const).map(f => (
                    <button
                      key={f}
                      className={`btn btn-sm ${fontFamily === f ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setFontFamily(f)}
                      style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label">Font Size</span>
                  <span className="form-label">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="13"
                  max="28"
                  value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))}
                  className="reader-progress-slider"
                />
              </div>

              {/* Line Height */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label">Line Spacing</span>
                  <span className="form-label">{lineHeight}x</span>
                </div>
                <input
                  type="range"
                  min="1.3"
                  max="2.4"
                  step="0.1"
                  value={lineHeight}
                  onChange={e => setLineHeight(Number(e.target.value))}
                  className="reader-progress-slider"
                />
              </div>

              {/* Alignment */}
              <div className="form-group">
                <span className="form-label">Text Alignment</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <button
                    className={`btn btn-sm ${textAlign === 'left' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setTextAlign('left')}
                  >
                    <AlignLeft size={13} />
                    <span>Left</span>
                  </button>
                  <button
                    className={`btn btn-sm ${textAlign === 'justify' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setTextAlign('justify')}
                  >
                    <AlignJustify size={13} />
                    <span>Justify</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Annotations Drawer */}
        {showAnnotations && (
          <aside className="reader-sidebar">
            <div className="reader-sidebar-header">
              <span style={{ fontFamily: 'var(--font-tech)', fontWeight: 600, fontSize: 'var(--text-2xs)', letterSpacing: '0.05em' }}>
                ANNOTATIONS ({annotations.length})
              </span>
              <button className="btn-icon btn-sm" onClick={() => setShowAnnotations(false)}>✕</button>
            </div>
            <div className="reader-sidebar-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {annotations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  Select text on any PDF page to create persistent highlights and notes.
                </div>
              ) : (
                annotations.map(a => (
                  <div
                    key={a.id}
                    className="card"
                    style={{
                      padding: 'var(--space-3)',
                      border: activeHighlightId === a.id ? '1px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                      background: activeHighlightId === a.id ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="badge" style={{ textTransform: 'uppercase' }}>{a.location}</span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          className="btn-icon btn-sm"
                          onClick={() => {
                            setEditingNoteId(a.id);
                            setNoteInputText(a.note || '');
                          }}
                          title="Edit Note"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button className="btn-icon btn-sm" onClick={() => deleteHighlight(a.id)}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    <div
                      style={{ fontSize: 'var(--text-xs)', fontStyle: 'italic', cursor: 'pointer', color: 'var(--text-primary)' }}
                      onClick={() => {
                        const match = a.location.match(/page-(\d+)/);
                        if (match) {
                          const pNum = parseInt(match[1], 10);
                          if (!isNaN(pNum)) setCurrentPage(pNum);
                        }
                        setActiveHighlightId(a.id);
                      }}
                      title="Click to jump to page"
                    >
                      "{a.selectedText}"
                    </div>

                    {editingNoteId === a.id ? (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <textarea
                          value={noteInputText}
                          onChange={e => setNoteInputText(e.target.value)}
                          placeholder="Enter note..."
                          style={{ fontSize: 'var(--text-2xs)', padding: 4, height: 54 }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingNoteId(null)}>Cancel</button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={async () => {
                              await db.updateAnnotationNote(a.id, noteInputText);
                              setEditingNoteId(null);
                              setNoteInputText('');
                              await loadData();
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : a.note ? (
                      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-secondary)', marginTop: 4, padding: '3px 6px', background: 'var(--bg-input)', borderRadius: 2 }}>
                        <strong>Note:</strong> {a.note}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* PDF Bottom Navigation Bar & Dock */}
      <footer className="reader-footer">
        {/* Desktop Footer View */}
        <div className="reader-desktop-only-footer">
          <button
            className="btn btn-sm btn-ghost"
            disabled={currentPage <= 1}
            onClick={() => {
              setCurrentPage(Math.max(1, currentPage - 1));
              setPanOffset({ x: 0, y: 0 });
            }}
          >
            <ChevronLeft size={14} />
            <span>PREV</span>
          </button>

          <div className="reader-progress-slider-wrap">
            <span>{currentPage}</span>
            <input
              type="range"
              min="1"
              max={Math.max(1, totalPages)}
              value={currentPage}
              onChange={e => {
                setCurrentPage(Number(e.target.value));
                setPanOffset({ x: 0, y: 0 });
              }}
              className="reader-progress-slider"
            />
            <span>{totalPages} PAGES</span>
          </div>

          <button
            className="btn btn-sm btn-ghost"
            disabled={currentPage >= totalPages}
            onClick={() => {
              setCurrentPage(Math.min(totalPages, currentPage + 1));
              setPanOffset({ x: 0, y: 0 });
            }}
          >
            <span>NEXT</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Mobile & Tablet Sleek Docked Footer View */}
        <div className="reader-mobile-only-footer">
          {/* Tool Mode: Pan vs Highlight */}
          <button
            className={`btn btn-sm ${toolMode === 'select' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setToolMode(toolMode === 'pan' ? 'select' : 'pan')}
            title={toolMode === 'pan' ? 'In Move Mode (Tap for Highlight Tool)' : 'In Highlight Mode (Tap for Move Tool)'}
            style={{ height: 30, padding: '0 6px', fontSize: '0.7rem', gap: 3 }}
          >
            {toolMode === 'pan' ? <Hand size={13} /> : <Highlighter size={13} />}
            <span>{toolMode === 'pan' ? 'Move' : 'Select'}</span>
          </button>

          {/* Page Step Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              className="btn-icon btn-sm"
              disabled={currentPage <= 1}
              onClick={() => {
                setCurrentPage(p => Math.max(1, p - 1));
                setPanOffset({ x: 0, y: 0 });
              }}
              style={{ width: 28, height: 28 }}
            >
              <ChevronLeft size={15} />
            </button>

            <span style={{ fontFamily: 'var(--font-tech)', fontSize: '0.72rem', fontWeight: 600, padding: '0 2px', minWidth: 46, textAlign: 'center' }}>
              {currentPage}/{totalPages}
            </span>

            <button
              className="btn-icon btn-sm"
              disabled={currentPage >= totalPages}
              onClick={() => {
                setCurrentPage(p => Math.min(totalPages, p + 1));
                setPanOffset({ x: 0, y: 0 });
              }}
              style={{ width: 28, height: 28 }}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Mobile Zoom Cluster: [ - ] [ 100% ] [ + ] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: 'var(--bg-input)', borderRadius: 'var(--radius-xs)', padding: '2px 3px', border: '1px solid var(--border-subtle)' }}>
            <button
              className="btn-icon btn-sm"
              onClick={() => {
                setZoom(z => Math.max(50, z - 25));
                setVisualScale(1);
              }}
              title="Zoom Out"
              style={{ width: 24, height: 24, padding: 0 }}
            >
              <ZoomOut size={12} />
            </button>

            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                setZoom(100);
                setPanOffset({ x: 0, y: 0 });
                setVisualScale(1);
              }}
              title="Reset Zoom to 100%"
              style={{ fontFamily: 'var(--font-tech)', fontSize: '0.68rem', fontWeight: 600, padding: '0 4px', height: 22 }}
            >
              {zoom}%
            </button>

            <button
              className="btn-icon btn-sm"
              onClick={() => {
                setZoom(z => Math.min(300, z + 25));
                setVisualScale(1);
              }}
              title="Zoom In"
              style={{ width: 24, height: 24, padding: 0 }}
            >
              <ZoomIn size={12} />
            </button>
          </div>
        </div>
      </footer>

      {/* Realtime Live Zoom HUD (Shows on Zoom / Pinch) */}
      {visualScale !== 1 && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.75)',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '9999px',
            fontFamily: 'var(--font-tech)',
            fontSize: '1rem',
            fontWeight: 700,
            zIndex: 4000,
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          }}
        >
          {Math.round(zoom * visualScale)}%
        </div>
      )}
    </div>
  );
};
