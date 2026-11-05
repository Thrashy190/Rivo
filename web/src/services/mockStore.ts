// Temporary in-browser sample data. Nothing in this file talks to a server: the
// UI reads and writes here until each service module is connected to the API in
// services/. The exported shapes (ApiSpace, ApiProject, ApiProjectDetail,
// AuthTokens, ...) are meant to stay stable across that swap.
import type { CanvasNode, CanvasEdge } from "../features/canvas/useCanvas";

export function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const STORAGE_KEY = "rivo_mock_db";

export interface MockSpace {
  spaceId: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockProject {
  projectId: string;
  name: string;
  description?: string;
  spaceId: string;
  environment: string;
  region: string;
  status: "draft" | "deployed" | "deploying" | "failed";
  createdAt: string;
  updatedAt: string;
  model: {
    version?: string;
    nodes: CanvasNode[];
    edges: CanvasEdge[];
  };
}

interface MockDb {
  spaces: MockSpace[];
  projects: MockProject[];
}

const now = () => String(Math.floor(Date.now() / 1000));

function seedDb(): MockDb {
  const spaceId = "space-demo";
  const projectId = "project-demo";
  return {
    spaces: [
      {
        spaceId,
        name: "Demo Space",
        description: "Dummy space — safe to edit or delete.",
        color: "#6366f1",
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    projects: [
      {
        projectId,
        name: "Demo API",
        description: "Sample project preloaded with dummy nodes.",
        spaceId,
        environment: "development",
        region: "us-east-1",
        status: "draft",
        createdAt: now(),
        updatedAt: now(),
        model: {
          version: "1",
          nodes: [
            {
              id: "api-gateway-1",
              type: "api-gateway",
              label: "API Gateway",
              position: { x: 80, y: 160 },
              config: { name: "api-gateway-1", type: "REST", stage: "prod", authorizationType: "NONE" },
              variant: "service",
            },
            {
              id: "lambda-1",
              type: "lambda",
              label: "Lambda Function",
              position: { x: 420, y: 160 },
              config: { name: "lambda-1", runtime: "nodejs20.x", memory: 128, timeout: 30, handler: "index.handler" },
              variant: "service",
            },
            {
              id: "dynamodb-1",
              type: "dynamodb",
              label: "DynamoDB Table",
              position: { x: 760, y: 160 },
              config: { name: "dynamodb-1", billingMode: "PAY_PER_REQUEST", partitionKey: "id", partitionKeyType: "S" },
              variant: "service",
            },
          ],
          edges: [
            {
              id: "edge-api-gateway-1__lambda-1",
              sourceId: "api-gateway-1",
              targetId: "lambda-1",
              config: { method: "ANY", path: "/{proxy+}" },
            },
            { id: "edge-lambda-1__dynamodb-1", sourceId: "lambda-1", targetId: "dynamodb-1" },
          ],
        },
      },
    ],
  };
}

function saveDb(next: MockDb) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (e.g. private mode) — mock state just won't persist
  }
}

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    // fall through to reseed
  }
  const seeded = seedDb();
  saveDb(seeded);
  return seeded;
}

let db = loadDb();

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export const mockDb = {
  listSpaces: (): MockSpace[] => db.spaces,

  getSpace: (spaceId: string): MockSpace | null =>
    db.spaces.find((s) => s.spaceId === spaceId) ?? null,

  createSpace: (input: { name: string; description?: string; color: string }): MockSpace => {
    const space: MockSpace = { spaceId: newId("space"), ...input, createdAt: now(), updatedAt: now() };
    db = { ...db, spaces: [...db.spaces, space] };
    saveDb(db);
    return space;
  },

  updateSpace: (
    spaceId: string,
    patch: Partial<Pick<MockSpace, "name" | "description" | "color">>
  ): MockSpace | null => {
    let updated: MockSpace | null = null;
    db = {
      ...db,
      spaces: db.spaces.map((s) => {
        if (s.spaceId !== spaceId) return s;
        updated = { ...s, ...patch, updatedAt: now() };
        return updated;
      }),
    };
    saveDb(db);
    return updated;
  },

  deleteSpace: (spaceId: string): void => {
    db = { ...db, spaces: db.spaces.filter((s) => s.spaceId !== spaceId) };
    saveDb(db);
  },

  listProjects: (): MockProject[] => db.projects,

  getProject: (projectId: string): MockProject | null =>
    db.projects.find((p) => p.projectId === projectId) ?? null,

  createProject: (input: {
    name: string;
    description?: string;
    spaceId: string;
    region: string;
    environment: string;
  }): MockProject => {
    const project: MockProject = {
      projectId: newId("project"),
      status: "draft",
      createdAt: now(),
      updatedAt: now(),
      model: { version: "1", nodes: [], edges: [] },
      ...input,
    };
    db = { ...db, projects: [...db.projects, project] };
    saveDb(db);
    return project;
  },

  updateProjectModel: (
    projectId: string,
    model: { version?: string; nodes: CanvasNode[]; edges: CanvasEdge[] }
  ): MockProject | null => {
    let updated: MockProject | null = null;
    db = {
      ...db,
      projects: db.projects.map((p) => {
        if (p.projectId !== projectId) return p;
        updated = { ...p, model, updatedAt: now() };
        return updated;
      }),
    };
    saveDb(db);
    return updated;
  },

  deleteProject: (projectId: string): void => {
    db = { ...db, projects: db.projects.filter((p) => p.projectId !== projectId) };
    saveDb(db);
  },
};
