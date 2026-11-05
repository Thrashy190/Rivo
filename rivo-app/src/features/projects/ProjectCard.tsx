import { Link } from "react-router";
import { DotsVerticalIcon } from "../../components/icons";

export type ProjectStatus = "draft" | "deployed" | "failed" | "deploying";

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  region: string;
  resourceCount: number;
  updatedAt: string;
  accentColor: string;
}

const statusConfig: Record<ProjectStatus, { label: string; dot: string; text: string }> = {
  draft:      { label: "Draft",      dot: "bg-zinc-600",    text: "text-zinc-500" },
  deployed:   { label: "Deployed",   dot: "bg-emerald-500", text: "text-emerald-500" },
  failed:     { label: "Failed",     dot: "bg-red-500",     text: "text-red-500" },
  deploying:  { label: "Deploying",  dot: "bg-indigo-400",  text: "text-indigo-400" },
};

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const status = statusConfig[project.status];

  return (
    <div className="group relative bg-card/50 border border-edge/60 rounded-xl p-5 hover:bg-card hover:border-edge transition-all duration-150 cursor-pointer">
      {/* Menu button */}
      <button className="absolute top-4 right-4 p-1 rounded text-ink-dim hover:text-ink opacity-0 group-hover:opacity-100 transition-all">
        <DotsVerticalIcon className="w-4 h-4" />
      </button>

      {/* Name + description */}
      <Link
        to={`/projects/${project.id}`}
        className="block mb-4"
      >
        <h3 className="text-sm font-medium text-ink tracking-tight truncate pr-6">
          {project.name}
        </h3>
        {project.description && (
          <p className="text-xs text-ink-dim mt-1 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}
      </Link>

      {/* Status */}
      <div className="flex items-center gap-1.5 mb-5">
        <span
          className={[
            "w-1.5 h-1.5 rounded-full shrink-0",
            status.dot,
            project.status === "deploying" ? "animate-pulse" : "",
          ].join(" ")}
        />
        <span className={`text-xs ${status.text}`}>{status.label}</span>
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-ink-dim pt-4 border-t border-edge/60">
        <span className="font-mono">{project.region}</span>
        <div className="flex items-center gap-3">
          <span>{project.resourceCount} resources</span>
          <span>{project.updatedAt}</span>
        </div>
      </div>
    </div>
  );
}
