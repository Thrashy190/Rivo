import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { workspacesService, type Workspace } from "../services/workspaces";
import { errorMessage } from "../services/api";
import { LAST_WORKSPACE_KEY } from "../features/workspace/workspaceContext";
import { FullPageMessage } from "../features/workspace/FullPageMessage";

function lastWorkspace(): string | null {
  try {
    return localStorage.getItem(LAST_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

// Opens the workspace used last, or the list when there is no obvious one.
export function HomePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workspacesService
      .list()
      .then(setWorkspaces)
      .catch((err: unknown) => setError(errorMessage(err, "Could not load your workspaces.")));
  }, []);

  if (error) return <FullPageMessage title="Rivo can't load your workspaces" message={error} />;
  if (!workspaces) return <FullPageMessage title="Loading…" />;

  const last = lastWorkspace();
  const target = workspaces.find((w) => w.id === last) ?? (workspaces.length === 1 ? workspaces[0] : undefined);
  return <Navigate to={target ? `/workspaces/${target.id}` : "/workspaces"} replace />;
}
