import { useEffect, useRef } from "react";
import { getServiceIcon } from "../aws-services";
import type { CanvasNode, Viewport } from "../useCanvas";

// Groups are drawn with a tinted border and a faint fill of the same colour.
const CONTAINER_STYLES: Record<string, { border: string; defaultBorderColor: string }> = {
  region: { border: "border-dashed border-2", defaultBorderColor: "#7D8998" },
  vpc: { border: "border-2", defaultBorderColor: "#8C4FFF" },
  subnet: { border: "border border-dashed", defaultBorderColor: "#7AA116" },
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
  const borderColor = (node.config.borderColor as string | undefined) || styles.defaultBorderColor;

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
      <div
        className={`relative w-full h-full rounded-2xl transition-shadow ${styles.border} ${highlighted ? "ring-4 ring-indigo-500/25" : ""}`}
        style={{ borderColor: `color-mix(in srgb, ${borderColor} 70%, transparent)`, backgroundColor: `color-mix(in srgb, ${borderColor} 5%, transparent)` }}
      >
        {/* Header bar (drag handle) */}
        <div
          onMouseDown={handleHeaderMouseDown}
          className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing"
        >
          {icon && (
            <div className="w-5 h-5 rounded overflow-hidden shrink-0">{icon}</div>
          )}
          <span className="text-xs font-semibold text-ink truncate">
            {String(node.config.name ?? node.id)}
          </span>
          <span className="text-[10px] text-ink-dim truncate">
            {node.type === "region" ? String(node.config.region ?? node.label) : node.label}
          </span>

          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(node.id)}
            className="ml-auto w-5 h-5 rounded-md flex items-center justify-center text-ink-dim/50 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs leading-none shrink-0"
            title="Remove"
          >
            <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M1 1l10 10M11 1L1 11" strokeLinecap="round" />
            </svg>
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
