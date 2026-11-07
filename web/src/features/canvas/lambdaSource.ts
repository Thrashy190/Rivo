import type { CanvasEdge, CanvasNode } from "./useCanvas";

// Where a Lambda's code comes from, kept in its node's config so it is saved
// and versioned with the diagram.
export interface LambdaPackage {
  id: string;
  name: string;
  size: number;
  uploadedAt: number;
}

export type LambdaSource =
  | { kind: "inline"; code: string }
  | { kind: "package"; package: LambdaPackage }
  | { kind: "none" };

// Inline code lives in the diagram, which is limited to 5 MB. The limit covers
// the handler and its other files together.
export const MAX_INLINE_CODE_BYTES = 256 * 1024;

export function lambdaSource(node: CanvasNode): LambdaSource {
  const { source, code, package: pkg } = node.config as { source?: string; code?: unknown; package?: LambdaPackage };
  if (source === "package" && pkg?.id) return { kind: "package", package: pkg };
  if (source === "inline" && typeof code === "string") return { kind: "inline", code };
  return { kind: "none" };
}

// Files next to the handler, such as modules it imports, by path.
export function functionFiles(node: CanvasNode): Record<string, string> {
  const files = node.config.files;
  return files && typeof files === "object" && !Array.isArray(files) ? (files as Record<string, string>) : {};
}

// The same rule as filePath in tfgen: up to five folders, no "..".
export const FILE_PATH = /^[A-Za-z0-9_][A-Za-z0-9_.-]*(\/[A-Za-z0-9_][A-Za-z0-9_.-]*){0,4}$/;
export const MAX_FUNCTION_FILES = 50;

export function validFilePath(path: string): boolean {
  return FILE_PATH.test(path) && !path.includes("..");
}

export function withInlineCode(node: CanvasNode, code: string, files: Record<string, string> = functionFiles(node)): Record<string, unknown> {
  return { ...node.config, source: "inline", code, files };
}

export function withPackage(node: CanvasNode, pkg: LambdaPackage): Record<string, unknown> {
  return { ...node.config, source: "package", package: pkg };
}

// The same names the Terraform generator gives (envName in tfgen/names.go).
function envName(name: string, suffix: string) {
  let s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!s) s = "resource";
  if (/^[0-9]/.test(s)) s = `r_${s}`;
  return `${s.slice(0, 48).replace(/_+$/, "").toUpperCase()}_${suffix}`;
}

// Variables Rivo adds because of the function's connections.
export function connectedVariables(node: CanvasNode, nodes: CanvasNode[], edges: CanvasEdge[]) {
  const out: { key: string; from: string }[] = [];
  for (const e of edges) {
    const otherId = e.sourceId === node.id ? e.targetId : e.targetId === node.id ? e.sourceId : null;
    const other = otherId ? nodes.find((n) => n.id === otherId) : null;
    if (!other) continue;
    const name = String(other.config.name ?? other.id);
    if (other.type === "dynamodb") out.push({ key: envName(name, "TABLE"), from: name });
    if (other.type === "s3") out.push({ key: envName(name, "BUCKET"), from: name });
    if (other.type === "eventbridge" && e.sourceId === node.id) out.push({ key: "EVENT_BUS_NAME", from: "default bus" });
  }
  return out.filter((v, i) => out.findIndex((w) => w.key === v.key) === i);
}
