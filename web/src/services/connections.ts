import { api } from "./api";

// An AWS account connected to a workspace (services/connection). Rivo keeps
// no credentials: it assumes a role there with the connection's external ID.
export interface Connection {
  workspaceId: string;
  connectionId: string;
  name: string;
  accountId?: string;
  roleArn?: string;
  externalId: string;
  status: "pending" | "verified" | "failed";
  lastError?: string;
  verifiedAt?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  setup: {
    trustedAccount: string;
    trustedRoles: string[];
    roleName: string;
    cloudFormation: string;
  };
}

const base = (workspaceId: string) => `/workspaces/${encodeURIComponent(workspaceId)}/connections`;

export const connectionsService = {
  list: (workspaceId: string) => api.get<Connection[]>(base(workspaceId)),
  create: (workspaceId: string, name: string) => api.post<Connection>(base(workspaceId), { name }),
  verify: (workspaceId: string, connectionId: string, roleArn: string) =>
    api.post<Connection>(`${base(workspaceId)}/${encodeURIComponent(connectionId)}/verify`, { roleArn }),
  delete: (workspaceId: string, connectionId: string) => api.delete<unknown>(`${base(workspaceId)}/${encodeURIComponent(connectionId)}`),
};
