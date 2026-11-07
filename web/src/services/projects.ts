import type { CanvasNode, CanvasEdge } from "../features/canvas/useCanvas";
import { api } from "./api";

export interface ApiProject {
  workspaceId: string;
  projectId: string;
  folderId?: string;
  name: string;
  description: string;
  region: string;
  environment: string;
  status: "draft" | "deployed" | "deploying" | "failed";
  latestVersion: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface DiagramModel {
  version?: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface Draft {
  // Empty for a project that has never been saved.
  etag: string;
  model: DiagramModel;
}

export interface Version {
  projectId: string;
  number: number;
  note?: string;
  createdBy: string;
  createdAt: number;
}

export const DIAGRAM_FORMAT = "canvas/1";

// Terraform generated from a diagram (services/project/export-terraform).
export interface TerraformExport {
  files: { path: string; content: string }[];
  packages: { path: string; packageId: string }[];
  warnings: { nodeId?: string; edgeId?: string; message: string }[];
  // False when the files were too large to show; the .zip has them all.
  preview: boolean;
  // A short-lived link to the .zip.
  url: string;
  fileName: string;
}

const ACCENT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

export function projectAccentColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return ACCENT_COLORS[Math.abs(h) % ACCENT_COLORS.length];
}

const base = (workspaceId: string) => `/workspaces/${encodeURIComponent(workspaceId)}/projects`;
const one = (workspaceId: string, projectId: string) => `${base(workspaceId)}/${encodeURIComponent(projectId)}`;

export const projectsService = {
  list: async (workspaceId: string) => {
    const list = await api.get<ApiProject[]>(base(workspaceId));
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  },

  create: (
    workspaceId: string,
    body: { name: string; description?: string; folderId?: string; region: string; environment: string },
  ) => api.post<ApiProject>(base(workspaceId), body),

  get: (workspaceId: string, projectId: string) => api.get<ApiProject>(one(workspaceId, projectId)),

  // folderId "" takes the project out of its folder.
  update: (workspaceId: string, projectId: string, patch: { name?: string; description?: string; folderId?: string }) =>
    api.patch<ApiProject>(one(workspaceId, projectId), patch),

  delete: (workspaceId: string, projectId: string) => api.delete<unknown>(one(workspaceId, projectId)),

  getDraft: async (workspaceId: string, projectId: string): Promise<Draft> => {
    const draft = await api.get<{ etag?: string; model: DiagramModel }>(`${one(workspaceId, projectId)}/draft`);
    return {
      etag: draft.etag ?? "",
      model: { ...draft.model, nodes: draft.model?.nodes ?? [], edges: draft.model?.edges ?? [] },
    };
  },

  // Saves only if nobody else saved since `etag` was read; otherwise the API
  // answers 409. Returns the new ETag.
  saveDraft: async (workspaceId: string, projectId: string, model: DiagramModel, etag: string) => {
    const headers: Record<string, string> = etag ? { "If-Match": etag } : { "If-None-Match": "*" };
    const out = await api.put<{ etag: string }>(`${one(workspaceId, projectId)}/draft`, model, { headers });
    return out.etag;
  },

  versions: (workspaceId: string, projectId: string) =>
    api.get<Version[]>(`${one(workspaceId, projectId)}/versions`),

  createVersion: (workspaceId: string, projectId: string, note: string) =>
    api.post<Version>(`${one(workspaceId, projectId)}/versions`, { note }),

  // Generates Terraform from the saved draft, or from a version.
  exportTerraform: (workspaceId: string, projectId: string, version?: number) =>
    api.post<TerraformExport>(`${one(workspaceId, projectId)}/terraform`, version ? { version } : {}),
};
