import { useState } from "react";
import { createPortal } from "react-dom";
import { AWS_SERVICE_CATEGORIES, AWS_TYPE_CATEGORIES } from "../aws-services";
import type { AwsService } from "../aws-services";
import { SearchIcon } from "../../../components/icons";

type Tab = "cases" | "types";

interface ServicesModalProps {
  onClose: () => void;
  onAddService: (serviceId: string) => void;
}

function ServiceCard({ service, onAdd }: { service: AwsService; onAdd: () => void }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/rivo-service", service.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-3 p-3 rounded-xl border border-edge/60 bg-card/40 hover:bg-card hover:border-edge transition-all cursor-grab active:cursor-grabbing group"
    >
      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">{service.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink/80 group-hover:text-ink truncate">
          {service.name}
        </p>
        <p className="text-[10px] text-ink-dim truncate leading-snug">{service.description}</p>
      </div>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onAdd}
        className="shrink-0 w-6 h-6 rounded-md bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white flex items-center justify-center transition-colors"
        title="Add to canvas"
      >
        <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 1v10M1 6h10" />
        </svg>
      </button>
    </div>
  );
}

function CategorySection({
  label,
  services,
  defaultOpen,
  onAddService,
}: {
  label: string;
  services: AwsService[];
  defaultOpen: boolean;
  onAddService: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-edge/40 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-card/50 transition-colors"
      >
        <span className="text-[10px] font-semibold text-ink-dim uppercase tracking-widest">
          {label}
        </span>
        <svg
          viewBox="0 0 12 12"
          className={`w-3 h-3 text-ink-dim transition-transform ${open ? "" : "-rotate-90"}`}
          fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-1.5">
          {services.map((svc) => (
            <ServiceCard key={svc.id} service={svc} onAdd={() => onAddService(svc.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ServicesModal({ onClose, onAddService }: ServicesModalProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("cases");

  const query = search.toLowerCase();

  const filterSvcs = (svcs: AwsService[]) =>
    svcs.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
    );

  const categories = (tab === "cases" ? AWS_SERVICE_CATEGORIES : AWS_TYPE_CATEGORIES)
    .map((cat) => ({ ...cat, services: filterSvcs(cat.services) }))
    .filter((cat) => cat.services.length > 0);

  // No backdrop — the canvas stays fully accessible for drag-and-drop
  return createPortal(
    <div className="fixed left-12 top-0 h-full w-72 z-30 bg-page border-r border-edge/60 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge/60 shrink-0">
        <p className="text-sm font-semibold text-ink">Services</p>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors"
        >
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-dim pointer-events-none" />
          <input
            autoFocus
            type="text"
            placeholder="Search services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 bg-card border border-edge rounded-lg pl-8 pr-3 text-xs text-ink placeholder:text-ink-dim focus:outline-none focus:border-raised transition-colors"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-edge/60 shrink-0 px-3">
        {(["cases", "types"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-2 py-2 text-[11px] font-medium border-b-2 transition-colors",
              tab === t
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-ink-dim hover:text-ink",
            ].join(" ")}
          >
            {t === "cases" ? "Use cases" : "By type"}
          </button>
        ))}
      </div>

      {/* Service list */}
      <div className="flex-1 overflow-y-auto">
        {categories.length === 0 && (
          <p className="text-xs text-ink-dim px-4 py-8 text-center">No services found</p>
        )}
        {categories.map((cat, i) => (
          <CategorySection
            key={cat.id}
            label={cat.label}
            services={cat.services}
            defaultOpen={i === 0}
            onAddService={onAddService}
          />
        ))}
      </div>

      <div className="px-4 py-2.5 border-t border-edge/60 shrink-0">
        <p className="text-[10px] text-ink-dim text-center">
          Drag to canvas · click <span className="text-indigo-400">+</span> to add at center
        </p>
      </div>
    </div>,
    document.body
  );
}
