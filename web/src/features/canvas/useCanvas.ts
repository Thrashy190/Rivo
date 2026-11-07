import { useState, useCallback } from "react";
import type { InfraModel } from "../../types/infra";

export interface CanvasNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  variant?: "service" | "container";
  size?: { width: number; height: number };
  parentId?: string;
}

export interface CanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
  config?: EdgeConfig;
}

// Settings of a connection. Which ones apply depends on what it joins (see
// connections.ts).
export interface EdgeConfig {
  // API Gateway → Lambda. Older diagrams have one method and path instead.
  routes?: Route[];
  method?: string;
  path?: string;
  // Lambda ↔ DynamoDB or S3.
  access?: "read" | "write" | "readwrite";
}

export interface Route {
  method: string;
  path: string;
}

// A group of nodes and their connections, such as a blueprint. Links refer to
// nodes by their position in the list.
export interface CanvasGraph {
  nodes: { type: string; offset: { x: number; y: number }; config?: Record<string, unknown> }[];
  links: { from: number; to: number; config?: EdgeConfig }[];
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

const SERVICE_LABELS: Record<string, string> = {
  lambda: "Lambda Function",
  "api-gateway": "API Gateway",
  dynamodb: "DynamoDB Table",
  region: "AWS Region",
  vpc: "VPC",
  subnet: "Subnet",
  ec2: "EC2 Instance",
  s3: "S3 Bucket",
  rds: "RDS Database",
  sqs: "SQS Queue",
  sns: "SNS Topic",
  "iam-role": "IAM Role",
  cloudwatch: "CloudWatch",
  ecs: "ECS Cluster",
  "load-balancer": "Load Balancer",
  "secrets-manager": "Secrets Manager",
  "elastic-cache": "ElastiCache",
  cloudfront: "CloudFront",
  eventbridge: "EventBridge Rule",
};

const CONTAINER_TYPES = new Set(["region", "vpc", "subnet"]);

const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  lambda: { runtime: "nodejs22.x", memory: 128, timeout: 30, handler: "index.handler", architecture: "arm64" },
  "api-gateway": { apiType: "HTTP", stage: "$default", authorizationType: "NONE", cors: true },
  dynamodb: { billingMode: "PAY_PER_REQUEST", partitionKey: "id", partitionKeyType: "S" },
  region: { provider: "aws", region: "us-east-1" },
  vpc: { cidr: "10.0.0.0/16", enableDnsHostnames: true },
  subnet: { cidr: "10.0.1.0/24", type: "public", availabilityZone: "us-east-1a" },
  ec2: { instanceType: "t3.micro", keyPair: "" },
  s3: { versioning: false, encryption: "AES256", blockPublicAccess: true, forceDestroy: false },
  rds: { engine: "postgres", instanceClass: "db.t3.micro", multiAZ: false },
  sqs: { messageRetentionPeriod: 86400, visibilityTimeout: 30, fifo: false },
  sns: { protocol: "email" },
  "iam-role": { trustPolicy: "lambda.amazonaws.com" },
  cloudwatch: { retentionDays: 30 },
  ecs: { launchType: "FARGATE", cpu: 256, memory: 512 },
  "load-balancer": { type: "application", scheme: "internet-facing" },
  "secrets-manager": { rotationEnabled: false },
  "elastic-cache": { engine: "redis", nodeType: "cache.t3.micro" },
  cloudfront: { priceClass: "PriceClass_100", httpVersion: "http2and3", defaultRootObject: "index.html", compress: true, spa: false },
  eventbridge: { trigger: "schedule", schedule: "rate(5 minutes)", enabled: true },
};

const DEFAULT_SIZES: Record<string, { width: number; height: number }> = {
  region: { width: 640, height: 420 },
  vpc: { width: 440, height: 300 },
  subnet: { width: 260, height: 200 },
};

let nodeCounter = 0;

function newNode(
  serviceId: string,
  position: { x: number; y: number },
  config?: Record<string, unknown>,
  size?: { width: number; height: number },
): CanvasNode {
  nodeCounter += 1;
  const id = `${serviceId}-${nodeCounter}`;
  const isContainer = CONTAINER_TYPES.has(serviceId);
  const baseSize = size ?? (isContainer ? DEFAULT_SIZES[serviceId] : undefined);
  return {
    id,
    type: serviceId,
    label: SERVICE_LABELS[serviceId] ?? serviceId,
    position,
    config: { name: `${serviceId}-${nodeCounter}`, ...DEFAULT_CONFIGS[serviceId], ...config },
    variant: isContainer ? "container" : "service",
    ...(baseSize ? { size: baseSize } : {}),
  };
}

