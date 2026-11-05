import { useState } from "react";

type DeployStatus = "success" | "failed" | "running" | "cancelled";

interface GlobalDeployRun {
  id: string;
  projectId: string;
  projectName: string;
  accentColor: string;
  status: DeployStatus;
  triggeredBy: "manual" | "api" | "ci";
  startedAt: string;
  duration?: number;
  added: number;
  changed: number;
  destroyed: number;
  summary?: string;
}

const DUMMY_RUNS: GlobalDeployRun[] = [
  {
    id: "run_ae3f1b2", projectId: "p1", projectName: "serverless-api",   accentColor: "#6366f1",
    status: "running",   triggeredBy: "manual", startedAt: "Just now",  added: 3, changed: 1, destroyed: 0,
    summary: "Apply in progress…",
  },
  {
    id: "run_9c4d8e1", projectId: "p2", projectName: "cdn-layer",        accentColor: "#8b5cf6",
    status: "success",   triggeredBy: "manual", startedAt: "2h ago",    duration: 38, added: 0, changed: 2, destroyed: 0,
    summary: "Updated CloudFront origin",
  },
  {
    id: "run_7b2f0a5", projectId: "p3", projectName: "data-pipeline",    accentColor: "#10b981",
    status: "failed",    triggeredBy: "api",    startedAt: "4h ago",    duration: 12, added: 1, changed: 0, destroyed: 0,
    summary: "IAM permission denied on s3:PutBucketPolicy",
  },
  {
    id: "run_6e1a3d9", projectId: "p1", projectName: "serverless-api",   accentColor: "#6366f1",
    status: "success",   triggeredBy: "ci",     startedAt: "1d ago",    duration: 51, added: 0, changed: 1, destroyed: 0,
    summary: "Lambda memory updated to 512 MB",
  },
  {
    id: "run_3e8a1c7", projectId: "p4", projectName: "production-vpc",   accentColor: "#f59e0b",
    status: "success",   triggeredBy: "manual", startedAt: "2d ago",    duration: 124, added: 8, changed: 0, destroyed: 0,
    summary: "VPC with 3 AZs, NAT gateways",
  },
  {
    id: "run_1d5f9b3", projectId: "p2", projectName: "cdn-layer",        accentColor: "#8b5cf6",
    status: "cancelled", triggeredBy: "manual", startedAt: "3d ago",    duration: 7, added: 0, changed: 0, destroyed: 0,
    summary: "Cancelled by user",
  },
];

const STATUS_PILL: Record<DeployStatus, string> = {
  success:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  failed:    "bg-red-500/15 text-red-400 border-red-500/25",
  running:   "bg-sky-500/15 text-sky-400 border-sky-500/25",
  cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
};
const STATUS_LABEL: Record<DeployStatus, string> = {
  success: "Success", failed: "Failed", running: "Running", cancelled: "Cancelled",
};

function DeltaBadge({ n, type }: { n: number; type: "add" | "change" | "destroy" }) {
  if (n === 0) return null;
  const style = type === "add" ? "text-emerald-400" : type === "change" ? "text-amber-400" : "text-red-400";
  const prefix = type === "add" ? "+" : type === "change" ? "~" : "-";
  return <span className={`text-[10px] font-mono font-semibold ${style}`}>{prefix}{n}</span>;
}

export function GlobalDeploysView() {
  const [statusFilter, setStatusFilter] = useState<DeployStatus | "ALL">("ALL");

  const visible = statusFilter === "ALL"
    ? DUMMY_RUNS
    : DUMMY_RUNS.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Deploy history</h2>
          <p className="text-xs text-ink-dim mt-0.5">All projects · {DUMMY_RUNS.length} runs</p>
        </div>
        <div className="flex items-center gap-1">
          {(["ALL", "running", "success", "failed", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                "px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors",
                statusFilter === s ? "bg-raised text-ink" : "text-ink-dim hover:text-ink",
              ].join(" ")}
            >
              {s === "ALL" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-edge/60 overflow-hidden">
        {visible.map((run, i) => (
          <div
            key={run.id}
            className={[
              "flex items-center gap-4 px-4 py-3 hover:bg-card/40 transition-colors",
              i < visible.length - 1 ? "border-b border-edge/40" : "",
            ].join(" ")}
          >
            {/* Project color dot */}
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: run.accentColor }}
            />

            {/* Project name */}
            <span
              className="text-[11px] font-medium w-36 shrink-0 truncate"
              style={{ color: run.accentColor }}
            >
              {run.projectName}
            </span>

            {/* Run id */}
            <span className="text-[11px] font-mono text-ink-dim w-24 shrink-0">{run.id}</span>

            {/* Summary */}
            <span className="text-xs text-ink/70 flex-1 truncate">{run.summary ?? "—"}</span>

            {/* Deltas */}
            <div className="flex items-center gap-1.5 shrink-0 w-16 justify-end">
              <DeltaBadge n={run.added} type="add" />
              <DeltaBadge n={run.changed} type="change" />
              <DeltaBadge n={run.destroyed} type="destroy" />
            </div>

            {/* Status pill */}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 w-20 text-center ${STATUS_PILL[run.status]}`}>
              {run.status === "running"
                ? <span className="flex items-center justify-center gap-1"><span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse" />{STATUS_LABEL[run.status]}</span>
                : STATUS_LABEL[run.status]
              }
            </span>

            {/* Time */}
            <span className="text-[10px] text-ink-dim shrink-0 w-16 text-right">{run.startedAt}</span>
            {run.duration && (
              <span className="text-[10px] text-ink-dim/50 shrink-0 w-8 text-right">{run.duration}s</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
