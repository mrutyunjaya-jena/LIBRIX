import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Sliders,
  Sparkles,
  BookOpen,
  FileText,
  Tag as TagIcon,
  User,
  Folder as FolderIcon,
  Eye,
} from 'lucide-react';
import {
  KnowledgeGraphData,
  KnowledgeGraphNode,
  KnowledgeGraphLink,
  GraphNodeType,
  GraphNodeShape,
} from '../core/types';
import { db } from '../core/db/DatabaseEngine';
import { WikilinkParser } from './WikilinkParser';

interface KnowledgeGraphProps {
  onOpenDocument?: (docId: string) => void;
  onOpenNote?: (noteId: string) => void;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  onOpenDocument,
  onOpenNote,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // State
  const [graphData, setGraphData] = useState<KnowledgeGraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<KnowledgeGraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<GraphNodeType>>(
    new Set(['note', 'book', 'tag', 'author', 'folder'])
  );

  // Physics settings
  const [chargeStrength, setChargeStrength] = useState(140);
  const [linkDistance, setLinkDistance] = useState(95);
  const [showControls, setShowControls] = useState(false);

  // Transform / Pan & Zoom
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<KnowledgeGraphNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Build Comprehensive Graph Data from Database
  const buildGraph = async () => {
    const dbDocs = await db.getDocuments();
    const dbNotes = await db.getNotes();
    const dbFolders = await db.getFolders();

    const gNodes: KnowledgeGraphNode[] = [];
    const gLinks: KnowledgeGraphLink[] = [];
    const nodeMap = new Map<string, KnowledgeGraphNode>();

    // 1. Add Note Nodes (Circle)
    dbNotes.forEach((n, idx) => {
      const parsed = WikilinkParser.parse(n.content);
      const id = `note_${n.id}`;
      const node: KnowledgeGraphNode = {
        id,
        label: n.title,
        type: 'note',
        shape: 'circle',
        val: 14,
        x: Math.cos((idx / (dbNotes.length || 1)) * Math.PI * 2) * 180 + (Math.random() - 0.5) * 40,
        y: Math.sin((idx / (dbNotes.length || 1)) * Math.PI * 2) * 180 + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      };
      gNodes.push(node);
      nodeMap.set(id, node);
      nodeMap.set(`title_${n.title.toLowerCase().trim()}`, node);
    });

    // 2. Add Book & Document Nodes (Diamond)
    dbDocs.forEach((d, idx) => {
      const id = `doc_${d.id}`;
      const node: KnowledgeGraphNode = {
        id,
        label: d.title,
        type: 'book',
        shape: 'diamond',
        val: 18,
        x: Math.cos((idx / (dbDocs.length || 1)) * Math.PI * 2) * 320 + (Math.random() - 0.5) * 60,
        y: Math.sin((idx / (dbDocs.length || 1)) * Math.PI * 2) * 320 + (Math.random() - 0.5) * 60,
        vx: 0,
        vy: 0,
      };
      gNodes.push(node);
      nodeMap.set(id, node);
      nodeMap.set(`title_${d.title.toLowerCase().trim()}`, node);

      // Add author nodes (Hexagon)
      if (d.author && d.author !== 'Unknown' && d.author !== 'Unknown Author') {
        const authorId = `author_${d.author.toLowerCase().trim()}`;
        if (!nodeMap.has(authorId)) {
          const aNode: KnowledgeGraphNode = {
            id: authorId,
            label: d.author,
            type: 'author',
            shape: 'hexagon',
            val: 11,
            x: (Math.random() - 0.5) * 400,
            y: (Math.random() - 0.5) * 400,
            vx: 0,
            vy: 0,
          };
          gNodes.push(aNode);
          nodeMap.set(authorId, aNode);
        }
        gLinks.push({ source: id, target: authorId, type: 'author' });
      }

      // Add document tags (Square)
      d.tags.forEach(t => {
        const tagId = `tag_${t.toLowerCase().trim()}`;
        if (!nodeMap.has(tagId)) {
          const tNode: KnowledgeGraphNode = {
            id: tagId,
            label: `#${t}`,
            type: 'tag',
            shape: 'square',
            val: 9,
            x: (Math.random() - 0.5) * 360,
            y: (Math.random() - 0.5) * 360,
            vx: 0,
            vy: 0,
          };
          gNodes.push(tNode);
          nodeMap.set(tagId, tNode);
        }
        gLinks.push({ source: id, target: tagId, type: 'tag' });
      });

      // Folder association
      if (d.folderId) {
        const folderId = `fld_${d.folderId}`;
        const targetFolder = dbFolders.find(f => f.id === d.folderId);
        if (targetFolder && !nodeMap.has(folderId)) {
          const fNode: KnowledgeGraphNode = {
            id: folderId,
            label: `📁 ${targetFolder.name}`,
            type: 'folder',
            shape: 'circle',
            val: 12,
            x: (Math.random() - 0.5) * 450,
            y: (Math.random() - 0.5) * 450,
            vx: 0,
            vy: 0,
          };
          gNodes.push(fNode);
          nodeMap.set(folderId, fNode);
        }
        if (nodeMap.has(folderId)) {
          gLinks.push({ source: id, target: folderId, type: 'folder' });
        }
      }
    });

    // 3. Connect Notes with [[Wikilinks]] and #tags
    dbNotes.forEach(n => {
      const sourceId = `note_${n.id}`;
      const parsed = WikilinkParser.parse(n.content);

      // Connect wikilinks
      parsed.wikilinks.forEach(targetTitle => {
        const cleanTitle = targetTitle.toLowerCase().trim();
        const targetNode = nodeMap.get(`title_${cleanTitle}`);
        if (targetNode) {
          gLinks.push({
            source: sourceId,
            target: targetNode.id,
            type: 'wikilink',
          });
        } else {
          // Concept/Topic stub node
          const topicId = `topic_${cleanTitle}`;
          if (!nodeMap.has(topicId)) {
            const topicNode: KnowledgeGraphNode = {
              id: topicId,
              label: targetTitle,
              type: 'topic',
              shape: 'circle',
              val: 8,
              x: (Math.random() - 0.5) * 300,
              y: (Math.random() - 0.5) * 300,
              vx: 0,
              vy: 0,
            };
            gNodes.push(topicNode);
            nodeMap.set(topicId, topicNode);
            nodeMap.set(`title_${cleanTitle}`, topicNode);
          }
          gLinks.push({
            source: sourceId,
            target: topicId,
            type: 'wikilink',
          });
        }
      });

      // Connect note tags
      parsed.tags.forEach(t => {
        const tagId = `tag_${t.toLowerCase().trim()}`;
        if (!nodeMap.has(tagId)) {
          const tNode: KnowledgeGraphNode = {
            id: tagId,
            label: `#${t}`,
            type: 'tag',
            shape: 'square',
            val: 9,
            x: (Math.random() - 0.5) * 360,
            y: (Math.random() - 0.5) * 360,
            vx: 0,
            vy: 0,
          };
          gNodes.push(tNode);
          nodeMap.set(tagId, tNode);
        }
        gLinks.push({ source: sourceId, target: tagId, type: 'tag' });
      });
    });

    setGraphData({ nodes: gNodes, links: gLinks });
  };

