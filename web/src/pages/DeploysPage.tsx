import { useEffect, useState } from "react";
import { ProjectsHeader } from "../features/projects/ProjectsHeader";
import { ProjectsSidebar } from "../features/projects/ProjectsSidebar";
import { GlobalDeploysView } from "../features/projects/GlobalDeploysView";
import { spacesService, spacesCache, type ApiSpace } from "../services/spaces";

export function DeploysPage() {
  const [spaces, setSpaces] = useState<ApiSpace[]>(() =>
    spacesCache.peek() ?? []
  );
  const [loadingSpaces, setLoadingSpaces] = useState(() =>
    spacesCache.isEmpty()
  );

  useEffect(() => {
    if (!spacesCache.isStale()) return;
    const firstLoad = spacesCache.isEmpty();
    if (firstLoad) setLoadingSpaces(true);
    spacesService.list()
      .then((res) => setSpaces(res.spaces))
      .catch(console.error)
      .finally(() => setLoadingSpaces(false));
  }, []);

  return (
    <div className="h-screen flex flex-col bg-page overflow-hidden">
      <ProjectsHeader />

      <div className="flex flex-1 overflow-hidden">
        <ProjectsSidebar spaces={spaces} loadingSpaces={loadingSpaces} />

        <main className="flex-1 overflow-y-auto px-8 py-8">
          <GlobalDeploysView />
        </main>
      </div>
    </div>
  );
}
