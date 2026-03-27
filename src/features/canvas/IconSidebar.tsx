import { useState } from "react";

interface IconSidebarProps {
  servicesOpen: boolean;
  onToggleServices: () => void;
}

function ServicesIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconSidebar({ servicesOpen, onToggleServices }: IconSidebarProps) {
  const [tooltip, setTooltip] = useState(false);

  return (
    <aside className="w-12 shrink-0 h-full bg-page border-r border-edge/60 flex flex-col items-center py-3 gap-1">
      <div className="relative">
        <button
          onClick={onToggleServices}
          onMouseEnter={() => setTooltip(true)}
          onMouseLeave={() => setTooltip(false)}
          className={[
            "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
            servicesOpen
              ? "bg-indigo-600 text-white"
              : "text-ink-dim hover:text-ink hover:bg-raised",
          ].join(" ")}
          title="Services"
        >
          <ServicesIcon />
        </button>

        {tooltip && !servicesOpen && (
          <div className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 z-50 ml-1">
            <div className="bg-popover border border-edge/60 text-ink text-xs px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
              Add service
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
