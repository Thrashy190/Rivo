import { useEffect, useRef, useState, useLayoutEffect, type ReactNode } from "react";
import { ServiceNode, SERVICE_NODE_WIDTH, SERVICE_NODE_HEIGHT } from "./nodes/ServiceNode";
import { ContainerNode } from "./nodes/ContainerNode";
import { EdgeLayer } from "./edges/EdgeLayer";
import { nodeIssues } from "./readiness";
import { nodeSummary } from "./summary";
import type { CanvasNode as CanvasNodeType, CanvasEdge, Viewport } from "./useCanvas";

type EdgeStyle = "curved" | "straight" | "orthogonal";

interface CanvasAreaProps {
  nodes: CanvasNodeType[];
  edges: CanvasEdge[];
  viewport: Viewport;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  readOnly?: boolean;
  animated?: boolean;
  // Shown in the middle of an empty canvas.
  emptyState?: ReactNode;
  onAddNode: (serviceId: string, position: { x: number; y: number }) => void;
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
  onResizeNode: (nodeId: string, size: { width: number; height: number }) => void;
  onRemoveNode: (nodeId: string) => void;
  onRemoveEdge: (edgeId: string) => void;
  onAddEdge: (sourceId: string, targetId: string) => void;
  onAttachNode: (nodeId: string, parentId: string | null) => void;
  onViewportChange: (vp: Viewport | ((prev: Viewport) => Viewport)) => void;
  onNodeClick?: (nodeId: string) => void;
  onEdgeSelect?: (edgeId: string | null) => void;
  onCanvasClick?: () => void;
  onToggleAnimated?: () => void;
}

