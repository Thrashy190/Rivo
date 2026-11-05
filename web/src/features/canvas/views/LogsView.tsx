import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

interface LogLine {
  id: number;
  ts: string;
  level: LogLevel;
  source: string;
  message: string;
}

// ─── Dummy data ───────────────────────────────────────────────────────────────

let _id = 0;
function line(level: LogLevel, source: string, message: string, minsAgo = 0): LogLine {
  const d = new Date(Date.now() - minsAgo * 60_000);
  return {
    id: _id++,
    ts: d.toTimeString().slice(0, 8),
    level,
    source,
    message,
  };
}

const INITIAL_LINES: LogLine[] = [
  line("INFO",  "orchestrator", "Deploy job started (run_id=run_ae3f1b2)", 4),
  line("INFO",  "orchestrator", "Fetching project model from store…",      4),
  line("INFO",  "terraform",    "Initializing the backend…",               3),
  line("INFO",  "terraform",    "Initializing provider plugins…",          3),
  line("DEBUG", "aws",          "Authenticating via STS AssumeRole",        3),
  line("INFO",  "terraform",    "Refreshing Terraform state in memory…",   3),
  line("INFO",  "terraform",    "Planning: 3 to add, 1 to change, 0 to destroy", 2),
  line("INFO",  "aws",          "Creating aws_lambda_function.api_handler…", 2),
  line("INFO",  "aws",          "Lambda provisioned in 3.8s",              2),
  line("INFO",  "aws",          "Creating aws_dynamodb_table.users…",      1),
  line("WARN",  "aws",          "Table users already exists — importing state", 1),
  line("INFO",  "aws",          "Imported existing table into state",       1),
  line("INFO",  "aws",          "Creating aws_api_gateway_rest_api.main…", 1),
  line("INFO",  "aws",          "API Gateway created: id=abc12345",         0),
];

const STREAM_LINES: [LogLevel, string, string][] = [
  ["INFO",  "terraform",    "Deploying stage: prod…"],
  ["INFO",  "aws",          "Updating API Gateway deployment…"],
  ["DEBUG", "aws",          "Waiting for deployment propagation (usually 20–30s)"],
  ["INFO",  "terraform",    "Apply complete! Resources: 3 added, 1 changed, 0 destroyed."],
  ["INFO",  "orchestrator", "Collecting output variables…"],
  ["INFO",  "orchestrator", "Invoke URL: https://abc12345.execute-api.us-east-1.amazonaws.com/prod"],
  ["INFO",  "orchestrator", "Deploy succeeded in 48s"],
];

// ─── Level styling ────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<LogLevel, string> = {
  INFO:  "text-sky-400",
  WARN:  "text-amber-400",
  ERROR: "text-red-400",
  DEBUG: "text-zinc-500",
};

const SOURCE_STYLE: Record<string, string> = {
  orchestrator: "text-violet-400",
  terraform:    "text-indigo-400",
  aws:          "text-emerald-400",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface LogsViewProps {
  projectName?: string;
}

export function LogsView({ projectName }: LogsViewProps) {
  const [lines, setLines] = useState<LogLine[]>(INITIAL_LINES);
  const [streaming, setStreaming] = useState(true);
  const [streamIdx, setStreamIdx] = useState(0);
  const [filter, setFilter] = useState<LogLevel | "ALL">("ALL");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Stream new lines every 1.4s
  useEffect(() => {
    if (!streaming || streamIdx >= STREAM_LINES.length) {
      if (streamIdx >= STREAM_LINES.length) setStreaming(false);
      return;
    }
    const t = setTimeout(() => {
      const [level, source, message] = STREAM_LINES[streamIdx];
      setLines((prev) => [...prev, line(level, source, message)]);
      setStreamIdx((i) => i + 1);
    }, 1400);
    return () => clearTimeout(t);
  }, [streaming, streamIdx]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const visible = filter === "ALL" ? lines : lines.filter((l) => l.level === filter);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-page">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-edge/60 shrink-0">
        <div className="flex items-center gap-2">
          {/* Live indicator */}
          {streaming ? (
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="text-[10px] text-ink-dim font-mono">COMPLETED</span>
          )}
        </div>

        <div className="flex-1" />

        {/* Level filter */}
        <div className="flex items-center gap-1">
          {(["ALL", "INFO", "WARN", "ERROR", "DEBUG"] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={[
                "px-2 py-1 rounded text-[10px] font-mono transition-colors",
                filter === lvl
                  ? "bg-raised text-ink"
                  : "text-ink-dim hover:text-ink",
              ].join(" ")}
            >
              {lvl}
            </button>
          ))}
        </div>

        <button
          onClick={() => setLines(INITIAL_LINES.slice())}
          className="text-[10px] text-ink-dim hover:text-ink font-mono transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto px-5 py-3 font-mono text-[11px] space-y-0.5">
        {visible.map((l) => (
          <div key={l.id} className="flex items-start gap-3 leading-relaxed group">
            <span className="text-ink-dim/50 shrink-0 select-none tabular-nums">{l.ts}</span>
            <span className={`w-12 shrink-0 ${LEVEL_STYLE[l.level]}`}>{l.level}</span>
            <span className={`w-20 shrink-0 ${SOURCE_STYLE[l.source] ?? "text-ink-dim"}`}>{l.source}</span>
            <span className="text-ink/80 break-all">{l.message}</span>
          </div>
        ))}

        {streaming && (
          <div className="flex items-center gap-3 leading-relaxed">
            <span className="text-ink-dim/50 shrink-0 select-none tabular-nums">
              {new Date().toTimeString().slice(0, 8)}
            </span>
            <span className="text-ink-dim/40 text-[10px]">▋</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 px-5 py-2 border-t border-edge/40 shrink-0">
        <span className="text-[10px] text-ink-dim font-mono">
          {projectName ? `Project: ${projectName}` : ""}
        </span>
        <span className="text-[10px] text-ink-dim font-mono ml-auto">
          {lines.length} lines
        </span>
      </div>
    </div>
  );
}