  useEffect(() => {
    buildGraph();
  }, []);

  // Filter nodes based on active filter pills & search query
  const filteredNodes = graphData.nodes.filter(n => {
    if (!activeFilters.has(n.type)) return false;
    if (searchQuery.trim().length > 0) {
      return n.label.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = graphData.links.filter(
    l => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target)
  );

  // Physics Simulation & Grayscale Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isDark = document.body.classList.contains('theme-dark') || !document.body.classList.contains('theme-light');

    // Resize handler
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Spring Physics Simulation Tick
    const simulatePhysics = () => {
      const nodes = filteredNodes;
      const links = filteredLinks;
      const k = 0.04;
      const repulsion = chargeStrength * 10;
      const damping = 0.85;

      // 1. Coulomb Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = (n1.x || 0) - (n2.x || 0);
          const dy = (n1.y || 0) - (n2.y || 0);
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);

          if (dist < 400) {
            const force = repulsion / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (draggedNodeRef.current !== n1) {
              n1.vx = ((n1.vx || 0) + fx) * damping;
              n1.vy = ((n1.vy || 0) + fy) * damping;
            }
            if (draggedNodeRef.current !== n2) {
              n2.vx = ((n2.vx || 0) - fx) * damping;
              n2.vy = ((n2.vy || 0) - fy) * damping;
            }
          }
        }
      }

