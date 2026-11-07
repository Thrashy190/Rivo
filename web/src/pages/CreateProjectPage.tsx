import { Link } from "react-router";
import { CreateProjectWizard } from "../features/projects/CreateProjectWizard";
import { RivoLogo } from "../components/icons";
import { useWorkspace } from "../features/workspace/workspaceContext";

export function CreateProjectPage() {
  const { workspace } = useWorkspace();
  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header className="h-12 border-b border-edge/60 flex items-center gap-3 px-6">
        <Link to={`/workspaces/${workspace.id}`} className="flex items-center gap-2" aria-label="Back to the workspace">
          <RivoLogo className="w-6 h-6" />
          <span className="text-sm font-semibold tracking-tight">rivo</span>
        </Link>
        <span className="text-ink-dim/50 text-sm">/</span>
        <span className="text-sm text-ink-dim truncate">{workspace.name}</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <CreateProjectWizard />
      </div>
    </div>
  );
}
