import type { ReactNode } from "react";

// ─── Icons ────────────────────────────────────────────────────────────────────

function LambdaIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#E07B12" />
      <path d="M11 29L17.5 14L22 22.5L25 18L29 29" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function ApiGatewayIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#8A4FFF" />
      <circle cx="13" cy="20" r="3" fill="white" />
      <circle cx="27" cy="20" r="3" fill="white" />
      <path d="M16 20h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M23 17l4 3-4 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M20 11v4M20 25v4" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function DynamoDBIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#3B4CB8" />
      <ellipse cx="20" cy="13" rx="9" ry="4" fill="white" fillOpacity="0.9" />
      <path d="M11 13v6c0 2.2 4 4 9 4s9-1.8 9-4v-6" stroke="white" strokeWidth="1.8" fill="none" />
      <path d="M11 19v5.5c0 2.2 4 4 9 4s9-1.8 9-4V19" stroke="white" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

function RegionIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#555A60" />
      <circle cx="20" cy="20" r="9" stroke="white" strokeWidth="1.8" />
      <ellipse cx="20" cy="20" rx="4.5" ry="9" stroke="white" strokeWidth="1.5" />
      <path d="M11 20h18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.5 15.5h15M12.5 24.5h15" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function VpcIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#1A7F37" />
      <rect x="9" y="9" width="22" height="22" rx="3" stroke="white" strokeWidth="2" fill="none" strokeDasharray="4 2" />
      <rect x="14" y="14" width="12" height="12" rx="2" fill="white" fillOpacity="0.25" />
      <path d="M17 20h6M20 17v6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SubnetIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#2E8B57" />
      <rect x="8" y="12" width="24" height="16" rx="3" stroke="white" strokeWidth="1.8" fill="none" />
      <path d="M8 18h24" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <circle cx="14" cy="22" r="2" fill="white" fillOpacity="0.7" />
      <circle cx="20" cy="22" r="2" fill="white" fillOpacity="0.7" />
      <circle cx="26" cy="22" r="2" fill="white" fillOpacity="0.7" />
    </svg>
  );
}

function EC2Icon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#FF9900" />
      <rect x="11" y="11" width="18" height="18" rx="2" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.8" />
      <path d="M15 15h10M15 20h10M15 25h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function S3Icon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#569A31" />
      <path d="M20 10l10 5v10l-10 5-10-5V15z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      <path d="M10 15l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20 20v10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function RDSIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#2165B0" />
      <ellipse cx="20" cy="14" rx="9" ry="3.5" fill="white" fillOpacity="0.9" />
      <path d="M11 14v12c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5V14" stroke="white" strokeWidth="1.8" fill="none" />
      <path d="M11 20c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5" stroke="white" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function SQSIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#FF4B00" />
      <rect x="9" y="15" width="22" height="10" rx="2" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.8" />
      <path d="M13 20h6M23 20h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M26 17l4 3-4 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function SNSIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#E8431A" />
      <circle cx="20" cy="20" r="4" fill="white" fillOpacity="0.9" />
      <circle cx="10" cy="14" r="2.5" fill="white" fillOpacity="0.7" />
      <circle cx="30" cy="14" r="2.5" fill="white" fillOpacity="0.7" />
      <circle cx="10" cy="26" r="2.5" fill="white" fillOpacity="0.7" />
      <circle cx="30" cy="26" r="2.5" fill="white" fillOpacity="0.7" />
      <path d="M16 18l-4-3M24 18l4-3M16 22l-4 3M24 22l4 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IAMIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#DD344C" />
      <circle cx="20" cy="15" r="5" stroke="white" strokeWidth="1.8" fill="none" />
      <path d="M10 31c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function CloudWatchIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#E5631A" />
      <path d="M9 26l6-8 5 5 4-7 6 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="9" cy="26" r="1.5" fill="white" />
      <circle cx="31" cy="26" r="1.5" fill="white" />
    </svg>
  );
}

function ECSIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#FF9900" />
      <rect x="9" y="9" width="9" height="9" rx="2" fill="white" fillOpacity="0.9" />
      <rect x="22" y="9" width="9" height="9" rx="2" fill="white" fillOpacity="0.9" />
      <rect x="9" y="22" width="9" height="9" rx="2" fill="white" fillOpacity="0.9" />
      <rect x="22" y="22" width="9" height="9" rx="2" fill="white" fillOpacity="0.4" />
    </svg>
  );
}

function LoadBalancerIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#8C4FFF" />
      <circle cx="20" cy="13" r="3.5" fill="white" fillOpacity="0.9" />
      <circle cx="11" cy="27" r="3.5" fill="white" fillOpacity="0.9" />
      <circle cx="29" cy="27" r="3.5" fill="white" fillOpacity="0.9" />
      <path d="M20 17v4M16 24l-3 1M24 24l3 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 21l-3.5 3M23 21l3.5 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SecretsManagerIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#DD344C" />
      <rect x="12" y="18" width="16" height="13" rx="2" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.8" />
      <path d="M15 18v-4a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="20" cy="24" r="2" fill="white" />
    </svg>
  );
}

function ElastiCacheIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#C7131F" />
      <path d="M20 10l3 6h7l-5.5 4 2 6.5L20 23l-6.5 3.5 2-6.5L10 16h7z" fill="white" fillOpacity="0.9" />
    </svg>
  );
}

function CloudFrontIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#8A4FFF" />
      <circle cx="20" cy="20" r="10" stroke="white" strokeWidth="1.8" fill="none" />
      <path d="M20 10v20M10 20h20" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
      <ellipse cx="20" cy="20" rx="5" ry="10" stroke="white" strokeWidth="1.5" fill="none" />
      <path d="M11 15.5a16 6 0 0 0 18 0M11 24.5a16 6 0 0 0 18 0" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

// ─── Type definitions ─────────────────────────────────────────────────────────

export type ServiceTypeCategory =
  | "compute"
  | "networking"
  | "storage"
  | "database"
  | "messaging"
  | "security"
  | "monitoring"
  | "serverless"
  | "container-infra";

export interface AwsService {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  category: string;
  typeCategory: ServiceTypeCategory;
}

export interface AwsServiceCategory {
  id: string;
  label: string;
  services: AwsService[];
}

export interface AwsTypeCategory {
  id: ServiceTypeCategory;
  label: string;
  services: AwsService[];
}

// ─── All services flat list ───────────────────────────────────────────────────

