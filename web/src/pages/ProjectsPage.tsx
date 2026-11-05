import { useEffect, useState } from "react";
import { ProjectsHeader } from "../features/projects/ProjectsHeader";
import { ProjectsSidebar } from "../features/projects/ProjectsSidebar";
import { TemplatesStrip } from "../features/projects/TemplatesStrip";
import { ProjectsGrid } from "../features/projects/ProjectsGrid";
import type { Project } from "../features/projects/ProjectCard";
import { projectsService, projectsCache, projectAccentColor, type ApiProject } from "../services/projects";
import { spacesService, spacesCache, type ApiSpace } from "../services/spaces";

function timeAgo(unixSeconds: number): string {
  const diff = Date.now() - unixSeconds * 1000;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

function mapProject(p: ApiProject): Project {
  return {
    id:            p.projectId,
    name:          p.name,
    description:   p.description,
    status:        p.status ?? "draft",
    region:        p.region,
    resourceCount: 0,
    updatedAt:     timeAgo(Number(p.updatedAt)),
    accentColor:   projectAccentColor(p.projectId),
  };
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(() =>
    (projectsCache.peek() ?? []).map(mapProject)
  );
  const [spaces, setSpaces] = useState<ApiSpace[]>(() =>
    spacesCache.peek() ?? []
  );
  const [loading, setLoading] = useState(() =>
    projectsCache.isEmpty() || spacesCache.isEmpty()
  );

  useEffect(() => {
    if (!projectsCache.isStale() && !spacesCache.isStale()) return;

    Promise.all([projectsService.list(), spacesService.list()])
      .then(([projRes, spaceRes]) => {
        setProjects(projRes.projects.map(mapProject));
        setSpaces(spaceRes.spaces);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-screen flex flex-col bg-page overflow-hidden">
      <ProjectsHeader />

      <div className="flex flex-1 overflow-hidden">
        <ProjectsSidebar spaces={spaces} loadingSpaces={loading} />

        <main className="flex-1 overflow-y-auto px-8 py-8">
          <TemplatesStrip />
          <ProjectsGrid projects={projects} loading={loading} />
        </main>
      </div>
    </div>
  );
}
