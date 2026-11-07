import type { CanvasNode } from "../useCanvas";
import { lambdaSource } from "../lambdaSource";
import { formatBytes } from "../../../utils/format";

function InUse() {
  return (
    <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
      In use
    </span>
  );
}

const RUNTIME_LANGUAGE: Record<string, string> = {
  "nodejs20.x": "JavaScript",
  "nodejs18.x": "JavaScript",
  "python3.12": "Python",
  "python3.11": "Python",
  "python3.10": "Python",
  "go1.x": "Go",
  java21: "Java",
  "ruby3.3": "Ruby",
};

interface LambdaPanelProps {
  node: CanvasNode;
  onOpenCode: () => void;
  onOpenZip: () => void;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-edge/40 last:border-0">
      <span className="text-xs text-ink-dim">{label}</span>
      <span className="text-xs font-mono text-ink/80">{value}</span>
    </div>
  );
}

export function LambdaPanel({ node, onOpenCode, onOpenZip }: LambdaPanelProps) {
  const runtime = String(node.config.runtime ?? "nodejs20.x");
  const language = RUNTIME_LANGUAGE[runtime] ?? "JavaScript";
  const memory = String(node.config.memory ?? 128);
  const timeout = String(node.config.timeout ?? 30);
  const handler = String(node.config.handler ?? "index.handler");
  const source = lambdaSource(node);
  const lines = source.kind === "inline" ? source.code.split("\n").length : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Runtime info */}
      <div className="px-4 py-3 border-b border-edge/60">
        <p className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider mb-2.5">
          Runtime
        </p>
        <div className="rounded-lg border border-edge/60 bg-card/40 px-3 divide-y divide-edge/40">
          <StatRow label="Runtime" value={runtime} />
          <StatRow label="Language" value={language} />
          <StatRow label="Memory" value={`${memory} MB`} />
          <StatRow label="Timeout" value={`${timeout}s`} />
          <StatRow label="Handler" value={handler} />
        </div>
      </div>

      {/* Code editor launcher */}
      <div className="px-4 py-3 border-b border-edge/60">
        <p className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider mb-2.5">
          Source code
        </p>
        <button
          onClick={onOpenCode}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-edge/60 bg-card/40 hover:bg-card hover:border-edge transition-all group text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
            <svg viewBox="0 0 20 20" className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 6L3 10l4 4M13 6l4 4-4 4M11 4l-2 12" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-ink/80 group-hover:text-ink transition-colors">
              Open code editor
            </p>
            <p className="text-[10px] text-ink-dim mt-0.5">
              {source.kind === "inline" ? `${lines} line${lines === 1 ? "" : "s"} saved with the diagram` : "Write the function in the diagram"}
            </p>
          </div>
          {source.kind === "inline" && <InUse />}
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 text-ink-dim shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 7h10M8 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ZIP upload launcher */}
      <div className="px-4 py-3 border-b border-edge/60">
        <p className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider mb-2.5">
          Deployment package
        </p>
        <button
          onClick={onOpenZip}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-edge/60 bg-card/40 hover:bg-card hover:border-edge transition-all group text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-raised flex items-center justify-center shrink-0 group-hover:bg-raised/80 transition-colors">
            <svg viewBox="0 0 20 20" className="w-5 h-5 text-ink-dim" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 2H5a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 5 18h10a1.5 1.5 0 0 0 1.5-1.5V7.5L11 2Z" />
              <path d="M11 2v5.5H16.5" />
              <path d="M10 10v1M10 13v1" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-ink/80 group-hover:text-ink transition-colors truncate">
              {source.kind === "package" ? source.package.name : "Upload .zip package"}
            </p>
            <p className="text-[10px] text-ink-dim mt-0.5">
              {source.kind === "package" ? formatBytes(source.package.size) : "Stored in your account's S3 bucket"}
            </p>
          </div>
          {source.kind === "package" && <InUse />}
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 text-ink-dim shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 7h10M8 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Env vars placeholder */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider mb-2">
          Environment variables
        </p>
        <div className="rounded-lg border border-dashed border-edge/60 px-3 py-4 flex flex-col items-center gap-1.5">
          <p className="text-xs text-ink-dim text-center">Not available yet</p>
        </div>
      </div>
    </div>
  );
}
