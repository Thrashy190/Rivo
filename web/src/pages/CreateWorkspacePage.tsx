import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { RivoLogo } from "../components/icons";
import { Button } from "../components/Button/Button";
import { Input } from "../components/Input/Input";
import { workspacesService } from "../services/workspaces";
import { errorMessage } from "../services/api";

export function CreateWorkspacePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const workspace = await workspacesService.create(name.trim());
      navigate(`/workspaces/${workspace.id}`);
    } catch (err) {
      setError(errorMessage(err, "Could not create the workspace."));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header className="h-13 border-b border-edge/60 flex items-center px-6 shrink-0">
        <Link to="/" aria-label="Rivo home">
          <RivoLogo className="w-6 h-6" />
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <form className="w-full max-w-md flex flex-col gap-6" onSubmit={submit}>
          <div>
            <h1 className="text-xl font-semibold tracking-tight mb-1">Create a workspace</h1>
            <p className="text-sm text-ink-dim">
              A workspace holds one team's projects, folders and members. You'll be its owner.
            </p>
          </div>

          <Input
            label="Workspace name"
            placeholder="e.g. Acme"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />

          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="sm" type="button" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading || !name.trim()}>
              {loading ? "Creating…" : "Create workspace"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
