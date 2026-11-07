import { useEffect, useRef, type RefObject } from "react";
import type { CanvasNode, CanvasEdge } from "../useCanvas";
import { connectionColor, connectionLabel, resolveConnection } from "../connections";
import { SERVICE_NODE_WIDTH, SERVICE_NODE_HEIGHT } from "../nodes/ServiceNode";

// ─── Port position helpers ────────────────────────────────────────────────────

type Pos = { x: number; y: number };

function getNodePorts(nodeId: string, nodes: CanvasNode[], livePos: Map<string, Pos>) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const pos = livePos.get(nodeId) ?? node.position;

  if (node.variant === "container") {
    const w = node.size?.width ?? 300;
    const h = node.size?.height ?? 200;
    return {
      left:   { x: pos.x,         y: pos.y + h / 2 },
      right:  { x: pos.x + w,     y: pos.y + h / 2 },
      center: { x: pos.x + w / 2, y: pos.y + h / 2 },
    };
  }
  return {
    left:   { x: pos.x,                          y: pos.y + SERVICE_NODE_HEIGHT / 2 },
    right:  { x: pos.x + SERVICE_NODE_WIDTH,      y: pos.y + SERVICE_NODE_HEIGHT / 2 },
    center: { x: pos.x + SERVICE_NODE_WIDTH / 2,  y: pos.y + SERVICE_NODE_HEIGHT / 2 },
  };
}

function choosePorts(sourceId: string, targetId: string, nodes: CanvasNode[], livePos: Map<string, Pos>) {
  const sp = getNodePorts(sourceId, nodes, livePos);
  const tp = getNodePorts(targetId, nodes, livePos);
  if (!sp || !tp) return null;
  return tp.center.x >= sp.center.x
    ? { src: sp.right, tgt: tp.left }
    : { src: sp.left, tgt: tp.right };
}

function bezierPath(sx: number, sy: number, tx: number, ty: number) {
  const dx = Math.abs(tx - sx) * 0.55;
  const cx1 = sx + (tx >= sx ? dx : -dx);
  const cx2 = tx + (tx >= sx ? -dx : dx);
  return `M ${sx} ${sy} C ${cx1} ${sy}, ${cx2} ${ty}, ${tx} ${ty}`;
}

function straightPath(sx: number, sy: number, tx: number, ty: number) {
  return `M ${sx} ${sy} L ${tx} ${ty}`;
}

function orthogonalPath(sx: number, sy: number, tx: number, ty: number) {
  const mx = (sx + tx) / 2;
  return `M ${sx} ${sy} H ${mx} V ${ty} H ${tx}`;
}

function bezierMidpoint(sx: number, sy: number, tx: number, ty: number): Pos {
  const dx = Math.abs(tx - sx) * 0.55;
  const cx1 = sx + (tx >= sx ? dx : -dx);
  const cx2 = tx + (tx >= sx ? -dx : dx);
  // Cubic bezier at t=0.5: 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
  return {
    x: 0.125 * sx + 0.375 * cx1 + 0.375 * cx2 + 0.125 * tx,
    y: (sy + ty) / 2,
  };
}

function getMidpoint(
  sx: number, sy: number, tx: number, ty: number,
  style: "curved" | "straight" | "orthogonal"
): Pos {
  if (style === "straight") return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
  if (style === "orthogonal") return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
  return bezierMidpoint(sx, sy, tx, ty);
}

function markerId(color: string) {
  return `arrow-${color.replace("#", "")}`;
}

// ─── EdgeLayer ────────────────────────────────────────────────────────────────

interface EdgeLayerProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  livePositionsRef: RefObject<Map<string, Pos>>;
  connecting: { fromPos: Pos; toPos: Pos } | null;
  edgeStyle: "curved" | "straight" | "orthogonal";
  selectedEdgeId: string | null;
  animated: boolean;
  readOnly?: boolean;
  onEdgeSelect: (edgeId: string | null) => void;
  onEdgeRemove: (edgeId: string) => void;
}

