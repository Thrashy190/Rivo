import { useEffect, useRef, useState } from "react";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

interface LogLine {
  id: number;
  ts: string;
  level: LogLevel;
  project: string;
  accentColor: string;
  source: string;
  message: string;
}

let _id = 0;
function line(level: LogLevel, project: string, accentColor: string, source: string, message: string, secsAgo = 0): LogLine {
  const d = new Date(Date.now() - secsAgo * 1000);
  return { id: _id++, ts: d.toTimeString().slice(0, 8), level, project, accentColor, source, message };
}

const INITIAL_LINES: LogLine[] = [
  line("INFO",  "production-vpc",  "#f59e0b", "orchestrator", "Deploy job started (run_id=run_ae3f1b2)", 420),
  line("INFO",  "production-vpc",  "#f59e0b", "terraform",    "Initializing providers…",                 400),
  line("DEBUG", "serverless-api",  "#6366f1", "aws",          "Authenticating via STS AssumeRole",        390),
  line("INFO",  "serverless-api",  "#6366f1", "terraform",    "Planning: 3 to add, 1 to change, 0 to destroy", 380),
  line("INFO",  "cdn-layer",       "#8b5cf6", "orchestrator", "Deploy job started (run_id=run_9c4d8e1)",  350),
  line("INFO",  "cdn-layer",       "#8b5cf6", "aws",          "Updating CloudFront distribution…",        340),
  line("WARN",  "data-pipeline",   "#10b981", "aws",          "Retrying S3 bucket policy update (attempt 2/3)", 300),
  line("ERROR", "data-pipeline",   "#10b981", "aws",          "Permission denied: s3:PutBucketPolicy",    280),
  line("INFO",  "serverless-api",  "#6366f1", "aws",          "Lambda provisioned in 3.8s",               260),
  line("INFO",  "serverless-api",  "#6366f1", "aws",          "API Gateway created: id=abc12345",          240),
  line("INFO",  "cdn-layer",       "#8b5cf6", "aws",          "CloudFront distribution updated",          180),
  line("INFO",  "cdn-layer",       "#8b5cf6", "orchestrator", "Deploy succeeded in 38s",                  170),
];

const STREAM_LINES: [LogLevel, string, string, string, string][] = [
  ["INFO",  "serverless-api", "#6366f1", "terraform",    "Deploying stage: prod…"],
  ["INFO",  "serverless-api", "#6366f1", "aws",          "Updating API Gateway deployment…"],
  ["DEBUG", "serverless-api", "#6366f1", "aws",          "Waiting for propagation…"],
  ["INFO",  "serverless-api", "#6366f1", "terraform",    "Apply complete! 3 added, 1 changed."],
  ["INFO",  "serverless-api", "#6366f1", "orchestrator", "Invoke URL: https://abc123.execute-api.us-east-1.amazonaws.com/prod"],
  ["INFO",  "serverless-api", "#6366f1", "orchestrator", "Deploy succeeded in 48s"],
];

const LEVEL_STYLE: Record<LogLevel, string> = {
  INFO: "text-sky-400", WARN: "text-amber-400", ERROR: "text-red-400", DEBUG: "text-ink-dim",
};
const SOURCE_STYLE: Record<string, string> = {
  orchestrator: "text-violet-400", terraform: "text-indigo-400", aws: "text-emerald-400",
};

export function GlobalLogsView() {
  const [lines, setLines] = useState<LogLine[]>(INITIAL_LINES);
  const [streamIdx, setStreamIdx] = useState(0);
  const [filter, setFilter] = useState<LogLevel | "ALL">("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const bottomRef = useRef<HTMLDivElement>(null);
  const streaming = streamIdx < STREAM_LINES.length;

  useEffect(() => {
    if (!streaming) return;
    const t = setTimeout(() => {
      const [level, project, accentColor, source, message] = STREAM_LINES[streamIdx];
      setLines((prev) => [...prev, line(level, project, accentColor, source, message)]);
      setStreamIdx((i) => i + 1);
    }, 1400);
    return () => clearTimeout(t);
  }, [streaming, streamIdx]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const projects = ["ALL", ...Array.from(new Set(lines.map((l) => l.project)))];
  const visible = lines
    .filter((l) => filter === "ALL" || l.level === filter)
    .filter((l) => projectFilter === "ALL" || l.project === projectFilter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">Live logs</h2>
          {streaming && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Project filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-7 text-[11px] bg-card border border-edge rounded-md px-2 text-ink appearance-none focus:outline-none focus:border-raised"
          >
            {projects.map((p) => <option key={p} value={p}>{p === "ALL" ? "All projects" : p}</option>)}
          </select>
          {/* Level filter */}
          <div className="flex items-center gap-0.5">
            {(["ALL", "INFO", "WARN", "ERROR"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={[
                  "px-2 py-1 rounded text-[10px] font-mono transition-colors",
                  filter === lvl ? "bg-raised text-ink" : "text-ink-dim hover:text-ink",
                ].join(" ")}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div className="bg-[#0d0d14] border border-edge/60 rounded-xl overflow-hidden">
        {/* Terminal toolbar */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-edge/40">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-2 text-[10px] text-ink-dim/50 font-mono">rivo — logs stream</span>
        </div>

        <div className="h-96 overflow-y-auto px-4 py-3 font-mono text-[11px] space-y-0.5">
          {visible.map((l) => (
            <div key={l.id} className="flex items-start gap-2 leading-relaxed">
              <span className="text-ink-dim/40 shrink-0 select-none tabular-nums">{l.ts}</span>
              <span className={`w-11 shrink-0 ${LEVEL_STYLE[l.level]}`}>{l.level}</span>
              <span
                className="w-24 shrink-0 truncate text-[10px] font-semibold"
                style={{ color: l.accentColor }}
              >
                {l.project}
              </span>
              <span className={`w-20 shrink-0 ${SOURCE_STYLE[l.source] ?? "text-ink-dim"}`}>{l.source}</span>
              <span className="text-ink/70 break-all">{l.message}</span>
            </div>
          ))}

          {streaming && (
            <div className="flex items-center gap-2 leading-relaxed">
              <span className="text-ink-dim/30 shrink-0 tabular-nums">{new Date().toTimeString().slice(0, 8)}</span>
              <span className="text-ink-dim/30 text-[10px]">▋</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-edge/40">
          <span className="text-[10px] text-ink-dim/40 font-mono">{visible.length} lines shown</span>
        </div>
      </div>
    </div>
  );
}
