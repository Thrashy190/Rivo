/**
 * Global secondary indexes of a DynamoDB table, kept in its node's config as
 * `indexes`. services/shared/tfgen reads the same keys and applies the same
 * rules: change both together.
 */

import type { CanvasNode } from "./useCanvas";

export type KeyType = "S" | "N" | "B";

export interface TableIndex {
  name: string;
  partitionKey: string;
  partitionKeyType?: KeyType;
  sortKey?: string;
  sortKeyType?: KeyType;
  // ALL copies every attribute into the index; KEYS_ONLY only the keys.
  projection?: "ALL" | "KEYS_ONLY";
}

export const MAX_INDEXES = 20;
const INDEX_NAME = /^[A-Za-z0-9_.-]{3,255}$/;

export function tableIndexes(node: CanvasNode): TableIndex[] {
  return Array.isArray(node.config.indexes) ? (node.config.indexes as TableIndex[]) : [];
}

// The key types also come as labels such as "N — Number".
export function keyType(t: unknown): KeyType {
  const first = String(t ?? "S").trim().charAt(0).toUpperCase();
  return first === "N" || first === "B" ? first : "S";
}

// Why the generator would leave each index out, by position. Empty means it is fine.
export function indexProblems(node: CanvasNode): string[] {
  const types = new Map<string, KeyType>();
  const pk = String(node.config.partitionKey ?? "id").trim() || "id";
  types.set(pk, keyType(node.config.partitionKeyType));
  const sk = String(node.config.sortKey ?? "").trim();
  if (sk) types.set(sk, keyType(node.config.sortKeyType));

  const seen = new Set<string>();
  let kept = 0;
  return tableIndexes(node).map((ix) => {
    const name = (ix.name ?? "").trim();
    const ipk = (ix.partitionKey ?? "").trim();
    let isk = (ix.sortKey ?? "").trim();
    if (isk === ipk) isk = "";
    if (!INDEX_NAME.test(name)) return "Use 3 to 255 letters, digits, '_', '-' or '.' for the name.";
    if (seen.has(name)) return `There is already an index called ${name}.`;
    if (!ipk) return "Set a partition key.";
    if (kept === MAX_INDEXES) return `A table takes up to ${MAX_INDEXES} indexes.`;
    const conflict = (attr: string, t: KeyType) => {
      const have = types.get(attr);
      return have && have !== t ? `${attr} is already a ${have} key, not ${t}.` : "";
    };
    const problem = conflict(ipk, keyType(ix.partitionKeyType)) || (isk ? conflict(isk, keyType(ix.sortKeyType)) : "");
    if (problem) return problem;
    types.set(ipk, keyType(ix.partitionKeyType));
    if (isk) types.set(isk, keyType(ix.sortKeyType));
    seen.add(name);
    kept++;
    return "";
  });
}
