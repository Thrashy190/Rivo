import { useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { ProjectCard } from "../projects/ProjectCard";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { PlusIcon, FolderIcon, SearchIcon } from "../../components/icons";
import { useState } from "react";
import type { Project } from "../projects/ProjectCard";

interface SpaceViewProps {
  spaceId: string;
  spaceName: string;
  projects: Project[];
  loading?: boolean;
}

export function SpaceView({ spaceId: _spaceId, spaceName, projects, loading = false }: SpaceViewProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      {/* Space header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center">
              <FolderIcon className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">
            {spaceName || <Skeleton className="h-5 w-32 inline-block" />}
          </h1>
          </div>
          <p className="text-xs text-zinc-500">
            {loading
              ? <Skeleton className="h-3 w-24 inline-block" />
              : projects.length === 0
                ? "No projects in this space"
                : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/projects/new")}>
          <PlusIcon />
          New project
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6 max-w-xs">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
            <SearchIcon className="w-3.5 h-3.5 text-zinc-600" />
          </div>
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-900 pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card/50 border border-edge/60 rounded-xl p-5 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
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
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <FolderIcon className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-400 mb-1">
            {search ? "No matching projects" : "No projects in this space"}
          </p>
          <p className="text-sm text-zinc-600 mb-6 max-w-xs">
            {search
              ? "Try a different search term."
              : "Add projects to this space to keep your work organized."}
          </p>
          {!search && (
            <Button size="sm" onClick={() => navigate("/projects/new")}>
              <PlusIcon />
              New project
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
