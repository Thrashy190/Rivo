import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { DotsVerticalIcon, LayersIcon, ClockIcon } from "../../components/icons";
import { useSnackbar } from "../../context/SnackbarContext";

export type ProjectStatus = "draft" | "deployed" | "failed" | "deploying";

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  region: string;
  environment: string;
  updatedAt: string;
  accentColor: string;
  // Where the card opens: the project's canvas.
  href: string;
}

const statusConfig: Record<
  ProjectStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  draft:     { label: "Draft",     bg: "bg-raised/70",    text: "text-ink-dim",    dot: "bg-zinc-500"    },
  deployed:  { label: "Deployed",  bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  failed:    { label: "Failed",    bg: "bg-red-500/10",     text: "text-red-400",     dot: "bg-red-400"     },
  deploying: { label: "Deploying", bg: "bg-indigo-500/10",  text: "text-indigo-400",  dot: "bg-indigo-400"  },
};

// ── Dropdown menu ─────────────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={[
        "w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors text-left",
        danger
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
          : "text-ink-dim hover:bg-raised hover:text-ink",
      ].join(" ")}
    >
      <span className="w-3.5 h-3.5 shrink-0 [&>svg]:w-full [&>svg]:h-full">{icon}</span>
      {label}
    </button>
  );
}

// ── Inline icons (menu-specific) ──────────────────────────────────────────────

const PencilIcon = (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2.5l2 2-7 7H2.5v-2L9.5 2.5z" />
  </svg>
);

const MoveIcon = (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 4.5V11a1 1 0 001 1h9a1 1 0 001-1V5.5a1 1 0 00-1-1H7L5.5 2.5h-3a1 1 0 00-1 1v1z" />
    <path d="M6 8h3.5M8 6.5L9.5 8 8 9.5" />
  </svg>
);

const CanvasIcon = (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="12" height="12" rx="2" />
    <circle cx="4.5" cy="4.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="9.5" cy="4.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="9.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="9.5" cy="9.5" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

const CopyIcon = (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 1h6a1 1 0 011 1v8" />
    <rect x="1" y="4" width="9" height="9" rx="1.5" />
  </svg>
);

const TrashIcon = (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 3.5h11M5 3.5V2h4v1.5M3 3.5l.8 8.5a1 1 0 001 .9h4.4a1 1 0 001-.9L11 3.5" />
  </svg>
);

const MapPinIcon = (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 1C4.8 1 3 2.8 3 5c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4z" />
    <circle cx="7" cy="5" r="1.3" />
  </svg>
);

// ── Card ──────────────────────────────────────────────────────────────────────

export interface ProjectCardProps {
  project: Project;
  // Each action shows in the menu only when it is given, so a role that
  // cannot change projects does not see it.
  onRename?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
}

export function ProjectCard({ project, onRename, onMove, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { push } = useSnackbar();

  const status = statusConfig[project.status] ?? statusConfig.draft;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(project.id);
    push("Project ID copied", "success");
    setMenuOpen(false);
  };

  return (
    <div
      className="group relative border border-edge/60 rounded-xl overflow-hidden transition-all duration-200 hover:border-edge hover:shadow-lg hover:shadow-black/25 hover:-translate-y-px"
      style={{
        borderLeftColor: project.accentColor,
        borderLeftWidth: "3px",
        background: `linear-gradient(135deg, ${project.accentColor}1a 0%, transparent 55%)`,
      }}
    >
      {/* Stretched link */}
      <Link
        to={project.href}
        className="absolute inset-0 rounded-xl"
        aria-label={project.name}
      />

      <div className="p-5">
        {/* Top row: name + menu */}
        <div className="flex items-start gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-ink tracking-tight truncate">
              {project.name}
            </h3>
            {project.description ? (
              <p className="text-xs text-ink-dim mt-1 line-clamp-2 leading-relaxed">
                {project.description}
              </p>
            ) : (
              <p className="text-xs text-ink-dim/40 mt-1 italic">No description</p>
            )}
          </div>

          {/* Options menu */}
          <div ref={menuRef} className="relative z-10 shrink-0">
            <button
              onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
              aria-label={`Options for ${project.name}`}
              className="w-7 h-7 rounded-md flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised/80 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
            >
              <DotsVerticalIcon className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 w-48 bg-popover border border-edge rounded-lg shadow-xl shadow-black/40 py-1 z-50">
                <MenuItem icon={CanvasIcon} label="Open in canvas"
                  onClick={() => { navigate(project.href); setMenuOpen(false); }}
                />
                {onRename && (
                  <MenuItem icon={PencilIcon} label="Rename"
                    onClick={() => { setMenuOpen(false); onRename(); }}
                  />
                )}
                {onMove && (
                  <MenuItem icon={MoveIcon} label="Move to folder"
                    onClick={() => { setMenuOpen(false); onMove(); }}
                  />
                )}
                <MenuItem icon={CopyIcon} label="Copy project ID"
                  onClick={handleCopyId}
                />
                {onDelete && (
                  <>
                    <div className="my-1 border-t border-edge/60" />
                    <MenuItem icon={TrashIcon} label="Delete" danger
                      onClick={() => { setMenuOpen(false); onDelete(); }}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status pill + AWS badge */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${status.bg} ${status.text}`}
          >
            <span
              className={[
                "w-1.5 h-1.5 rounded-full shrink-0",
                status.dot,
                project.status === "deploying" ? "animate-pulse" : "",
              ].join(" ")}
            />
            {status.label}
          </span>
          <span className="text-[10px] font-mono font-semibold text-ink-dim/50 bg-raised/40 border border-edge/40 px-1.5 py-0.5 rounded">
            AWS
          </span>
        </div>

        {/* Footer stats */}
        <div className="flex items-center gap-3 pt-3 border-t border-edge/50 text-[11px] text-ink-dim">
          <span className="flex items-center gap-1 capitalize">
            <LayersIcon className="w-3 h-3 shrink-0" />
            {project.environment}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 shrink-0">{MapPinIcon}</span>
            <span className="font-mono truncate max-w-[70px]">{project.region}</span>
          </span>
          <span className="flex items-center gap-1 ml-auto whitespace-nowrap">
            <ClockIcon className="w-3 h-3 shrink-0" />
            {project.updatedAt}
          </span>
        </div>
      </div>
    </div>
  );
}