      // 2. Hooke's Law Spring Links
      const nodeIndexMap = new Map(nodes.map(n => [n.id, n]));
      links.forEach(link => {
        const source = nodeIndexMap.get(link.source);
        const target = nodeIndexMap.get(link.target);
        if (source && target) {
          const dx = (target.x || 0) - (source.x || 0);
          const dy = (target.y || 0) - (source.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const displacement = dist - linkDistance;
          const force = displacement * k;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (draggedNodeRef.current !== source) {
            source.vx = ((source.vx || 0) + fx) * damping;
            source.vy = ((source.vy || 0) + fy) * damping;
          }
          if (draggedNodeRef.current !== target) {
            target.vx = ((target.vx || 0) - fx) * damping;
            target.vy = ((target.vy || 0) - fy) * damping;
          }
        }
      });

      // 3. Center Gravity & Position Integration
      nodes.forEach(n => {
        if (draggedNodeRef.current !== n) {
          n.vx = ((n.vx || 0) - (n.x || 0) * 0.002) * damping;
          n.vy = ((n.vy || 0) - (n.y || 0) * 0.002) * damping;
          n.x = (n.x || 0) + (n.vx || 0);
          n.y = (n.y || 0) + (n.vy || 0);
        }
      });
    };

    // Draw Geometric Node Shapes
    const drawNodeShape = (
      ctx: CanvasRenderingContext2D,
      shape: GraphNodeShape,
      x: number,
      y: number,
      radius: number,
      type: GraphNodeType,
      isSelected: boolean,
      isHovered: boolean
    ) => {
      ctx.beginPath();
      if (shape === 'diamond') {
        // Diamond for Books
        ctx.moveTo(x, y - radius * 1.3);
        ctx.lineTo(x + radius * 1.3, y);
        ctx.lineTo(x, y + radius * 1.3);
        ctx.lineTo(x - radius * 1.3, y);
        ctx.closePath();
      } else if (shape === 'square') {
        // Square for Tags
        const size = radius * 1.6;
        ctx.rect(x - size / 2, y - size / 2, size, size);
      } else if (shape === 'hexagon') {
        // Hexagon for Authors
        const sides = 6;
        const hexRadius = radius * 1.2;
        for (let i = 0; i < sides; i++) {
          const angle = (i * Math.PI) / 3;
          const hx = x + hexRadius * Math.cos(angle);
          const hy = y + hexRadius * Math.sin(angle);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
      } else {
        // Circle for Notes & Topics
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }

      // STRICT GRAYSCALE FILLS & BORDERS
      if (isDark) {
        ctx.fillStyle = isSelected ? '#ffffff' : isHovered ? '#d4d4d4' : type === 'book' ? '#1f1f1f' : '#141414';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : isHovered ? '#a3a3a3' : type === 'book' ? '#ffffff' : '#555555';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = isSelected ? '#000000' : isHovered ? '#333333' : type === 'book' ? '#ffffff' : '#f0f0f0';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#000000' : isHovered ? '#555555' : type === 'book' ? '#000000' : '#888888';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();
      }
    };

    // Render Canvas Frame
    const render = () => {
      simulatePhysics();

      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background Grid
      const bgStyle = isDark ? '#080808' : '#fafafa';
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply Pan & Zoom Transform
      const { x: panX, y: panY, scale } = transformRef.current;
      ctx.translate(canvas.width / 2 + panX * dpr, canvas.height / 2 + panY * dpr);
      ctx.scale(scale * dpr, scale * dpr);

      // 1. Draw Links
      const nodeIndexMap = new Map(filteredNodes.map(n => [n.id, n]));
      filteredLinks.forEach(link => {
        const source = nodeIndexMap.get(link.source);
        const target = nodeIndexMap.get(link.target);
        if (source && target) {
          const isConnectedToHover =
            hoveredNode && (hoveredNode.id === source.id || hoveredNode.id === target.id);
          const isConnectedToSelected =
            selectedNode && (selectedNode.id === source.id || selectedNode.id === target.id);

          ctx.beginPath();
          ctx.moveTo(source.x || 0, source.y || 0);
          ctx.lineTo(target.x || 0, target.y || 0);

          if (link.type === 'tag') {
            ctx.setLineDash([3, 3]); // Dashed for tags
          } else if (link.type === 'folder') {
            ctx.setLineDash([2, 4]); // Dotted for folders
          } else {
            ctx.setLineDash([]); // Solid for wikilinks
          }

          if (isDark) {
            ctx.strokeStyle = isConnectedToSelected
              ? '#ffffff'
              : isConnectedToHover
              ? '#a3a3a3'
              : 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = isConnectedToSelected ? 2 : isConnectedToHover ? 1.5 : 1;
          } else {
            ctx.strokeStyle = isConnectedToSelected
              ? '#000000'
              : isConnectedToHover
              ? '#555555'
              : 'rgba(0, 0, 0, 0.15)';
            ctx.lineWidth = isConnectedToSelected ? 2 : isConnectedToHover ? 1.5 : 1;
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // 2. Draw Nodes
      filteredNodes.forEach(node => {
        const nx = node.x || 0;
        const ny = node.y || 0;
        const isSelected = selectedNode?.id === node.id;
        const isHovered = hoveredNode?.id === node.id;

        drawNodeShape(
          ctx,
          node.shape || 'circle',
          nx,
          ny,
          node.val,
          node.type,
          isSelected,
          isHovered
        );

        // Text Labels (Level of Detail LOD)
        if (scale > 0.55 || isSelected || isHovered) {
          ctx.font = `${isSelected ? 'bold ' : ''}11px 'JetBrains Mono', monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (isDark) {
            ctx.fillStyle = isSelected ? '#ffffff' : isHovered ? '#e5e5e5' : '#a3a3a3';
          } else {
            ctx.fillStyle = isSelected ? '#000000' : isHovered ? '#222222' : '#525252';
          }

          const labelText = node.label.length > 24 ? node.label.substring(0, 22) + '…' : node.label;
          ctx.fillText(labelText, nx, ny + node.val + 13);
        }
      });

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', updateSize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [filteredNodes, filteredLinks, selectedNode, hoveredNode, chargeStrength, linkDistance]);

  // Pointer Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const { x: panX, y: panY, scale } = transformRef.current;

    const mouseX = ((e.clientX - rect.left - rect.width / 2) / scale) - panX;
    const mouseY = ((e.clientY - rect.top - rect.height / 2) / scale) - panY;

    // Check hit on any node
    const hitNode = filteredNodes.find(n => {
      const dx = (n.x || 0) - mouseX;
      const dy = (n.y || 0) - mouseY;
      return Math.sqrt(dx * dx + dy * dy) <= n.val * 1.5;
    });

    if (hitNode) {
      draggedNodeRef.current = hitNode;
      setSelectedNode(hitNode);
    } else {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX - panX * scale, y: e.clientY - panY * scale };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { x: panX, y: panY, scale } = transformRef.current;

    const mouseX = ((e.clientX - rect.left - rect.width / 2) / scale) - panX;
    const mouseY = ((e.clientY - rect.top - rect.height / 2) / scale) - panY;

    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = mouseX;
      draggedNodeRef.current.y = mouseY;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
    } else if (isDraggingRef.current) {
      transformRef.current.x = (e.clientX - dragStartRef.current.x) / scale;
      transformRef.current.y = (e.clientY - dragStartRef.current.y) / scale;
    } else {
      const hit = filteredNodes.find(n => {
        const dx = (n.x || 0) - mouseX;
        const dy = (n.y || 0) - mouseY;
        return Math.sqrt(dx * dx + dy * dy) <= n.val * 1.5;
      });
      setHoveredNode(hit || null);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    draggedNodeRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    transformRef.current.scale = Math.min(3, Math.max(0.2, transformRef.current.scale * zoomFactor));
  };

  const toggleFilter = (type: GraphNodeType) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Top Controls Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          right: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        {/* Left: Search & Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
          <div className="input-with-icon" style={{ width: 220 }}>
            <Search size={13} />
            <input
              type="text"
              placeholder="Search graph nodes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ height: 32, fontSize: 'var(--text-xs)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 3, background: 'var(--bg-glass)', padding: 3, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <button
              className={`btn btn-sm ${activeFilters.has('note') ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => toggleFilter('note')}
            >
              ● Notes
            </button>
            <button
              className={`btn btn-sm ${activeFilters.has('book') ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => toggleFilter('book')}
            >
              ◆ Books
            </button>
            <button
              className={`btn btn-sm ${activeFilters.has('tag') ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => toggleFilter('tag')}
            >
              ■ Tags
            </button>
            <button
              className={`btn btn-sm ${activeFilters.has('author') ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => toggleFilter('author')}
            >
              ⬡ Authors
            </button>
          </div>
        </div>

        {/* Right: Zoom & Physics Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'auto', background: 'var(--bg-glass)', padding: 3, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <button
            className="btn-icon btn-sm"
            onClick={() => { transformRef.current.scale = Math.min(3, transformRef.current.scale * 1.2); }}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            className="btn-icon btn-sm"
            onClick={() => { transformRef.current.scale = Math.max(0.2, transformRef.current.scale * 0.8); }}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            className="btn-icon btn-sm"
            onClick={() => { transformRef.current = { x: 0, y: 0, scale: 1 }; }}
            title="Reset View"
          >
            <Maximize2 size={14} />
          </button>
          <button
            className={`btn-icon btn-sm ${showControls ? 'active' : ''}`}
            onClick={() => setShowControls(!showControls)}
            title="Physics Settings"
          >
            <Sliders size={14} />
          </button>
        </div>
      </div>

      {/* Physics Sliders Drawer */}
      {showControls && (
        <div
          className="card card-elevated"
          style={{
            position: 'absolute',
            top: 56,
            right: 14,
            width: 240,
            zIndex: 30,
            padding: 'var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ fontFamily: 'var(--font-tech)', fontSize: 'var(--text-2xs)', fontWeight: 600, letterSpacing: '0.05em' }}>
            GRAPH PHYSICS DYNAMICS
          </div>
          <div className="form-group">
            <span className="form-label">Repulsion Charge ({chargeStrength})</span>
            <input
              type="range"
              min="50"
              max="300"
              value={chargeStrength}
              onChange={e => setChargeStrength(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <span className="form-label">Link Distance ({linkDistance})</span>
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

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div
          className="card card-elevated scifi-box"
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            width: 320,
            zIndex: 30,
            padding: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="badge" style={{ textTransform: 'uppercase' }}>
              {selectedNode.type}
            </span>
            <button className="btn-icon btn-sm" onClick={() => setSelectedNode(null)}>✕</button>
          </div>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', fontWeight: 700, margin: '6px 0', color: 'var(--text-primary)' }}>
            {selectedNode.label}
          </h4>

          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {selectedNode.type === 'book' && onOpenDocument && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const docId = selectedNode.id.replace('doc_', '');
                  onOpenDocument(docId);
                }}
              >
                <BookOpen size={13} />
                <span>Open Book</span>
              </button>
            )}

            {selectedNode.type === 'note' && onOpenNote && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const noteId = selectedNode.id.replace('note_', '');
                  onOpenNote(noteId);
                }}
              >
                <FileText size={13} />
                <span>Open Note</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: draggedNodeRef.current ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
};
