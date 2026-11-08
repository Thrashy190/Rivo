import { useEffect, useRef } from "react";
import { getServiceIcon } from "../aws-services";
import type { Issue } from "../readiness";
import type { CanvasNode, Viewport } from "../useCanvas";

export const SERVICE_NODE_WIDTH = 224;
export const SERVICE_NODE_HEIGHT = 72;

interface ServiceNodeProps {
  node: CanvasNode;
  viewport: Viewport;
  selected?: boolean;
  // A line is being drawn from another node: this one can receive it.
  connectable?: boolean;
  summary?: string;
  issues?: Issue[];
  parentLabel?: string;
  // Deployed and reachable.
  live?: boolean;
  readOnly?: boolean;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onDragEnd?: (id: string, position: { x: number; y: number }) => void;
  onRemove: (id: string) => void;
  onNodeClick?: (id: string) => void;
  onConnectDrop?: (id: string) => void;
  onPortMouseDown?: (nodeId: string, side: "left" | "right", portPos: { x: number; y: number }) => void;
}

export function ServiceNode({
  node,
  viewport,
  selected = false,
  connectable = false,
  summary,
  issues = [],
  parentLabel,
  live = false,
  readOnly = false,
  onMove,
  onDragEnd,
  onRemove,
  onNodeClick,
  onConnectDrop,
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
      if (!dragState.current.hasMoved) return;
      const newPos = { x: dragState.current.startPos.x + dx, y: dragState.current.startPos.y + dy };
      dragState.current.lastPos = newPos;
      onMove(node.id, newPos);
    };

    const onMouseUp = () => {
      if (dragState.current) {
        if (!dragState.current.hasMoved) onNodeClick?.(node.id);
        else onDragEnd?.(node.id, dragState.current.lastPos);
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
    if (e.button !== 0) return;
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
    const portX = side === "left" ? node.position.x : node.position.x + SERVICE_NODE_WIDTH;
    onPortMouseDown?.(node.id, side, { x: portX, y: node.position.y + SERVICE_NODE_HEIGHT / 2 });
  };

  const name = String(node.config.name ?? node.id);
  const skipped = issues.some((i) => i.level === "skipped");
  const todo = !skipped && issues.length > 0;

  return (
    <div
      data-canvas-node
      data-node-id={node.id}
      role="button"
      aria-label={`${node.label} ${name}`}
      aria-pressed={selected}
      onMouseDown={handleMouseDown}
      onMouseUp={() => onConnectDrop?.(node.id)}
      className="absolute select-none group"
      style={{ left: node.position.x, top: node.position.y, width: SERVICE_NODE_WIDTH, zIndex: selected ? 4 : 3 }}
    >
      <div
        className={[
          "relative flex items-center gap-3 px-3 rounded-xl border bg-popover cursor-grab active:cursor-grabbing",
          "shadow-[0_1px_2px_rgba(0,0,0,0.12),0_8px_24px_-12px_rgba(0,0,0,0.35)] transition-[border-color,box-shadow] duration-150",
          selected
            ? "border-indigo-500 ring-4 ring-indigo-500/15"
            : connectable
              ? "border-edge hover:border-indigo-400 hover:ring-4 hover:ring-indigo-500/15"
              : "border-edge hover:border-ink-dim/50",
          skipped ? "border-dashed" : "",
        ].join(" ")}
        style={{ height: SERVICE_NODE_HEIGHT }}
      >
        <div className={["w-10 h-10 rounded-lg overflow-hidden shrink-0", skipped ? "opacity-60 grayscale-[35%]" : ""].join(" ")}>
          {getServiceIcon(node.type)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink leading-tight min-w-0">
            <span className="truncate">{name}</span>
            {live && (
              <span title="Deployed" aria-label="Live" className="shrink-0 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
            )}
          </p>
          <p className="text-[11px] text-ink-dim leading-tight truncate mt-1">{summary ?? node.label}</p>
        </div>

        {(todo || skipped) && (
          <span
            title={issues.map((i) => i.message).join("\n")}
            className={[
              "absolute top-2 right-2 w-2 h-2 rounded-full",
              skipped ? "bg-ink-dim/50" : "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.18)]",
            ].join(" ")}
          />
        )}

        {!readOnly && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(node.id)}
            aria-label={`Remove ${name}`}
            className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-popover border border-edge text-ink-dim hover:text-red-500 hover:border-red-500/40 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center z-10"
          >
            <svg viewBox="0 0 10 10" className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M1 1l8 8M9 1L1 9" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {parentLabel && (
        <div className="absolute -bottom-5 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[10px] text-ink-dim bg-page/80 border border-edge px-1.5 py-px rounded-full truncate max-w-full">
            in {parentLabel}
          </span>
        </div>
      )}

      {!readOnly &&
        (["left", "right"] as const).map((side) => (
          <div
            key={side}
            onMouseDown={(e) => handlePortMouseDown(e, side)}
            title="Drag to connect"
            className={[
              "absolute w-3.5 h-3.5 rounded-full border-2 border-indigo-500 bg-page z-20 cursor-crosshair",
              "opacity-0 group-hover:opacity-100 hover:scale-125 transition-[opacity,transform] duration-150",
              side === "left" ? "-left-[7px]" : "-right-[7px]",
            ].join(" ")}
            style={{ top: SERVICE_NODE_HEIGHT / 2 - 7 }}
          />
        ))}
    </div>
  );
}
