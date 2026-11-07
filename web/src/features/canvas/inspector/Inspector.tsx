import type { ReactNode } from "react";
import { GENERATED_TYPES, getServiceIcon } from "../aws-services";
import {
  ACCESS_LABELS,
  connectionColor,
  connectionDescription,
  connectionLabel,
  edgeRoutes,
  METHOD_COLORS,
  resolveConnection,
  type Connection,
} from "../connections";
import { nodeIssues } from "../readiness";
import { SERVICE_SCHEMAS } from "../service-config-schemas";
import type { CanvasEdge, CanvasNode, EdgeConfig, Route } from "../useCanvas";
import { ConfigFieldInput } from "./fields";
import { LambdaCode } from "./LambdaCode";
import { inputClass, sectionTitle } from "./styles";

function Shell({ children, onClose, header }: { children: ReactNode; header: ReactNode; onClose: () => void }) {
  return (
    <aside aria-label="Inspector" className="w-[340px] shrink-0 h-full bg-page border-l border-edge flex flex-col overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-4 border-b border-edge">
        <div className="flex-1 min-w-0">{header}</div>
        <button
          onClick={onClose}
          aria-label="Close the inspector"
          className="w-7 h-7 -mr-1 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors shrink-0"
        >
          <svg viewBox="0 0 14 14" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
    </aside>
  );
}

function DangerButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <div className="px-4 py-4">
      <button
        onClick={onClick}
        className="w-full h-8 rounded-lg border border-edge text-xs font-medium text-ink-dim hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/5 transition-colors"
      >
        {children}
      </button>
    </div>
  );
}

// ── Services ─────────────────────────────────────────────────────────────────

interface NodeInspectorProps {
  node: CanvasNode;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  readOnly?: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, config: Record<string, unknown>) => void;
  onRemove: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onOpenCode: () => void;
  onOpenZip: () => void;
}

