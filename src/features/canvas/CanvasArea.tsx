import { useRef, useState } from "react";
import { ServiceNode, SERVICE_NODE_WIDTH, SERVICE_NODE_HEIGHT } from "./nodes/ServiceNode";
import { ContainerNode } from "./nodes/ContainerNode";
import { EdgeLayer } from "./edges/EdgeLayer";
import type { CanvasNode as CanvasNodeType, CanvasEdge, Viewport } from "./useCanvas";

interface CanvasAreaProps {
  nodes: CanvasNodeType[];
  edges: CanvasEdge[];
  viewport: Viewport;
  selectedNodeId?: string | null;
  onAddNode: (serviceId: string, position: { x: number; y: number }) => void;
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
  onResizeNode: (nodeId: string, size: { width: number; height: number }) => void;
  onRemoveNode: (nodeId: string) => void;
  onRemoveEdge: (edgeId: string) => void;
  onAddEdge: (sourceId: string, targetId: string) => void;
  onAttachNode: (nodeId: string, parentId: string | null) => void;
  onViewportChange: (vp: Viewport | ((prev: Viewport) => Viewport)) => void;
  onNodeClick?: (nodeId: string) => void;
  onContainerClick?: (nodeId: string) => void;
}

interface ConnectingState {
  fromId: string;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
}

export function CanvasArea({
  nodes,
  edges,
  viewport,
  selectedNodeId,
  onAddNode,
  onMoveNode,
  onResizeNode,
  onRemoveNode,
  onRemoveEdge,
  onAddEdge,
  onAttachNode,
  onViewportChange,
  onNodeClick,
  onContainerClick,
}: CanvasAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ mx: 0, my: 0, vx: 0, vy: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [connecting, setConnecting] = useState<ConnectingState | null>(null);
  const [highlightedContainerId, setHighlightedContainerId] = useState<string | null>(null);

  // ── Panning ──────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-canvas-node]")) return;
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
      const rect = containerRef.current!.getBoundingClientRect();
      const toX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const toY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
      setConnecting((prev) => prev ? { ...prev, toPos: { x: toX, y: toY } } : null);
      return;
    }
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.mx;
    const dy = e.clientY - panStart.current.my;
    onViewportChange((prev) => ({
      ...prev,
      x: panStart.current.vx + dx,
      y: panStart.current.vy + dy,
    }));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isPanning.current = false;
    (e.currentTarget as HTMLDivElement).style.cursor = "";
  };

  // ── Zoom ─────────────────────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    onViewportChange((prev) => {
      const newZoom = Math.min(Math.max(prev.zoom * delta, 0.2), 3);
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      return {
        zoom: newZoom,
        x: mx - (mx - prev.x) * (newZoom / prev.zoom),
        y: my - (my - prev.y) * (newZoom / prev.zoom),
      };
    });
  };

  // ── Drop from sidebar ────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const serviceId = e.dataTransfer.getData("application/rivo-service");
    if (!serviceId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;
    onAddNode(serviceId, { x, y });
  };

  // ── Container attachment detection ───────────────────────────────────────
  const findContainerAt = (pos: { x: number; y: number }) => {
    const centerX = pos.x + SERVICE_NODE_WIDTH / 2;
    const centerY = pos.y + SERVICE_NODE_HEIGHT / 2;
    return nodes.find((n) => {
      if (n.variant !== "container") return false;
      const w = n.size?.width ?? 300;
      const h = n.size?.height ?? 200;
      return (
        centerX >= n.position.x &&
        centerX <= n.position.x + w &&
        centerY >= n.position.y &&
        centerY <= n.position.y + h
      );
    }) ?? null;
  };

  const handleNodeDragEnd = (nodeId: string, position: { x: number; y: number }) => {
    const container = findContainerAt(position);
    onAttachNode(nodeId, container ? container.id : null);
    setHighlightedContainerId(null);
  };

  const handleNodeMove = (nodeId: string, position: { x: number; y: number }) => {
    onMoveNode(nodeId, position);
    // Highlight the container the node is hovering over during drag
    const node = nodes.find((n) => n.id === nodeId);
    if (node?.variant !== "container") {
      const container = findContainerAt(position);
      setHighlightedContainerId(container?.id ?? null);
    }
  };

  // ── Edge connection ───────────────────────────────────────────────────────
  const handlePortMouseDown = (
    nodeId: string,
    _side: "left" | "right",
    portPos: { x: number; y: number }
  ) => {
    setConnecting({ fromId: nodeId, fromPos: portPos, toPos: portPos });
  };

  const handleNodeClickWithConnect = (nodeId: string) => {
    if (connecting) {
      if (connecting.fromId !== nodeId) {
        onAddEdge(connecting.fromId, nodeId);
      }
      setConnecting(null);
      return;
    }
    onNodeClick?.(nodeId);
  };

  // Escape to cancel connecting
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setConnecting(null);
  };

  const containerNodes = nodes.filter((n) => n.variant === "container");
  const serviceNodes = nodes.filter((n) => n.variant !== "container");

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={[
        "flex-1 relative overflow-hidden bg-page transition-colors outline-none",
        isDragOver ? "bg-card/30" : "",
        connecting ? "cursor-crosshair" : "",
      ].join(" ")}
      style={{
        backgroundImage: "radial-gradient(circle, var(--theme-edge) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
    >
      {/* Viewport transform container */}
      <div
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {/* Layer 1: Container nodes (Region, VPC, Subnet) */}
        {containerNodes.map((node) => (
          <ContainerNode
            key={node.id}
            node={node}
            viewport={viewport}
            highlighted={highlightedContainerId === node.id}
            onMove={onMoveNode}
            onResize={onResizeNode}
            onRemove={onRemoveNode}
            onContainerClick={onContainerClick}
          />
        ))}

        {/* Layer 2: Edges */}
        <EdgeLayer
          nodes={nodes}
          edges={edges}
          connecting={
            connecting
              ? { fromPos: connecting.fromPos, toPos: connecting.toPos }
              : null
          }
          onEdgeClick={onRemoveEdge}
        />

        {/* Layer 3: Service nodes */}
        {serviceNodes.map((node) => {
          const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) : null;
          return (
            <ServiceNode
              key={node.id}
              node={node}
              viewport={viewport}
              selected={selectedNodeId === node.id}
              parentLabel={parent ? String(parent.config.name ?? parent.label) : undefined}
              onMove={handleNodeMove}
              onDragEnd={handleNodeDragEnd}
              onRemove={onRemoveNode}
              onNodeClick={handleNodeClickWithConnect}
              onPortMouseDown={handlePortMouseDown}
            />
          );
        })}
      </div>

      {/* Drop hint */}
      {isDragOver && (
        <div className="absolute inset-0 border-2 border-dashed border-edge/50 rounded pointer-events-none flex items-center justify-center">
          <p className="text-sm text-ink-dim">Drop to place service</p>
        </div>
      )}

      {/* Connecting hint */}
      {connecting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-600/90 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm">
          Click a node to connect — Esc to cancel
        </div>
      )}

      {/* Empty state */}
      {nodes.length === 0 && !isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <div className="text-center">
            <p className="text-sm text-ink-dim mb-1">Canvas vacío</p>
            <p className="text-xs text-ink-dim/60">
              Arrastra servicios desde el panel izquierdo
            </p>
          </div>
        </div>
      )}

      {/* Corner info */}
      <div className="absolute bottom-4 right-4 flex items-center gap-3 text-[10px] text-ink-dim/60 font-mono select-none pointer-events-none">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} edges</span>
        <span>{Math.round(viewport.zoom * 100)}%</span>
      </div>
    </div>
  );
}
