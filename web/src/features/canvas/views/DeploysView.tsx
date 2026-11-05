import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeployStatus = "success" | "failed" | "running" | "cancelled";
type LogLevel     = "INFO" | "WARN" | "ERROR" | "DEBUG";

interface LogLine { id: number; ts: string; level: LogLevel; source: string; message: string; }
interface DeployRun {
  id: string;
  status: DeployStatus;
  triggeredBy: "manual" | "api" | "ci";
  startedAt: string;
  duration?: number;
  added: number;
  changed: number;
  destroyed: number;
  commitSha?: string;
  summary?: string;
  logs: [LogLevel, string, string][];   // [level, source, message]
}

// ─── Dummy data ───────────────────────────────────────────────────────────────

const RUNNING_LOGS: [LogLevel, string, string][] = [
  ["INFO",  "orchestrator", "Deploy job started (run_id=run_ae3f1b2)"],
  ["INFO",  "orchestrator", "Fetching project model from store…"],
  ["INFO",  "terraform",    "Initializing the backend…"],
  ["DEBUG", "aws",          "Authenticating via STS AssumeRole"],
  ["INFO",  "terraform",    "Refreshing Terraform state in memory…"],
  ["INFO",  "terraform",    "Planning: 3 to add, 1 to change, 0 to destroy"],
  ["INFO",  "aws",          "Creating aws_lambda_function.api_handler…"],
];

const DUMMY_RUNS: DeployRun[] = [
  {
    id: "run_ae3f1b2", status: "running", triggeredBy: "manual",
    startedAt: "Just now", added: 3, changed: 1, destroyed: 0,
    summary: "Apply in progress…",
    logs: RUNNING_LOGS,
  },
  {
    id: "run_9c4d8e1", status: "success", triggeredBy: "manual",
    startedAt: "2h ago", duration: 38, added: 0, changed: 2, destroyed: 0,
    commitSha: "f3a1c9b", summary: "Updated Lambda environment variables",
    logs: [
      ["INFO",  "orchestrator", "Deploy job started (run_id=run_9c4d8e1)"],
      ["INFO",  "terraform",    "Refreshing Terraform state in memory…"],
      ["INFO",  "aws",          "Updating aws_lambda_function.api_handler…"],
      ["INFO",  "aws",          "Lambda updated in 2.1s"],
      ["INFO",  "terraform",    "Apply complete! Resources: 0 added, 2 changed, 0 destroyed."],
      ["INFO",  "orchestrator", "Deploy succeeded in 38s"],
    ],
  },
  {
    id: "run_7b2f0a5", status: "failed", triggeredBy: "api",
    startedAt: "1d ago", duration: 12, added: 1, changed: 0, destroyed: 0,
    commitSha: "a8e2d74", summary: "IAM permission denied on s3:PutBucketPolicy",
    logs: [
      ["INFO",  "orchestrator", "Deploy job started (run_id=run_7b2f0a5)"],
      ["INFO",  "terraform",    "Planning: 1 to add, 0 to change, 0 to destroy"],
      ["INFO",  "aws",          "Creating aws_s3_bucket_policy.frontend…"],
      ["ERROR", "aws",          "AccessDenied: s3:PutBucketPolicy on arn:aws:s3:::dev-rivo-frontend"],
      ["ERROR", "terraform",    "Error: creating S3 Bucket Policy — permission denied"],
      ["ERROR", "orchestrator", "Deploy failed after 12s"],
    ],
  },
  {
    id: "run_3e8a1c7", status: "success", triggeredBy: "manual",
    startedAt: "3d ago", duration: 61, added: 5, changed: 0, destroyed: 0,
    commitSha: "2c9f3a1", summary: "Initial infrastructure provisioning",
    logs: [
      ["INFO",  "orchestrator", "Deploy job started (run_id=run_3e8a1c7)"],
      ["INFO",  "terraform",    "Planning: 5 to add, 0 to change, 0 to destroy"],
      ["INFO",  "aws",          "Creating aws_lambda_function.api_handler…"],
      ["INFO",  "aws",          "Creating aws_dynamodb_table.users…"],
      ["INFO",  "aws",          "Creating aws_api_gateway_rest_api.main…"],
      ["INFO",  "aws",          "Creating aws_api_gateway_stage.prod…"],
      ["INFO",  "aws",          "Creating aws_api_gateway_deployment.main…"],
      ["INFO",  "terraform",    "Apply complete! Resources: 5 added, 0 changed, 0 destroyed."],
      ["INFO",  "orchestrator", "Deploy succeeded in 61s"],
    ],
  },
  {
    id: "run_1d5f9b3", status: "cancelled", triggeredBy: "manual",
    startedAt: "5d ago", duration: 7, added: 0, changed: 0, destroyed: 0,
    summary: "Cancelled by user before apply",
    logs: [
      ["INFO",  "orchestrator", "Deploy job started (run_id=run_1d5f9b3)"],
      ["INFO",  "terraform",    "Planning: 1 to add, 0 to change, 0 to destroy"],
      ["INFO",  "orchestrator", "Cancellation requested by user"],
      ["INFO",  "orchestrator", "Job cancelled after 7s"],
    ],
  },
];

