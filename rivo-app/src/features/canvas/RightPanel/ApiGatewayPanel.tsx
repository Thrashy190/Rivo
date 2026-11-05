import { useState } from "react";
import type { CanvasNode } from "../useCanvas";

type Tab = "endpoints" | "test";
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:    "text-emerald-400 bg-emerald-500/10",
  POST:   "text-sky-400    bg-sky-500/10",
  PUT:    "text-amber-400  bg-amber-500/10",
  PATCH:  "text-violet-400 bg-violet-500/10",
  DELETE: "text-red-400    bg-red-500/10",
};

interface Endpoint {
  method: HttpMethod;
  path: string;
  description: string;
  auth: string;
}

// Mock endpoints derived from node config
function deriveEndpoints(node: CanvasNode): Endpoint[] {
  const stage = String(node.config.stage ?? "prod");
  const auth = String(node.config.authorizationType ?? "NONE");
  return [
    { method: "GET",    path: `/${stage}/health`,       description: "Health check",        auth },
    { method: "GET",    path: `/${stage}/items`,         description: "List all items",      auth },
    { method: "POST",   path: `/${stage}/items`,         description: "Create a new item",   auth },
    { method: "GET",    path: `/${stage}/items/{id}`,    description: "Get item by ID",      auth },
    { method: "PUT",    path: `/${stage}/items/{id}`,    description: "Update item",         auth },
    { method: "DELETE", path: `/${stage}/items/{id}`,    description: "Delete item",         auth },
  ];
}

// ─── Endpoints tab ────────────────────────────────────────────────────────────

function EndpointsTab({ node }: { node: CanvasNode }) {
  const endpoints = deriveEndpoints(node);
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-4 space-y-1.5">
        {endpoints.map((ep, i) => (
          <div key={i} className="rounded-lg border border-edge/60 overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-card/50 transition-colors text-left"
            >
              <span className={`text-[10px] font-bold font-mono w-12 shrink-0 text-center px-1.5 py-1 rounded ${METHOD_COLORS[ep.method]}`}>
                {ep.method}
              </span>
              <span className="text-xs font-mono text-ink/80 flex-1 truncate">{ep.path}</span>
              <svg
                viewBox="0 0 12 12"
                className={`w-3 h-3 text-ink-dim shrink-0 transition-transform ${expanded === i ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" strokeWidth="1.5"
              >
                <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {expanded === i && (
              <div className="px-3 pb-3 pt-1 bg-card/30 border-t border-edge/40">
                <p className="text-xs text-ink-dim mb-2">{ep.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-ink-dim uppercase tracking-wider">Auth</span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    {ep.auth}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Test tab ─────────────────────────────────────────────────────────────────

interface TestResponse {
  status: number;
  duration: number;
  body: string;
}

function TestTab({ node }: { node: CanvasNode }) {
  const endpoints = deriveEndpoints(node);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [body, setBody] = useState('{\n  \n}');
  const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = endpoints[selectedIdx];

  const handleSend = () => {
    setLoading(true);
    setResponse(null);
    // Mock response
    setTimeout(() => {
      setResponse({
        status: 200,
        duration: Math.floor(Math.random() * 80) + 20,
        body: JSON.stringify({ message: "OK", data: { id: "abc-123", createdAt: new Date().toISOString() } }, null, 2),
      });
      setLoading(false);
    }, 600);
  };

  const statusColor = (s: number) =>
    s < 300 ? "text-emerald-400" : s < 400 ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Endpoint selector */}
      <div className="p-4 border-b border-edge/60 shrink-0 space-y-3">
        <div className="flex gap-2">
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="flex-1 h-8 text-xs bg-card border border-edge rounded-md px-2 text-ink appearance-none focus:outline-none focus:border-raised"
          >
            {endpoints.map((ep, i) => (
              <option key={i} value={i}>{ep.method} {ep.path}</option>
            ))}
          </select>
          <button
            onClick={handleSend}
            disabled={loading}
            className="px-3 h-8 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-colors shrink-0"
          >
            {loading ? "Sending…" : "Send"}
          </button>
        </div>

        {/* Method badge */}
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${METHOD_COLORS[selected.method]}`}>
            {selected.method}
          </span>
          <span className="text-xs font-mono text-ink-dim truncate">{selected.path}</span>
        </div>
      </div>

      {/* Body / Headers */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {["POST", "PUT", "PATCH"].includes(selected.method) && (
          <div>
            <p className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider mb-1.5">Body</p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full text-xs font-mono bg-card border border-edge rounded-lg p-2.5 text-ink resize-none focus:outline-none focus:border-raised transition-colors"
            />
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider mb-1.5">Headers</p>
          <textarea
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            rows={3}
            className="w-full text-xs font-mono bg-card border border-edge rounded-lg p-2.5 text-ink resize-none focus:outline-none focus:border-raised transition-colors"
          />
        </div>

        {/* Response */}
        {response && (
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <p className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider">Response</p>
              <span className={`text-[10px] font-mono font-bold ${statusColor(response.status)}`}>
                {response.status}
              </span>
              <span className="text-[10px] text-ink-dim font-mono">{response.duration}ms</span>
            </div>
            <pre className="w-full text-xs font-mono bg-card border border-edge rounded-lg p-2.5 text-emerald-400 overflow-x-auto max-h-40">
              {response.body}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface ApiGatewayPanelProps {
  node: CanvasNode;
}

export function ApiGatewayPanel({ node }: ApiGatewayPanelProps) {
  const [tab, setTab] = useState<Tab>("endpoints");

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-edge/60 shrink-0 px-4">
        {(["endpoints", "test"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-3 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize",
              tab === t
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-ink-dim hover:text-ink",
            ].join(" ")}
          >
            {t === "endpoints" ? "Endpoints" : "Test"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "endpoints" ? <EndpointsTab node={node} /> : <TestTab node={node} />}
      </div>
    </div>
  );
}
