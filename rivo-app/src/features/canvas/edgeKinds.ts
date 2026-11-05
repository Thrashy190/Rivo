/**
 * Edge kind resolution.
 *
 * Determines what config panel (if any) to show when an edge is selected,
 * based on the types of the two connected nodes.
 *
 * To support a new edge type, add an entry to EDGE_KIND_MAP.
 * Keys are sorted so "lambda+api-gateway" === "api-gateway+lambda".
 */

import type { CanvasNode, CanvasEdge } from "./useCanvas";

// ── Registered edge kinds ─────────────────────────────────────────────────────

export type EdgeKind =
  | { kind: "route";  apiGw: CanvasNode; lambda: CanvasNode }
  | { kind: "none" };

/** Canonical pair key — order-independent */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join("+");
}

const CONFIGURABLE_PAIRS = new Set([
  pairKey("api-gateway", "lambda"),
  // future: pairKey("lambda", "dynamodb"), pairKey("cloudfront", "s3"), …
]);

// ── Resolver ──────────────────────────────────────────────────────────────────

export function resolveEdgeKind(
  edge: CanvasEdge | null,
  nodes: CanvasNode[]
): EdgeKind {
  if (!edge) return { kind: "none" };

  const source = nodes.find((n) => n.id === edge.sourceId);
  const target = nodes.find((n) => n.id === edge.targetId);
  if (!source || !target) return { kind: "none" };

  const key = pairKey(source.type, target.type);

  if (!CONFIGURABLE_PAIRS.has(key)) return { kind: "none" };

  if (key === pairKey("api-gateway", "lambda")) {
    const apiGw  = source.type === "api-gateway" ? source : target;
    const lambda = source.type === "lambda"       ? source : target;
    return { kind: "route", apiGw, lambda };
  }

  return { kind: "none" };
}
