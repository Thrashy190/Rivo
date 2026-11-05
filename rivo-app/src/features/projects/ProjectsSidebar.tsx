import { useState } from "react";
import { Link, useLocation } from "react-router";
import {
  HomeIcon,
  ClockIcon,
  StarIcon,
  PlusIcon,
  LayersIcon,
  ActivityIcon,
  SettingsIcon,
} from "../../components/icons";

const SPACES = [
  { id: "personal", name: "Personal", color: "#6366f1" },
  { id: "team-alpha", name: "Team Alpha", color: "#10b981" },
];

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  to?: string;
  badge?: number;
  active?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon, label, to, badge, active, onClick }: SidebarItemProps) {
  const cls = [
    "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors w-full text-left",
    active
      ? "bg-raised text-ink"
      : "text-ink-dim hover:text-ink hover:bg-card",
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

  if (to) {
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  }
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

export function ProjectsSidebar() {
  const location = useLocation();
  const [activeView, setActiveView] = useState<"home" | "recent" | "starred">("home");

  return (
    <aside className="w-52 shrink-0 h-full bg-page border-r border-edge/60 flex flex-col overflow-y-auto">
      <div className="flex-1 py-3 px-2">
        {/* Main nav */}
        <SidebarItem
          icon={<HomeIcon />}
          label="Home"
          active={activeView === "home"}
          onClick={() => setActiveView("home")}
        />
        <SidebarItem
          icon={<ClockIcon />}
          label="Recent"
          active={activeView === "recent"}
          onClick={() => setActiveView("recent")}
        />
        <SidebarItem
          icon={<StarIcon />}
          label="Starred"
          active={activeView === "starred"}
          onClick={() => setActiveView("starred")}
        />

        {/* Spaces */}
        <SectionLabel>Spaces</SectionLabel>
        {SPACES.map((space) => (
          <SidebarItem
            key={space.id}
            icon={
              <span
                className="w-4 h-4 rounded-sm shrink-0"
                style={{ backgroundColor: space.color }}
              />
            }
            label={space.name}
            active={location.pathname === `/spaces/${space.id}`}
            to={`/spaces/${space.id}`}
          />
        ))}
        <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-ink-dim hover:text-ink hover:bg-card transition-colors w-full">
          <PlusIcon className="w-4 h-4" />
          <span>New space</span>
        </button>

        {/* Activity */}
        <SectionLabel>Activity</SectionLabel>
        <SidebarItem
          icon={<ActivityIcon />}
          label="Deploying"
          badge={2}
        />
        <SidebarItem
          icon={<LayersIcon />}
          label="Logs"
        />
      </div>

      {/* Bottom */}
      <div className="border-t border-edge/60 px-2 py-3">
        <SidebarItem
          icon={<SettingsIcon />}
          label="Settings"
          to="/settings"
        />
      </div>
    </aside>
  );
}
