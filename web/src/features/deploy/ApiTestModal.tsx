import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/Button/Button";
import { CodeEditor } from "../../components/CodeEditor/CodeEditor";
import { errorMessage } from "../../services/api";
import { testApi, type TestResponse } from "../../services/projects";
import { edgeRoutes, METHOD_COLORS } from "../canvas/connections";
import type { CanvasEdge, CanvasNode } from "../canvas/useCanvas";

interface ApiTestModalProps {
  workspaceId: string;
  projectId: string;
  api: CanvasNode;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  baseUrl: string;
  onClose: () => void;
}

interface RouteOption {
  method: string;
  path: string;
  fn: string;
}

type Pair = { key: string; value: string };

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PARAM = /\{([A-Za-z0-9_]+)\+?\}/g;

function statusClass(status: number) {
  if (status < 300) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (status < 400) return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
  if (status < 500) return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "bg-red-500/10 text-red-600 dark:text-red-400";
}

function pretty(body: string, contentType = "") {
  if (!contentType.includes("json") && !/^\s*[[{]/.test(body)) return { text: body, json: false };
  try {
    return { text: JSON.stringify(JSON.parse(body), null, 2), json: true };
  } catch {
    return { text: body, json: false };
  }
}

// Sends requests to a deployed API, like the AWS console's test tab. Requests
// go through Rivo, so they work whatever the API's CORS settings.
export function ApiTestModal({ workspaceId, projectId, api, nodes, edges, baseUrl, onClose }: ApiTestModalProps) {
  const routes = useMemo<RouteOption[]>(() => {
    const out: RouteOption[] = [];
    for (const e of edges) {
      const otherId = e.sourceId === api.id ? e.targetId : e.targetId === api.id ? e.sourceId : null;
      const fn = otherId ? nodes.find((n) => n.id === otherId && n.type === "lambda") : undefined;
      if (!fn) continue;
      for (const r of edgeRoutes(e)) out.push({ method: r.method.toUpperCase(), path: r.path, fn: String(fn.config.name ?? fn.label) });
    }
    return out;
  }, [api.id, nodes, edges]);

  const [routeIndex, setRouteIndex] = useState(0);
  const route = routes[routeIndex] ?? { method: "GET", path: "/", fn: "" };
  const [method, setMethod] = useState(route.method === "ANY" ? "GET" : route.method);
  const [params, setParams] = useState<Record<string, string>>({});
  const [query, setQuery] = useState<Pair[]>([{ key: "", value: "" }]);
  const [headers, setHeaders] = useState<Pair[]>([{ key: "Content-Type", value: "application/json" }, { key: "", value: "" }]);
  const [body, setBody] = useState('{\n  "name": "Coffee beans",\n  "price": 12.5\n}');
  const [tab, setTab] = useState<"params" | "headers" | "body">("params");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [respTab, setRespTab] = useState<"body" | "headers">("body");

  const names = [...route.path.matchAll(PARAM)].map((m) => m[1]);
  const path = route.path.replace(PARAM, (_, n: string) => encodeURIComponent(params[n] ?? "") || `{${n}}`);
  const missing = names.filter((n) => !params[n]);
  const hasBody = BODY_METHODS.has(method);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (i: number) => {
    setRouteIndex(i);
    const m = routes[i]?.method ?? "GET";
    setMethod(m === "ANY" ? "GET" : m);
    setTab(BODY_METHODS.has(m) ? "body" : "params");
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const toMap = (pairs: Pair[]) => Object.fromEntries(pairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]));
      const res = await testApi(workspaceId, projectId, {
        nodeId: api.id,
        method,
        path,
        query: toMap(query),
        headers: hasBody ? toMap(headers) : toMap(headers.filter((h) => h.key.toLowerCase() !== "content-type")),
        body: hasBody ? body : "",
      });
      setResult(res);
      setRespTab("body");
    } catch (err) {
      setResult(null);
      setError(errorMessage(err, "The request could not be sent."));
    } finally {
      setSending(false);
    }
  };

  const shown = result ? pretty(result.base64 ? "(binary body, base64)\n" + result.body : result.body, result.headers["content-type"]) : null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label="Test the API" className="w-full max-w-6xl h-[min(86vh,780px)] bg-page border border-edge rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
          <header className="flex items-center gap-3 px-5 h-14 border-b border-edge shrink-0">
            <p className="text-sm font-semibold text-ink">Test {String(api.config.name ?? "the API")}</p>
            <code className="text-[11px] font-mono text-ink-dim truncate">{baseUrl}</code>
            <div className="flex-1" />
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors">
              <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div className="flex-1 flex min-h-0">
            {/* Routes */}
            <nav aria-label="Routes" className="w-56 shrink-0 border-r border-edge overflow-y-auto py-2">
              {routes.length === 0 && <p className="px-4 py-2 text-xs text-ink-dim">The API has no routes in the diagram.</p>}
              {routes.map((r, i) => (
                <button
                  key={`${r.method}-${r.path}-${i}`}
                  onClick={() => pick(i)}
                  aria-current={i === routeIndex}
                  className={["w-full text-left px-4 py-2 transition-colors", i === routeIndex ? "bg-indigo-500/[0.08]" : "hover:bg-card"].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-[10px] font-mono font-bold" style={{ color: METHOD_COLORS[r.method] ?? METHOD_COLORS.ANY }}>
                      {r.method}
                    </span>
                    <span className="text-xs font-mono text-ink truncate">{r.path}</span>
                  </span>
                  <span className="block pl-14 text-[10px] text-ink-dim truncate">{r.fn}</span>
                </button>
              ))}
            </nav>

            {/* Request */}
            <div className="w-[44%] shrink-0 border-r border-edge flex flex-col min-h-0">
              <form
                className="flex items-center gap-2 p-3 border-b border-edge"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <select
                  aria-label="Method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="h-9 rounded-lg border border-edge bg-page px-2 text-xs font-mono font-bold"
                  style={{ color: METHOD_COLORS[method] ?? METHOD_COLORS.ANY }}
                >
                  {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <code className="flex-1 min-w-0 h-9 flex items-center rounded-lg border border-edge bg-card/50 px-2.5 text-xs font-mono text-ink truncate" title={path}>
                  {path}
                </code>
                <Button type="submit" size="sm" className="h-9" disabled={sending || missing.length > 0}>
                  {sending ? "Sending…" : "Send"}
                </Button>
              </form>

              <div role="tablist" className="flex gap-4 px-4 border-b border-edge text-xs">
                {(["params", "headers", "body"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    disabled={t === "body" && !hasBody}
                    className={["py-2 border-b-2 -mb-px capitalize transition-colors disabled:opacity-40", tab === t ? "border-indigo-500 text-ink" : "border-transparent text-ink-dim hover:text-ink"].join(" ")}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {tab === "params" && (
                  <div className="p-4 flex flex-col gap-4">
                    {names.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-dim mb-2">Path</p>
                        <div className="flex flex-col gap-1.5">
                          {names.map((n) => (
                            <label key={n} className="flex items-center gap-2">
                              <code className="w-24 shrink-0 text-xs font-mono text-ink">{n}</code>
                              <input
                                value={params[n] ?? ""}
                                onChange={(e) => setParams((p) => ({ ...p, [n]: e.target.value }))}
                                placeholder="required"
                                className="flex-1 h-8 rounded-lg border border-edge bg-page px-2.5 text-xs font-mono text-ink"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-dim mb-2">Query</p>
                      <Pairs pairs={query} onChange={setQuery} keyPlaceholder="limit" valuePlaceholder="10" />
                    </div>
                  </div>
                )}
                {tab === "headers" && (
                  <div className="p-4">
                    <Pairs pairs={headers} onChange={setHeaders} keyPlaceholder="Authorization" valuePlaceholder="Bearer …" />
                  </div>
                )}
                {tab === "body" && hasBody && (
                  <div className="h-full min-h-64">
                    <CodeEditor value={body} onChange={setBody} language="json" path="file:///api-test/body.json" />
                  </div>
                )}
              </div>
            </div>

            {/* Response */}
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
              {error ? (
                <div className="m-4 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3 text-xs text-ink">{error}</div>
              ) : !result ? (
                <div className="flex-1 flex items-center justify-center text-center px-8">
                  <p className="text-xs text-ink-dim">
                    {missing.length > 0 ? `Fill in ${missing.join(", ")} and send the request.` : "Send the request to see the answer."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-4 h-12 border-b border-edge shrink-0">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${statusClass(result.status)}`}>{result.status}</span>
                    <span className="text-[11px] text-ink-dim">{result.durationMs} ms</span>
                    <span className="text-[11px] text-ink-dim">{new TextEncoder().encode(result.body).length} B</span>
                    {result.truncated && <span className="text-[11px] text-amber-600">cut at 1 MB</span>}
                    <div className="flex-1" />
                    <div role="tablist" className="flex gap-3 text-xs">
                      {(["body", "headers"] as const).map((t) => (
                        <button key={t} role="tab" aria-selected={respTab === t} onClick={() => setRespTab(t)} className={["capitalize", respTab === t ? "text-ink font-medium" : "text-ink-dim hover:text-ink"].join(" ")}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    {respTab === "body" ? (
                      shown && shown.text ? (
                        <CodeEditor key={result.url + result.durationMs} value={shown.text} onChange={() => {}} language={shown.json ? "json" : "plaintext"} readOnly path="file:///api-test/response" />
                      ) : (
                        <p className="p-4 text-xs text-ink-dim">No body.</p>
                      )
                    ) : (
                      <dl className="p-4 grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1.5 text-[11px] font-mono overflow-y-auto h-full">
                        {Object.entries(result.headers).map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-ink-dim truncate">{k}</dt>
                            <dd className="text-ink break-all">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function Pairs({ pairs, onChange, keyPlaceholder, valuePlaceholder }: { pairs: Pair[]; onChange: (p: Pair[]) => void; keyPlaceholder: string; valuePlaceholder: string }) {
  const set = (i: number, patch: Partial<Pair>) => {
    const next = pairs.map((p, j) => (j === i ? { ...p, ...patch } : p));
    // A new empty row appears once the last one is used.
    if (next[next.length - 1].key || next[next.length - 1].value) next.push({ key: "", value: "" });
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1.5">
      {pairs.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input aria-label="Name" value={p.key} placeholder={keyPlaceholder} onChange={(e) => set(i, { key: e.target.value })} className="w-[40%] h-8 rounded-lg border border-edge bg-page px-2.5 text-xs font-mono text-ink placeholder:text-ink-dim/60" />
          <input aria-label="Value" value={p.value} placeholder={valuePlaceholder} onChange={(e) => set(i, { value: e.target.value })} className="flex-1 h-8 rounded-lg border border-edge bg-page px-2.5 text-xs font-mono text-ink placeholder:text-ink-dim/60" />
          {pairs.length > 1 && i < pairs.length - 1 && (
            <button onClick={() => onChange(pairs.filter((_, j) => j !== i))} aria-label="Remove" className="w-7 h-7 rounded-md flex items-center justify-center text-ink-dim hover:text-red-500">
              <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M1 1l8 8M9 1L1 9" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
