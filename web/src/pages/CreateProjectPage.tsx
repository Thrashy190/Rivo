import { Link } from "react-router";
import { CreateProjectWizard } from "../features/projects/CreateProjectWizard";
import { RivoLogo } from "../components/icons";

export function CreateProjectPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Minimal header */}
      <header className="h-12 border-b border-zinc-800/60 flex items-center px-6">
        <Link to="/projects" className="flex items-center gap-2">
          <RivoLogo className="w-6 h-6" />
          <span className="text-sm font-semibold tracking-tight">rivo</span>
        </Link>
      </header>

      {/* Centered wizard */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <CreateProjectWizard />
      </div>
    </div>
  );
}
