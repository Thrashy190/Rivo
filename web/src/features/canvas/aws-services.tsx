import type { ReactNode } from "react";

// ─── Real AWS SVG icons (temporary — will be served from CDN) ─────────────────
import lambdaSvg      from "../../assets/Icons/svg/Compute/Lambda.svg";
import ec2Svg         from "../../assets/Icons/svg/Compute/EC2.svg";
import apiGatewaySvg  from "../../assets/Icons/svg/App-Integration/API-Gateway.svg";
import sqsSvg         from "../../assets/Icons/svg/App-Integration/Simple-Queue-Service.svg";
import snsSvg         from "../../assets/Icons/svg/App-Integration/Simple-Notification-Service.svg";
import dynamodbSvg    from "../../assets/Icons/svg/Database/DynamoDB.svg";
import rdsSvg         from "../../assets/Icons/svg/Database/RDS.svg";
import elasticacheSvg from "../../assets/Icons/svg/Database/ElastiCache.svg";
import vpcSvg         from "../../assets/Icons/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg";
import cloudfrontSvg  from "../../assets/Icons/svg/Networking-Content-Delivery/CloudFront.svg";
import albSvg         from "../../assets/Icons/svg/Networking-Content-Delivery/Elastic-Load-Balancing.svg";
import iamSvg         from "../../assets/Icons/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg";
import secretsSvg     from "../../assets/Icons/svg/Security-Identity-Compliance/Secrets-Manager.svg";
import cloudwatchSvg  from "../../assets/Icons/svg/Management-Governance/CloudWatch.svg";
import ecsSvg         from "../../assets/Icons/svg/Containers/Elastic-Container-Service.svg";
import s3Svg          from "../../assets/Icons/svg/Storage/Simple-Storage-Service.svg";

function AwsIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-contain"
      draggable={false}
    />
  );
}

// ─── Custom inline icons for infra containers (no AWS icon exists) ────────────

function RegionIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#555A60" />
      {/* Flag pole */}
      <line x1="12" y1="10" x2="12" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round" />
      {/* Flag body */}
      <path
        d="M12 11 L28 14 L12 20 Z"
        fill="white"
        fillOpacity="0.9"
      />
      {/* Flag wave highlight */}
      <path
        d="M12 11 L28 14 L12 20"
        stroke="white"
        strokeWidth="1"
        strokeOpacity="0.5"
        fill="none"
        strokeLinejoin="round"
      />
      {/* Ground base */}
      <line x1="9" y1="32" x2="15" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
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

// ─── All services ─────────────────────────────────────────────────────────────

const ALL_SERVICES: AwsService[] = [
  // Serverless
  { id: "lambda",        name: "Lambda",        description: "Serverless function execution",        icon: <AwsIcon src={lambdaSvg}      alt="Lambda" />,        category: "serverless",     typeCategory: "serverless" },
  { id: "api-gateway",   name: "API Gateway",   description: "Managed REST & HTTP APIs",             icon: <AwsIcon src={apiGatewaySvg}  alt="API Gateway" />,   category: "serverless",     typeCategory: "networking" },
  { id: "dynamodb",      name: "DynamoDB",      description: "Serverless NoSQL database",            icon: <AwsIcon src={dynamodbSvg}    alt="DynamoDB" />,      category: "serverless",     typeCategory: "database" },
  { id: "sqs",           name: "SQS",           description: "Managed message queues",               icon: <AwsIcon src={sqsSvg}         alt="SQS" />,           category: "serverless",     typeCategory: "messaging" },
  { id: "sns",           name: "SNS",           description: "Pub/Sub notification service",         icon: <AwsIcon src={snsSvg}         alt="SNS" />,           category: "serverless",     typeCategory: "messaging" },
  // Compute
  { id: "ec2",           name: "EC2",           description: "Virtual machine instances",            icon: <AwsIcon src={ec2Svg}         alt="EC2" />,           category: "compute",        typeCategory: "compute" },
  { id: "ecs",           name: "ECS",           description: "Container orchestration",              icon: <AwsIcon src={ecsSvg}         alt="ECS" />,           category: "compute",        typeCategory: "compute" },
  // Networking
  { id: "load-balancer", name: "Load Balancer", description: "Application & network load balancer", icon: <AwsIcon src={albSvg}         alt="Load Balancer" />, category: "networking",     typeCategory: "networking" },
  { id: "cloudfront",   name: "CloudFront",    description: "Global CDN distribution",              icon: <AwsIcon src={cloudfrontSvg}  alt="CloudFront" />,    category: "networking",     typeCategory: "networking" },
  // Storage
  { id: "s3",            name: "S3",            description: "Object storage at scale",              icon: <AwsIcon src={s3Svg}          alt="S3" />,            category: "storage",        typeCategory: "storage" },
  // Database
  { id: "rds",           name: "RDS",           description: "Managed relational database",          icon: <AwsIcon src={rdsSvg}         alt="RDS" />,           category: "database",       typeCategory: "database" },
  { id: "elastic-cache", name: "ElastiCache",   description: "In-memory caching (Redis/Memcached)", icon: <AwsIcon src={elasticacheSvg} alt="ElastiCache" />,   category: "database",       typeCategory: "database" },
  // Security
  { id: "iam-role",      name: "IAM Role",      description: "Identity & access management",        icon: <AwsIcon src={iamSvg}         alt="IAM" />,           category: "security",       typeCategory: "security" },
  { id: "secrets-manager", name: "Secrets Manager", description: "Secrets rotation & storage",      icon: <AwsIcon src={secretsSvg}     alt="Secrets Manager" />, category: "security",     typeCategory: "security" },
  // Monitoring
  { id: "cloudwatch",    name: "CloudWatch",    description: "Logs, metrics & alarms",              icon: <AwsIcon src={cloudwatchSvg}  alt="CloudWatch" />,    category: "monitoring",     typeCategory: "monitoring" },
  // Infrastructure containers (custom icons — no official AWS icon for these constructs)
  { id: "region",        name: "AWS Region",    description: "Geographic deployment boundary",       icon: <RegionIcon />,                                        category: "infrastructure", typeCategory: "container-infra" },
  { id: "vpc",           name: "VPC",           description: "Isolated virtual network",             icon: <AwsIcon src={vpcSvg}         alt="VPC" />,           category: "infrastructure", typeCategory: "container-infra" },
  { id: "subnet",        name: "Subnet",        description: "Network subdivision within a VPC",    icon: <SubnetIcon />,                                        category: "infrastructure", typeCategory: "container-infra" },
];

// ─── By use case ──────────────────────────────────────────────────────────────

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

// ─── By type ──────────────────────────────────────────────────────────────────

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
