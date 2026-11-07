import type { CanvasNode } from "./useCanvas";

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

// Inline code lives in the diagram, which is limited to 5 MB.
export const MAX_INLINE_CODE_BYTES = 256 * 1024;

export function lambdaSource(node: CanvasNode): LambdaSource {
  const { source, code, package: pkg } = node.config as { source?: string; code?: unknown; package?: LambdaPackage };
  if (source === "package" && pkg?.id) return { kind: "package", package: pkg };
  if (source === "inline" && typeof code === "string") return { kind: "inline", code };
  return { kind: "none" };
}

export function withInlineCode(node: CanvasNode, code: string): Record<string, unknown> {
  return { ...node.config, source: "inline", code };
}

export function withPackage(node: CanvasNode, pkg: LambdaPackage): Record<string, unknown> {
  return { ...node.config, source: "package", package: pkg };
}