// ─── Styling helpers ──────────────────────────────────────────────────────────

const STATUS_PILL: Record<DeployStatus, string> = {
  success:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  failed:    "bg-red-500/15 text-red-400 border-red-500/25",
  running:   "bg-sky-500/15 text-sky-400 border-sky-500/25",
  cancelled: "bg-zinc-500/15 text-ink-dim border-zinc-500/25",
};
const STATUS_LABEL: Record<DeployStatus, string> = {
  success: "Success", failed: "Failed", running: "Running", cancelled: "Cancelled",
};

const LEVEL_STYLE: Record<LogLevel, string> = {
  INFO: "text-sky-400", WARN: "text-amber-400", ERROR: "text-red-400", DEBUG: "text-ink-dim",
};
const SOURCE_STYLE: Record<string, string> = {
  orchestrator: "text-violet-400", terraform: "text-indigo-400", aws: "text-emerald-400",
};

function DeltaBadge({ n, type }: { n: number; type: "add" | "change" | "destroy" }) {
  if (n === 0) return null;
  const style = type === "add" ? "text-emerald-400" : type === "change" ? "text-amber-400" : "text-red-400";
  const prefix = type === "add" ? "+" : type === "change" ? "~" : "-";
  return <span className={`text-[10px] font-mono font-semibold ${style}`}>{prefix}{n}</span>;
}

// ─── Inline log panel ─────────────────────────────────────────────────────────

