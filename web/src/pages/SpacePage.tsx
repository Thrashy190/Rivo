import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { ProjectsHeader } from "../features/projects/ProjectsHeader";
import { ProjectsSidebar } from "../features/projects/ProjectsSidebar";
import { SpaceView } from "../features/spaces/SpaceView";
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

function projectsForSpace(raw: ApiProject[], spaceId: string): Project[] {
  return raw.filter((p) => p.spaceId === spaceId).map(mapProject);
}

export function SpacePage() {
  const { id = "" } = useParams<{ id: string }>();

  // Derive initial state synchronously from cache
  const [spaces, setSpaces] = useState<ApiSpace[]>(() =>
    spacesCache.peek() ?? []
  );
  const [space, setSpace] = useState<ApiSpace | null>(() =>
    spacesCache.peek()?.find((s) => s.spaceId === id) ?? null
  );
  const [projects, setProjects] = useState<Project[]>(() =>
    projectsForSpace(projectsCache.peek() ?? [], id)
  );
  const [loading, setLoading] = useState(() =>
    spacesCache.isEmpty() || projectsCache.isEmpty()
  );

  useEffect(() => {
    if (!spacesCache.isStale() && !projectsCache.isStale()) return;

    const firstLoad = spacesCache.isEmpty() || projectsCache.isEmpty();
    if (firstLoad) setLoading(true);

    Promise.all([spacesService.list(), projectsService.list()])
      .then(([spacesRes, projRes]) => {
        setSpaces(spacesRes.spaces);
        setSpace(spacesRes.spaces.find((s) => s.spaceId === id) ?? null);
        setProjects(projectsForSpace(projRes.projects, id));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="h-screen flex flex-col bg-page overflow-hidden">
      <ProjectsHeader />
      <div className="flex flex-1 overflow-hidden">
        <ProjectsSidebar spaces={spaces} loadingSpaces={loading} />
        <SpaceView
          spaceId={id}
          spaceName={space?.name ?? ""}
          projects={projects}
          loading={loading}
        />
      </div>
    </div>
  );
}
