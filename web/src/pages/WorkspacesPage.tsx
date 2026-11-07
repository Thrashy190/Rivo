import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppHeader } from "../features/workspace/AppHeader";
import { Button } from "../components/Button/Button";
import { Skeleton } from "../components/Skeleton/Skeleton";
import { PlusIcon } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { hasPlatformPermission, isPlatformAdmin } from "../services/users";
import { ROLE_LABELS, workspacesService, type Workspace } from "../services/workspaces";
import { errorMessage } from "../services/api";
import { projectAccentColor } from "../services/projects";

export function WorkspacesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workspacesService
      .list()
      .then(setWorkspaces)
      .catch((err: unknown) => setError(errorMessage(err, "Could not load your workspaces.")));
  }, []);

  const canCreate = hasPlatformPermission(profile, "workspaces:create");

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <AppHeader />
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Workspaces</h1>
            <p className="text-xs text-ink-dim mt-0.5">
              {isPlatformAdmin(profile)
                ? "Every workspace in this installation. You can read them all, and change those you belong to."
                : "The workspaces you belong to."}
            </p>
          </div>
          {canCreate && (
            <Button size="sm" onClick={() => navigate("/workspaces/new")}>
              <PlusIcon />
              New workspace
            </Button>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

        {!error && workspaces === null && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        )}

        {workspaces?.length === 0 && (
          <div className="border border-dashed border-edge rounded-xl py-14 px-6 text-center">
            <p className="text-sm font-medium text-ink">You aren't in any workspace yet</p>
            <p className="text-sm text-ink-dim mt-1 max-w-sm mx-auto">
              {canCreate
                ? "Create one for your team, then invite people to it."
                : "Ask a workspace owner to invite you, then sign in again."}
            </p>
          </div>
        )}

        {workspaces && workspaces.length > 0 && (
          <ul className="flex flex-col gap-2">
            {workspaces.map((w) => (
              <li key={w.id}>
                <Link
                  to={`/workspaces/${w.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-edge/60 bg-card/40 hover:bg-card hover:border-edge transition-colors"
                >
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: projectAccentColor(w.id) }} />
                  <span className="text-sm font-medium text-ink flex-1 truncate">{w.name}</span>
                  <span className="text-[11px] text-ink-dim border border-edge rounded px-1.5 py-0.5">
                    {ROLE_LABELS[w.role]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
