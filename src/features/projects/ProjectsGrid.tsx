import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { ProjectCard } from "./ProjectCard";
import { PlusIcon, SearchIcon, FolderIcon } from "../../components/icons";
import type { Project } from "./ProjectCard";

interface ProjectsGridProps {
  projects: Project[];
}

export function ProjectsGrid({ projects }: ProjectsGridProps) {
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
            {projects.length === 0 ? "No projects yet" : `${projects.length} projects`}
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

      {filtered.length > 0 ? (
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
