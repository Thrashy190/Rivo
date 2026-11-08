import { api } from "./api";

// Runs of the deployment engine (services/deployment): a plan, an approval,
// and the apply.
export type DeploymentStatus = "queued" | "planning" | "planned" | "applying" | "succeeded" | "failed" | "cancelled";

export interface Deployment {
  workspaceId: string;
  deploymentId: string;
  projectId: string;
  projectName: string;
  connectionId: string;
  connectionName: string;
  accountId: string;
  region: string;
  action: "deploy" | "destroy";
  status: DeploymentStatus;
  summary?: { add: number; change: number; destroy: number };
  error?: string;
  endpoints?: Record<string, Record<string, string>>;
  createdBy: string;
  createdByEmail?: string;
  approvedBy?: string;
  approvedByEmail?: string;
  createdAt: number;
  startedAt?: number;
  plannedAt?: number;
  approvedAt?: number;
  finishedAt?: number;
  updatedAt: number;
  planSeconds?: number;
  applySeconds?: number;
}

export interface PlanChange {
  address: string;
  type: string;
  actions: string[];
}

export interface DeploymentDetail extends Deployment {
  plan?: {
    summary: { add: number; change: number; destroy: number };
    changes: PlanChange[];
    outputs: { name: string; nodeId: string; kind: string }[];
    warnings: { nodeId?: string; message: string }[];
  };
  log: string;
}

export interface DeploymentPage {
  items: Deployment[];
  nextCursor?: string;
  usage?: { month: string; taskSeconds: number; runs: number };
}

export const RUNNING: DeploymentStatus[] = ["queued", "planning", "applying"];
export const FINISHED: DeploymentStatus[] = ["succeeded", "failed", "cancelled"];

const ws = (workspaceId: string) => `/workspaces/${encodeURIComponent(workspaceId)}`;

export const deploymentsService = {
  start: (workspaceId: string, projectId: string, body: { connectionId?: string; action?: "deploy" | "destroy" }) =>
    api.post<Deployment>(`${ws(workspaceId)}/projects/${encodeURIComponent(projectId)}/deployments`, body),

  listForProject: (workspaceId: string, projectId: string, cursor?: string) =>
    api.get<DeploymentPage>(
      `${ws(workspaceId)}/projects/${encodeURIComponent(projectId)}/deployments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),

  list: (workspaceId: string, cursor?: string) =>
    api.get<DeploymentPage>(`${ws(workspaceId)}/deployments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),

  get: (workspaceId: string, deploymentId: string) =>
    api.get<DeploymentDetail>(`${ws(workspaceId)}/deployments/${encodeURIComponent(deploymentId)}`),

  approve: (workspaceId: string, deploymentId: string) =>
    api.post<Deployment>(`${ws(workspaceId)}/deployments/${encodeURIComponent(deploymentId)}/approve`),

  cancel: (workspaceId: string, deploymentId: string) =>
    api.post<Deployment>(`${ws(workspaceId)}/deployments/${encodeURIComponent(deploymentId)}/cancel`),
};

export const STATUS_LABELS: Record<DeploymentStatus, string> = {
  queued: "Starting",
  planning: "Planning",
  planned: "Waiting for approval",
  applying: "Applying",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function duration(seconds?: number): string {
  if (!seconds) return "";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function timeAgo(ms?: number): string {
  if (!ms) return "";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
}
