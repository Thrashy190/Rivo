import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/Button/Button";
import { useSnackbar } from "../../context/SnackbarContext";
import { errorMessage } from "../../services/api";
import { connectionsService, type Connection } from "../../services/connections";
import {
  deploymentsService,
  duration,
  FINISHED,
  RUNNING,
  timeAgo,
  type Deployment,
  type DeploymentDetail,
  type PlanChange,
} from "../../services/deployments";
import type { ApiProject } from "../../services/projects";
import { getServiceIcon } from "../canvas/aws-services";
import type { CanvasNode } from "../canvas/useCanvas";
import { LogView } from "./LogView";
import { StatusBadge, SummaryChips } from "./StatusBadge";

interface DeployPanelProps {
  workspaceId: string;
  project: ApiProject;
  nodes: CanvasNode[];
  isDirty: boolean;
  canSave: boolean;
  canDeploy: boolean;
  initialDeploymentId?: string;
  onSave: () => Promise<boolean>;
  // The project changed on the server: a deployment started or finished.
  onProjectChanged: () => void;
  onSelectNode: (id: string) => void;
  onClose: () => void;
}

const POLL_RUNNING = 2000;
const POLL_WAITING = 6000;

export function DeployPanel({
  workspaceId,
  project,
  nodes,
  isDirty,
  canSave,
  canDeploy,
  initialDeploymentId,
  onSave,
  onProjectChanged,
  onSelectNode,
  onClose,
}: DeployPanelProps) {
  const { push } = useSnackbar();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [history, setHistory] = useState<Deployment[] | null>(null);
  const [historyRun, setHistoryRun] = useState(0);
  const [chosen, setChosen] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(initialDeploymentId ?? project.activeDeployment ?? project.lastDeployment);
  const [detail, setDetail] = useState<DeploymentDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  // Bumped to follow the selected deployment again after acting on it.
  const [follow, setFollow] = useState(0);

  useEffect(() => {
    connectionsService
      .list(workspaceId)
      .then(setConnections)
      .catch(() => setConnections([]));
  }, [workspaceId]);

  useEffect(() => {
    let active = true;
    deploymentsService
      .listForProject(workspaceId, project.projectId)
      .then((page) => active && setHistory(page.items))
      .catch(() => active && setHistory([]));
    return () => {
      active = false;
    };
  }, [workspaceId, project.projectId, historyRun]);

  // Follows the selected deployment until it finishes.
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let last = "";
    const load = async () => {
      try {
        const d = await deploymentsService.get(workspaceId, selectedId);
        if (!active) return;
        setDetail(d);
        if (last && last !== d.status) {
          setHistoryRun((n) => n + 1);
          if (FINISHED.includes(d.status)) onProjectChanged();
        }
        last = d.status;
        if (!FINISHED.includes(d.status)) timer = setTimeout(load, RUNNING.includes(d.status) ? POLL_RUNNING : POLL_WAITING);
      } catch (err) {
        if (active) push(errorMessage(err, "Could not load the deployment."), "error");
      }
    };
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [workspaceId, selectedId, follow, onProjectChanged, push]);

  const verified = useMemo(() => (connections ?? []).filter((c) => c.status === "verified"), [connections]);
  const target = project.connectionId ? (connections ?? []).find((c) => c.connectionId === project.connectionId) : verified.find((c) => c.connectionId === chosen) ?? verified[0];
  const shown = detail && detail.deploymentId === selectedId ? detail : null;
  const busyProject = Boolean(project.activeDeployment) || (shown ? !FINISHED.includes(shown.status) : false);

  const start = async (action: "deploy" | "destroy") => {
    if (!target) return;
    if (action === "deploy" && isDirty) {
      if (!canSave || !(await onSave())) return;
    }
    setBusy(action);
    try {
      const d = await deploymentsService.start(workspaceId, project.projectId, { connectionId: target.connectionId, action });
      setDetail(null);
      setSelectedId(d.deploymentId);
      setHistoryRun((n) => n + 1);
      onProjectChanged();
    } catch (err) {
      push(errorMessage(err, "Could not start the deployment."), "error");
    } finally {
      setBusy(null);
    }
  };

  const act = async (what: "approve" | "cancel") => {
    if (!shown) return;
    setBusy(what);
    try {
      const d = what === "approve" ? await deploymentsService.approve(workspaceId, shown.deploymentId) : await deploymentsService.cancel(workspaceId, shown.deploymentId);
      setDetail({ ...shown, ...d });
      setHistoryRun((n) => n + 1);
      onProjectChanged();
      // Picks up the new status, and keeps polling while it applies.
      setFollow((n) => n + 1);
    } catch (err) {
      push(errorMessage(err, what === "approve" ? "Could not approve the plan." : "Could not discard the plan."), "error");
    } finally {
      setBusy(null);
    }
  };

  const nodeName = useCallback((id: string) => nodes.find((n) => n.id === id), [nodes]);

  return (
    <aside aria-label="Deploy" className="absolute top-0 right-0 bottom-0 z-30 w-[480px] max-w-full bg-page border-l border-edge shadow-2xl flex flex-col">
      <header className="flex items-center gap-3 px-5 h-14 border-b border-edge shrink-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 13V3M4 7l4-4 4 4M3 14h10" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink">Deploy</p>
          <p className="text-[11px] text-ink-dim truncate">
            {project.connectionId && target
              ? `In ${target.name} · ${target.accountId} · ${project.region}`
              : `Plan, review and apply to an AWS account · ${project.region}`}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors"
        >
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Start */}
        <section className="px-5 py-4 border-b border-edge">
          {connections === null ? (
            <p className="text-xs text-ink-dim">Loading the AWS accounts…</p>
          ) : !project.connectionId && verified.length === 0 ? (
            <div className="rounded-xl border border-dashed border-edge p-4">
              <p className="text-sm font-medium text-ink">Connect an AWS account first</p>
              <p className="text-xs text-ink-dim mt-1 mb-3">Rivo deploys by assuming a role you create in the account. It takes a minute.</p>
              <Link to={`/workspaces/${workspaceId}/accounts`} className="text-xs font-medium text-indigo-500 hover:text-indigo-400">
                Go to AWS accounts →
              </Link>
            </div>
          ) : (
            <>
              {!project.connectionId && verified.length > 1 && (
                <label className="block mb-3">
                  <span className="text-[11px] font-medium text-ink-dim">Account</span>
                  <select
                    value={target?.connectionId ?? ""}
                    onChange={(e) => setChosen(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-edge bg-page px-2.5 text-sm text-ink"
                  >
                    {verified.map((c) => (
                      <option key={c.connectionId} value={c.connectionId}>
                        {c.name} · {c.accountId}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!project.connectionId && verified.length === 1 && target && (
                <p className="text-xs text-ink-dim mb-3">
                  To <span className="text-ink font-medium">{target.name}</span> <span className="font-mono">· {target.accountId}</span>
                </p>
              )}
              <Button className="w-full" onClick={() => void start("deploy")} disabled={!canDeploy || !target || busyProject || busy !== null}>
                {busy === "deploy" ? "Starting…" : isDirty ? "Save and plan" : "Plan the deployment"}
              </Button>
              <p className="mt-2 text-[11px] leading-snug text-ink-dim">
                {!canDeploy
                  ? "Your role can see deployments but not run them."
                  : busyProject
                    ? "A deployment is in progress. Finish or discard it to start another."
                    : "Nothing changes in AWS until you approve the plan."}
              </p>
            </>
          )}
        </section>

        {/* The selected deployment */}
        {selectedId && !shown && <p className="px-5 py-4 text-xs text-ink-dim">Loading the deployment…</p>}
        {shown && (
          <section aria-label="Selected deployment" data-deployment-id={shown.deploymentId} className="px-5 py-4 border-b border-edge">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={shown.status} />
              <span className="text-xs font-medium text-ink">{shown.action === "destroy" ? "Destroy" : "Deploy"}</span>
              <span className="ml-auto"><SummaryChips summary={shown.summary} /></span>
            </div>
            <p className="text-[11px] text-ink-dim">
              {shown.createdByEmail ?? "Someone"} · {timeAgo(shown.createdAt)}
              {shown.planSeconds ? ` · planned in ${duration(shown.planSeconds)}` : ""}
              {shown.applySeconds ? ` · applied in ${duration(shown.applySeconds)}` : ""}
              {shown.approvedByEmail && shown.status !== "cancelled" ? ` · approved by ${shown.approvedByEmail}` : ""}
            </p>

            <Steps status={shown.status} action={shown.action} approved={Boolean(shown.approvedAt)} />

            {shown.status === "planned" && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
                <p className="text-xs text-ink">
                  {shown.action === "destroy"
                    ? `This removes ${shown.summary?.destroy ?? 0} resources from ${shown.connectionName}.`
                    : `Review the changes below. Applying them changes ${shown.connectionName} (${shown.accountId}).`}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant={shown.action === "destroy" ? "danger" : "primary"} onClick={() => void act("approve")} disabled={!canDeploy || busy !== null}>
                    {busy === "approve" ? "Approving…" : shown.action === "destroy" ? "Approve and destroy" : "Approve and apply"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void act("cancel")} disabled={!canDeploy || busy !== null}>
                    Discard
                  </Button>
                </div>
              </div>
            )}

            {shown.status === "failed" && shown.error && (
              <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3">
                <pre className="text-[11px] leading-relaxed text-ink whitespace-pre-wrap font-mono max-h-48 overflow-auto">{shown.error}</pre>
              </div>
            )}

            {shown.status === "succeeded" && shown.action === "deploy" && (
              <Endpoints endpoints={shown.endpoints ?? {}} nodeName={nodeName} onSelectNode={onSelectNode} />
            )}

            {shown.plan && shown.plan.changes.length > 0 && <Changes changes={shown.plan.changes} />}
            {shown.plan && shown.plan.warnings.length > 0 && (
              <details className="mt-3">
                <summary className="text-[11px] text-ink-dim cursor-pointer">
                  {shown.plan.warnings.length} note{shown.plan.warnings.length === 1 ? "" : "s"} from the generator
                </summary>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {shown.plan.warnings.map((w, i) => (
                    <li key={i} className="text-[11px] leading-snug text-ink-dim">
                      {w.nodeId ? (
                        <button onClick={() => onSelectNode(w.nodeId!)} className="text-left hover:text-ink underline decoration-dotted underline-offset-2">
                          {w.message}
                        </button>
                      ) : (
                        w.message
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="mt-4 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-dim">Engine log</p>
            <div className="h-72">
              <LogView log={shown.log} live={RUNNING.includes(shown.status)} />
            </div>
          </section>
        )}

        {/* History */}
        <section className="px-5 py-4 border-b border-edge">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-dim">History</p>
          {history === null ? (
            <p className="text-xs text-ink-dim">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-ink-dim">No deployments yet.</p>
          ) : (
            <ul className="flex flex-col">
              {history.map((d) => (
                <li key={d.deploymentId}>
                  <button
                    onClick={() => setSelectedId(d.deploymentId)}
                    aria-current={d.deploymentId === selectedId}
                    className={[
                      "w-full flex items-center gap-2.5 px-2 py-2 -mx-2 rounded-lg text-left transition-colors",
                      d.deploymentId === selectedId ? "bg-indigo-500/[0.07]" : "hover:bg-card",
                    ].join(" ")}
                  >
                    <StatusBadge status={d.status} />
                    <span className="text-xs text-ink">{d.action === "destroy" ? "Destroy" : "Deploy"}</span>
                    <SummaryChips summary={d.summary} />
                    <span className="ml-auto text-[11px] text-ink-dim whitespace-nowrap">{timeAgo(d.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Destroy */}
        {project.connectionId && canDeploy && (
          <section className="px-5 py-4">
            <p className="mb-1 text-xs font-medium text-ink">Destroy the infrastructure</p>
            <p className="mb-3 text-[11px] leading-snug text-ink-dim">
              Plans the removal of everything this project created in {target?.name ?? "the account"}. You review it before anything is removed.
            </p>
            {confirmDestroy ? (
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => void start("destroy")} disabled={busyProject || busy !== null}>
                  {busy === "destroy" ? "Starting…" : "Plan the destroy"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDestroy(false)}>
                  Keep it
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setConfirmDestroy(true)} disabled={busyProject}>
                Destroy…
              </Button>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}

function Steps({ status, action, approved }: { status: DeploymentDetail["status"]; action: "deploy" | "destroy"; approved: boolean }) {
  const steps = ["Plan", "Approve", action === "destroy" ? "Destroy" : "Apply"];
  // A failure stops at the step it happened in: the plan, or the apply once approved.
  const failedAt = status === "failed" ? (approved ? 2 : 0) : -1;
  const at =
    status === "queued" || status === "planning" ? 0 : status === "planned" ? 1 : status === "applying" ? 2 : status === "failed" ? failedAt : status === "cancelled" ? 1 : 3;
  return (
    <ol className="mt-3 flex items-center gap-1.5" aria-label="Progress">
      {steps.map((s, i) => {
        const done = at > i;
        const failed = failedAt === i;
        const current = at === i && !failed && status !== "cancelled";
        return (
          <li key={s} className="flex items-center gap-1.5 flex-1">
            <span
              className={[
                "h-1 flex-1 rounded-full",
                done ? "bg-emerald-500" : failed ? "bg-red-500" : current ? (status === "planned" ? "bg-amber-500" : "bg-indigo-500 animate-pulse") : "bg-raised",
              ].join(" ")}
            />
            <span className={["text-[10px] font-medium", done ? "text-ink" : failed ? "text-red-500" : current ? "text-indigo-500" : "text-ink-dim"].join(" ")}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

const ACTION_STYLE: Record<string, { label: string; cls: string }> = {
  create: { label: "+", cls: "text-emerald-600 dark:text-emerald-400" },
  update: { label: "~", cls: "text-amber-600 dark:text-amber-400" },
  delete: { label: "−", cls: "text-red-600 dark:text-red-400" },
  replace: { label: "±", cls: "text-amber-600 dark:text-amber-400" },
};

function Changes({ changes }: { changes: PlanChange[] }) {
  const kind = (c: PlanChange) => (c.actions.length === 2 ? "replace" : c.actions[0]);
  return (
    <details className="mt-4" open={changes.length <= 12}>
      <summary className="text-[11px] font-medium text-ink cursor-pointer">
        {changes.length} resource{changes.length === 1 ? "" : "s"} change
      </summary>
      <ul className="mt-2 rounded-lg border border-edge divide-y divide-edge/60 max-h-64 overflow-y-auto">
        {changes.map((c) => {
          const k = ACTION_STYLE[kind(c)] ?? ACTION_STYLE.update;
          return (
            <li key={c.address} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-mono">
              <span className={`w-3 text-center font-bold ${k.cls}`} title={kind(c)}>
                {k.label}
              </span>
              <span className="text-ink truncate" title={c.address}>
                {c.address}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

const KIND_LABELS: Record<string, string> = { url: "URL", function_name: "Function", table_name: "Table", bucket: "Bucket" };

function Endpoints({
  endpoints,
  nodeName,
  onSelectNode,
}: {
  endpoints: Record<string, Record<string, string>>;
  nodeName: (id: string) => CanvasNode | undefined;
  onSelectNode: (id: string) => void;
}) {
  const rows = Object.entries(endpoints).flatMap(([nodeId, kinds]) => Object.entries(kinds).map(([kind, value]) => ({ nodeId, kind, value })));
  if (rows.length === 0) return null;
  const urls = rows.filter((r) => r.kind === "url");
  const rest = rows.filter((r) => r.kind !== "url");
  return (
    <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-3">
      <p className="text-xs font-medium text-ink mb-2">Live</p>
      <ul className="flex flex-col gap-1.5">
        {[...urls, ...rest].map((r) => {
          const n = nodeName(r.nodeId);
          return (
            <li key={`${r.nodeId}-${r.kind}`} className="flex items-center gap-2 min-w-0">
              <button onClick={() => onSelectNode(r.nodeId)} className="w-5 h-5 rounded overflow-hidden shrink-0" title={String(n?.config.name ?? r.nodeId)}>
                {n && getServiceIcon(n.type)}
              </button>
              <span className="text-[11px] text-ink-dim w-16 shrink-0">{KIND_LABELS[r.kind] ?? r.kind}</span>
              {r.kind === "url" ? (
                <a href={r.value} target="_blank" rel="noreferrer" className="text-[11px] font-mono text-indigo-500 hover:underline truncate">
                  {r.value}
                </a>
              ) : (
                <code className="text-[11px] font-mono text-ink truncate">{r.value}</code>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
