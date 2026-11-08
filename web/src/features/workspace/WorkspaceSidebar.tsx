import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { ActivityIcon, FolderIcon, LayersIcon, PlusIcon, SettingsIcon, UsersIcon } from "../../components/icons";
import { foldersService, type Folder } from "../../services/folders";
import { errorMessage } from "../../services/api";
import { useSnackbar } from "../../context/SnackbarContext";
import { useWorkspace } from "./workspaceContext";
import { ConfirmDialog } from "./dialogs";

function SidebarLink({ to, icon, label, active, action }: { to: string; icon: ReactNode; label: string; active: boolean; action?: ReactNode }) {
  return (
    <div
      className={[
        "group flex items-center rounded-md text-sm transition-colors",
        active ? "bg-raised text-ink" : "text-ink-dim hover:text-ink hover:bg-card",
      ].join(" ")}
    >
      <Link to={to} className="flex items-center gap-2.5 px-3 py-1.5 flex-1 min-w-0" aria-current={active ? "page" : undefined}>
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </Link>
      {action}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pt-5 pb-1 text-[10px] font-semibold text-ink-dim uppercase tracking-widest">{children}</p>
  );
}

function NewFolderForm({ onDone }: { onDone: () => void }) {
  const { workspace, reloadFolders } = useWorkspace();
  const { push } = useSnackbar();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return onDone();
    setBusy(true);
    try {
      await foldersService.create(workspace.id, name.trim());
      await reloadFolders();
      onDone();
    } catch (err) {
      push(errorMessage(err, "Could not create the folder."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="px-2 py-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !busy && !name.trim() && onDone()}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
        disabled={busy}
        placeholder="Folder name"
        aria-label="Folder name"
        className="h-8 w-full rounded-md border border-edge bg-card px-2.5 text-sm text-ink placeholder:text-ink-dim focus:outline-none"
      />
    </form>
  );
}

export function WorkspaceSidebar() {
  const { workspace, folders, can, reloadFolders } = useWorkspace();
  const location = useLocation();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Folder | null>(null);

  const root = `/workspaces/${workspace.id}`;

  return (
    <aside className="w-56 shrink-0 h-full bg-page border-r border-edge/60 flex flex-col overflow-y-auto">
      <nav className="flex-1 py-3 px-2" aria-label="Workspace">
        <SidebarLink to={root} icon={<LayersIcon />} label="All projects" active={location.pathname === root} />
        <SidebarLink to={`${root}/deployments`} icon={<ActivityIcon />} label="Deployments" active={location.pathname === `${root}/deployments`} />

        <SectionLabel>Folders</SectionLabel>
        {folders.length === 0 && !creating && (
          <p className="px-3 py-1 text-xs text-ink-dim/70">No folders yet</p>
        )}
        {folders.map((folder) => {
          const to = `${root}/folders/${folder.id}`;
          return (
            <SidebarLink
              key={folder.id}
              to={to}
              icon={<FolderIcon />}
              label={folder.name}
              active={location.pathname === to}
              action={
                can("folders:manage") && (
                  <button
                    onClick={() => setDeleting(folder)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 mr-1.5 w-6 h-6 rounded flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-all"
                    aria-label={`Delete folder ${folder.name}`}
                  >
                    <svg viewBox="0 0 14 14" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M3 3l8 8M11 3l-8 8" />
                    </svg>
                  </button>
                )
              }
            />
          );
        })}
        {creating && <NewFolderForm onDone={() => setCreating(false)} />}
        {can("folders:manage") && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-ink-dim hover:text-ink hover:bg-card transition-colors w-full"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New folder</span>
          </button>
        )}

        <SectionLabel>Workspace</SectionLabel>
        <SidebarLink to={`${root}/members`} icon={<UsersIcon />} label="Members" active={location.pathname === `${root}/members`} />
        <SidebarLink to={`${root}/accounts`} icon={<SettingsIcon />} label="AWS accounts" active={location.pathname === `${root}/accounts`} />
      </nav>

      {deleting && (
        <ConfirmDialog
          open
          title="Delete folder"
          confirmLabel="Delete folder"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await foldersService.delete(workspace.id, deleting.id);
            await reloadFolders();
          }}
        >
          Delete <strong className="text-ink">{deleting.name}</strong>? Move its projects out first: a folder with projects
          can't be deleted.
        </ConfirmDialog>
      )}
    </aside>
  );
}
