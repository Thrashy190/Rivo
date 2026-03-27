import type { CanvasNode, CanvasEdge } from "../useCanvas";
import { SERVICE_NODE_WIDTH, SERVICE_NODE_HEIGHT } from "../nodes/ServiceNode";

// Port positions for service nodes
function getNodePorts(node: CanvasNode) {
  if (node.variant === "container") {
    const w = node.size?.width ?? 300;
    const h = node.size?.height ?? 200;
    return {
      left:   { x: node.position.x,         y: node.position.y + h / 2 },
      right:  { x: node.position.x + w,      y: node.position.y + h / 2 },
      top:    { x: node.position.x + w / 2,  y: node.position.y },
      bottom: { x: node.position.x + w / 2,  y: node.position.y + h },
    };
  }
  return {
    left:   { x: node.position.x,                          y: node.position.y + SERVICE_NODE_HEIGHT / 2 },
    right:  { x: node.position.x + SERVICE_NODE_WIDTH,     y: node.position.y + SERVICE_NODE_HEIGHT / 2 },
    top:    { x: node.position.x + SERVICE_NODE_WIDTH / 2, y: node.position.y },
    bottom: { x: node.position.x + SERVICE_NODE_WIDTH / 2, y: node.position.y + SERVICE_NODE_HEIGHT },
  };
}

// Choose source/target port sides based on relative positions
function choosePorts(source: CanvasNode, target: CanvasNode) {
  const sc = {
    x: source.position.x + (source.variant === "container" ? (source.size?.width ?? 300) / 2 : SERVICE_NODE_WIDTH / 2),
    y: source.position.y + (source.variant === "container" ? (source.size?.height ?? 200) / 2 : SERVICE_NODE_HEIGHT / 2),
  };
  const tc = {
    x: target.position.x + (target.variant === "container" ? (target.size?.width ?? 300) / 2 : SERVICE_NODE_WIDTH / 2),
    y: target.position.y + (target.variant === "container" ? (target.size?.height ?? 200) / 2 : SERVICE_NODE_HEIGHT / 2),
  };

  const sp = getNodePorts(source);
  const tp = getNodePorts(target);

  if (tc.x > sc.x) {
    return { src: sp.right, tgt: tp.left };
  }
  return { src: sp.left, tgt: tp.right };
}

function bezierPath(sx: number, sy: number, tx: number, ty: number) {
  const dx = Math.abs(tx - sx) * 0.55;
  const cx1 = sx + (tx > sx ? dx : -dx);
  const cx2 = tx + (tx > sx ? -dx : dx);
  return `M ${sx} ${sy} C ${cx1} ${sy}, ${cx2} ${ty}, ${tx} ${ty}`;
}

interface EdgeLayerProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  // In-progress edge connection
  connecting: { fromPos: { x: number; y: number }; toPos: { x: number; y: number } } | null;
  onEdgeClick: (edgeId: string) => void;
}

export function EdgeLayer({ nodes, edges, connecting, onEdgeClick }: EdgeLayerProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 2, width: "100%", height: "100%" }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0 0 L0 6 L8 3 z" fill="#6366f1" fillOpacity="0.8" />
        </marker>
        <marker
          id="arrowhead-dim"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0 0 L0 6 L8 3 z" fill="#6366f1" fillOpacity="0.4" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const source = nodeMap.get(edge.sourceId);
        const target = nodeMap.get(edge.targetId);
        if (!source || !target) return null;

        const { src, tgt } = choosePorts(source, target);
        const d = bezierPath(src.x, src.y, tgt.x, tgt.y);

        return (
          <g key={edge.id} className="pointer-events-auto" onClick={() => onEdgeClick(edge.id)}>
            {/* Wider invisible hit area */}
            <path
              d={d}
              stroke="transparent"
              strokeWidth="12"
              fill="none"
              className="cursor-pointer"
            />
            <path
              d={d}
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeOpacity="0.6"
              fill="none"
              markerEnd="url(#arrowhead)"
              className="transition-all hover:stroke-opacity-100"
            />
          </g>
        );
      })}

      {/* In-progress connection line */}
      {connecting && (
        <path
          d={bezierPath(
            connecting.fromPos.x,
            connecting.fromPos.y,
            connecting.toPos.x,
            connecting.toPos.y
          )}
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeOpacity="0.5"
          strokeDasharray="6 4"
          fill="none"
          markerEnd="url(#arrowhead-dim)"
        />
      )}
    </svg>
  );
}