export function NodeInspector({ node, nodes, edges, readOnly = false, onClose, onUpdate, onRemove, onSelectEdge, onOpenCode, onOpenZip }: NodeInspectorProps) {
  const schema = SERVICE_SCHEMAS[node.type] ?? {};
  const issues = nodeIssues(node, nodes, edges);
  const generated = GENERATED_TYPES.has(node.type) || node.variant === "container";
  const connections = edges
    .filter((e) => e.sourceId === node.id || e.targetId === node.id)
    .map((e) => resolveConnection(e, nodes))
    .filter((c): c is Connection => c !== null);
  const set = (key: string, value: unknown) => onUpdate(node.id, { ...node.config, [key]: value });

  const visible = Object.entries(schema).filter(([, f]) => !f.showIf || (node.config[f.showIf.field] ?? schemaDefault(schema, f.showIf.field)) === f.showIf.equals);

  return (
    <Shell
      onClose={onClose}
      header={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">{getServiceIcon(node.type)}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{String(node.config.name ?? node.id)}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-ink-dim">
              <span className="truncate">{node.label}</span>
              {node.variant !== "container" && (
                <span
                  className={[
                    "shrink-0 px-1.5 py-px rounded-full text-[10px] font-medium",
                    generated ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-raised text-ink-dim",
                  ].join(" ")}
                >
                  {generated ? "Terraform" : "Note only"}
                </span>
              )}
            </p>
          </div>
        </div>
      }
    >
      {issues.length > 0 && (
        <div className="mx-4 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5">
          {issues.map((i) => (
            <p key={i.message} className="text-[11px] leading-snug text-ink">
              {i.message}
            </p>
          ))}
        </div>
      )}

      {node.type === "lambda" && (
        <LambdaCode
          node={node}
          nodes={nodes}
          edges={edges}
          readOnly={readOnly}
          onOpenCode={onOpenCode}
          onOpenZip={onOpenZip}
          onUpdate={(config) => onUpdate(node.id, config)}
        />
      )}

      {node.type === "api-gateway" && <ApiRoutes node={node} connections={connections} onSelectEdge={onSelectEdge} />}

      <section className="px-4 py-4 border-b border-edge">
        <p className={`${sectionTitle} mb-3`}>Settings</p>
        {visible.length === 0 ? (
          <p className="text-xs text-ink-dim">Nothing to set for this service.</p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {visible.map(([key, field]) => (
              <ConfigFieldInput
                key={key}
                id={`field-${node.id}-${key}`}
                field={field}
                value={node.config[key] ?? (field.type === "boolean" ? schemaDefault(schema, key) : undefined)}
                disabled={readOnly}
                onChange={(v) => set(key, v)}
              />
            ))}
          </div>
        )}
      </section>

      {node.variant !== "container" && (
        <section className="px-4 py-4 border-b border-edge">
          <p className={`${sectionTitle} mb-2.5`}>Connections</p>
          {connections.length === 0 ? (
            <p className="text-[11px] text-ink-dim">Drag from the dot on either side of the service to another one.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {connections.map((c) => {
                const other = c.source.id === node.id ? c.target : c.source;
                return (
                  <button
                    key={c.edge.id}
                    onClick={() => onSelectEdge(c.edge.id)}
                    className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-lg hover:bg-card text-left transition-colors"
                  >
                    <span className="w-6 h-6 rounded overflow-hidden shrink-0">{getServiceIcon(other.type)}</span>
                    <span className="text-xs text-ink truncate flex-1">{String(other.config.name ?? other.label)}</span>
                    <span className="text-[10px] font-mono font-semibold truncate max-w-[45%]" style={{ color: connectionColor(c) }}>
                      {connectionLabel(c) || "not generated"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!readOnly && <DangerButton onClick={() => onRemove(node.id)}>Remove from the diagram</DangerButton>}
    </Shell>
  );
}

function schemaDefault(schema: (typeof SERVICE_SCHEMAS)[string], key: string): unknown {
  const f = schema[key];
  if (!f) return undefined;
  if (f.type === "boolean") return key === "enabled" || key === "blockPublicAccess" || key === "compress";
  if (f.type === "select") return f.options?.[0];
  return undefined;
}

function ApiRoutes({ node, connections, onSelectEdge }: { node: CanvasNode; connections: Connection[]; onSelectEdge: (id: string) => void }) {
  const routes = connections
    .filter((c) => c.kind === "route")
    .flatMap((c) => {
      const fn = c.source.id === node.id ? c.target : c.source;
      const list = edgeRoutes(c.edge);
      return (list.length ? list : [{ method: "ANY", path: "/" }]).map((r) => ({ ...r, fn, edgeId: c.edge.id }));
    });
  return (
    <section className="px-4 py-4 border-b border-edge">
      <p className={`${sectionTitle} mb-2.5`}>Routes</p>
      {routes.length === 0 ? (
        <p className="text-[11px] text-ink-dim">Connect the API to a Lambda function, then pick the connection to add routes.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {routes.map((r, i) => (
            <button
              key={`${r.edgeId}-${i}`}
              onClick={() => onSelectEdge(r.edgeId)}
              className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-lg hover:bg-card text-left transition-colors"
            >
              <span className="w-14 shrink-0 text-[10px] font-mono font-bold" style={{ color: METHOD_COLORS[r.method] ?? METHOD_COLORS.ANY }}>
                {r.method}
              </span>
              <span className="text-xs font-mono text-ink truncate flex-1">{r.path}</span>
              <span className="text-[10px] text-ink-dim truncate max-w-[40%]">{String(r.fn.config.name ?? r.fn.label)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Connections ──────────────────────────────────────────────────────────────

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "ANY"];

interface EdgeInspectorProps {
  edge: CanvasEdge;
  nodes: CanvasNode[];
  readOnly?: boolean;
  onClose: () => void;
  onUpdate: (edgeId: string, config: EdgeConfig) => void;
  onReverse: (edgeId: string) => void;
  onRemove: (edgeId: string) => void;
}

export function EdgeInspector({ edge, nodes, readOnly = false, onClose, onUpdate, onReverse, onRemove }: EdgeInspectorProps) {
  const c = resolveConnection(edge, nodes);
  if (!c) return null;
  const color = connectionColor(c);
  const name = (n: CanvasNode) => String(n.config.name ?? n.label);

  return (
    <Shell
      onClose={onClose}
      header={
        <div>
          <p className="text-sm font-semibold text-ink">Connection</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-ink">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-5 h-5 rounded overflow-hidden shrink-0">{getServiceIcon(c.source.type)}</span>
              <span className="truncate">{name(c.source)}</span>
            </span>
            <svg viewBox="0 0 16 8" className="w-4 h-2 shrink-0" fill="none" stroke={color} strokeWidth="1.5">
              <path d="M1 4h13M11 1l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-5 h-5 rounded overflow-hidden shrink-0">{getServiceIcon(c.target.type)}</span>
              <span className="truncate">{name(c.target)}</span>
            </span>
          </div>
        </div>
      }
    >
      <section className="px-4 py-4 border-b border-edge">
        <p className="text-xs leading-relaxed text-ink-dim">{connectionDescription(c)}</p>
      </section>

      {c.kind === "route" && <RoutesEditor edge={edge} readOnly={readOnly} onChange={(routes) => onUpdate(edge.id, { routes })} />}

      {c.kind === "data" && (
        <section className="px-4 py-4 border-b border-edge">
          <p className={`${sectionTitle} mb-2.5`}>Access</p>
          <div role="radiogroup" className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-card border border-edge">
            {(Object.keys(ACCESS_LABELS) as (keyof typeof ACCESS_LABELS)[]).map((a) => {
              const active = (edge.config?.access ?? "readwrite") === a;
              return (
                <button
                  key={a}
                  role="radio"
                  aria-checked={active}
                  disabled={readOnly}
                  onClick={() => onUpdate(edge.id, { ...edge.config, access: a })}
                  className={[
                    "h-7 rounded-md text-[11px] font-medium transition-colors",
                    active ? "bg-page text-ink shadow-sm" : "text-ink-dim hover:text-ink",
                  ].join(" ")}
                >
                  {ACCESS_LABELS[a]}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {(c.kind === "trigger" || c.kind === "publish") && !readOnly && (
        <section className="px-4 py-4 border-b border-edge">
          <button
            onClick={() => onReverse(edge.id)}
            className="w-full h-8 rounded-lg border border-edge bg-card text-xs font-medium text-ink hover:bg-raised transition-colors"
          >
            {c.kind === "trigger" ? "Make the function send events instead" : "Make the rule run the function instead"}
          </button>
        </section>
      )}

      {!readOnly && <DangerButton onClick={() => onRemove(edge.id)}>Remove connection</DangerButton>}
    </Shell>
  );
}

function RoutesEditor({ edge, readOnly, onChange }: { edge: CanvasEdge; readOnly: boolean; onChange: (routes: Route[]) => void }) {
  const routes = edgeRoutes(edge);
  const list = routes.length ? routes : [{ method: "ANY", path: "/" }];
  const update = (i: number, patch: Partial<Route>) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <section className="px-4 py-4 border-b border-edge">
      <div className="flex items-center justify-between mb-2.5">
        <p className={sectionTitle}>Routes</p>
        {!readOnly && (
          <button
            onClick={() => onChange([...list, { method: "GET", path: "/" }])}
            className="text-[11px] font-medium text-indigo-500 hover:text-indigo-400 transition-colors"
          >
            Add route
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {list.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <select
              aria-label="Method"
              value={r.method}
              disabled={readOnly}
              onChange={(e) => update(i, { method: e.target.value })}
              className={`${inputClass} w-[86px] shrink-0 font-mono font-bold appearance-none text-center`}
              style={{ color: METHOD_COLORS[r.method] ?? METHOD_COLORS.ANY }}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              aria-label="Path"
              value={r.path}
              disabled={readOnly}
              spellCheck={false}
              placeholder="/items/{id}"
              onChange={(e) => update(i, { path: e.target.value.startsWith("/") ? e.target.value : `/${e.target.value}` })}
              className={`${inputClass} flex-1 font-mono`}
            />
            {!readOnly && list.length > 1 && (
              <button
                onClick={() => onChange(list.filter((_, j) => j !== i))}
                aria-label={`Remove ${r.method} ${r.path}`}
                className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-ink-dim hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M1 1l8 8M9 1L1 9" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-dim/80">
        Use <code className="font-mono text-ink">{"{id}"}</code> for a path parameter, or <code className="font-mono text-ink">{"{proxy+}"}</code> to match the rest of the path.
      </p>
    </section>
  );
}
