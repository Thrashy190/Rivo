import { useState } from "react";
import { AWS_TYPE_CATEGORIES, GENERATED_TYPES, getServiceIcon, type AwsService } from "./aws-services";
import { BLUEPRINTS, type Blueprint } from "./blueprints";
import { SearchIcon } from "../../components/icons";

interface LibraryProps {
  readOnly?: boolean;
  onAddService: (serviceId: string) => void;
  onAddBlueprint: (blueprint: Blueprint) => void;
  onClose: () => void;
}

export function Library({ readOnly = false, onAddService, onAddBlueprint, onClose }: LibraryProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const categories = AWS_TYPE_CATEGORIES.map((cat) => ({
    ...cat,
    services: cat.services.filter(
      (s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.id.includes(q),
    ),
  })).filter((cat) => cat.services.length > 0);
  const blueprints = BLUEPRINTS.filter((b) => !q || b.name.toLowerCase().includes(q) || b.services.some((s) => s.includes(q)));

  return (
    <aside aria-label="Services" className="w-72 shrink-0 h-full bg-page border-r border-edge flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <p className="text-sm font-semibold text-ink">Add to the diagram</p>
        <button
          onClick={onClose}
          aria-label="Hide the library"
          title="Hide the library"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2.5" width="12" height="11" rx="2" />
            <path d="M6 2.5v11M10.5 6.5 9 8l1.5 1.5" />
          </svg>
        </button>
      </div>

      <div className="px-4 pb-3">
        <label className="relative block">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-dim">
            <SearchIcon className="w-3.5 h-3.5" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services"
            className="w-full h-8 rounded-lg border border-edge bg-card pl-8 pr-2.5 text-xs text-ink placeholder:text-ink-dim focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15 transition"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {blueprints.length > 0 && (
          <Section title="Blueprints">
            <div className="flex flex-col gap-2">
              {blueprints.map((b) => (
                <BlueprintCard key={b.id} blueprint={b} disabled={readOnly} onAdd={() => onAddBlueprint(b)} />
              ))}
            </div>
          </Section>
        )}

        {categories.map((cat) => (
          <Section key={cat.id} title={cat.label}>
            <div className="flex flex-col">
              {cat.services.map((s) => (
                <ServiceItem key={s.id} service={s} disabled={readOnly} onAdd={() => onAddService(s.id)} />
              ))}
            </div>
          </Section>
        ))}

        {categories.length === 0 && blueprints.length === 0 && (
          <p className="text-xs text-ink-dim text-center py-10">Nothing matches “{query}”.</p>
        )}

        <p className="mt-4 px-2 text-[11px] leading-relaxed text-ink-dim">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 align-middle mr-1.5" />
          Becomes Terraform. The others can be drawn as notes for now.
        </p>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 first:mt-0">
      <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-dim">{title}</p>
      {children}
    </section>
  );
}

function ServiceItem({ service, disabled, onAdd }: { service: AwsService; disabled: boolean; onAdd: () => void }) {
  const generated = GENERATED_TYPES.has(service.id);
  return (
    <button
      type="button"
      draggable={!disabled}
      disabled={disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/rivo-service", service.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onAdd}
      aria-label={`Add ${service.name}${generated ? "" : " (not generated yet)"}`}
      title={disabled ? "You can view this project but not change it" : `Add ${service.name}, or drag it onto the canvas`}
      className="group w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left hover:bg-card disabled:opacity-50 disabled:hover:bg-transparent cursor-grab active:cursor-grabbing disabled:cursor-not-allowed transition-colors"
    >
      <span className="w-8 h-8 rounded-md overflow-hidden shrink-0">{service.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-ink truncate">{service.name}</span>
          {generated && <span title="Becomes Terraform" className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
        </span>
        <span className="block text-[11px] text-ink-dim truncate">{service.description}</span>
      </span>
      <span className="w-6 h-6 rounded-md flex items-center justify-center text-ink-dim opacity-0 group-hover:opacity-100 group-hover:bg-raised transition-opacity">
        <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 1.5v9M1.5 6h9" />
        </svg>
      </span>
    </button>
  );
}

function BlueprintCard({ blueprint, disabled, onAdd }: { blueprint: Blueprint; disabled: boolean; onAdd: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onAdd}
      aria-label={`Add the ${blueprint.name} blueprint`}
      className="group w-full text-left p-3 rounded-xl border border-edge bg-card/60 hover:bg-card hover:border-indigo-500/40 disabled:opacity-50 disabled:hover:border-edge transition-colors"
    >
      <span className="flex items-center gap-1 mb-2">
        {blueprint.services.map((s, i) => (
          <span key={s} className="flex items-center">
            {i > 0 && (
              <svg viewBox="0 0 12 8" className="w-3 h-2 mx-0.5 text-ink-dim/60" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="M1 4h9M7.5 1.5 10 4 7.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span className="w-6 h-6 rounded overflow-hidden">{getServiceIcon(s)}</span>
          </span>
        ))}
      </span>
      <span className="block text-xs font-semibold text-ink">{blueprint.name}</span>
      <span className="block text-[11px] leading-snug text-ink-dim mt-0.5">{blueprint.description}</span>
    </button>
  );
}
