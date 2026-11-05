import { useEffect, useRef } from "react";
import { AWS_SERVICE_CATEGORIES } from "../aws-services";
import type { CanvasNode, Viewport } from "../useCanvas";

function getServiceIcon(type: string) {
  for (const cat of AWS_SERVICE_CATEGORIES) {
    const svc = cat.services.find((s) => s.id === type);
    if (svc) return svc.icon;
  }
  return null;
}

const CONTAINER_STYLES: Record<
  string,
  { border: string; bg: string; label: string }
> = {
  region: {
    border: "border-dashed border-2 border-zinc-500/60",
    bg: "bg-zinc-800/20",
    label: "text-zinc-400",
  },
  vpc: {
    border: "border-2 border-green-600/60",
    bg: "bg-green-950/20",
    label: "text-green-400",
  },
  subnet: {
    border: "border border-dashed border-green-500/50",
    bg: "bg-green-900/10",
    label: "text-green-500",
  },
};

const HANDLE_SIZE = 10;

type ResizeHandle =
  | "se" | "sw" | "ne" | "nw"
  | "n" | "s" | "e" | "w";

interface ContainerNodeProps {
  node: CanvasNode;
  viewport: Viewport;
  highlighted?: boolean;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onResize: (id: string, size: { width: number; height: number }) => void;
  onRemove: (id: string) => void;
  onContainerClick?: (id: string) => void;
}

export function ContainerNode({
  node,
  viewport,
  highlighted = false,
  onMove,
  onResize,
  onRemove,
  onContainerClick,
}: ContainerNodeProps) {
  const width = node.size?.width ?? 300;
  const height = node.size?.height ?? 200;

  const moveDrag = useRef<{
    startMouse: { x: number; y: number };
    startPos: { x: number; y: number };
    hasMoved: boolean;
  } | null>(null);

  const resizeDrag = useRef<{
    handle: ResizeHandle;
    startMouse: { x: number; y: number };
    startPos: { x: number; y: number };
    startSize: { width: number; height: number };
  } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (moveDrag.current) {
        const dx = (e.clientX - moveDrag.current.startMouse.x) / viewport.zoom;
        const dy = (e.clientY - moveDrag.current.startMouse.y) / viewport.zoom;
        if (!moveDrag.current.hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
          moveDrag.current.hasMoved = true;
        }
        if (moveDrag.current.hasMoved) {
          onMove(node.id, {
            x: moveDrag.current.startPos.x + dx,
            y: moveDrag.current.startPos.y + dy,
          });
        }
        return;
      }

      if (resizeDrag.current) {
        const dx = (e.clientX - resizeDrag.current.startMouse.x) / viewport.zoom;
        const dy = (e.clientY - resizeDrag.current.startMouse.y) / viewport.zoom;
        const { handle, startPos, startSize } = resizeDrag.current;

        let newW = startSize.width;
        let newH = startSize.height;
        let newX = startPos.x;
        let newY = startPos.y;

        if (handle.includes("e")) newW = Math.max(120, startSize.width + dx);
        if (handle.includes("w")) { newW = Math.max(120, startSize.width - dx); newX = startPos.x + startSize.width - newW; }
        if (handle.includes("s")) newH = Math.max(80, startSize.height + dy);
        if (handle.includes("n")) { newH = Math.max(80, startSize.height - dy); newY = startPos.y + startSize.height - newH; }

        onMove(node.id, { x: newX, y: newY });
        onResize(node.id, { width: newW, height: newH });
      }
    };

    const onMouseUp = () => {
      if (moveDrag.current && !moveDrag.current.hasMoved) {
        onContainerClick?.(node.id);
      }
      moveDrag.current = null;
      resizeDrag.current = null;
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [node.id, viewport.zoom, onMove, onResize]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    moveDrag.current = {
      startMouse: { x: e.clientX, y: e.clientY },
      startPos: { ...node.position },
      hasMoved: false,
    };
    document.body.style.cursor = "grabbing";
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    resizeDrag.current = {
      handle,
      startMouse: { x: e.clientX, y: e.clientY },
      startPos: { ...node.position },
      startSize: { width, height },
    };
  };

  const styles = CONTAINER_STYLES[node.type] ?? CONTAINER_STYLES.region;
  const icon = getServiceIcon(node.type);

  const cursors: Record<ResizeHandle, string> = {
    se: "cursor-se-resize", sw: "cursor-sw-resize",
    ne: "cursor-ne-resize", nw: "cursor-nw-resize",
    n: "cursor-n-resize",  s: "cursor-s-resize",
    e: "cursor-e-resize",  w: "cursor-w-resize",
  };

  const handles: { id: ResizeHandle; style: React.CSSProperties }[] = [
    { id: "nw", style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
    { id: "ne", style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
    { id: "sw", style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
    { id: "se", style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
    { id: "n",  style: { top: -HANDLE_SIZE / 2, left: "50%", transform: "translateX(-50%)" } },
    { id: "s",  style: { bottom: -HANDLE_SIZE / 2, left: "50%", transform: "translateX(-50%)" } },
    { id: "e",  style: { right: -HANDLE_SIZE / 2, top: "50%", transform: "translateY(-50%)" } },
    { id: "w",  style: { left: -HANDLE_SIZE / 2, top: "50%", transform: "translateY(-50%)" } },
  ];

  return (
    <div
      data-canvas-node
      className="absolute group/container select-none"
      style={{ left: node.position.x, top: node.position.y, width, height, zIndex: 1 }}
    >
      <div className={`relative w-full h-full rounded-xl transition-shadow ${styles.border} ${styles.bg} ${highlighted ? "ring-2 ring-indigo-500/60" : ""}`}>
        {/* Header bar (drag handle) */}
        <div
          onMouseDown={handleHeaderMouseDown}
          className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing"
        >
          {icon && (
            <div className="w-5 h-5 rounded overflow-hidden shrink-0">{icon}</div>
          )}
          <span className={`text-xs font-semibold ${styles.label} truncate`}>
            {node.label}
          </span>
          <span className="text-[10px] text-ink-dim font-mono ml-1 truncate opacity-60">
            {String(node.config.name ?? node.id)}
          </span>

          {/* Remove button */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(node.id)}
            className="ml-auto w-5 h-5 rounded-full bg-raised/60 border border-edge text-ink-dim hover:text-ink transition-colors opacity-0 group-hover/container:opacity-100 flex items-center justify-center text-xs leading-none"
          >
            ×
          </button>
        </div>

        {/* Resize handles — visible on hover */}
        {handles.map(({ id, style }) => (
          <div
            key={id}
            onMouseDown={(e) => handleResizeMouseDown(e, id)}
            className={`absolute opacity-0 group-hover/container:opacity-100 w-2.5 h-2.5 rounded-sm bg-indigo-500/80 border border-indigo-300/50 z-10 ${cursors[id]}`}
            style={{ width: HANDLE_SIZE, height: HANDLE_SIZE, ...style }}
          />
        ))}
      </div>
    </div>
  );
}
