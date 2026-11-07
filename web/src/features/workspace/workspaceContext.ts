import { createContext, useContext } from "react";
import type { Folder } from "../../services/folders";
import type { Workspace, WorkspacePermission } from "../../services/workspaces";

export interface WorkspaceContextValue {
  workspace: Workspace;
  workspaces: Workspace[];
  folders: Folder[];
  can: (permission: WorkspacePermission) => boolean;
  reloadFolders: () => Promise<void>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const LAST_WORKSPACE_KEY = "rivo_last_workspace";

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

// The same as useWorkspace, but null outside a workspace (the header uses it).
export function useOptionalWorkspace(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
