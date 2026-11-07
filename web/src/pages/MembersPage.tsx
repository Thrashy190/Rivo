import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../components/Button/Button";
import { Input } from "../components/Input/Input";
import { Select } from "../components/Select/Select";
import { Skeleton } from "../components/Skeleton/Skeleton";
import { useAuth } from "../context/AuthContext";
import { useSnackbar } from "../context/SnackbarContext";
import { useWorkspace } from "../features/workspace/workspaceContext";
import { ConfirmDialog } from "../features/workspace/dialogs";
import { errorMessage } from "../services/api";
import { hasPlatformPermission } from "../services/users";
import {
  INVITABLE_ROLES,
  ROLE_LABELS,
  workspacesService,
  type Member,
  type WorkspaceRole,
} from "../services/workspaces";

const ROLE_HINTS: Record<WorkspaceRole, string> = {
  owner: "Everything, including inviting people",
  editor: "Change folders and projects",
  operator: "Read, and run deployments when they exist",
  viewer: "Read only",
};

function InviteForm({ roles, onInvited }: { roles: WorkspaceRole[]; onInvited: (m: Member) => void }) {
  const { workspace } = useWorkspace();
  const { push } = useSnackbar();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>(roles[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const member =
        role === "owner"
          ? await workspacesService.addOwner(workspace.id, email.trim())
          : await workspacesService.invite(workspace.id, email.trim(), role);
      onInvited(member);
      push(`${member.email} was added. New accounts get their password by email.`, "success");
      setEmail("");
    } catch (err) {
      setError(errorMessage(err, "Could not add this person."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border border-edge/60 rounded-xl p-4 bg-card/40 mb-8">
      <p className="text-sm font-medium text-ink mb-1">Invite someone</p>
      <p className="text-xs text-ink-dim mb-4">
        If they don't have a Rivo account yet, one is created and they receive a temporary password by email.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
        <Input
          label="Email"
          type="email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)}>
          {roles.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </Select>
        <Button type="submit" disabled={busy || !email.trim()} className="h-10">
          {busy ? "Inviting…" : "Invite"}
        </Button>
      </div>
      <p className="text-[11px] text-ink-dim mt-2">{ROLE_HINTS[role]}</p>
      {error && <p role="alert" className="text-xs text-red-500 mt-2">{error}</p>}
    </form>
  );
}

export function MembersPage() {
  const { workspace, can } = useWorkspace();
  const { profile } = useAuth();
  const { push } = useSnackbar();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  useEffect(() => {
    let active = true;
    workspacesService
      .members(workspace.id)
      .then((list) => active && setMembers([...list].sort((a, b) => a.email.localeCompare(b.email))))
      .catch((err: unknown) => active && setError(errorMessage(err, "Could not load the members.")));
    return () => {
      active = false;
    };
  }, [workspace.id]);

  const canManage = can("members:manage");
  const managesOwners = hasPlatformPermission(profile, "workspaces:manage");
  const inviteRoles: WorkspaceRole[] = [
    ...(canManage ? INVITABLE_ROLES : []),
    ...(managesOwners ? (["owner"] as const) : []),
  ];

  const canChange = (m: Member) => canManage && m.role !== "owner" && m.userId !== profile?.id;
  const canRemove = (m: Member) => (m.role === "owner" ? managesOwners : canManage) && m.userId !== profile?.id;

  const upsert = (m: Member) =>
    setMembers((list) => {
      const rest = (list ?? []).filter((x) => x.userId !== m.userId);
      return [...rest, m].sort((a, b) => a.email.localeCompare(b.email));
    });

  const changeRole = async (m: Member, role: WorkspaceRole) => {
    try {
      upsert(await workspacesService.changeRole(workspace.id, m.userId, role));
    } catch (err) {
      push(errorMessage(err, "Could not change the role."), "error");
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-base font-semibold tracking-tight">Members</h1>
        <p className="text-xs text-ink-dim mt-0.5">People who can open {workspace.name}, and what each one can do.</p>
      </div>

      {inviteRoles.length > 0 && <InviteForm roles={inviteRoles} onInvited={upsert} />}

      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

      {!error && members === null && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {members && (
        <ul className="border border-edge/60 rounded-xl divide-y divide-edge/60 overflow-hidden">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 px-4 py-3 bg-card/30">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate">
                  {m.email}
                  {m.userId === profile?.id && <span className="text-ink-dim"> (you)</span>}
                </p>
              </div>

              {canChange(m) ? (
                <select
                  aria-label={`Role of ${m.email}`}
                  value={m.role}
                  onChange={(e) => changeRole(m, e.target.value as WorkspaceRole)}
                  className="h-8 rounded-md border border-edge bg-card px-2 text-xs text-ink focus:outline-none"
                >
                  {INVITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-ink-dim border border-edge rounded px-2 py-1">{ROLE_LABELS[m.role]}</span>
              )}

              {canRemove(m) ? (
                <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>Remove</Button>
              ) : (
                <span className="w-[4.5rem]" aria-hidden />
              )}
            </li>
          ))}
        </ul>
      )}

      {removing && (
        <ConfirmDialog
          open
          title={removing.role === "owner" ? "Remove owner" : "Remove member"}
          confirmLabel="Remove"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            if (removing.role === "owner") await workspacesService.removeOwner(workspace.id, removing.userId);
            else await workspacesService.removeMember(workspace.id, removing.userId);
            setMembers((list) => (list ?? []).filter((x) => x.userId !== removing.userId));
          }}
        >
          <strong className="text-ink">{removing.email}</strong> will lose access to {workspace.name}. Their Rivo account
          stays, and so does everything they created.
        </ConfirmDialog>
      )}
    </div>
  );
}
