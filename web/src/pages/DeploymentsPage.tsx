import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "../components/Button/Button";
import { Skeleton } from "../components/Skeleton/Skeleton";
import { useWorkspace } from "../features/workspace/workspaceContext";
import { StatusBadge, SummaryChips } from "../features/deploy/StatusBadge";
import { errorMessage } from "../services/api";
import { deploymentsService, duration, RUNNING, timeAgo, type Deployment, type DeploymentPage } from "../services/deployments";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-edge bg-card/40 px-4 py-3">
      <p className="text-[11px] text-ink-dim">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-ink-dim mt-0.5">{hint}</p>}
    </div>
  );
}

// Every deployment in the workspace, newest first, and the engine time used
// this month.
export function DeploymentsPage() {
  const { workspace } = useWorkspace();
  const [items, setItems] = useState<Deployment[] | null>(null);
  const [usage, setUsage] = useState<DeploymentPage["usage"]>();
  const [cursor, setCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    deploymentsService
      .list(workspace.id)
      .then((page) => {
        if (!active) return;
        setItems(page.items);
        setUsage(page.usage);
        setCursor(page.nextCursor);
        // Keeps running ones up to date.
        if (page.items.some((d) => RUNNING.includes(d.status))) timer = setTimeout(() => setRefresh((n) => n + 1), 4000);
      })
      .catch((err: unknown) => active && setError(errorMessage(err, "Could not load the deployments.")));
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [workspace.id, refresh]);

  const more = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await deploymentsService.list(workspace.id, cursor);
      setItems((l) => [...(l ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const waiting = (items ?? []).filter((d) => d.status === "planned").length;
  const running = (items ?? []).filter((d) => RUNNING.includes(d.status)).length;
  const minutes = usage ? Math.ceil(usage.taskSeconds / 60) : 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold text-ink">Deployments</h1>
      <p className="text-sm text-ink-dim mt-1 mb-6">Plans, approvals and applies of every project in the workspace.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Running" value={items ? String(running) : "–"} />
        <Stat label="Waiting for approval" value={items ? String(waiting) : "–"} />
        <Stat label="Engine time this month" value={usage ? `${minutes} min` : "–"} hint={usage ? `${usage.runs} task${usage.runs === 1 ? "" : "s"}` : undefined} />
        <Stat label="Shown" value={items ? String(items.length) : "–"} hint={cursor ? "more below" : undefined} />
      </div>

      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : items === null ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge p-10 text-center">
          <p className="text-sm text-ink">No deployments yet</p>
          <p className="text-xs text-ink-dim mt-1">Open a project and use Deploy to plan its first one.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-edge overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-card/60 text-[11px] text-ink-dim">
              <tr>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">Account</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">By</th>
                <th className="px-4 py-2 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/60">
              {items.map((d) => (
                <tr key={d.deploymentId} className="hover:bg-card/40 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/workspaces/${workspace.id}/projects/${d.projectId}?deployment=${d.deploymentId}`}
                      className="text-sm text-ink font-medium hover:text-indigo-500 transition-colors"
                    >
                      {d.projectName}
                    </Link>
                    <span className="ml-2 text-[11px] text-ink-dim">{d.action === "destroy" ? "destroy" : "deploy"}</span>
                    <span className="ml-2">
                      <SummaryChips summary={d.summary} />
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs text-ink-dim">
                    {d.connectionName} <span className="font-mono">· {d.region}</span>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs text-ink-dim truncate max-w-[12rem]">{d.createdByEmail}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-ink-dim whitespace-nowrap">
                    {timeAgo(d.createdAt)}
                    {(d.planSeconds || d.applySeconds) && (
                      <span className="block text-[11px]">{duration((d.planSeconds ?? 0) + (d.applySeconds ?? 0))}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cursor && (
        <div className="mt-4 text-center">
          <Button size="sm" variant="secondary" onClick={() => void more()} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Show more"}
          </Button>
        </div>
      )}
    </div>
  );
}