function InlineLogs({ run }: { run: DeployRun }) {
  const [lines, setLines] = useState<LogLine[]>(() =>
    run.logs.map(([level, source, message], i) => ({
      id: i,
      ts: new Date().toTimeString().slice(0, 8),
      level,
      source,
      message,
    }))
  );
  const [streamIdx, setStreamIdx] = useState(run.logs.length);
  const streaming = run.status === "running";
  const bottomRef = useRef<HTMLDivElement>(null);

  const EXTRA: [LogLevel, string, string][] = [
    ["INFO",  "aws",          "Lambda provisioned in 3.8s"],
    ["INFO",  "aws",          "Creating aws_api_gateway_rest_api.main…"],
    ["INFO",  "aws",          "API Gateway created: id=abc12345"],
    ["INFO",  "terraform",    "Apply complete! Resources: 3 added, 1 changed."],
    ["INFO",  "orchestrator", "Deploy succeeded in 48s"],
  ];

  useEffect(() => {
    if (!streaming || streamIdx >= EXTRA.length) return;
    const t = setTimeout(() => {
      const [level, source, message] = EXTRA[streamIdx];
      setLines((prev) => [...prev, {
        id: prev.length,
        ts: new Date().toTimeString().slice(0, 8),
        level, source, message,
      }]);
      setStreamIdx((i) => i + 1);
    }, 1400);
    return () => clearTimeout(t);
  }, [streaming, streamIdx]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="border-t border-edge/40 bg-[#0d0d14]">
      {/* Log toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-edge/30">
        <span className="text-[10px] text-ink-dim/50 font-mono">Logs</span>
        {streaming && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Log lines */}
      <div className="max-h-48 overflow-y-auto px-4 py-2 space-y-0.5 font-mono text-[11px]">
        {lines.map((l) => (
          <div key={l.id} className="flex items-start gap-2 leading-relaxed">
            <span className="text-ink-dim/30 shrink-0 tabular-nums">{l.ts}</span>
            <span className={`w-10 shrink-0 ${LEVEL_STYLE[l.level]}`}>{l.level}</span>
            <span className={`w-20 shrink-0 ${SOURCE_STYLE[l.source] ?? "text-ink-dim"}`}>{l.source}</span>
            <span className={l.level === "ERROR" ? "text-red-300" : "text-ink/60"}>{l.message}</span>
          </div>
        ))}
        {streaming && (
          <div className="flex items-center gap-2">
            <span className="text-ink-dim/20 tabular-nums">{new Date().toTimeString().slice(0, 8)}</span>
            <span className="text-ink-dim/30 animate-pulse">▋</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DeploysViewProps {
  projectName?: string;
}

export function DeploysView({ projectName: _projectName }: DeploysViewProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const runningRun = DUMMY_RUNS.find((r) => r.status === "running");
  const pastRuns   = DUMMY_RUNS.filter((r) => r.status !== "running");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-edge/60 shrink-0">
        <p className="text-xs font-semibold text-ink">Deploy history</p>
        <span className="text-[10px] font-mono bg-raised px-1.5 py-0.5 rounded text-ink-dim">
          {DUMMY_RUNS.length} runs
        </span>
        <div className="flex-1" />
        <button className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors">
          Deploy now
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Active deploy banner ────────────────────────────────────── */}
        {runningRun && (
          <div className="m-4 rounded-xl border border-sky-500/40 bg-sky-500/5 overflow-hidden">
            {/* Banner header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-sky-500/10 border-b border-sky-500/30">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-400" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-sky-300">Deploy in progress</p>
                <p className="text-[11px] text-sky-400/70 font-mono">{runningRun.id}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  <DeltaBadge n={runningRun.added} type="add" />
                  <DeltaBadge n={runningRun.changed} type="change" />
                  <DeltaBadge n={runningRun.destroyed} type="destroy" />
                </div>
                <span className="text-[10px] text-sky-400/60">{runningRun.startedAt}</span>
                <button className="px-2 py-1 rounded border border-red-500/40 text-[10px] text-red-400 hover:border-red-500/70 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => setExpanded(expanded === runningRun.id ? null : runningRun.id)}
                  className={`w-6 h-6 flex items-center justify-center rounded-md text-sky-400/60 hover:text-sky-300 transition-colors`}
                >
                  <svg viewBox="0 0 12 12" className={`w-3 h-3 transition-transform ${expanded === runningRun.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Inline logs always visible for running deploy */}
            <InlineLogs run={runningRun} />
          </div>
        )}

        {/* ── Past runs ───────────────────────────────────────────────── */}
        <div className={runningRun ? "px-4 pb-4" : ""}>
          {pastRuns.length > 0 && (
            <div className={[
              "rounded-xl border border-edge/60 overflow-hidden",
              runningRun ? "" : "",
            ].join(" ")}>
              {pastRuns.map((run, i) => (
                <div key={run.id} className={i < pastRuns.length - 1 ? "border-b border-edge/40" : ""}>
                  {/* Row */}
                  <button
                    onClick={() => setExpanded(expanded === run.id ? null : run.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-card/40 transition-colors text-left"
                  >
                    <span className={[
                      "w-2 h-2 rounded-full shrink-0 mt-0.5",
                      run.status === "success"   ? "bg-emerald-400" :
                      run.status === "failed"    ? "bg-red-400" :
                      "bg-zinc-500",
                    ].join(" ")} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-ink/80">{run.id}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_PILL[run.status]}`}>
                          {STATUS_LABEL[run.status]}
                        </span>
                        <span className="text-[10px] text-ink-dim/60 bg-raised/40 px-1.5 py-0.5 rounded capitalize">
                          {run.triggeredBy}
                        </span>
                      </div>
                      {run.summary && (
                        <p className="text-[11px] text-ink-dim truncate">{run.summary}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <DeltaBadge n={run.added} type="add" />
                      <DeltaBadge n={run.changed} type="change" />
                      <DeltaBadge n={run.destroyed} type="destroy" />
                    </div>

                    <div className="text-right shrink-0 w-16">
                      <p className="text-[10px] text-ink-dim">{run.startedAt}</p>
                      {run.duration && (
                        <p className="text-[10px] text-ink-dim/50">{run.duration}s</p>
                      )}
                    </div>

                    {run.commitSha && (
                      <span className="text-[10px] font-mono text-indigo-400/70 shrink-0">{run.commitSha}</span>
                    )}

                    <svg
                      viewBox="0 0 12 12"
                      className={`w-3 h-3 text-ink-dim shrink-0 transition-transform ${expanded === run.id ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" strokeWidth="1.5"
                    >
                      <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Inline logs */}
                  {expanded === run.id && <InlineLogs run={run} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
