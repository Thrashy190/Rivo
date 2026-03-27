import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { AWS_SERVICE_CATEGORIES } from "./aws-services";
import { SERVICE_SCHEMAS } from "./service-config-schemas";
import type { CanvasNode } from "./useCanvas";

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

interface ServiceConfigPanelProps {
  node: CanvasNode;
  onClose: () => void;
  onUpdate: (nodeId: string, config: Record<string, unknown>) => void;
}

export function ServiceConfigPanel({ node, onClose, onUpdate }: ServiceConfigPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({ ...node.config });

  const schema = SERVICE_SCHEMAS[node.type] ?? {};

  const icon = (() => {
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
        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">{icon}</div>
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
