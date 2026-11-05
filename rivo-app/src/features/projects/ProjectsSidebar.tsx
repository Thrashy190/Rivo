import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import {
  HomeIcon,
  ClockIcon,
  StarIcon,
  PlusIcon,
  ActivityIcon,
  SettingsIcon,
} from "../../components/icons";
import type { ApiSpace } from "../../services/spaces";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  to?: string;
  badge?: number;
  active?: boolean;
  onClick?: () => void;
}

function SidebarItem({
  icon,
  label,
  to,
  badge,
  active,
  onClick,
}: SidebarItemProps) {
  const cls = [
    "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors w-full text-left",
    active ? "bg-raised text-ink" : "text-ink-dim hover:text-ink hover:bg-card",
  ].join(" ");

  const content = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </>
  );

  if (to)
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  return (
    <button className={cls} onClick={onClick}>
      {content}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-5 pb-1 text-[10px] font-semibold text-ink-dim uppercase tracking-widest">
      {children}
    </p>
  );
}

interface ProjectsSidebarProps {
  spaces?:        ApiSpace[];
  loadingSpaces?: boolean;
}

export function ProjectsSidebar({ spaces = [], loadingSpaces = false }: ProjectsSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<"home" | "recent" | "starred">(
    "home",
  );

  return (
    <aside className="w-52 shrink-0 h-full bg-page border-r border-edge/60 flex flex-col overflow-y-auto">
      <div className="flex-1 py-3 px-2">
        <SidebarItem
          icon={<HomeIcon />}
          label="Home"
          active={activeView === "home"}
          onClick={() => {
            setActiveView("home");
            navigate("/projects");
          }}
        />
        <SidebarItem
          icon={<ClockIcon />}
          label="Recent"
          active={activeView === "recent"}
          onClick={() => {
            setActiveView("recent");
            navigate("/projects");
          }}
        />
        <SidebarItem
          icon={<StarIcon />}
          label="Starred"
          active={activeView === "starred"}
          onClick={() => {
            setActiveView("starred");
            navigate("/projects");
          }}
        />

        <SectionLabel>Spaces</SectionLabel>
        {loadingSpaces ? (
          <div className="px-3 py-1 space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton className="w-4 h-4 rounded-sm shrink-0" />
                <Skeleton className="h-3 flex-1" style={{ width: `${60 + i * 15}%` }} />
              </div>
            ))}
          </div>
        ) : (
          spaces.map((space) => (
            <SidebarItem
              key={space.spaceId}
              icon={
                <span
                  className="w-4 h-4 rounded-sm shrink-0"
                  style={{ backgroundColor: space.color }}
                />
              }
              label={space.name}
              active={location.pathname === `/spaces/${space.spaceId}`}
              to={`/spaces/${space.spaceId}`}
            />
          ))
        )}
        <button
          onClick={() => navigate("/spaces/new")}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-ink-dim hover:text-ink hover:bg-card transition-colors w-full"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New space</span>
        </button>

        <SectionLabel>Activity</SectionLabel>
        <SidebarItem
          icon={<ActivityIcon />}
          label="Deploys"
          badge={1}
          active={location.pathname === "/deploys"}
          to="/deploys"
        />
      </div>

      <div className="border-t border-edge/60 px-2 py-3">
        <SidebarItem icon={<SettingsIcon />} label="Settings" to="/settings" />
      </div>
    </aside>
  );
}
