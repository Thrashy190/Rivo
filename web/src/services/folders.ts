import { api } from "./api";

export interface Folder {
  workspaceId: string;
  id: string;
  parentId?: string;
  name: string;
  createdBy: string;
  createdAt: number;
}

const base = (workspaceId: string) => `/workspaces/${encodeURIComponent(workspaceId)}/folders`;

export const foldersService = {
  list: async (workspaceId: string) => {
    const list = await api.get<Folder[]>(base(workspaceId));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  },

  create: (workspaceId: string, name: string) => api.post<Folder>(base(workspaceId), { name }),

  delete: (workspaceId: string, folderId: string) =>
    api.delete<unknown>(`${base(workspaceId)}/${encodeURIComponent(folderId)}`),
};
