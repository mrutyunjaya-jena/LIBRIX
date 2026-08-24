import React, { useRef, useEffect, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Search,
  BookOpen,
  FileText,
  Tag as TagIcon,
  User,
  Folder,
  Layers,
  Sparkles,
} from 'lucide-react';
import { KnowledgeGraphNode, KnowledgeGraphLink, Document, Note } from '../core/types';
import { db } from '../core/db/DatabaseEngine';

interface KnowledgeGraphProps {
  onSelectNode: (node: KnowledgeGraphNode) => void;
  onOpenLibris?: () => void;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  onSelectNode,
  onOpenLibris,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<KnowledgeGraphNode[]>([]);
  const [links, setLinks] = useState<KnowledgeGraphLink[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);

  // Visibility filters
  const [filterNotes, setFilterNotes] = useState(true);
  const [filterBooks, setFilterBooks] = useState(true);
  const [filterTags, setFilterTags] = useState(true);
  const [filterAuthors, setFilterAuthors] = useState(true);

  // Physics settings
  const [chargeStrength, setChargeStrength] = useState(120);
  const [linkDistance, setLinkDistance] = useState(90);
  const [showControls, setShowControls] = useState(false);

  // Transform / Pan & Zoom
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<KnowledgeGraphNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Build Graph Data from Database
  useEffect(() => {
    const buildGraph = async () => {
      const dbDocs = await db.getDocuments();
      const dbNotes = await db.getNotes();
      const dbTags = await db.getTags();

      const gNodes: KnowledgeGraphNode[] = [];
      const gLinks: KnowledgeGraphLink[] = [];
      const nodeMap = new Set<string>();

      // 1. Add Note Nodes
      dbNotes.forEach((n, idx) => {
        gNodes.push({
          id: `note_${n.id}`,
          label: n.title,
          type: 'note',
          val: 12,
          color: '#6366f1',
          x: Math.cos((idx / dbNotes.length) * Math.PI * 2) * 200 + (Math.random() - 0.5) * 50,
          y: Math.sin((idx / dbNotes.length) * Math.PI * 2) * 200 + (Math.random() - 0.5) * 50,
          vx: 0,
          vy: 0,
        });
        nodeMap.add(`note_${n.id}`);
        nodeMap.add(`title_${n.title.toLowerCase()}`);
      });

      // 2. Add Book / Document Nodes
      dbDocs.forEach((d, idx) => {
        const id = `doc_${d.id}`;
        gNodes.push({
          id,
          label: d.title,
          type: 'book',
          val: 16,
          color: '#ec4899',
          x: Math.cos((idx / dbDocs.length) * Math.PI * 2) * 350 + (Math.random() - 0.5) * 60,
          y: Math.sin((idx / dbDocs.length) * Math.PI * 2) * 350 + (Math.random() - 0.5) * 60,
          vx: 0,
          vy: 0,
        });
        nodeMap.add(id);

        // Add author nodes
        if (d.author && d.author !== 'Unknown') {
          const authorId = `author_${d.author}`;
          if (!nodeMap.has(authorId)) {
            gNodes.push({
              id: authorId,
              label: d.author,
              type: 'author',
              val: 10,
              color: '#10b981',
              x: (Math.random() - 0.5) * 500,
              y: (Math.random() - 0.5) * 500,
              vx: 0,
              vy: 0,
            });
            nodeMap.add(authorId);
          }
          gLinks.push({ source: id, target: authorId, type: 'author' });
        }

        // Add document tags
        d.tags.forEach(t => {
          const tagId = `tag_${t.toLowerCase()}`;
          if (!nodeMap.has(tagId)) {
            gNodes.push({
              id: tagId,
              label: `#${t}`,
              type: 'tag',
              val: 8,
              color: '#f59e0b',
              x: (Math.random() - 0.5) * 400,
              y: (Math.random() - 0.5) * 400,
              vx: 0,
              vy: 0,
            });
            nodeMap.add(tagId);
          }
          gLinks.push({ source: id, target: tagId, type: 'tag' });
        });
      });

      // 3. Connect Notes with [[Wikilinks]] and tags
      dbNotes.forEach(n => {
        const sourceId = `note_${n.id}`;

        // Wikilinks
        n.wikilinks.forEach(w => {
          // Find target note
          const targetNote = dbNotes.find(target => target.title.toLowerCase() === w.toLowerCase());
          if (targetNote) {
            gLinks.push({
              source: sourceId,
              target: `note_${targetNote.id}`,
              type: 'wikilink',
            });
          }
        });

        // Tags
        n.tags.forEach(t => {
          const tagId = `tag_${t.toLowerCase()}`;
          if (!nodeMap.has(tagId)) {
            gNodes.push({
              id: tagId,
              label: `#${t}`,
              type: 'tag',
              val: 8,
              color: '#f59e0b',
              x: (Math.random() - 0.5) * 300,
              y: (Math.random() - 0.5) * 300,
              vx: 0,
              vy: 0,
            });
            nodeMap.add(tagId);
          }
          gLinks.push({ source: sourceId, target: tagId, type: 'tag' });
        });
      });

      setNodes(gNodes);
      setLinks(gLinks);
    };

    buildGraph();
  }, []);

