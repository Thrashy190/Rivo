import type { ReactNode } from "react";
import type { CanvasEdge, CanvasNode } from "../useCanvas";
import { connectedVariables, lambdaSource } from "../lambdaSource";
import { formatBytes } from "../../../utils/format";
import { inputClass, sectionTitle } from "./styles";

interface LambdaCodeProps {
  node: CanvasNode;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  readOnly?: boolean;
  onOpenCode: () => void;
  onOpenZip: () => void;
  onUpdate: (config: Record<string, unknown>) => void;
}

const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function LambdaCode({ node, nodes, edges, readOnly = false, onOpenCode, onOpenZip, onUpdate }: LambdaCodeProps) {
  const source = lambdaSource(node);
  const lines = source.kind === "inline" ? source.code.split("\n").length : 0;
  const env = Object.entries((node.config.environment as Record<string, string> | undefined) ?? {});
  const auto = connectedVariables(node, nodes, edges);

  const setEnv = (entries: [string, string][]) => onUpdate({ ...node.config, environment: Object.fromEntries(entries) });

  return (
    <>
      <section className="px-4 py-4 border-b border-edge">
        <p className={`${sectionTitle} mb-2.5`}>Code</p>
        <div className="flex flex-col gap-2">
          <Launcher
            onClick={onOpenCode}
            active={source.kind === "inline"}
            title={readOnly ? "View the code" : "Write the code"}
            detail={source.kind === "inline" ? `${lines} line${lines === 1 ? "" : "s"} saved with the diagram` : "In the editor, saved with the diagram"}
            icon={<path d="M7 6L3 10l4 4M13 6l4 4-4 4M11 4l-2 12" />}
          />
          <Launcher
            onClick={onOpenZip}
            active={source.kind === "package"}
            title={source.kind === "package" ? source.package.name : readOnly ? "No .zip package" : "Upload a .zip"}
            detail={source.kind === "package" ? formatBytes(source.package.size) : "Up to 50 MB, for dependencies or compiled code"}
            icon={
              <>
                <path d="M11 2H5a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 5 18h10a1.5 1.5 0 0 0 1.5-1.5V7.5L11 2Z" />
                <path d="M11 2v5.5H16.5M10 10v1M10 13v1" />
              </>
            }
          />
        </div>
      </section>

      <section className="px-4 py-4 border-b border-edge">
        <div className="flex items-center justify-between mb-2.5">
          <p className={sectionTitle}>Environment variables</p>
          {!readOnly && (
            <button
              onClick={() => setEnv([...env, [`VAR_${env.length + 1}`, ""]])}
              className="text-[11px] font-medium text-indigo-500 hover:text-indigo-400 transition-colors"
            >
              Add
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {auto.map((v) => (
            <div key={v.key} className="flex items-center gap-2 h-8 px-2.5 rounded-lg bg-card/70 border border-edge/70">
              <code className="text-[11px] text-ink truncate">{v.key}</code>
              <span className="ml-auto text-[10px] text-ink-dim truncate">from {v.from}</span>
            </div>
          ))}
          {env.map(([key, value], i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                aria-label="Name"
                value={key}
                disabled={readOnly}
                spellCheck={false}
                onChange={(e) => setEnv(env.map((kv, j) => (j === i ? [e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"), kv[1]] : kv)))}
                className={`${inputClass} w-[42%] font-mono ${ENV_KEY.test(key) ? "" : "border-red-500/60"}`}
              />
              <input
                aria-label={`Value of ${key}`}
                value={value}
                disabled={readOnly}
                spellCheck={false}
                placeholder="value"
                onChange={(e) => setEnv(env.map((kv, j) => (j === i ? [kv[0], e.target.value] : kv)))}
                className={`${inputClass} flex-1 font-mono`}
              />
              {!readOnly && (
                <button
                  onClick={() => setEnv(env.filter((_, j) => j !== i))}
                  aria-label={`Remove ${key}`}
                  className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-ink-dim hover:text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M1 1l8 8M9 1L1 9" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {auto.length === 0 && env.length === 0 && (
            <p className="text-[11px] text-ink-dim">None. Connections to tables and buckets add their names here.</p>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-dim/80">Values are saved in the diagram as plain text: keep secrets in Secrets Manager.</p>
      </section>
    </>
  );
}

function Launcher({ onClick, active, title, detail, icon }: { onClick: () => void; active: boolean; title: string; detail: string; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors group",
        active ? "border-indigo-500/40 bg-indigo-500/[0.06]" : "border-edge bg-card/50 hover:bg-card",
      ].join(" ")}
    >
      <span className={["w-8 h-8 rounded-lg flex items-center justify-center shrink-0", active ? "bg-indigo-500/15 text-indigo-500" : "bg-raised text-ink-dim"].join(" ")}>
        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-ink truncate">{title}</span>
        <span className="block text-[11px] text-ink-dim truncate mt-0.5">{detail}</span>
      </span>
      {active && <span className="text-[9px] font-semibold uppercase tracking-wider text-indigo-500 shrink-0">In use</span>}
      <svg viewBox="0 0 14 14" className="w-3 h-3 text-ink-dim shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
