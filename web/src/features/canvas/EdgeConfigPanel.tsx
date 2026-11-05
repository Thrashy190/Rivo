import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { CanvasEdge, CanvasNode } from "./useCanvas";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "ANY"] as const;

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET:    { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  POST:   { bg: "bg-blue-500/15",    text: "text-blue-400"    },
  PUT:    { bg: "bg-amber-500/15",   text: "text-amber-400"   },
  PATCH:  { bg: "bg-purple-500/15",  text: "text-purple-400"  },
  DELETE: { bg: "bg-red-500/15",     text: "text-red-400"     },
  ANY:    { bg: "bg-raised/60",    text: "text-ink-dim"    },
};

interface EdgeConfigPanelProps {
  edge: CanvasEdge;
  apiGwNode: CanvasNode;
  lambdaNode: CanvasNode;
  onClose: () => void;
  onUpdate: (edgeId: string, config: CanvasEdge["config"]) => void;
}

export function EdgeConfigPanel({
  edge,
  apiGwNode,
  lambdaNode,
  onClose,
  onUpdate,
}: EdgeConfigPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [method, setMethod] = useState(edge.config?.method ?? "GET");
  const [path,   setPath]   = useState(edge.config?.path ?? "/");

  // Keep refs up-to-date so the unmount cleanup can commit the latest values
  // without stale-closure issues (handles panel closed by clicking elsewhere).
  const latestMethod = useRef(method);
  const latestPath   = useRef(path);
  latestMethod.current = method;
  latestPath.current   = path;

  useEffect(() => {
    gsap.fromTo(
      panelRef.current,
      { y: "100%" },
      { y: "0%", duration: 0.35, ease: "power3.out" }
    );
    // Commit on unmount — fires whether closed via X button or by clicking elsewhere
    return () => {
      onUpdate(edge.id, { method: latestMethod.current, path: latestPath.current });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    gsap.to(panelRef.current, {
      y: "100%",
      duration: 0.25,
      ease: "power3.in",
      onComplete: onClose,
    });
  };

  const commit = (nextMethod: string, nextPath: string) => {
    onUpdate(edge.id, { method: nextMethod, path: nextPath });
  };

  const methodColor = METHOD_COLORS[method] ?? METHOD_COLORS.ANY;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-0 left-0 right-0 z-20 bg-popover border-t border-edge/80 shadow-2xl shadow-black/30"
      style={{ height: "44%" }}
    >
      {/* Handle */}
      <div className="flex justify-center pt-2.5 pb-1">
        <div className="w-10 h-1 rounded-full bg-raised" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-edge/60">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Route pill preview */}
          <span className={`shrink-0 text-[11px] font-mono font-bold px-2 py-0.5 rounded ${methodColor.bg} ${methodColor.text}`}>
            {method}
          </span>
          <span className="text-sm font-mono text-ink truncate">{path || "/"}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-dim shrink-0">
          <span className="truncate max-w-[80px]">{apiGwNode.config.name as string || apiGwNode.label}</span>
          <svg viewBox="0 0 14 8" className="w-5 h-3 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 4h12M9 1l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="truncate max-w-[80px]">{lambdaNode.config.name as string || lambdaNode.label}</span>
        </div>

        <button
          onClick={handleClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors"
        >
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Config */}
      <div className="px-5 py-5 grid grid-cols-2 gap-5">
        {/* Method picker */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider">
            HTTP Method
          </label>
          <div className="flex flex-wrap gap-1.5">
            {HTTP_METHODS.map((m) => {
              const c = METHOD_COLORS[m];
              const active = method === m;
              return (
                <button
                  key={m}
                  onClick={() => { setMethod(m); commit(m, path); }}
                  className={[
                    "px-2.5 py-1 rounded text-[11px] font-mono font-semibold border transition-all",
                    active
                      ? `${c.bg} ${c.text} border-current`
                      : "bg-transparent text-ink-dim border-edge/60 hover:border-edge hover:text-ink",
                  ].join(" ")}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Path input */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider">
            Path
          </label>
          <input
            type="text"
            value={path}
            placeholder="/resource/{id}"
            onChange={(e) => setPath(e.target.value)}
            onBlur={() => commit(method, path)}
            className="h-8 rounded-md border border-edge bg-page px-2.5 text-xs font-mono text-ink placeholder:text-ink-dim focus:outline-none focus:border-raised transition-colors"
          />
          <p className="text-[10px] text-ink-dim">
            Use <code className="text-indigo-400">{"{id}"}</code> for path parameters
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="px-5 py-2 border-t border-edge/40">
        <p className="text-[11px] text-ink-dim">
          <span className={`font-mono font-semibold ${methodColor.text}`}>{method}</span>
          {" "}
          <span className="font-mono">{path || "/"}</span>
          {" → "}
          <span className="text-ink/60">{lambdaNode.config.name as string || lambdaNode.label}</span>
        </p>
      </div>
    </div>
  );
}
