import { useState } from "react";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { ProjectCard, type ProjectCardProps } from "./ProjectCard";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { PlusIcon, SearchIcon, FolderIcon } from "../../components/icons";
import type { Project } from "./ProjectCard";

interface ProjectsGridProps {
  title: string;
  projects: Project[];
  loading?: boolean;
  // Shown when the role can create projects.
  onCreate?: () => void;
  emptyMessage?: string;
  cardActions?: (project: Project) => Pick<ProjectCardProps, "onRename" | "onMove" | "onDelete">;
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

export function ProjectsGrid({
  title,
  projects,
  loading = false,
  onCreate,
  emptyMessage = "Create your first project to start building infrastructure visually.",
  cardActions,
}: ProjectsGridProps) {
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
          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
          <div className="text-xs text-ink-dim mt-0.5">
            {loading ? (
              <Skeleton className="h-3 w-20 inline-block" />
            ) : projects.length === 0 ? "No projects yet" : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
          </div>
        </div>
        {onCreate && (
          <Button size="sm" onClick={onCreate}>
            <PlusIcon />
            New project
          </Button>
        )}
      </div>

      <div className="mb-6 max-w-xs">
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          rightElement={<SearchIcon className="w-4 h-4 text-ink-dim" />}
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
            <ProjectCard key={project.id} project={project} {...cardActions?.(project)} />
          ))}
        </div>
      ) : search ? (
        <p className="py-16 text-center text-sm text-ink-dim">No projects match “{search}”.</p>
      ) : (
        <EmptyState message={emptyMessage} onCreate={onCreate} />
      )}
    </div>
  );
}

function EmptyState({ message, onCreate }: { message: string; onCreate?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-xl bg-card border border-edge flex items-center justify-center mb-4">
        <FolderIcon className="w-5 h-5 text-ink-dim" />
      </div>
      <p className="text-sm font-medium text-ink-dim mb-1">No projects yet</p>
      <p className="text-sm text-ink-dim mb-6 max-w-xs">
        {message}
      </p>
      {onCreate && (
        <Button size="sm" onClick={onCreate}>
          <PlusIcon />
          New project
        </Button>
      )}
    </div>
  );
}
