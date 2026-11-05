import { useState } from "react";
import { AWS_SERVICE_CATEGORIES, AWS_TYPE_CATEGORIES } from "./aws-services";
import type { AwsService, AwsServiceCategory, AwsTypeCategory } from "./aws-services";
import { SearchIcon } from "../../components/icons";

type SidebarTab = "groups" | "types";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

function ServiceItem({ service }: { service: AwsService }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/rivo-service", service.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title={service.name}
      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-raised/60 transition-colors group select-none"
    >
      <div className="w-8 h-8 shrink-0 rounded-md overflow-hidden">{service.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink/80 group-hover:text-ink transition-colors truncate">
          {service.name}
        </p>
        <p className="text-[10px] text-ink-dim truncate leading-snug">
          {service.description}
        </p>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  defaultOpen = true,
}: {
  category: AwsServiceCategory | AwsTypeCategory;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-card/50 transition-colors"
      >
        <span className="text-[10px] font-semibold text-ink-dim uppercase tracking-widest">
          {category.label}
        </span>
        <svg
          viewBox="0 0 12 12"
          className={`w-3 h-3 text-ink-dim transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-2 pb-1">
          {category.services.map((service) => (
            <ServiceItem key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CanvasSidebar({ open, onToggle }: SidebarProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<SidebarTab>("groups");

  const query = search.toLowerCase();

  const filteredGroups = AWS_SERVICE_CATEGORIES.map((cat) => ({
    ...cat,
    services: cat.services.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
    ),
  })).filter((cat) => cat.services.length > 0);

  const filteredTypes = AWS_TYPE_CATEGORIES.map((cat) => ({
    ...cat,
    services: cat.services.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
    ),
  })).filter((cat) => cat.services.length > 0);

  const categories = tab === "groups" ? filteredGroups : filteredTypes;

  if (!open) return null;

  return (
    <aside className="w-56 shrink-0 h-full bg-page border-r border-edge/60 flex flex-col overflow-hidden">
      {/* Header: close button + search */}
      <div className="p-3 border-b border-edge/60 flex items-center gap-2">
        <button
          onClick={onToggle}
          title="Collapse sidebar"
          className="w-8 h-8 shrink-0 rounded-md flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors"
        >
          <svg
            viewBox="0 0 16 16"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M6 3l-4 5 4 5" />
            <path d="M14 3l-4 5 4 5" />
          </svg>
        </button>

        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-dim pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 bg-card border border-edge rounded-md pl-7 pr-3 text-xs text-ink/80 placeholder:text-ink-dim focus:outline-none focus:border-raised transition-colors"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-edge/60 shrink-0 px-3">
        {(["groups", "types"] as SidebarTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-2 py-2 text-[11px] font-medium border-b-2 transition-colors capitalize",
              tab === t
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-ink-dim hover:text-ink",
            ].join(" ")}
          >
            {t === "groups" ? "Use cases" : "By type"}
          </button>
        ))}
      </div>

      {/* Services */}
      <div className="flex-1 overflow-y-auto py-2">
        {categories.length === 0 && (
          <p className="text-xs text-ink-dim px-4 py-6 text-center">No services found</p>
        )}
        {categories.map((cat, i) => (
          <CategorySection key={cat.id} category={cat} defaultOpen={i === 0} />
        ))}
      </div>

      <div className="p-3 border-t border-edge/60">
        <p className="text-[10px] text-ink-dim text-center">
          Drag services onto the canvas
        </p>
      </div>
    </aside>
  );
}