export function serviceLabel(type: string): string {
  return SERVICE_LABELS[type] ?? type;
}

export function useCanvas() {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);

  // Hydrate canvas from a saved model (e.g. loaded from API).
  // Also syncs nodeCounter so new nodes don't collide with existing IDs.
  const resetCanvas = useCallback((newNodes: CanvasNode[], newEdges: CanvasEdge[]) => {
    for (const n of newNodes) {
      const num = parseInt(n.id.split("-").pop() ?? "0", 10);
      if (!isNaN(num) && num > nodeCounter) nodeCounter = num;
    }
    setNodes(newNodes);
    setEdges(newEdges);
  }, []);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  const addNode = useCallback(
    (
      serviceId: string,
      position: { x: number; y: number },
      config?: Record<string, unknown>,
      size?: { width: number; height: number },
    ) => {
      const node = newNode(serviceId, position, config, size);
      setNodes((prev) => [...prev, node]);
      return node.id;
    },
    []
  );

  // Adds a group of connected nodes around `origin`. Returns the new IDs.
  const insertGraph = useCallback((graph: CanvasGraph, origin: { x: number; y: number }) => {
    const created = graph.nodes.map((n) =>
      newNode(n.type, { x: origin.x + n.offset.x, y: origin.y + n.offset.y }, n.config),
    );
    const links: CanvasEdge[] = graph.links.map((l) => {
      const sourceId = created[l.from].id;
      const targetId = created[l.to].id;
      return { id: `edge-${sourceId}__${targetId}`, sourceId, targetId, ...(l.config ? { config: l.config } : {}) };
    });
    setNodes((prev) => [...prev, ...created]);
    setEdges((prev) => [...prev, ...links]);
    return created.map((n) => n.id);
  }, []);

  const moveNode = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      setNodes((prev) => {
        const node = prev.find((n) => n.id === nodeId);
        if (!node) return prev;
        // When moving a container, also move attached children by the same delta
        if (node.variant === "container") {
          const dx = position.x - node.position.x;
          const dy = position.y - node.position.y;
          return prev.map((n) => {
            if (n.id === nodeId) return { ...n, position };
            if (n.parentId === nodeId) {
              return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
            }
            return n;
          });
        }
        return prev.map((n) => (n.id === nodeId ? { ...n, position } : n));
      });
    },
    []
  );

  const resizeNode = useCallback(
    (nodeId: string, size: { width: number; height: number }) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, size } : n))
      );
    },
    []
  );

  const removeNode = useCallback((nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) =>
      prev.filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId)
    );
  }, []);

  const updateNodeConfig = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, config } : n))
      );
    },
    []
  );

  const addEdge = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const id = `edge-${sourceId}__${targetId}`;
    // Two connections between the same nodes would mean the same thing.
    setEdges((prev) => {
      const exists = prev.some(
        (e) =>
          (e.sourceId === sourceId && e.targetId === targetId) ||
          (e.sourceId === targetId && e.targetId === sourceId)
      );
      if (exists) return prev;
      return [...prev, { id, sourceId, targetId }];
    });
  }, []);

  const attachNode = useCallback(
    (nodeId: string, parentId: string | null) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, parentId: parentId ?? undefined }
            : n
        )
      );
    },
    []
  );

  const removeEdge = useCallback((edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  }, []);

  const updateEdgeConfig = useCallback(
    (edgeId: string, config: CanvasEdge["config"]) => {
      setEdges((prev) =>
        prev.map((e) => (e.id === edgeId ? { ...e, config } : e))
      );
    },
    []
  );

  // Reverses a connection, for those where direction matters (an EventBridge
  // rule runs a function; a function sends events to a rule's bus).
  const reverseEdge = useCallback((edgeId: string) => {
    setEdges((prev) =>
      prev.map((e) => (e.id === edgeId ? { ...e, sourceId: e.targetId, targetId: e.sourceId } : e)),
    );
  }, []);

  const toJSON = useCallback(
    (): InfraModel => ({
      version: "1",
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        config: n.config,
        ...(n.parentId ? { parentId: n.parentId } : {}),
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        type: "depends_on" as const,
        ...(e.config ? { config: e.config } : {}),
      })),
    }),
    [nodes, edges]
  );

  return {
    nodes,
    edges,
    viewport,
    setViewport,
    addNode,
    moveNode,
    resizeNode,
    removeNode,
    updateNodeConfig,
    attachNode,
    addEdge,
    removeEdge,
    updateEdgeConfig,
    reverseEdge,
    insertGraph,
    toJSON,
    resetCanvas,
  };
}
