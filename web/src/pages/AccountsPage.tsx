import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../components/Button/Button";
import { Input } from "../components/Input/Input";
import { Skeleton } from "../components/Skeleton/Skeleton";
import { useSnackbar } from "../context/SnackbarContext";
import { useWorkspace } from "../features/workspace/workspaceContext";
import { ConfirmDialog } from "../features/workspace/dialogs";
import { errorMessage } from "../services/api";
import { connectionsService, type Connection } from "../services/connections";
import { timeAgo } from "../services/deployments";

const STATUS: Record<Connection["status"], { label: string; dot: string }> = {
  pending: { label: "Waiting for the role", dot: "bg-amber-500" },
  verified: { label: "Connected", dot: "bg-emerald-500" },
  failed: { label: "Could not connect", dot: "bg-red-500" },
};

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/x-yaml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      aria-label={`Copy ${label}`}
      className="shrink-0 text-[11px] font-medium text-indigo-500 hover:text-indigo-400 transition-colors"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-28 shrink-0 text-xs text-ink-dim">{label}</span>
      <code className="flex-1 min-w-0 truncate text-xs font-mono text-ink" title={value}>
        {value}
      </code>
      <Copy text={value} label={label} />
    </div>
  );
}

function Setup({ connection, canManage, onChange }: { connection: Connection; canManage: boolean; onChange: (c: Connection) => void }) {
  const { workspace } = useWorkspace();
  const [roleArn, setRoleArn] = useState(connection.roleArn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = `rivo-${connection.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-role.yaml`;
  const stack = "rivo-deploy-role";
  const cli = `aws cloudformation deploy --stack-name ${stack} --template-file ${file} --capabilities CAPABILITY_NAMED_IAM\naws cloudformation describe-stacks --stack-name ${stack} --query "Stacks[0].Outputs[0].OutputValue" --output text`;

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = await connectionsService.verify(workspace.id, connection.connectionId, roleArn.trim());
      onChange(c);
      if (c.status !== "verified") setError(c.lastError ?? "Rivo could not use the role.");
    } catch (err) {
      setError(errorMessage(err, "Could not check the role."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-edge/60 grid gap-5">
      <ol className="grid gap-5">
        <li>
          <p className="text-xs font-semibold text-ink mb-1">1. Create the role in the AWS account</p>
          <p className="text-xs text-ink-dim mb-3 max-w-2xl">
            The template creates the role {connection.setup.roleName}, which only Rivo can assume, and only with this
            connection's external ID. It can manage the services Rivo generates, and IAM roles for its functions.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <Button size="sm" variant="secondary" onClick={() => download(file, connection.setup.cloudFormation)}>
              Download the template
            </Button>
            <a
              href="https://console.aws.amazon.com/cloudformation/home#/stacks/create"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center h-8 px-3 rounded-lg border border-edge text-xs font-medium text-ink hover:bg-raised transition-colors"
            >
              Open CloudFormation ↗
            </a>
          </div>
          <p className="text-[11px] text-ink-dim mb-1.5">Or with the AWS CLI, signed in to that account:</p>
          <div className="relative rounded-lg border border-edge bg-card/60">
            <pre className="p-3 pr-14 text-[11px] leading-relaxed font-mono text-ink overflow-x-auto">{cli}</pre>
            <span className="absolute top-2.5 right-3">
              <Copy text={cli} label="the commands" />
            </span>
          </div>
          <div className="mt-3 grid gap-1.5 rounded-lg border border-edge/60 px-3 py-2.5">
            <Field label="External ID" value={connection.externalId} />
            <Field label="Rivo account" value={connection.setup.trustedAccount} />
          </div>
        </li>

        <li>
          <p className="text-xs font-semibold text-ink mb-1">2. Paste the role's ARN</p>
          <p className="text-xs text-ink-dim mb-3">It is the RoleArn output of the stack.</p>
          <form onSubmit={verify} className="flex flex-col sm:flex-row gap-2 sm:items-start max-w-2xl">
            <div className="flex-1">
              <Input
                aria-label="Role ARN"
                placeholder="arn:aws:iam::123456789012:role/RivoDeploy"
                value={roleArn}
                onChange={(e) => setRoleArn(e.target.value)}
                disabled={!canManage || busy}
                className="font-mono"
              />
            </div>
            <Button type="submit" disabled={!canManage || busy || !roleArn.trim()} className="h-10">
              {busy ? "Checking…" : "Connect"}
            </Button>
          </form>
          {(error ?? connection.lastError) && (
            <p role="alert" className="text-xs text-red-500 mt-2 max-w-2xl">
              {error ?? connection.lastError}
            </p>
          )}
        </li>
      </ol>
    </div>
  );
}

function ConnectionCard({
  connection,
  canManage,
  onChange,
  onDelete,
}: {
  connection: Connection;
  canManage: boolean;
  onChange: (c: Connection) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(connection.status !== "verified");
  const s = STATUS[connection.status];
  return (
    <div className="rounded-xl border border-edge bg-card/40 p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold text-[11px]">AWS</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink truncate">{connection.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-ink-dim">
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
            {connection.accountId && <span className="font-mono">· {connection.accountId}</span>}
            {connection.verifiedAt && connection.status === "verified" && <span>· checked {timeAgo(connection.verifiedAt)}</span>}
          </p>
        </div>
        {canManage && (
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide setup" : connection.status === "verified" ? "Check again" : "Set up"}
          </Button>
        )}
        {canManage && (
          <button
            onClick={onDelete}
            aria-label={`Remove ${connection.name}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-dim hover:text-red-500 hover:bg-red-500/5 transition-colors"
          >
            <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2.5 4h9M5.5 4V2.5h3V4M3.5 4l.5 8h6l.5-8" />
            </svg>
          </button>
        )}
      </div>
      {connection.roleArn && !open && <p className="mt-2 ml-12 text-[11px] font-mono text-ink-dim truncate">{connection.roleArn}</p>}
      {open && canManage && <Setup connection={connection} canManage={canManage} onChange={onChange} />}
    </div>
  );
}

export function AccountsPage() {
  const { workspace, can } = useWorkspace();
  const { push } = useSnackbar();
  const canManage = can("connections:manage");
  const [list, setList] = useState<Connection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Connection | null>(null);

  useEffect(() => {
    let active = true;
    connectionsService
      .list(workspace.id)
      .then((l) => active && setList(l))
      .catch((err: unknown) => active && setError(errorMessage(err, "Could not load the AWS accounts.")));
    return () => {
      active = false;
    };
  }, [workspace.id]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const c = await connectionsService.create(workspace.id, name.trim());
      setList((l) => [...(l ?? []), c]);
      setName("");
    } catch (err) {
      push(errorMessage(err, "Could not add the account."), "error");
    } finally {
      setBusy(false);
    }
  };

  const replace = (c: Connection) => setList((l) => (l ?? []).map((x) => (x.connectionId === c.connectionId ? c : x)));

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold text-ink">AWS accounts</h1>
      <p className="text-sm text-ink-dim mt-1 mb-6 max-w-2xl">
        Where this workspace's projects are deployed. Rivo keeps no keys: it assumes a role you create in each account,
        and every deployment shows its plan for someone to approve before anything changes.
      </p>

      {canManage && (
        <form onSubmit={create} className="border border-edge/60 rounded-xl p-4 bg-card/40 mb-6">
          <p className="text-sm font-medium text-ink mb-3">Connect an account</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <Input label="Name" placeholder="Production" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <Button type="submit" disabled={busy || !name.trim()} className="h-10">
              {busy ? "Adding…" : "Continue"}
            </Button>
          </div>
        </form>
      )}

      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : list === null ? (
        <div className="grid gap-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge p-8 text-center">
          <p className="text-sm text-ink">No AWS accounts yet</p>
          <p className="text-xs text-ink-dim mt-1">
            {canManage ? "Name one above to get the role to create in it." : "An owner of the workspace can connect one."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((c) => (
            <ConnectionCard key={c.connectionId} connection={c} canManage={canManage} onChange={replace} onDelete={() => setDeleting(c)} />
          ))}
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          open
          title="Remove the account"
          confirmLabel="Remove"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await connectionsService.delete(workspace.id, deleting.connectionId);
            setList((l) => (l ?? []).filter((x) => x.connectionId !== deleting.connectionId));
          }}
        >
          Remove <strong className="text-ink">{deleting.name}</strong> from the workspace? Projects deployed there must be
          destroyed first. Delete the role in AWS too.
        </ConfirmDialog>
      )}
    </div>
  );
}
