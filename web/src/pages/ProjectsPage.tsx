import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ProjectsGrid } from "../features/projects/ProjectsGrid";
import type { Project } from "../features/projects/ProjectCard";
import { useWorkspace } from "../features/workspace/workspaceContext";
import { ConfirmDialog, PromptDialog } from "../features/workspace/dialogs";
import { Modal } from "../components/Modal/Modal";
import { Select } from "../components/Select/Select";
import { Button } from "../components/Button/Button";
import { projectsService, projectAccentColor, type ApiProject } from "../services/projects";
import { errorMessage } from "../services/api";
import { timeAgo } from "../utils/time";

type Dialog = { kind: "rename" | "move" | "delete"; project: ApiProject } | null;

function MoveDialog({ project, onClose, onMoved }: { project: ApiProject; onClose: () => void; onMoved: (p: ApiProject) => void }) {
  const { workspace, folders } = useWorkspace();
  const [folderId, setFolderId] = useState(project.folderId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = async () => {
    setBusy(true);
    setError(null);
    try {
      onMoved(await projectsService.update(workspace.id, project.projectId, { folderId }));
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Move ${project.name}`} size="sm">
      <div className="p-5 flex flex-col gap-4">
        <Select label="Folder" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
          <option value="">No folder</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </Select>
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={move} disabled={busy || folderId === (project.folderId ?? "")}>
            {busy ? "Moving…" : "Move"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ProjectsPage() {
  const { folderId } = useParams<{ folderId?: string }>();
  const { workspace, folders, can } = useWorkspace();
  const navigate = useNavigate();

  const [loaded, setLoaded] = useState<{ workspaceId: string; projects: ApiProject[]; error?: string } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    let active = true;
    projectsService
      .list(workspace.id)
      .then((projects) => active && setLoaded({ workspaceId: workspace.id, projects }))
      .catch(
        (err: unknown) =>
          active &&
          setLoaded({ workspaceId: workspace.id, projects: [], error: errorMessage(err, "Could not load the projects.") }),
      );
    return () => {
      active = false;
    };
  }, [workspace.id]);

  // Null while loading, including right after switching workspace.
  const projects = loaded?.workspaceId === workspace.id ? loaded.projects : null;
  const error = loaded?.workspaceId === workspace.id ? loaded.error : undefined;
  const setProjects = (update: (list: ApiProject[]) => ApiProject[]) =>
    setLoaded((prev) => (prev ? { ...prev, projects: update(prev.projects) } : prev));

  const folder = folderId ? folders.find((f) => f.id === folderId) : undefined;
  if (folderId && !folder) {
    return <p className="text-sm text-ink-dim">This folder doesn't exist anymore.</p>;
  }

  const visible = (projects ?? []).filter((p) => !folderId || p.folderId === folderId);
  const byId = new Map(visible.map((p) => [p.projectId, p]));

  const toCard = (p: ApiProject): Project => ({
    id: p.projectId,
    name: p.name,
    description: p.description || undefined,
    status: p.status ?? "draft",
    region: p.region,
    environment: p.environment,
    updatedAt: timeAgo(p.updatedAt),
    accentColor: projectAccentColor(p.projectId),
    href: `/workspaces/${workspace.id}/projects/${p.projectId}`,
  });

  const replace = (updated: ApiProject) =>
    setProjects((list) => list.map((p) => (p.projectId === updated.projectId ? updated : p)));

  const open = (kind: "rename" | "move" | "delete") => (card: Project) => {
    const project = byId.get(card.id);
    return project ? () => setDialog({ kind, project }) : undefined;
  };

  return (
    <>
      {error ? (
        <p role="alert" className="text-sm text-red-500">{error}</p>
      ) : (
        <ProjectsGrid
          title={folder?.name ?? "All projects"}
          projects={visible.map(toCard)}
          loading={projects === null}
          emptyMessage={
            can("projects:create")
              ? "Create a project to start drawing its architecture."
              : "Nobody has created a project here yet."
          }
          onCreate={
            can("projects:create")
              ? () => navigate(`/workspaces/${workspace.id}/projects/new${folderId ? `?folder=${folderId}` : ""}`)
              : undefined
          }
          cardActions={(card) => ({
            onRename: can("projects:update") ? open("rename")(card) : undefined,
            onMove: can("projects:update") ? open("move")(card) : undefined,
            onDelete: can("projects:delete") ? open("delete")(card) : undefined,
          })}
        />
      )}

      {dialog?.kind === "rename" && (
        <PromptDialog
          open
          title="Rename project"
          label="Name"
          initialValue={dialog.project.name}
          submitLabel="Rename"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => replace(await projectsService.update(workspace.id, dialog.project.projectId, { name }))}
        />
      )}

      {dialog?.kind === "move" && (
        <MoveDialog project={dialog.project} onClose={() => setDialog(null)} onMoved={replace} />
      )}

      {dialog?.kind === "delete" && (
        <ConfirmDialog
          open
          title="Delete project"
          confirmLabel="Delete project"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await projectsService.delete(workspace.id, dialog.project.projectId);
            setProjects((list) => list.filter((p) => p.projectId !== dialog.project.projectId));
          }}
        >
          Delete <strong className="text-ink">{dialog.project.name}</strong> with its diagram and all its versions? This
          can't be undone from Rivo.
        </ConfirmDialog>
      )}
    </>
  );
}