  // Canvas Rendering & Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    // Physics Simulation Step
    const simulatePhysics = () => {
      const activeNodes = nodes.filter(n => {
        if (n.type === 'note' && !filterNotes) return false;
        if (n.type === 'book' && !filterBooks) return false;
        if (n.type === 'tag' && !filterTags) return false;
        if (n.type === 'author' && !filterAuthors) return false;
        return true;
      });

      const activeMap = new Map(activeNodes.map(n => [n.id, n]));

      // 1. Repulsion between active nodes (Coulomb Force)
      for (let i = 0; i < activeNodes.length; i++) {
        for (let j = i + 1; j < activeNodes.length; j++) {
          const a = activeNodes[i];
          const b = activeNodes[j];
          const dx = (b.x || 0) - (a.x || 0);
          const dy = (b.y || 0) - (a.y || 0);
          const distSq = dx * dx + dy * dy + 100;
          const dist = Math.sqrt(distSq);
          const force = (chargeStrength * 100) / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (a !== draggedNodeRef.current) {
            a.vx = (a.vx || 0) - fx;
            a.vy = (a.vy || 0) - fy;
          }
          if (b !== draggedNodeRef.current) {
            b.vx = (b.vx || 0) + fx;
            b.vy = (b.vy || 0) + fy;
          }
        }
      }

      // 2. Spring Attraction along Links (Hooke's Law)
      links.forEach(l => {
        const source = activeMap.get(l.source);
        const target = activeMap.get(l.target);
        if (source && target) {
          const dx = (target.x || 0) - (source.x || 0);
          const dy = (target.y || 0) - (source.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const diff = dist - linkDistance;
          const force = diff * 0.03;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (source !== draggedNodeRef.current) {
            source.vx = (source.vx || 0) + fx;
            source.vy = (source.vy || 0) + fy;
          }
          if (target !== draggedNodeRef.current) {
            target.vx = (target.vx || 0) - fx;
            target.vy = (target.vy || 0) - fy;
          }
        }
      });

      // 3. Center Gravity & Damping
      activeNodes.forEach(n => {
        if (n === draggedNodeRef.current) return;
        // Gravity to (0,0)
        n.vx = (n.vx || 0) - (n.x || 0) * 0.005;
        n.vy = (n.vy || 0) - (n.y || 0) * 0.005;

        // Damping / Friction
        n.vx *= 0.88;
        n.vy *= 0.88;

        n.x = (n.x || 0) + n.vx;
        n.y = (n.y || 0) + n.vy;
      });
    };

    // Render Function
    const render = () => {
      simulatePhysics();

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Draw Grid Background
      ctx.fillStyle = '#0d0f14';
      ctx.fillRect(0, 0, width, height);

      // Apply Pan & Zoom
      const { x: panX, y: panY, scale } = transformRef.current;
      ctx.translate(width / 2 + panX, height / 2 + panY);
      ctx.scale(scale, scale);

      const activeNodes = nodes.filter(n => {
        if (n.type === 'note' && !filterNotes) return false;
        if (n.type === 'book' && !filterBooks) return false;
        if (n.type === 'tag' && !filterTags) return false;
        if (n.type === 'author' && !filterAuthors) return false;
        return true;
      });
      const activeMap = new Map(activeNodes.map(n => [n.id, n]));

      // 1. Draw Links
      ctx.lineWidth = 1;
      links.forEach(l => {
        const src = activeMap.get(l.source);
        const tgt = activeMap.get(l.target);
        if (src && tgt) {
          ctx.beginPath();
          ctx.moveTo(src.x || 0, src.y || 0);
          ctx.lineTo(tgt.x || 0, tgt.y || 0);

          if (l.type === 'wikilink') {
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
            ctx.lineWidth = 1.5;
          } else if (l.type === 'tag') {
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
            ctx.lineWidth = 1;
          } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
          }
          ctx.stroke();
        }
      });

      // 2. Draw Nodes
      activeNodes.forEach(n => {
        const nx = n.x || 0;
        const ny = n.y || 0;
        const radius = n.val;
        const isMatched = searchQuery ? n.label.toLowerCase().includes(searchQuery.toLowerCase()) : true;
        const isSelected = selectedNode?.id === n.id;

        // Outer glow
        if (isSelected || (searchQuery && isMatched)) {
          ctx.beginPath();
          ctx.arc(nx, ny, radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(99, 102, 241, 0.4)' : 'rgba(245, 158, 11, 0.3)';
          ctx.fill();
        }

        // Main circle
        ctx.beginPath();
        ctx.arc(nx, ny, radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color || '#6366f1';
        ctx.globalAlpha = isMatched ? 1.0 : 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.stroke();

        // Node Label
        if (scale > 0.6 || isSelected || (searchQuery && isMatched)) {
          ctx.font = `${isSelected ? 'bold' : 'normal'} 11px Inter, sans-serif`;
          ctx.fillStyle = isSelected ? '#ffffff' : '#cbd5e1';
          ctx.textAlign = 'center';
          ctx.fillText(n.label, nx, ny + radius + 14);
        }
      });

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [nodes, links, filterNotes, filterBooks, filterTags, filterAuthors, chargeStrength, linkDistance, searchQuery, selectedNode]);

  // Pointer Interactions: Pan, Zoom, and Drag Node
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse coordinates to world coordinates
    const { x: panX, y: panY, scale } = transformRef.current;
    const worldX = (mouseX - canvas.width / 2 - panX) / scale;
    const worldY = (mouseY - canvas.height / 2 - panY) / scale;

    // Check if clicked a node
    const clicked = nodes.find(n => {
      const dx = (n.x || 0) - worldX;
      const dy = (n.y || 0) - worldY;
      return Math.sqrt(dx * dx + dy * dy) <= n.val + 4;
    });

    if (clicked) {
      draggedNodeRef.current = clicked;
      setSelectedNode(clicked);
      onSelectNode(clicked);
    } else {
      isDraggingRef.current = true;
      dragStartRef.current = { x: mouseX - panX, y: mouseY - panY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggedNodeRef.current) {
      const { x: panX, y: panY, scale } = transformRef.current;
      draggedNodeRef.current.x = (mouseX - canvas.width / 2 - panX) / scale;
      draggedNodeRef.current.y = (mouseY - canvas.height / 2 - panY) / scale;
    } else if (isDraggingRef.current) {
      transformRef.current.x = mouseX - dragStartRef.current.x;
      transformRef.current.y = mouseY - dragStartRef.current.y;
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    draggedNodeRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    transformRef.current.scale = Math.min(3.0, Math.max(0.2, transformRef.current.scale * zoomFactor));
  };

  const resetView = () => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#0d0f14' }}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ width: '100%', height: '100%', cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
      />

      {/* Top Search Bar & Filters */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          zIndex: 10,
        }}
      >
        <div className="input-with-icon" style={{ width: 260 }}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Search graph nodes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <button
          className={`badge ${filterNotes ? 'badge-brand' : 'badge-cloud'}`}
          onClick={() => setFilterNotes(!filterNotes)}
          style={{ cursor: 'pointer', padding: '6px 12px' }}
        >
          <FileText size={12} /> Notes ({nodes.filter(n => n.type === 'note').length})
        </button>

        <button
          className={`badge ${filterBooks ? 'badge-brand' : 'badge-cloud'}`}
          onClick={() => setFilterBooks(!filterBooks)}
          style={{ cursor: 'pointer', padding: '6px 12px', background: filterBooks ? '#ec4899' : undefined, color: '#fff' }}
        >
          <BookOpen size={12} /> Books ({nodes.filter(n => n.type === 'book').length})
        </button>

        <button
          className={`badge ${filterTags ? 'badge-warning' : 'badge-cloud'}`}
          onClick={() => setFilterTags(!filterTags)}
          style={{ cursor: 'pointer', padding: '6px 12px' }}
        >
          <TagIcon size={12} /> Tags ({nodes.filter(n => n.type === 'tag').length})
        </button>

        <button
          className={`badge ${filterAuthors ? 'badge-success' : 'badge-cloud'}`}
          onClick={() => setFilterAuthors(!filterAuthors)}
          style={{ cursor: 'pointer', padding: '6px 12px' }}
        >
          <User size={12} /> Authors ({nodes.filter(n => n.type === 'author').length})
        </button>
      </div>

      {/* Top Right Actions */}
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 'var(--space-2)', zIndex: 10 }}>
        {onOpenLibris && (
          <button className="btn btn-sm btn-primary" onClick={onOpenLibris}>
            <Sparkles size={14} />
            Ask Libris Graph
          </button>
        )}
      </div>

