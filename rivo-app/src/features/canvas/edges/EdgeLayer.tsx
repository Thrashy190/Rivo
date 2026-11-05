import { useEffect, useRef, type RefObject } from "react";
import type { CanvasNode, CanvasEdge } from "../useCanvas";
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

// ─── EdgeLayer ────────────────────────────────────────────────────────────────

interface EdgeLayerProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  livePositionsRef: RefObject<Map<string, Pos>>;
  connecting: { fromPos: Pos; toPos: Pos } | null;
  onEdgeClick: (edgeId: string) => void;
}

export function EdgeLayer({
  nodes,
  edges,
  livePositionsRef,
  connecting,
  onEdgeClick,
}: EdgeLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  // path refs: edgeId → { base, flow, hit, particle }
  const pathRefs = useRef<
    Map<string, { base: SVGPathElement; flow: SVGPathElement; hit: SVGPathElement }>
  >(new Map());
  const connectingPathRef = useRef<SVGPathElement | null>(null);

  // ── RAF loop: update path `d` attributes directly from livePositionsRef ──
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
        const d = bezierPath(ports.src.x, ports.src.y, ports.tgt.x, ports.tgt.y);
        refs.base.setAttribute("d", d);
        refs.flow.setAttribute("d", d);
        refs.hit.setAttribute("d", d);
        // mpath href is static — it references the base path id by id, no update needed
      });

      // Update connecting line
      if (connecting && connectingPathRef.current) {
        const d = bezierPath(
          connecting.fromPos.x, connecting.fromPos.y,
          connecting.toPos.x, connecting.toPos.y
        );
        connectingPathRef.current.setAttribute("d", d);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [edges, nodes, connecting, livePositionsRef]);

  // ── Initial d computation (server-side / first render) ────────────────────
  const computeD = (edge: CanvasEdge) => {
    const lp = livePositionsRef.current ?? new Map();
    const ports = choosePorts(edge.sourceId, edge.targetId, nodes, lp);
    if (!ports) return "";
    return bezierPath(ports.src.x, ports.src.y, ports.tgt.x, ports.tgt.y);
  };

  const connectingD = connecting
    ? bezierPath(connecting.fromPos.x, connecting.fromPos.y, connecting.toPos.x, connecting.toPos.y)
    : "";

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 2, width: "100%", height: "100%" }}
    >
      <defs>
        <marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
          <path d="M0 0 L0 6 L7 3 z" fill="#6366f1" fillOpacity="0.9" />
        </marker>
        <marker id="arrow-dim" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
          <path d="M0 0 L0 6 L7 3 z" fill="#6366f1" fillOpacity="0.35" />
        </marker>

        {/* Glow filter for the flow line */}
        <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        <style>{`
          @keyframes edge-dash-flow {
            from { stroke-dashoffset: 24; }
            to   { stroke-dashoffset: 0; }
          }
        `}</style>
      </defs>

      {/* Existing edges */}
      {edges.map((edge) => {
        const d = computeD(edge);
        if (!d) return null;

        return (
          <g key={edge.id} className="pointer-events-auto">
            {/* 1. Base line (structure, arrow) */}
            <path
              ref={(el) => {
                if (!el) { pathRefs.current.delete(edge.id); return; }
                const existing = pathRefs.current.get(edge.id);
                if (existing) existing.base = el;
                else pathRefs.current.set(edge.id, { base: el, flow: el, hit: el });
              }}
              d={d}
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeOpacity="0.35"
              fill="none"
              markerEnd="url(#arrow)"
            />

            {/* 2. Animated flow dashes on top */}
            <path
              ref={(el) => {
                if (!el) return;
                const existing = pathRefs.current.get(edge.id);
                if (existing) existing.flow = el;
              }}
              d={d}
              stroke="#818cf8"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="6 8"
              strokeLinecap="round"
              style={{
                animation: "edge-dash-flow 0.7s linear infinite",
                filter: "url(#edge-glow)",
              }}
            />

            {/* 3. Wide invisible hit area for click */}
            <path
              ref={(el) => {
                if (!el) return;
                const existing = pathRefs.current.get(edge.id);
                if (existing) existing.hit = el;
              }}
              d={d}
              stroke="transparent"
              strokeWidth="14"
              fill="none"
              className="cursor-pointer"
              onClick={() => onEdgeClick(edge.id)}
            />
          </g>
        );
      })}

      {/* In-progress connecting line */}
      {connecting && (
        <path
          ref={(el) => { connectingPathRef.current = el; }}
          d={connectingD}
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeOpacity="0.45"
          strokeDasharray="6 5"
          fill="none"
          markerEnd="url(#arrow-dim)"
        />
      )}
    </svg>
  );
}
