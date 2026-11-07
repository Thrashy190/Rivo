/**
 * What a connection between two services means. It mirrors connect() in
 * services/shared/tfgen/generate.go, which turns each kind into Terraform:
 * change both together.
 */

import type { CanvasEdge, CanvasNode, Route } from "./useCanvas";

export type ConnectionKind =
  | "route"    // API Gateway → Lambda: an HTTP route
  | "data"     // Lambda ↔ DynamoDB or S3: the function can use it
  | "origin"   // CloudFront → S3: the distribution serves the bucket
  | "trigger"  // EventBridge → Lambda: the rule runs the function
  | "publish"  // Lambda → EventBridge: the function sends events to the bus
  | "unsupported";

export interface Connection {
  kind: ConnectionKind;
  edge: CanvasEdge;
  source: CanvasNode;
  target: CanvasNode;
}

function pair(a: string, b: string) {
  return [a, b].sort().join("+");
}

export function connectionKind(source: CanvasNode, target: CanvasNode): ConnectionKind {
  switch (pair(source.type, target.type)) {
    case pair("api-gateway", "lambda"):
      return "route";
    case pair("dynamodb", "lambda"):
    case pair("lambda", "s3"):
      return "data";
    case pair("cloudfront", "s3"):
      return "origin";
    case pair("eventbridge", "lambda"):
      return source.type === "eventbridge" ? "trigger" : "publish";
    default:
      return "unsupported";
  }
}

export function resolveConnection(edge: CanvasEdge, nodes: CanvasNode[]): Connection | null {
  const source = nodes.find((n) => n.id === edge.sourceId);
  const target = nodes.find((n) => n.id === edge.targetId);
  if (!source || !target) return null;
  return { kind: connectionKind(source, target), edge, source, target };
}

// A route connection's routes, reading the single method and path of older diagrams.
export function edgeRoutes(edge: CanvasEdge): Route[] {
  if (edge.config?.routes?.length) return edge.config.routes;
  if (edge.config?.method || edge.config?.path) {
    return [{ method: edge.config.method ?? "ANY", path: edge.config.path ?? "/" }];
  }
  return [];
}

export const ACCESS_LABELS = { read: "Read", write: "Write", readwrite: "Read & write" } as const;

// The short text drawn on the line.
export function connectionLabel(c: Connection): string {
  switch (c.kind) {
    case "route": {
      const routes = edgeRoutes(c.edge);
      if (routes.length === 0) return "ANY /";
      const first = `${routes[0].method} ${routes[0].path}`;
      return routes.length > 1 ? `${first} +${routes.length - 1}` : first;
    }
    case "data":
      return ACCESS_LABELS[c.edge.config?.access ?? "readwrite"].toLowerCase();
    case "origin":
      return "origin";
    case "trigger":
      return "runs";
    case "publish":
      return "sends events";
    default:
      return "";
  }
}

export function connectionDescription(c: Connection): string {
  const s = String(c.source.config.name ?? c.source.label);
  const t = String(c.target.config.name ?? c.target.label);
  switch (c.kind) {
    case "route":
      return "Requests to this route run the function.";
    case "data": {
      const fn = c.source.type === "lambda" ? s : t;
      const store = c.source.type === "lambda" ? t : s;
      return `${fn} gets permission to use ${store}, and its name in an environment variable.`;
    }
    case "origin":
      return "The distribution serves the bucket's files. The bucket stays private: only CloudFront can read it.";
    case "trigger":
      return `${s} runs ${t} on its schedule, or for each event that matches its pattern.`;
    case "publish":
      return `${s} can send events to the default bus, in EVENT_BUS_NAME. ${t} picks up the ones that match its pattern.`;
    default:
      return "This connection is drawn for reference: Rivo does not generate it yet.";
  }
}

// Colours of the line, by kind. Routes use their method's colour.
export const METHOD_COLORS: Record<string, string> = {
  GET: "#10b981",
  POST: "#3b82f6",
  PUT: "#f59e0b",
  PATCH: "#8b5cf6",
  DELETE: "#ef4444",
  ANY: "#6366f1",
  HEAD: "#14b8a6",
  OPTIONS: "#64748b",
};

const KIND_COLORS: Record<ConnectionKind, string> = {
  route: METHOD_COLORS.ANY,
  data: "#14b8a6",
  origin: "#8b5cf6",
  trigger: "#ec4899",
  publish: "#ec4899",
  unsupported: "#71717a",
};

export function connectionColor(c: Connection): string {
  if (c.kind === "route") {
    const routes = edgeRoutes(c.edge);
    const methods = new Set(routes.map((r) => r.method));
    const only = methods.size === 1 ? [...methods][0] : "ANY";
    return METHOD_COLORS[only] ?? METHOD_COLORS.ANY;
  }
  return KIND_COLORS[c.kind];
}
