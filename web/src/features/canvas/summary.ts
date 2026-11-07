import { edgeRoutes } from "./connections";
import type { CanvasEdge, CanvasNode } from "./useCanvas";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The second line of a node: what matters about it at a glance.
export function nodeSummary(node: CanvasNode, nodes: CanvasNode[], edges: CanvasEdge[]): string {
  const c = node.config;
  switch (node.type) {
    case "lambda":
      return `${c.runtime ?? "nodejs22.x"} · ${c.memory ?? 128} MB`;
    case "api-gateway": {
      const routes = edges
        .filter((e) => e.sourceId === node.id || e.targetId === node.id)
        .filter((e) => {
          const other = nodes.find((n) => n.id === (e.sourceId === node.id ? e.targetId : e.sourceId));
          return other?.type === "lambda";
        })
        .reduce((sum, e) => sum + Math.max(edgeRoutes(e).length, 1), 0);
      return `HTTP API · ${plural(routes, "route")}`;
    }
    case "dynamodb":
      return c.sortKey ? `Key ${c.partitionKey ?? "id"} + ${c.sortKey}` : `Key ${c.partitionKey ?? "id"}`;
    case "s3":
      return [c.blockPublicAccess === false ? "Bucket" : "Private bucket", c.versioning ? "versioned" : ""].filter(Boolean).join(" · ");
    case "cloudfront":
      return c.spa ? "CDN · single-page app" : "CDN · HTTPS";
    case "eventbridge":
      if (c.trigger === "pattern") {
        try {
          const source = JSON.parse(String(c.eventPattern ?? "{}")).source;
          return `Events from ${Array.isArray(source) ? source.join(", ") : "a pattern"}`;
        } catch {
          return "Event pattern";
        }
      }
      return String(c.schedule ?? "rate(5 minutes)");
    default:
      return node.label;
  }
}