      {/* Floating Control Toolbar */}
      <div
        className="card"
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: '6px 10px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-full)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 10,
        }}
      >
        <button
          className="btn-icon btn-sm"
          onClick={() => (transformRef.current.scale = Math.min(3, transformRef.current.scale * 1.2))}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="btn-icon btn-sm"
          onClick={() => (transformRef.current.scale = Math.max(0.2, transformRef.current.scale / 1.2))}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button className="btn-icon btn-sm" onClick={resetView} title="Reset View">
          <RotateCcw size={16} />
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border-medium)' }} />
        <button
          className={`btn-icon btn-sm ${showControls ? 'active' : ''}`}
          onClick={() => setShowControls(!showControls)}
          title="Physics Settings"
        >
          <Sliders size={16} />
        </button>
      </div>

      {/* Physics Settings Panel */}
      {showControls && (
        <div
          className="card"
          style={{
            position: 'absolute',
            bottom: 80,
            right: 24,
            width: 240,
            padding: 'var(--space-4)',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 12 }}>GRAPH PHYSICS</div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
              <span>Repulsion Charge</span>
              <span>{chargeStrength}</span>
            </div>
            <input
              type="range"
              min="30"
              max="300"
              value={chargeStrength}
              onChange={e => setChargeStrength(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
              <span>Link Distance</span>
              <span>{linkDistance}px</span>
            </div>
            <input
              type="range"
              min="40"
              max="200"
              value={linkDistance}
              onChange={e => setLinkDistance(Number(e.target.value))}
            />
          </div>
        </div>
      )}
    </div>
  );
};
