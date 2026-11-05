// ─── Types ────────────────────────────────────────────────────────────────────
// In production these schemas come from GET /api/service-types.
// The frontend only renders — all definitions live server-side.

export type FieldType = "text" | "number" | "select" | "boolean";

export interface ConfigField {
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
  hint?: string;
}

export type ServiceSchema = Record<string, ConfigField>;

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const SERVICE_SCHEMAS: Record<string, ServiceSchema> = {
  lambda: {
    name: {
      type: "text",
      label: "Function name",
      required: true,
      placeholder: "my-function",
    },
    runtime: {
      type: "select",
      label: "Runtime",
      options: [
        "nodejs20.x",
        "nodejs18.x",
        "python3.12",
        "python3.11",
        "python3.10",
        "go1.x",
        "java21",
        "ruby3.3",
      ],
    },
    architecture: {
      type: "select",
      label: "Architecture",
      options: ["x86_64", "arm64"],
    },
    memory: {
      type: "number",
      label: "Memory (MB)",
      min: 128,
      max: 10240,
      hint: "128 – 10,240 MB",
    },
    timeout: {
      type: "number",
      label: "Timeout (s)",
      min: 1,
      max: 900,
      hint: "1 – 900 seconds",
    },
    handler: {
      type: "text",
      label: "Handler",
      placeholder: "index.handler",
    },
    ephemeralStorage: {
      type: "number",
      label: "Ephemeral storage (MB)",
      min: 512,
      max: 10240,
      hint: "512 – 10,240 MB",
    },
    reservedConcurrency: {
      type: "number",
      label: "Reserved concurrency",
      min: 0,
      hint: "Leave empty for unreserved",
    },
  },

  "api-gateway": {
    name: {
      type: "text",
      label: "API name",
      required: true,
      placeholder: "my-api",
    },
    apiType: {
      type: "select",
      label: "API type",
      options: ["REST", "HTTP", "WebSocket"],
    },
    stage: {
      type: "text",
      label: "Stage name",
      placeholder: "prod",
    },
    authorizationType: {
      type: "select",
      label: "Authorization",
      options: ["NONE", "AWS_IAM", "COGNITO_USER_POOLS", "CUSTOM"],
    },
    throttlingBurstLimit: {
      type: "number",
      label: "Burst limit",
      min: 0,
      hint: "Max concurrent requests",
    },
    throttlingRateLimit: {
      type: "number",
      label: "Rate limit (req/s)",
      min: 0,
    },
    binaryMediaTypes: {
      type: "text",
      label: "Binary media types",
      placeholder: "image/png, application/pdf",
    },
  },

  dynamodb: {
    name: {
      type: "text",
      label: "Table name",
      required: true,
      placeholder: "my-table",
    },
    partitionKey: {
      type: "text",
      label: "Partition key",
      placeholder: "id",
    },
    partitionKeyType: {
      type: "select",
      label: "Partition key type",
      options: ["S — String", "N — Number", "B — Binary"],
    },
    sortKey: {
      type: "text",
      label: "Sort key",
      placeholder: "createdAt (optional)",
    },
    billingMode: {
      type: "select",
      label: "Billing mode",
      options: ["PAY_PER_REQUEST", "PROVISIONED"],
    },
    pointInTimeRecovery: {
      type: "boolean",
      label: "Point-in-time recovery (PITR)",
    },
    serverSideEncryption: {
      type: "boolean",
      label: "Server-side encryption (SSE)",
    },
    streamEnabled: {
      type: "boolean",
      label: "DynamoDB Streams",
    },
    ttlEnabled: {
      type: "boolean",
      label: "Time to Live (TTL)",
    },
  },

  region: {
    name: { type: "text", label: "Label", placeholder: "production" },
    region: {
      type: "select",
      label: "AWS Region",
      options: [
        "us-east-1", "us-east-2", "us-west-1", "us-west-2",
        "eu-west-1", "eu-west-2", "eu-central-1",
        "ap-northeast-1", "ap-southeast-1", "ap-southeast-2",
        "ca-central-1", "sa-east-1",
      ],
    },
  },

  vpc: {
    name: { type: "text", label: "VPC name", required: true, placeholder: "my-vpc" },
    cidr: { type: "text", label: "CIDR block", placeholder: "10.0.0.0/16", hint: "e.g. 10.0.0.0/16" },
    enableDnsHostnames: { type: "boolean", label: "Enable DNS hostnames" },
    enableDnsSupport: { type: "boolean", label: "Enable DNS support" },
    instanceTenancy: {
      type: "select",
      label: "Instance tenancy",
      options: ["default", "dedicated"],
    },
  },

  subnet: {
    name: { type: "text", label: "Subnet name", required: true, placeholder: "my-subnet" },
    cidr: { type: "text", label: "CIDR block", placeholder: "10.0.1.0/24", hint: "Must be within VPC CIDR" },
    availabilityZone: {
      type: "select",
      label: "Availability Zone",
      options: [
        "us-east-1a", "us-east-1b", "us-east-1c",
        "us-west-2a", "us-west-2b", "us-west-2c",
        "eu-west-1a", "eu-west-1b", "eu-west-1c",
        "eu-central-1a", "eu-central-1b",
        "ap-northeast-1a", "ap-northeast-1c",
      ],
    },
    type: {
      type: "select",
      label: "Subnet type",
      options: ["public", "private", "isolated"],
    },
    mapPublicIpOnLaunch: { type: "boolean", label: "Map public IP on launch" },
  },
};
