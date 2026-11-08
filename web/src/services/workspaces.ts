import { api } from "./api";
import { makeCache } from "../store/appCache";

export type WorkspaceRole = "owner" | "editor" | "operator" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  // The caller's role. A platform administrator who is not a member reads it
  // as a viewer.
  role: WorkspaceRole;
}

export interface Member {
  workspaceId: string;
  userId: string;
  email: string;
  role: WorkspaceRole;
  createdAt: number;
  updatedAt: number;
}

// Mirrors rolePermissions in services/shared/models/workspace. The API is what
// enforces them; the app only uses this to hide what a role cannot do.
const ROLE_PERMISSIONS: Record<WorkspaceRole, string[]> = {
  owner: ["*"],
  editor: [
    "workspace:read", "members:read", "folders:manage",
    "projects:read", "projects:create", "projects:update", "projects:delete",
    "deployments:run",
  ],
  operator: ["workspace:read", "members:read", "projects:read", "deployments:run"],
  viewer: ["workspace:read", "members:read", "projects:read"],
};

export type WorkspacePermission =
  | "members:manage"
  | "folders:manage"
  | "projects:create"
  | "projects:update"
  | "projects:delete"
  | "deployments:run"
  | "connections:manage";

export function can(role: WorkspaceRole | undefined, permission: WorkspacePermission): boolean {
  const perms = role ? ROLE_PERMISSIONS[role] : [];
  return perms.includes("*") || perms.includes(permission);
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  editor: "Editor",
  operator: "Operator",
  viewer: "Viewer",
};

// Roles an owner can invite. New owners come from a platform administrator.
export const INVITABLE_ROLES: WorkspaceRole[] = ["editor", "operator", "viewer"];

export const workspacesCache = makeCache<Workspace[]>();

const base = (workspaceId: string) => `/workspaces/${encodeURIComponent(workspaceId)}`;

export const workspacesService = {
  list: async () => {
    const list = await api.get<Workspace[]>("/workspaces");
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
    workspacesCache.set(sorted);
    return sorted;
  },

  create: async (name: string) => {
    const created = await api.post<Omit<Workspace, "role">>("/workspaces", { name });
    workspacesCache.invalidate();
    return { ...created, role: "owner" as const };
  },

  members: (workspaceId: string) => api.get<Member[]>(`${base(workspaceId)}/members`),

  invite: (workspaceId: string, email: string, role: WorkspaceRole) =>
    api.post<Member>(`${base(workspaceId)}/members`, { email, role }),

  changeRole: (workspaceId: string, userId: string, role: WorkspaceRole) =>
    api.patch<Member>(`${base(workspaceId)}/members/${encodeURIComponent(userId)}`, { role }),

  removeMember: (workspaceId: string, userId: string) =>
    api.delete<unknown>(`${base(workspaceId)}/members/${encodeURIComponent(userId)}`),

  // Platform administrators only.
  addOwner: (workspaceId: string, email: string) =>
    api.post<Member>(`${base(workspaceId)}/owners`, { email }),

  removeOwner: (workspaceId: string, userId: string) =>
    api.delete<unknown>(`${base(workspaceId)}/owners/${encodeURIComponent(userId)}`),
};
