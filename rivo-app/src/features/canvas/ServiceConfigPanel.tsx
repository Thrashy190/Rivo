import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { AWS_SERVICE_CATEGORIES } from "./aws-services";
import { SERVICE_SCHEMAS } from "./service-config-schemas";
import { useServices } from "./useServices";
import type { CanvasNode, CanvasEdge } from "./useCanvas";

// ─── Field renderers ──────────────────────────────────────────────────────────

function TextField({
  fieldKey: _fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string;
  field: { label: string; placeholder?: string; hint?: string; required?: boolean };
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium text-ink-dim uppercase tracking-wider">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-edge bg-page px-2.5 text-xs text-ink placeholder:text-ink-dim focus:outline-none focus:border-raised transition-colors"
      />
      {field.hint && <p className="text-[10px] text-ink-dim">{field.hint}</p>}
    </div>
  );
}

function NumberField({
  fieldKey: _fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string;
  field: { label: string; min?: number; max?: number; hint?: string };
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium text-ink-dim uppercase tracking-wider">
        {field.label}
      </label>
      <input
        type="number"
        value={value ?? ""}
        min={field.min}
        max={field.max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-md border border-edge bg-page px-2.5 text-xs text-ink focus:outline-none focus:border-raised transition-colors"
      />
      {field.hint && <p className="text-[10px] text-ink-dim">{field.hint}</p>}
    </div>
  );
}

function SelectField({
  fieldKey: _fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string;
  field: { label: string; options: string[] };
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium text-ink-dim uppercase tracking-wider">
        {field.label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full rounded-md border border-edge bg-page pl-2.5 pr-7 text-xs text-ink appearance-none focus:outline-none focus:border-raised transition-colors"
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-ink-dim" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function ColorField({
  fieldKey: _fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string;
  field: { label: string };
  value: string;
  onChange: (v: string) => void;
}) {
  // Fallback to #888888 for the native picker when value is empty or non-hex
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#888888";
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium text-ink-dim uppercase tracking-wider">
        {field.label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-md border border-edge bg-page cursor-pointer p-0.5"
          style={{ colorScheme: "dark" }}
        />
        <input
          type="text"
          value={value}
          placeholder="#6366f1"
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-8 rounded-md border border-edge bg-page px-2.5 text-xs font-mono text-ink placeholder:text-ink-dim focus:outline-none focus:border-raised transition-colors"
        />
      </div>
    </div>
  );
}

function BooleanField({
  fieldKey: _fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string;
  field: { label: string };
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <label className="text-[10px] font-medium text-ink-dim uppercase tracking-wider">
        {field.label}
      </label>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={[
          "relative w-8 h-4 rounded-full transition-colors duration-200 focus:outline-none",
          value ? "bg-indigo-600" : "bg-raised",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200",
            value ? "translate-x-4" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-400", POST: "text-blue-400", PUT: "text-amber-400",
  PATCH: "text-purple-400", DELETE: "text-red-400", ANY: "text-zinc-400",
};

interface ServiceConfigPanelProps {
  node: CanvasNode;
  edges?: CanvasEdge[];
  allNodes?: CanvasNode[];
  onClose: () => void;
  onUpdate: (nodeId: string, config: Record<string, unknown>) => void;
  onEdgeClick?: (edgeId: string) => void;
}

export function ServiceConfigPanel({ node, edges = [], allNodes = [], onClose, onUpdate, onEdgeClick }: ServiceConfigPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({ ...node.config });
  const { byId } = useServices();

  const apiDef = byId.get(node.type);
  const schema = apiDef?.configSchema ?? SERVICE_SCHEMAS[node.type] ?? {};

  const staticIcon = (() => {
    for (const cat of AWS_SERVICE_CATEGORIES) {
      const svc = cat.services.find((s) => s.id === node.type);
      if (svc) return svc.icon;
    }
    return null;
  })();

  useEffect(() => {
    gsap.fromTo(
      panelRef.current,
      { y: "100%" },
      { y: "0%", duration: 0.38, ease: "power3.out" }
    );
  }, []);

  const handleClose = () => {
    gsap.to(panelRef.current, {
      y: "100%",
      duration: 0.28,
      ease: "power3.in",
      onComplete: onClose,
    });
  };

  const setField = (key: string, value: unknown) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    onUpdate(node.id, next);
  };

  return (
    <div
      ref={panelRef}
      className="absolute bottom-0 left-0 right-0 z-20 bg-popover border-t border-edge/80 shadow-2xl shadow-black/30"
      style={{ height: "52%" }}
    >
      {/* Handle bar */}
      <div className="flex justify-center pt-2.5 pb-1">
        <div className="w-10 h-1 rounded-full bg-raised" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-edge/60">
        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-card/60 flex items-center justify-center">
          {apiDef?.iconUrl ? (
            <img src={apiDef.iconUrl} alt={node.label} className="w-7 h-7 object-contain" />
          ) : (
            staticIcon
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{node.label}</p>
          <p className="text-xs text-ink-dim font-mono truncate">{node.id}</p>
        </div>
        <button
          onClick={handleClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors"
        >
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Routes section — only for API Gateway */}
      {node.type === "api-gateway" && (() => {
        const routes = edges
          .filter((e) => e.sourceId === node.id || e.targetId === node.id)
          .filter((e) => {
            const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
            return allNodes.find((n) => n.id === otherId)?.type === "lambda";
          });
        if (routes.length === 0) return (
          <div className="px-5 py-2 border-b border-edge/40 flex items-center gap-2">
            <span className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider">Routes</span>
            <span className="text-[10px] text-ink-dim/50 italic">Connect to a Lambda to add routes</span>
          </div>
        );
        return (
          <div className="px-5 py-2 border-b border-edge/50">
            <p className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider mb-1.5">Routes</p>
            <div className="flex flex-col gap-1">
              {routes.map((e) => {
                const lambdaId = e.sourceId === node.id ? e.targetId : e.sourceId;
                const lambda = allNodes.find((n) => n.id === lambdaId);
                const method = e.config?.method ?? "—";
                const path   = e.config?.path   ?? "(not configured)";
                const color  = METHOD_COLORS[method] ?? "text-zinc-400";
                return (
                  <button
                    key={e.id}
                    onClick={() => onEdgeClick?.(e.id)}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-raised/60 transition-colors text-left group"
                  >
                    <span className={`text-[11px] font-mono font-bold w-12 shrink-0 ${color}`}>{method}</span>
                    <span className="text-[11px] font-mono text-ink/70 flex-1 truncate">{path}</span>
                    <span className="text-[10px] text-ink-dim/50 truncate max-w-[80px]">
                      {lambda?.config.name as string || lambda?.label || lambdaId}
                    </span>
                    <svg viewBox="0 0 12 12" className="w-3 h-3 text-ink-dim/40 group-hover:text-indigo-400 shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 6h8M6 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Config fields */}
      <div className="overflow-y-auto h-[calc(100%-7.5rem)] px-5 py-4">
        {Object.keys(schema).length === 0 ? (
          <p className="text-xs text-ink-dim text-center py-8">
            No configurable properties
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            {Object.entries(schema).map(([key, field]) => {
              const rawVal = config[key];

              if (field.type === "color") {
                return (
                  <div key={key} className="col-span-2">
                    <ColorField
                      fieldKey={key}
                      field={field}
                      value={String(rawVal ?? "")}
                      onChange={(v) => setField(key, v)}
                    />
                  </div>
                );
              }

              if (field.type === "boolean") {
                return (
                  <div key={key} className="col-span-2">
                    <BooleanField
                      fieldKey={key}
                      field={field}
                      value={Boolean(rawVal)}
                      onChange={(v) => setField(key, v)}
                    />
                  </div>
                );
              }

              if (field.type === "select") {
                return (
                  <SelectField
                    key={key}
                    fieldKey={key}
                    field={field as { label: string; options: string[] }}
                    value={String(rawVal ?? field.options?.[0] ?? "")}
                    onChange={(v) => setField(key, v)}
                  />
                );
              }

              if (field.type === "number") {
                return (
                  <NumberField
                    key={key}
                    fieldKey={key}
                    field={field}
                    value={Number(rawVal ?? 0)}
                    onChange={(v) => setField(key, v)}
                  />
                );
              }

              return (
                <TextField
                  key={key}
                  fieldKey={key}
                  field={field}
                  value={String(rawVal ?? "")}
                  onChange={(v) => setField(key, v)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
