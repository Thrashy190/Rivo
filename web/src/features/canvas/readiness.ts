/**
 * What still stops a service from becoming working infrastructure, shown on
 * the canvas before anyone generates Terraform. The generator
 * (services/shared/tfgen) has the final word and reports the same things as
 * warnings.
 */

import { GENERATED_TYPES } from "./aws-services";
import { lambdaSource } from "./lambdaSource";
import type { CanvasEdge, CanvasNode } from "./useCanvas";

export interface Issue {
  message: string;
  // "todo" still generates, with a placeholder; "skipped" is left out.
  level: "todo" | "skipped";
}

const COMPILED = /^(java|provided)/;
const SCHEDULE = /^(rate\(\d+ (minute|minutes|hour|hours|day|days)\)|cron\([^()]+\))$/;

function neighbours(node: CanvasNode, nodes: CanvasNode[], edges: CanvasEdge[]) {
  const out: { node: CanvasNode; outgoing: boolean }[] = [];
  for (const e of edges) {
    if (e.sourceId === node.id) {
      const other = nodes.find((n) => n.id === e.targetId);
      if (other) out.push({ node: other, outgoing: true });
    } else if (e.targetId === node.id) {
      const other = nodes.find((n) => n.id === e.sourceId);
      if (other) out.push({ node: other, outgoing: false });
    }
  }
  return out;
}

export function nodeIssues(node: CanvasNode, nodes: CanvasNode[], edges: CanvasEdge[]): Issue[] {
  if (node.variant === "container") return [];
  if (!GENERATED_TYPES.has(node.type)) {
    return [{ level: "skipped", message: "Rivo does not generate this service yet. It stays in the diagram as a note." }];
  }
  const near = neighbours(node, nodes, edges);
  const issues: Issue[] = [];

  switch (node.type) {
    case "lambda": {
      const source = lambdaSource(node);
      const runtime = String(node.config.runtime ?? "nodejs22.x");
      if (COMPILED.test(runtime) && source.kind !== "package") {
        issues.push({ level: "todo", message: `${runtime} needs a compiled .zip. Upload one in the Code tab.` });
      } else if (source.kind === "none") {
        issues.push({ level: "todo", message: "No code yet: it deploys with a placeholder that answers \"Hello from Lambda\"." });
      }
      break;
    }
    case "api-gateway":
      if (!near.some((n) => n.node.type === "lambda")) {
        issues.push({ level: "todo", message: "No routes yet. Connect it to a Lambda function." });
      }
      break;
    case "cloudfront":
      if (!near.some((n) => n.node.type === "s3")) {
        issues.push({ level: "skipped", message: "No origin. Connect it to an S3 bucket to serve its files." });
      }
      break;
    case "eventbridge": {
      if (!near.some((n) => n.node.type === "lambda" && n.outgoing)) {
        issues.push({ level: "todo", message: "No target. Connect it to a Lambda function for the rule to run it." });
      }
      if ((node.config.trigger ?? "schedule") === "schedule" && !SCHEDULE.test(String(node.config.schedule ?? "rate(5 minutes)"))) {
        issues.push({ level: "todo", message: "The schedule is not valid, so it runs every 5 minutes." });
      }
      if (node.config.trigger === "pattern") {
        try {
          const p = JSON.parse(String(node.config.eventPattern ?? ""));
          if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error();
        } catch {
          issues.push({ level: "todo", message: "The event pattern is not a JSON object." });
        }
      }
      break;
    }
  }
  return issues;
}
