import { useEffect, useState, type ReactNode } from "react";
import { Outlet, useParams } from "react-router";
import { foldersService, type Folder } from "../../services/folders";
import { can, workspacesCache, workspacesService, type Workspace } from "../../services/workspaces";
import { errorMessage } from "../../services/api";
import { FullPageMessage } from "./FullPageMessage";
import { LAST_WORKSPACE_KEY, WorkspaceContext, type WorkspaceContextValue } from "./workspaceContext";

interface Loaded {
  workspaceId: string;
  workspaces: Workspace[];
  folders: Folder[];
  error?: string;
}

// Loads the workspace in the URL, and its folders, for every page inside it.
export function WorkspaceProvider({ children }: { children?: ReactNode }) {
  const { workspaceId = "" } = useParams<{ workspaceId: string }>();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    const cached = workspacesCache.peek();
    const list = cached && !workspacesCache.isStale() ? Promise.resolve(cached) : workspacesService.list();
    Promise.all([list, foldersService.list(workspaceId)])
      .then(([workspaces, folders]) => active && setLoaded({ workspaceId, workspaces, folders }))
      .catch(
        (err: unknown) =>
          active &&
          setLoaded({ workspaceId, workspaces: [], folders: [], error: errorMessage(err, "Could not load this workspace.") }),
      );
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const current = loaded?.workspaceId === workspaceId ? loaded : null;
  const workspace = current?.workspaces.find((w) => w.id === workspaceId);

  useEffect(() => {
    if (!workspace) return;
    try {
      localStorage.setItem(LAST_WORKSPACE_KEY, workspace.id);
    } catch {
      // Only a convenience for the next visit.
    }
  }, [workspace]);

  if (!current) return <FullPageMessage title="Loading…" />;
  // A workspace you are not in answers 404, the same as one that does not exist.
  if (current.error && !/not found/i.test(current.error)) {
    return <FullPageMessage title="This workspace isn't available" message={current.error} />;
  }
  if (!workspace) {
    return (
      <FullPageMessage
        title="Workspace not found"
        message="It doesn't exist, or you aren't a member. Ask its owner for an invitation."
      />
    );
  }

  const value: WorkspaceContextValue = {
    workspace,
    workspaces: current.workspaces,
    folders: current.folders,
    can: (permission) => can(workspace.role, permission),
    reloadFolders: async () => {
      const folders = await foldersService.list(workspace.id);
      setLoaded((prev) => (prev && prev.workspaceId === workspace.id ? { ...prev, folders } : prev));
    },
  };

  return <WorkspaceContext.Provider value={value}>{children ?? <Outlet />}</WorkspaceContext.Provider>;
}