interface ConnectingState {
  fromId: string;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
  startMouse: { x: number; y: number };
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;

export function CanvasArea({
  nodes,
  edges,
  viewport,
  selectedNodeId,
  selectedEdgeId = null,
  readOnly = false,
  animated = false,
  emptyState,
  onAddNode,
  onMoveNode,
  onResizeNode,
  onRemoveNode,
  onRemoveEdge,
  onAddEdge,
  onAttachNode,
  onViewportChange,
  onNodeClick,
  onEdgeSelect,
  onCanvasClick,
  onToggleAnimated,
}: CanvasAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ mx: 0, my: 0, vx: 0, vy: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [connecting, setConnecting] = useState<ConnectingState | null>(null);
  const [highlightedContainerId, setHighlightedContainerId] = useState<string | null>(null);
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>(() => {
    try {
      const saved = localStorage.getItem("rivo_canvas_edges");
      return saved === "straight" || saved === "orthogonal" ? saved : "curved";
    } catch {
      return "curved";
    }
  });

  const chooseEdgeStyle = (style: EdgeStyle) => {
    setEdgeStyle(style);
    try {
      localStorage.setItem("rivo_canvas_edges", style);
    } catch {
      // Only a preference.
    }
  };

  // Live positions, updated synchronously during a drag so the edges follow
  // without waiting for React to render.
  const livePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  useLayoutEffect(() => {
    nodes.forEach((n) => livePositionsRef.current.set(n.id, n.position));
  }, [nodes]);

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - viewport.x) / viewport.zoom, y: (clientY - rect.top - viewport.y) / viewport.zoom };
  };

  // ── Panning ──────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-canvas-node],[data-canvas-ui]")) return;
    onEdgeSelect?.(null);
    onCanvasClick?.();
    if (connecting) {
      setConnecting(null);
      return;
    }
    isPanning.current = true;
    panStart.current = { mx: e.clientX, my: e.clientY, vx: viewport.x, vy: viewport.y };
    (e.currentTarget as HTMLDivElement).style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (connecting) {
      const toPos = toCanvas(e.clientX, e.clientY);
      setConnecting((prev) => (prev ? { ...prev, toPos } : null));
      return;
    }
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.mx;
    const dy = e.clientY - panStart.current.my;
    onViewportChange((prev) => ({ ...prev, x: panStart.current.vx + dx, y: panStart.current.vy + dy }));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isPanning.current = false;
    (e.currentTarget as HTMLDivElement).style.cursor = "";
    // Released away from any node after dragging a line: cancel it. A plain
    // click on a port keeps it, to finish with a click on the other node.
    if (connecting && !(e.target as HTMLElement).closest("[data-canvas-node]")) {
      const moved = Math.hypot(e.clientX - connecting.startMouse.x, e.clientY - connecting.startMouse.y);
      if (moved > 6) setConnecting(null);
    }
  };

  // ── Zoom ─────────────────────────────────────────────────────────────────
  const zoomAround = (factor: number, mx: number, my: number) => {
    onViewportChange((prev) => {
      const zoom = Math.min(Math.max(prev.zoom * factor, MIN_ZOOM), MAX_ZOOM);
      return { zoom, x: mx - (mx - prev.x) * (zoom / prev.zoom), y: my - (my - prev.y) * (zoom / prev.zoom) };
    });
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    // Pinch on a trackpad arrives as a wheel event with ctrl held.
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) >= 50) {
      zoomAround(e.deltaY > 0 ? 0.9 : 1.1, e.clientX - rect.left, e.clientY - rect.top);
    } else {
      onViewportChange((prev) => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  // React listens to wheel events passively, so the browser would zoom the
  // whole page on a pinch. This listener can stop it.
  const wheelRef = useRef(handleWheel);
  useEffect(() => {
    wheelRef.current = handleWheel;
  });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomFromCenter = (factor: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    zoomAround(factor, rect.width / 2, rect.height / 2);
  };

  const fitView = () => {
    if (!containerRef.current || nodes.length === 0) {
      onViewportChange({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const w = n.variant === "container" ? n.size?.width ?? 300 : SERVICE_NODE_WIDTH;
      const h = n.variant === "container" ? n.size?.height ?? 200 : SERVICE_NODE_HEIGHT;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }
    const pad = 80;
    const zoom = Math.min(Math.max(Math.min(rect.width / (maxX - minX + pad * 2), rect.height / (maxY - minY + pad * 2)), MIN_ZOOM), 1.25);
    onViewportChange({
      zoom,
      x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
    });
  };

  // ── Drop from the library ────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly || !e.dataTransfer.types.includes("application/rivo-service")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const serviceId = e.dataTransfer.getData("application/rivo-service");
    if (!serviceId || !containerRef.current) return;
    const p = toCanvas(e.clientX, e.clientY);
    onAddNode(serviceId, { x: p.x - SERVICE_NODE_WIDTH / 2, y: p.y - SERVICE_NODE_HEIGHT / 2 });
  };

  // ── Containers ───────────────────────────────────────────────────────────
  const findContainerAt = (pos: { x: number; y: number }) => {
    const cx = pos.x + SERVICE_NODE_WIDTH / 2;
    const cy = pos.y + SERVICE_NODE_HEIGHT / 2;
    return (
      nodes.find((n) => {
        if (n.variant !== "container") return false;
        const w = n.size?.width ?? 300;
        const h = n.size?.height ?? 200;
        return cx >= n.position.x && cx <= n.position.x + w && cy >= n.position.y && cy <= n.position.y + h;
      }) ?? null
    );
  };

  const handleNodeDragEnd = (nodeId: string, position: { x: number; y: number }) => {
    const container = findContainerAt(position);
    onAttachNode(nodeId, container ? container.id : null);
    setHighlightedContainerId(null);
  };

  const handleNodeMove = (nodeId: string, position: { x: number; y: number }) => {
    livePositionsRef.current.set(nodeId, position);
    onMoveNode(nodeId, position);
    const node = nodes.find((n) => n.id === nodeId);
    if (node?.variant !== "container") setHighlightedContainerId(findContainerAt(position)?.id ?? null);
  };

  // ── Connections ──────────────────────────────────────────────────────────
  const handlePortMouseDown = (nodeId: string, _side: "left" | "right", portPos: { x: number; y: number }) => {
    window.getSelection()?.removeAllRanges();
    const rect = containerRef.current!.getBoundingClientRect();
    setConnecting({
      fromId: nodeId,
      fromPos: portPos,
      toPos: portPos,
      startMouse: { x: portPos.x * viewport.zoom + viewport.x + rect.left, y: portPos.y * viewport.zoom + viewport.y + rect.top },
    });
  };

  const finishConnection = (nodeId: string) => {
    if (!connecting) return false;
    if (connecting.fromId !== nodeId) onAddEdge(connecting.fromId, nodeId);
    setConnecting(null);
    return true;
  };

  const handleNodeClick = (nodeId: string) => {
    if (finishConnection(nodeId)) return;
    onNodeClick?.(nodeId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setConnecting(null);
  };

  const containerNodes = nodes.filter((n) => n.variant === "container");
  const serviceNodes = nodes.filter((n) => n.variant !== "container");
  const zoomPct = Math.round(viewport.zoom * 100);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label="Diagram canvas"
      className={[
        "flex-1 relative overflow-hidden bg-page outline-none select-none",
        connecting ? "cursor-crosshair" : "",
      ].join(" ")}
      style={{
        backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--theme-ink-dim) 22%, transparent) 1px, transparent 1px)",
        backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={(e) => {
        isPanning.current = false;
        (e.currentTarget as HTMLDivElement).style.cursor = "";
      }}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
      >
        {containerNodes.map((node) => (
          <ContainerNode
            key={node.id}
            node={node}
            viewport={viewport}
            highlighted={highlightedContainerId === node.id}
            onMove={onMoveNode}
            onResize={onResizeNode}
            onRemove={onRemoveNode}
            onContainerClick={onNodeClick}
          />
        ))}

        <EdgeLayer
          nodes={nodes}
          edges={edges}
          livePositionsRef={livePositionsRef}
          connecting={connecting ? { fromPos: connecting.fromPos, toPos: connecting.toPos } : null}
          edgeStyle={edgeStyle}
          selectedEdgeId={selectedEdgeId}
          animated={animated}
          readOnly={readOnly}
          onEdgeSelect={(id) => onEdgeSelect?.(id)}
          onEdgeRemove={onRemoveEdge}
        />

        {serviceNodes.map((node) => {
          const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) : null;
          return (
            <ServiceNode
              key={node.id}
              node={node}
              viewport={viewport}
              selected={selectedNodeId === node.id}
              connectable={!!connecting && connecting.fromId !== node.id}
              summary={nodeSummary(node, nodes, edges)}
              issues={nodeIssues(node, nodes, edges)}
              parentLabel={parent ? String(parent.config.name ?? parent.label) : undefined}
              readOnly={readOnly}
              onMove={handleNodeMove}
              onDragEnd={handleNodeDragEnd}
              onRemove={onRemoveNode}
              onNodeClick={handleNodeClick}
              onConnectDrop={(id) => {
                if (connecting && connecting.fromId !== id) finishConnection(id);
              }}
              onPortMouseDown={handlePortMouseDown}
            />
          );
        })}
      </div>

      {isDragOver && (
        <div className="absolute inset-3 border-2 border-dashed border-indigo-500/40 rounded-2xl pointer-events-none flex items-center justify-center bg-indigo-500/[0.03]">
          <p className="text-sm text-ink-dim">Drop to add it here</p>
        </div>
      )}

      {connecting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-popover border border-edge text-ink text-xs px-3 py-1.5 rounded-full pointer-events-none shadow-lg">
          Release on a service to connect · Esc cancels
        </div>
      )}

      {nodes.length === 0 && !isDragOver && emptyState && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div data-canvas-ui className="pointer-events-auto">{emptyState}</div>
        </div>
      )}

      {/* Toolbar */}
      <div
        data-canvas-ui
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-popover/95 backdrop-blur border border-edge rounded-xl p-1 shadow-lg select-none"
      >
        <ToolButton label="Zoom out" onClick={() => zoomFromCenter(1 / 1.2)}>
          <path d="M3 8h10" />
        </ToolButton>
        <button
          onClick={() => onViewportChange((prev) => ({ ...prev, zoom: 1 }))}
          title="Reset zoom"
          className="h-8 w-12 rounded-lg text-xs font-mono tabular-nums text-ink-dim hover:text-ink hover:bg-raised transition-colors"
        >
          {zoomPct}%
        </button>
        <ToolButton label="Zoom in" onClick={() => zoomFromCenter(1.2)}>
          <path d="M3 8h10M8 3v10" />
        </ToolButton>
        <ToolButton label="Fit to view" onClick={fitView}>
          <path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10" />
        </ToolButton>

        <span className="w-px h-5 bg-edge mx-1" />

        {(
          [
            ["curved", "Curved lines", "M2 12 C6 12, 6 4, 10 4 S14 4, 14 4"],
            ["straight", "Straight lines", "M2 12 L14 4"],
            ["orthogonal", "Right-angle lines", "M2 12 H8 V4 H14"],
          ] as const
        ).map(([style, label, d]) => (
          <ToolButton key={style} label={label} active={edgeStyle === style} onClick={() => chooseEdgeStyle(style)}>
            <path d={d} />
          </ToolButton>
        ))}

        {onToggleAnimated && (
          <ToolButton label={animated ? "Stop flow animation" : "Animate the flow"} active={animated} onClick={onToggleAnimated}>
            <path d="M8 2v3M8 11v3M2 8h3M11 8h3M3.8 3.8l2.1 2.1M10.1 10.1l2.1 2.1M3.8 12.2l2.1-2.1M10.1 5.9l2.1-2.1" />
          </ToolButton>
        )}
      </div>

      <div className="absolute bottom-5 right-4 text-[10px] text-ink-dim/70 font-mono select-none pointer-events-none">
        {nodes.length} services · {edges.length} connections
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={[
        "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
        active ? "bg-indigo-500/15 text-indigo-500" : "text-ink-dim hover:text-ink hover:bg-raised",
      ].join(" ")}
    >
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
