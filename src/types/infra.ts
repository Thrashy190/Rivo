export interface InfraNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface InfraEdge {
  id: string;
  source: string;
  target: string;
  type: "depends_on" | "references";
}

export interface InfraModel {
  version: string;
  nodes: InfraNode[];
  edges: InfraEdge[];
}
