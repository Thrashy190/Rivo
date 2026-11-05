import { Link } from "react-router";
import { RivoLogo } from "../components/icons";
import { CreateSpaceWizard } from "../features/spaces/CreateSpaceWizard";

export function CreateSpacePage() {
  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header className="h-14 border-b border-edge/60 flex items-center px-6 shrink-0">
        <Link to="/projects">
          <RivoLogo className="w-6 h-6" />
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <CreateSpaceWizard />
      </div>
    </div>
  );
}