const ALL_SERVICES: AwsService[] = [
  // Serverless
  { id: "lambda",        name: "Lambda",        description: "Serverless function execution",    icon: <LambdaIcon />,        category: "serverless",       typeCategory: "serverless" },
  { id: "api-gateway",   name: "API Gateway",   description: "Managed REST & HTTP APIs",         icon: <ApiGatewayIcon />,    category: "serverless",       typeCategory: "networking" },
  { id: "dynamodb",      name: "DynamoDB",      description: "Serverless NoSQL database",        icon: <DynamoDBIcon />,      category: "serverless",       typeCategory: "database" },
  { id: "sqs",           name: "SQS",           description: "Managed message queues",           icon: <SQSIcon />,           category: "serverless",       typeCategory: "messaging" },
  { id: "sns",           name: "SNS",           description: "Pub/Sub notification service",     icon: <SNSIcon />,           category: "serverless",       typeCategory: "messaging" },
  // Compute
  { id: "ec2",           name: "EC2",           description: "Virtual machine instances",        icon: <EC2Icon />,           category: "compute",          typeCategory: "compute" },
  { id: "ecs",           name: "ECS",           description: "Container orchestration",          icon: <ECSIcon />,           category: "compute",          typeCategory: "compute" },
  { id: "load-balancer", name: "Load Balancer", description: "Application & network load balancer", icon: <LoadBalancerIcon />, category: "networking",     typeCategory: "networking" },
  { id: "cloudfront",    name: "CloudFront",    description: "Global CDN distribution",          icon: <CloudFrontIcon />,    category: "networking",       typeCategory: "networking" },
  // Storage
  { id: "s3",            name: "S3",            description: "Object storage at scale",          icon: <S3Icon />,            category: "storage",          typeCategory: "storage" },
  // Database
  { id: "rds",           name: "RDS",           description: "Managed relational database",      icon: <RDSIcon />,           category: "database",         typeCategory: "database" },
  { id: "elastic-cache", name: "ElastiCache",   description: "In-memory caching (Redis/Memcached)", icon: <ElastiCacheIcon />, category: "database",        typeCategory: "database" },
  // Security
  { id: "iam-role",      name: "IAM Role",      description: "Identity & access management",    icon: <IAMIcon />,           category: "security",         typeCategory: "security" },
  { id: "secrets-manager", name: "Secrets Manager", description: "Secrets rotation & storage",  icon: <SecretsManagerIcon />, category: "security",        typeCategory: "security" },
  // Monitoring
  { id: "cloudwatch",    name: "CloudWatch",    description: "Logs, metrics & alarms",           icon: <CloudWatchIcon />,    category: "monitoring",       typeCategory: "monitoring" },
  // Infrastructure (containers)
  { id: "region",        name: "AWS Region",    description: "Geographic deployment boundary",   icon: <RegionIcon />,        category: "infrastructure",   typeCategory: "container-infra" },
  { id: "vpc",           name: "VPC",           description: "Isolated virtual network",         icon: <VpcIcon />,           category: "infrastructure",   typeCategory: "container-infra" },
  { id: "subnet",        name: "Subnet",        description: "Network subdivision within a VPC", icon: <SubnetIcon />,        category: "infrastructure",   typeCategory: "container-infra" },
];

// ─── By use case (sidebar "Use cases" tab) ───────────────────────────────────

function pick(...ids: string[]): AwsService[] {
  return ids.flatMap((id) => ALL_SERVICES.filter((s) => s.id === id));
}

export const AWS_SERVICE_CATEGORIES: AwsServiceCategory[] = [
  {
    id: "serverless",
    label: "Serverless API",
    services: pick("lambda", "api-gateway", "dynamodb", "sqs", "sns"),
  },
  {
    id: "frontend",
    label: "Frontend & CDN",
    services: pick("s3", "cloudfront", "load-balancer"),
  },
  {
    id: "backend",
    label: "Backend / REST",
    services: pick("ec2", "load-balancer", "rds", "elastic-cache", "secrets-manager"),
  },
  {
    id: "microservices",
    label: "Microservices",
    services: pick("ecs", "load-balancer", "sqs", "sns", "rds", "cloudwatch"),
  },
  {
    id: "data",
    label: "Data & Storage",
    services: pick("s3", "dynamodb", "rds", "elastic-cache"),
  },
  {
    id: "security",
    label: "Security & IAM",
    services: pick("iam-role", "secrets-manager"),
  },
  {
    id: "observability",
    label: "Observability",
    services: pick("cloudwatch"),
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    services: pick("region", "vpc", "subnet"),
  },
];

// ─── By type (sidebar "Types" tab) ───────────────────────────────────────────

const TYPE_CATEGORY_META: { id: ServiceTypeCategory; label: string }[] = [
  { id: "compute",        label: "Compute" },
  { id: "serverless",     label: "Serverless" },
  { id: "networking",     label: "Networking" },
  { id: "storage",        label: "Storage" },
  { id: "database",       label: "Database" },
  { id: "messaging",      label: "Messaging" },
  { id: "security",       label: "Security" },
  { id: "monitoring",     label: "Monitoring" },
  { id: "container-infra", label: "Infrastructure" },
];

export const AWS_TYPE_CATEGORIES: AwsTypeCategory[] = TYPE_CATEGORY_META.map(
  (meta) => ({
    ...meta,
    services: ALL_SERVICES.filter((s) => s.typeCategory === meta.id),
  })
).filter((cat) => cat.services.length > 0);
