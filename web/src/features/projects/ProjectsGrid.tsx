import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { ProjectCard } from "./ProjectCard";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { PlusIcon, SearchIcon, FolderIcon } from "../../components/icons";
import type { Project } from "./ProjectCard";

interface ProjectsGridProps {
  projects: Project[];
  loading?: boolean;
}

function ProjectCardSkeleton() {
  return (
    <div className="bg-card/50 border border-edge/60 rounded-xl p-5 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="pt-4 border-t border-edge/60 flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function ProjectsGrid({ projects, loading = false }: ProjectsGridProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight">All projects</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {loading ? (
              <Skeleton className="h-3 w-20 inline-block" />
            ) : projects.length === 0 ? "No projects yet" : `${projects.length} projects`}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/projects/new")}>
          <PlusIcon />
          New project
        </Button>
      </div>

      <div className="mb-6 max-w-xs">
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          rightElement={<SearchIcon className="w-4 h-4 text-zinc-600" />}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState onCreate={() => navigate("/projects/new")} />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
        <FolderIcon className="w-5 h-5 text-zinc-600" />
      </div>
      <p className="text-sm font-medium text-zinc-400 mb-1">No projects yet</p>
      <p className="text-sm text-zinc-600 mb-6 max-w-xs">
        Create your first project to start building infrastructure visually.
      </p>
      <Button size="sm" onClick={onCreate}>
        <PlusIcon />
        New project
      </Button>
    </div>
  );
}
