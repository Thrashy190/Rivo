import { useEffect, useRef } from "react";
import { AWS_SERVICE_CATEGORIES } from "../aws-services";
import type { CanvasNode, Viewport } from "../useCanvas";

export const SERVICE_NODE_WIDTH = 144;
export const SERVICE_NODE_HEIGHT = 76;

function getServiceIcon(type: string) {
  for (const cat of AWS_SERVICE_CATEGORIES) {
    const svc = cat.services.find((s) => s.id === type);
    if (svc) return svc.icon;
  }
  return null;
}

interface ServiceNodeProps {
  node: CanvasNode;
  viewport: Viewport;
  selected?: boolean;
  parentLabel?: string;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onDragEnd?: (id: string, position: { x: number; y: number }) => void;
  onRemove: (id: string) => void;
  onNodeClick?: (id: string) => void;
  onPortMouseDown?: (
    nodeId: string,
    side: "left" | "right",
    portPos: { x: number; y: number }
  ) => void;
}

export function ServiceNode({
  node,
  viewport,
  selected = false,
  parentLabel,
  onMove,
  onDragEnd,
  onRemove,
  onNodeClick,
  onPortMouseDown,
}: ServiceNodeProps) {
  const dragState = useRef<{
    startMouse: { x: number; y: number };
    startPos: { x: number; y: number };
    hasMoved: boolean;
    lastPos: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const dx = (e.clientX - dragState.current.startMouse.x) / viewport.zoom;
      const dy = (e.clientY - dragState.current.startMouse.y) / viewport.zoom;
      if (!dragState.current.hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        dragState.current.hasMoved = true;
      }
      const newPos = {
        x: dragState.current.startPos.x + dx,
        y: dragState.current.startPos.y + dy,
      };
      dragState.current.lastPos = newPos;
      onMove(node.id, newPos);
    };

    const onMouseUp = () => {
      if (dragState.current) {
        if (!dragState.current.hasMoved) {
          onNodeClick?.(node.id);
        } else {
          onDragEnd?.(node.id, dragState.current.lastPos);
        }
      }
      dragState.current = null;
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [node.id, viewport.zoom, onMove, onNodeClick, onDragEnd]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    dragState.current = {
      startMouse: { x: e.clientX, y: e.clientY },
      startPos: { ...node.position },
      hasMoved: false,
      lastPos: { ...node.position },
    };
    document.body.style.cursor = "grabbing";
  };

  const handlePortMouseDown = (e: React.MouseEvent, side: "left" | "right") => {
    e.stopPropagation();
    e.preventDefault();
    const portX = side === "left"
      ? node.position.x
      : node.position.x + SERVICE_NODE_WIDTH;
    const portY = node.position.y + SERVICE_NODE_HEIGHT / 2;
    onPortMouseDown?.(node.id, side, { x: portX, y: portY });
  };

  const icon = getServiceIcon(node.type);

  return (
    <div
      data-canvas-node
      onMouseDown={handleMouseDown}
      className="absolute select-none group"
      style={{
        left: node.position.x,
        top: node.position.y,
        width: SERVICE_NODE_WIDTH,
        zIndex: 3,
      }}
    >
      <div
        className={[
          "relative bg-card border rounded-xl p-3 w-36 cursor-grab active:cursor-grabbing transition-colors shadow-lg shadow-black/20",
          selected
            ? "border-indigo-500 shadow-indigo-500/20"
            : "border-edge hover:border-raised",
        ].join(" ")}
      >
        {/* Remove button */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(node.id)}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-raised border border-edge text-ink-dim hover:text-ink transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs leading-none z-10"
        >
          ×
        </button>

        {/* Icon */}
        <div className="w-10 h-10 rounded-lg overflow-hidden mb-2.5">{icon}</div>

        {/* Name (title) */}
        <p className="text-xs font-semibold text-ink leading-snug truncate">
          {String(node.config.name ?? node.id)}
        </p>

        {/* Runtime or service type (subtitle) */}
        <p className="text-[10px] text-ink-dim truncate font-mono mt-0.5">
          {node.config.runtime
            ? String(node.config.runtime)
            : node.label}
        </p>
      </div>

      {/* Parent container badge */}
      {parentLabel && (
        <div className="absolute -bottom-5 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[9px] font-mono text-green-400/80 bg-green-900/30 border border-green-600/30 px-1.5 py-0.5 rounded-full truncate max-w-full">
            ↳ {parentLabel}
          </span>
        </div>
      )}

      {/* Port dot — left */}
      <div
        onMouseDown={(e) => handlePortMouseDown(e, "left")}
        className="absolute -left-2 w-4 h-4 rounded-full border-2 border-indigo-500 bg-page opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:scale-125 transition-all cursor-crosshair z-20 flex items-center justify-center"
        style={{ top: SERVICE_NODE_HEIGHT / 2 - 8 }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
      </div>

      {/* Port dot — right */}
      <div
        onMouseDown={(e) => handlePortMouseDown(e, "right")}
        className="absolute -right-2 w-4 h-4 rounded-full border-2 border-indigo-500 bg-page opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:scale-125 transition-all cursor-crosshair z-20 flex items-center justify-center"
        style={{ top: SERVICE_NODE_HEIGHT / 2 - 8 }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
      </div>
    </div>
  );
}