export function EdgeLayer({
  nodes,
  edges,
  livePositionsRef,
  connecting,
  edgeStyle,
  selectedEdgeId,
  animated,
  readOnly = false,
  onEdgeSelect,
  onEdgeRemove,
}: EdgeLayerProps) {
  const buildPath = edgeStyle === "straight" ? straightPath
    : edgeStyle === "orthogonal" ? orthogonalPath
    : bezierPath;

  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<
    Map<string, {
      base: SVGPathElement;
      flow: SVGPathElement;
      hit: SVGPathElement;
      deleteBtn: SVGGElement | null;
      labelG: SVGGElement | null;
    }>
  >(new Map());
  const connectingPathRef = useRef<SVGPathElement | null>(null);

  // ── RAF loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let rafId: number;

    const tick = () => {
      const lp = livePositionsRef.current;
      if (!lp) { rafId = requestAnimationFrame(tick); return; }

      edges.forEach((edge) => {
        const refs = pathRefs.current.get(edge.id);
        if (!refs) return;
        const ports = choosePorts(edge.sourceId, edge.targetId, nodes, lp);
        if (!ports) return;
        const { src, tgt } = ports;
        const d = buildPath(src.x, src.y, tgt.x, tgt.y);
        refs.base.setAttribute("d", d);
        refs.flow.setAttribute("d", d);
        refs.hit.setAttribute("d", d);

        // Update delete button + route label position
        const mid = getMidpoint(src.x, src.y, tgt.x, tgt.y, edgeStyle);
        refs.deleteBtn?.setAttribute("transform", `translate(${mid.x}, ${mid.y})`);
        if (refs.labelG) {
          refs.labelG.setAttribute("transform", `translate(${mid.x}, ${mid.y})`);
        }
      });

      if (connecting && connectingPathRef.current) {
        const d = buildPath(
          connecting.fromPos.x, connecting.fromPos.y,
          connecting.toPos.x, connecting.toPos.y
        );
        connectingPathRef.current.setAttribute("d", d);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [edges, nodes, connecting, livePositionsRef, buildPath, selectedEdgeId, edgeStyle]);

  // ── Initial d computation ─────────────────────────────────────────────────
  const computeD = (edge: CanvasEdge) => {
    const lp = livePositionsRef.current ?? new Map();
    const ports = choosePorts(edge.sourceId, edge.targetId, nodes, lp);
    if (!ports) return "";
    return buildPath(ports.src.x, ports.src.y, ports.tgt.x, ports.tgt.y);
  };

  const computeMid = (edge: CanvasEdge): Pos => {
    const lp = livePositionsRef.current ?? new Map();
    const ports = choosePorts(edge.sourceId, edge.targetId, nodes, lp);
    if (!ports) return { x: 0, y: 0 };
    return getMidpoint(ports.src.x, ports.src.y, ports.tgt.x, ports.tgt.y, edgeStyle);
  };

  const colors = [...new Set(edges.flatMap((e) => {
    const c = resolveConnection(e, nodes);
    return c ? [connectionColor(c)] : [];
  }))];

  const connectingD = connecting
    ? buildPath(connecting.fromPos.x, connecting.fromPos.y, connecting.toPos.x, connecting.toPos.y)
    : "";

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 2, width: "100%", height: "100%" }}
    >
      <defs>
        {colors.map((color) => (
          <marker key={color} id={markerId(color)} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0 0.5 L7 4 L0 7.5 z" fill={color} />
          </marker>
        ))}
        <marker id="arrow-dim" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0.5 L7 4 L0 7.5 z" fill="#6366f1" fillOpacity="0.6" />
        </marker>

        <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        <style>{`
          @keyframes edge-dash-flow {
            from { stroke-dashoffset: 32; }
            to   { stroke-dashoffset: 0; }
          }
        `}</style>
      </defs>

      {/* Live drag positions are read from a ref on purpose: the animation loop above updates paths without re-rendering. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {edges.map((edge) => {
        const d = computeD(edge);
        const conn = resolveConnection(edge, nodes);
        if (!d || !conn) return null;
        const isSelected = selectedEdgeId === edge.id;
        const mid = computeMid(edge);
        const color = connectionColor(conn);
        const label = connectionLabel(conn);
        const dashed = conn.kind === "unsupported";
        const labelWidth = label.length * 6.2 + 16;

        return (
          <g key={edge.id} className="pointer-events-auto">
            {/* 1. Base line */}
            <path
              ref={(el) => {
                if (!el) { pathRefs.current.delete(edge.id); return; }
                const existing = pathRefs.current.get(edge.id);
                if (existing) existing.base = el;
                else pathRefs.current.set(edge.id, { base: el, flow: el, hit: el, deleteBtn: null, labelG: null });
              }}
              d={d}
              stroke={color}
              strokeWidth={isSelected ? 2.25 : 1.5}
              strokeOpacity={isSelected ? 1 : dashed ? 0.5 : 0.75}
              strokeDasharray={dashed ? "4 5" : undefined}
              fill="none"
              markerEnd={`url(#${markerId(color)})`}
            />

            {/* 2. Animated flow, when animations are on */}
            <path
              ref={(el) => {
                if (!el) return;
                const existing = pathRefs.current.get(edge.id);
                if (existing) existing.flow = el;
              }}
              d={d}
              stroke={color}
              strokeWidth={isSelected ? 2.25 : 1.5}
              fill="none"
              strokeDasharray="2 14"
              strokeLinecap="round"
              style={{
                display: animated && !dashed ? "" : "none",
                animation: "edge-dash-flow 0.9s linear infinite",
                filter: "url(#edge-glow)",
              }}
            />

            {/* 3. Wide invisible hit area */}
            <path
              ref={(el) => {
                if (!el) return;
                const existing = pathRefs.current.get(edge.id);
                if (existing) existing.hit = el;
              }}
              d={d}
              stroke="transparent"
              strokeWidth="16"
              fill="none"
              className="cursor-pointer"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEdgeSelect(isSelected ? null : edge.id);
              }}
            />

            {/* 4. What the connection does */}
            {label && (
              <g
                ref={(el) => {
                  const existing = pathRefs.current.get(edge.id);
                  if (existing) existing.labelG = el;
                }}
                transform={`translate(${mid.x}, ${mid.y})`}
                style={{ pointerEvents: "none" }}
              >
                <rect
                  x={-labelWidth / 2}
                  y="-10"
                  width={labelWidth}
                  height="20"
                  rx="10"
                  fill="var(--theme-popover)"
                  stroke={color}
                  strokeOpacity={isSelected ? 1 : 0.55}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                  fill={color}
                  style={{ userSelect: "none" }}
                >
                  {label}
                </text>
              </g>
            )}

            {/* 5. Delete button beside the label, when selected */}
            <g
              ref={(el) => {
                const existing = pathRefs.current.get(edge.id);
                if (existing) existing.deleteBtn = el;
              }}
              transform={`translate(${mid.x}, ${mid.y})`}
              style={{ display: isSelected && !readOnly ? "" : "none", cursor: "pointer" }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEdgeRemove(edge.id);
              }}
            >
              <g transform={`translate(${label ? labelWidth / 2 + 14 : 0}, 0)`}>
                <circle r="9" fill="var(--theme-popover)" stroke="#ef4444" strokeWidth="1.5" />
                <path d="M-3 -3 L3 3 M3 -3 L-3 3" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" />
                <title>Remove connection</title>
              </g>
            </g>
          </g>
        );
      })}

      {/* In-progress connecting line */}
      {connecting && (
        <path
          ref={(el) => { connectingPathRef.current = el; }}
          d={connectingD}
          stroke="#6366f1"
          strokeWidth="1.75"
          strokeOpacity="0.7"
          strokeDasharray="6 5"
          fill="none"
          markerEnd="url(#arrow-dim)"
        />
      )}
    </svg>
  );
}
