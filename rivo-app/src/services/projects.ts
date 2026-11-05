import type { CanvasNode, CanvasEdge } from "../features/canvas/useCanvas";
import { makeCache } from "../store/appCache";
import { mockDb, delay, type MockProject } from "./mockStore";

// ── API shapes ────────────────────────────────────────────────────────────────

export interface ApiProject {
  projectId:   string;
  name:        string;
  description?: string;
  spaceId:     string;
  environment: string;
  region:      string;
  status:      "draft" | "deployed" | "deploying" | "failed";
  createdAt:   string;
  updatedAt:   string;
}

export interface ApiProjectDetail extends ApiProject {
  model: {
    version?: string;
    nodes:    CanvasNode[];
    edges:    CanvasEdge[];
  };
}

// ── Color helper ──────────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  "#6366f1", "#10b981", "#f59e0b",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

export function projectAccentColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return ACCENT_COLORS[Math.abs(h) % ACCENT_COLORS.length];
}

// ── Cache ─────────────────────────────────────────────────────────────────────

export const projectsCache = makeCache<ApiProject[]>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function toApiProject(project: MockProject): ApiProject {
  const { projectId, name, description, spaceId, environment, region, status, createdAt, updatedAt } = project;
  return { projectId, name, description, spaceId, environment, region, status, createdAt, updatedAt };
}

// ── Service calls ─────────────────────────────────────────────────────────────

export const projectsService = {
  list: () => {
    const projects = mockDb.listProjects().map(toApiProject);
    projectsCache.set(projects);
    return delay({ projects });
  },

  create: (body: {
    name:        string;
    description?: string;
    spaceId:     string;
    region:      string;
    environment: string;
  }) => delay({ project: toApiProject(mockDb.createProject(body)) }),

  get: (projectId: string) => {
    const project = mockDb.getProject(projectId);
    if (!project) return Promise.reject(new Error(`Project ${projectId} not found`));
    return delay({ project: project as ApiProjectDetail });
  },

  update: (projectId: string, nodes: CanvasNode[], edges: CanvasEdge[]) => {
    const project = mockDb.updateProjectModel(projectId, { version: "canvas/1", nodes, edges });
    if (!project) return Promise.reject(new Error(`Project ${projectId} not found`));
    return delay({ project: toApiProject(project) });
  },

  delete: (projectId: string) => {
    mockDb.deleteProject(projectId);
    return delay({ message: "Project deleted" });
  },
};
