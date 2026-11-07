// ─── Types ────────────────────────────────────────────────────────────────────
// What the inspector lets people set on each service. The Terraform generator
// (services/shared/tfgen) reads the same keys: change both together.

export type FieldType = "text" | "number" | "select" | "boolean" | "color" | "textarea";

export interface ConfigField {
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
  hint?: string;
  // Shown only while another field has this value.
  showIf?: { field: string; equals: unknown };
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
        "nodejs22.x",
        "nodejs24.x",
        "python3.13",
        "python3.12",
        "ruby3.4",
        "java21",
        "provided.al2023",
      ],
      hint: "Java and provided.al2023 need an uploaded .zip",
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
      options: ["HTTP", "REST", "WebSocket"],
      hint: "Rivo generates HTTP APIs",
    },
    stage: {
      type: "text",
      label: "Stage name",
      placeholder: "$default",
      hint: "$default serves the API at the root of its URL",
    },
    cors: {
      type: "boolean",
      label: "Allow calls from browsers (CORS)",
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
      placeholder: "Optional, such as createdAt",
    },
    sortKeyType: {
      type: "select",
      label: "Sort key type",
      options: ["S — String", "N — Number", "B — Binary"],
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
    deletionProtection: {
      type: "boolean",
      label: "Deletion protection",
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
    borderColor: { type: "color", label: "Border color" },
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
    borderColor: { type: "color", label: "Border color" },
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

  s3: {
    name: { type: "text", label: "Bucket name", required: true, placeholder: "my-bucket" },
    versioning: { type: "boolean", label: "Versioning" },
    encryption: {
      type: "select",
      label: "Encryption",
      options: ["AES256", "aws:kms", "None"],
    },
    blockPublicAccess: { type: "boolean", label: "Block public access", hint: "Serve public files through CloudFront" },
    forceDestroy: { type: "boolean", label: "Delete files when the bucket is destroyed" },
  },

  ec2: {
    name: { type: "text", label: "Instance name", required: true, placeholder: "my-instance" },
    instanceType: {
      type: "select",
      label: "Instance type",
      options: ["t3.micro", "t3.small", "t3.medium", "t3.large", "m5.large", "m5.xlarge", "c5.large", "r5.large"],
    },
    ami: { type: "text", label: "AMI ID", placeholder: "ami-xxxxxxxx" },
    keyPair: { type: "text", label: "Key pair name" },
    ebsSize: { type: "number", label: "Root volume (GB)", min: 8, max: 16384 },
  },

  ecs: {
    name: { type: "text", label: "Service name", required: true, placeholder: "my-service" },
    launchType: { type: "select", label: "Launch type", options: ["FARGATE", "EC2"] },
    cpu: { type: "select", label: "CPU (vCPU)", options: ["256", "512", "1024", "2048", "4096"] },
    memory: { type: "select", label: "Memory (MB)", options: ["512", "1024", "2048", "4096", "8192"] },
    desiredCount: { type: "number", label: "Desired count", min: 0 },
  },

  "load-balancer": {
    name: { type: "text", label: "LB name", required: true, placeholder: "my-lb" },
    type: { type: "select", label: "LB type", options: ["application", "network", "gateway"] },
    scheme: { type: "select", label: "Scheme", options: ["internet-facing", "internal"] },
    deletionProtection: { type: "boolean", label: "Deletion protection" },
  },

  cloudfront: {
    name: { type: "text", label: "Distribution name", placeholder: "my-cdn" },
    priceClass: {
      type: "select",
      label: "Price class",
      options: ["PriceClass_100", "PriceClass_200", "PriceClass_All"],
    },
    httpVersion: { type: "select", label: "HTTP version", options: ["http2", "http2and3", "http3", "http1.1"] },
    defaultRootObject: { type: "text", label: "Default root object", placeholder: "index.html" },
    compress: { type: "boolean", label: "Compress objects automatically" },
    spa: { type: "boolean", label: "Single-page app", hint: "Unknown paths serve the root object, for client-side routing" },
  },

  rds: {
    name: { type: "text", label: "DB identifier", required: true, placeholder: "my-database" },
    engine: {
      type: "select",
      label: "Engine",
      options: ["postgres", "mysql", "mariadb", "oracle-ee", "sqlserver-ex"],
    },
    instanceClass: {
      type: "select",
      label: "Instance class",
      options: ["db.t3.micro", "db.t3.small", "db.t3.medium", "db.r5.large", "db.r5.xlarge"],
    },
    storageGb: { type: "number", label: "Storage (GB)", min: 20, max: 65536 },
    multiAZ: { type: "boolean", label: "Multi-AZ" },
    backupRetention: { type: "number", label: "Backup retention (days)", min: 0, max: 35 },
  },

  "elastic-cache": {
    name: { type: "text", label: "Cluster name", required: true, placeholder: "my-cache" },
    engine: { type: "select", label: "Engine", options: ["redis", "memcached"] },
    nodeType: {
      type: "select",
      label: "Node type",
      options: ["cache.t3.micro", "cache.t3.small", "cache.t3.medium", "cache.r6g.large"],
    },
    numNodes: { type: "number", label: "Number of nodes", min: 1, max: 6 },
  },

  "iam-role": {
    roleName: { type: "text", label: "Role name", required: true, placeholder: "my-role" },
    trustPolicy: {
      type: "text",
      label: "Trusted service",
      placeholder: "lambda.amazonaws.com",
      hint: "Service principal that can assume this role",
    },
  },

  "secrets-manager": {
    name: { type: "text", label: "Secret name", required: true, placeholder: "my-secret" },
    description: { type: "text", label: "Description" },
    rotationEnabled: { type: "boolean", label: "Auto rotation" },
  },

  cloudwatch: {
    logGroupName: { type: "text", label: "Log group name", placeholder: "/aws/lambda/my-function" },
    retentionDays: {
      type: "select",
      label: "Retention",
      options: ["1", "3", "7", "14", "30", "60", "90", "180", "365", "never"],
    },
    alarmEnabled: { type: "boolean", label: "Create alarm" },
  },

  sqs: {
    name: { type: "text", label: "Queue name", required: true, placeholder: "my-queue" },
    fifo: { type: "boolean", label: "FIFO queue" },
    messageRetentionPeriod: { type: "number", label: "Retention (s)", min: 60, max: 1209600, hint: "60s to 14 days" },
    visibilityTimeout: { type: "number", label: "Visibility timeout (s)", min: 0, max: 43200 },
  },

  sns: {
    name: { type: "text", label: "Topic name", required: true, placeholder: "my-topic" },
    protocol: {
      type: "select",
      label: "Protocol",
      options: ["email", "sqs", "lambda", "http", "https"],
    },
    fifo: { type: "boolean", label: "FIFO topic" },
  },

  eventbridge: {
    name: { type: "text", label: "Rule name", required: true, placeholder: "nightly-report" },
    trigger: { type: "select", label: "Runs on", options: ["schedule", "pattern"], hint: "A schedule, or events that match a pattern" },
    schedule: {
      type: "text",
      label: "Schedule",
      placeholder: "rate(5 minutes)",
      hint: "rate(5 minutes) or cron(0 12 * * ? *)",
      showIf: { field: "trigger", equals: "schedule" },
    },
    eventPattern: {
      type: "textarea",
      label: "Event pattern",
      placeholder: '{"source": ["shop.orders"]}',
      hint: "JSON. Functions connected to this rule can send matching events",
      showIf: { field: "trigger", equals: "pattern" },
    },
    description: { type: "text", label: "Description" },
    enabled: { type: "boolean", label: "Enabled" },
  },
};
