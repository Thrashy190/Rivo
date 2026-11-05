import { useState } from "react";
import type { CanvasNode, CanvasEdge } from "../useCanvas";

type Tab = "endpoints" | "test";

const METHOD_COLORS: Record<string, string> = {
  GET:    "text-emerald-400 bg-emerald-500/10",
  POST:   "text-sky-400    bg-sky-500/10",
  PUT:    "text-amber-400  bg-amber-500/10",
  PATCH:  "text-violet-400 bg-violet-500/10",
  DELETE: "text-red-400    bg-red-500/10",
  ANY:    "text-zinc-400   bg-zinc-700/40",
};

interface Endpoint {
  edgeId: string;
  method: string;
  path: string;
  lambdaName: string;
}

function deriveEndpoints(node: CanvasNode, edges: CanvasEdge[], allNodes: CanvasNode[]): Endpoint[] {
  return edges
    .filter((e) => e.sourceId === node.id || e.targetId === node.id)
    .filter((e) => {
      const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
      return allNodes.find((n) => n.id === otherId)?.type === "lambda";
    })
    .map((e) => {
      const lambdaId = e.sourceId === node.id ? e.targetId : e.sourceId;
      const lambda   = allNodes.find((n) => n.id === lambdaId);
      return {
        edgeId:     e.id,
        method:     e.config?.method ?? "—",
        path:       e.config?.path   ?? "(not configured)",
        lambdaName: (lambda?.config.name as string) || lambda?.label || lambdaId,
      };
    });
}

// ─── Endpoints tab ────────────────────────────────────────────────────────────

function EndpointsTab({
  node,
  edges,
  allNodes,
}: {
  node: CanvasNode;
  edges: CanvasEdge[];
  allNodes: CanvasNode[];
}) {
  const endpoints = deriveEndpoints(node, edges, allNodes);
  const [expanded, setExpanded] = useState<string | null>(null);
  const stage = String(node.config.stage ?? "prod");
  const auth  = String(node.config.authorizationType ?? "NONE");

  if (endpoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-12">
        <div className="w-10 h-10 rounded-xl bg-raised/60 border border-edge/60 flex items-center justify-center mb-1">
          <svg viewBox="0 0 20 20" className="w-5 h-5 text-ink-dim" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 10h14M10 3v14" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-xs font-medium text-ink-dim">No routes yet</p>
        <p className="text-[11px] text-ink-dim/60 max-w-[180px]">
          Connect this API Gateway to a Lambda on the canvas, then configure each edge with a method and path.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-4 space-y-1.5">
        {/* Base URL hint */}
        <p className="text-[10px] text-ink-dim/60 font-mono px-1 mb-3">
          /{stage}/…
        </p>

        {endpoints.map((ep) => (
          <div key={ep.edgeId} className="rounded-lg border border-edge/60 overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === ep.edgeId ? null : ep.edgeId)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-card/50 transition-colors text-left"
            >
              <span className={`text-[10px] font-bold font-mono w-14 shrink-0 text-center px-1.5 py-1 rounded ${METHOD_COLORS[ep.method] ?? METHOD_COLORS.ANY}`}>
                {ep.method}
              </span>
              <span className="text-xs font-mono text-ink/80 flex-1 truncate">{ep.path}</span>
              <svg
                viewBox="0 0 12 12"
                className={`w-3 h-3 text-ink-dim shrink-0 transition-transform ${expanded === ep.edgeId ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" strokeWidth="1.5"
              >
                <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {expanded === ep.edgeId && (
              <div className="px-3 pb-3 pt-2 bg-card/30 border-t border-edge/40 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-ink-dim uppercase tracking-wider w-16 shrink-0">Lambda</span>
                  <span className="text-[10px] font-mono text-indigo-300 truncate">{ep.lambdaName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-ink-dim uppercase tracking-wider w-16 shrink-0">Auth</span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{auth}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-ink-dim uppercase tracking-wider w-16 shrink-0">Full path</span>
                  <span className="text-[10px] font-mono text-ink-dim/70 truncate">/{stage}{ep.path}</span>
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

function TestTab({
  node,
  edges,
  allNodes,
}: {
  node: CanvasNode;
  edges: CanvasEdge[];
  allNodes: CanvasNode[];
}) {
  const endpoints = deriveEndpoints(node, edges, allNodes);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [body,     setBody]     = useState('{\n  \n}');
  const [headers,  setHeaders]  = useState('{\n  "Content-Type": "application/json"\n}');
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [loading,  setLoading]  = useState(false);

  if (endpoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <p className="text-xs text-ink-dim text-center">Add routes by connecting this API Gateway to a Lambda on the canvas.</p>
      </div>
    );
  }

  const selected = endpoints[Math.min(selectedIdx, endpoints.length - 1)];

  const handleSend = () => {
    setLoading(true);
    setResponse(null);
    setTimeout(() => {
      setResponse({
        status:   200,
        duration: Math.floor(Math.random() * 80) + 20,
        body:     JSON.stringify({ message: "OK", data: { id: "abc-123", createdAt: new Date().toISOString() } }, null, 2),
      });
      setLoading(false);
    }, 600);
  };

  const statusColor = (s: number) =>
    s < 300 ? "text-emerald-400" : s < 400 ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-edge/60 shrink-0 space-y-3">
        <div className="flex gap-2">
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="flex-1 h-8 text-xs bg-card border border-edge rounded-md px-2 text-ink appearance-none focus:outline-none focus:border-raised"
          >
            {endpoints.map((ep, i) => (
              <option key={ep.edgeId} value={i}>{ep.method}  {ep.path}</option>
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
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${METHOD_COLORS[selected.method] ?? METHOD_COLORS.ANY}`}>
            {selected.method}
          </span>
          <span className="text-xs font-mono text-ink-dim truncate">{selected.path}</span>
        </div>
      </div>

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
        {response && (
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <p className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider">Response</p>
              <span className={`text-[10px] font-mono font-bold ${statusColor(response.status)}`}>{response.status}</span>
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
  edges?: CanvasEdge[];
  allNodes?: CanvasNode[];
}

export function ApiGatewayPanel({ node, edges = [], allNodes = [] }: ApiGatewayPanelProps) {
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
        {tab === "endpoints"
          ? <EndpointsTab node={node} edges={edges} allNodes={allNodes} />
          : <TestTab      node={node} edges={edges} allNodes={allNodes} />
        }
      </div>
    </div>
  );
}
