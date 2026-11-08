import { STATUS_LABELS, type DeploymentStatus } from "../../services/deployments";

const STYLES: Record<DeploymentStatus, string> = {
  queued: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  planning: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  planned: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  applying: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  succeeded: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400",
  cancelled: "bg-raised text-ink-dim",
};

const RUNNING = new Set<DeploymentStatus>(["queued", "planning", "applying"]);

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${STYLES[status]}`}>
      {RUNNING.has(status) ? (
        <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" aria-hidden="true" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}

export function SummaryChips({ summary }: { summary?: { add: number; change: number; destroy: number } }) {
  if (!summary) return null;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
      <span className="text-emerald-600 dark:text-emerald-400" title="To create">+{summary.add}</span>
      <span className="text-amber-600 dark:text-amber-400" title="To change">~{summary.change}</span>
      <span className="text-red-600 dark:text-red-400" title="To destroy">−{summary.destroy}</span>
    </span>
  );
}
