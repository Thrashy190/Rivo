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

function EventBridgeIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      <rect width="40" height="40" rx="6" fill="#E7157B" />
      <circle cx="11" cy="20" r="3.2" stroke="white" strokeWidth="1.8" />
      <circle cx="29" cy="11.5" r="3.2" stroke="white" strokeWidth="1.8" />
      <circle cx="29" cy="28.5" r="3.2" stroke="white" strokeWidth="1.8" />
      <path d="M14.2 20h4.3l7.3-7.2M18.5 20l7.3 7.2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
  // The AWS category colour, used to tint the node.
  accent: string;
  typeCategory: ServiceTypeCategory;
}

// Node types that become Terraform (services/shared/tfgen). The rest can be
// drawn, and the generator leaves them out with a warning.
export const GENERATED_TYPES = new Set(["lambda", "api-gateway", "dynamodb", "s3", "cloudfront", "eventbridge"]);

const COMPUTE = "#ED7100";
const INTEGRATION = "#E7157B";
const DATABASE = "#C925D1";
const NETWORK = "#8C4FFF";
const STORAGE = "#7AA116";
const SECURITY = "#DD344C";
const MANAGEMENT = "#E7157B";
const INFRA = "#7D8998";

// ─── All services ─────────────────────────────────────────────────────────────

export const ALL_SERVICES: AwsService[] = [
  { id: "lambda",          name: "Lambda",          description: "Run code without servers",            icon: <AwsIcon src={lambdaSvg}      alt="Lambda" />,          accent: COMPUTE,     typeCategory: "serverless" },
  { id: "api-gateway",     name: "API Gateway",     description: "HTTP APIs in front of functions",     icon: <AwsIcon src={apiGatewaySvg}  alt="API Gateway" />,     accent: INTEGRATION, typeCategory: "serverless" },
  { id: "eventbridge",     name: "EventBridge",     description: "Schedules and event rules",           icon: <EventBridgeIcon />,                                    accent: INTEGRATION, typeCategory: "serverless" },
  { id: "dynamodb",        name: "DynamoDB",        description: "Serverless key-value tables",         icon: <AwsIcon src={dynamodbSvg}    alt="DynamoDB" />,        accent: DATABASE,    typeCategory: "database" },
  { id: "s3",              name: "S3",              description: "Object storage and static files",     icon: <AwsIcon src={s3Svg}          alt="S3" />,              accent: STORAGE,     typeCategory: "storage" },
  { id: "cloudfront",      name: "CloudFront",      description: "Global CDN for sites and files",      icon: <AwsIcon src={cloudfrontSvg}  alt="CloudFront" />,      accent: NETWORK,     typeCategory: "networking" },
  { id: "sqs",             name: "SQS",             description: "Message queues",                      icon: <AwsIcon src={sqsSvg}         alt="SQS" />,             accent: INTEGRATION, typeCategory: "messaging" },
  { id: "sns",             name: "SNS",             description: "Pub/sub notifications",               icon: <AwsIcon src={snsSvg}         alt="SNS" />,             accent: INTEGRATION, typeCategory: "messaging" },
  { id: "ec2",             name: "EC2",             description: "Virtual machines",                    icon: <AwsIcon src={ec2Svg}         alt="EC2" />,             accent: COMPUTE,     typeCategory: "compute" },
  { id: "ecs",             name: "ECS",             description: "Containers on Fargate or EC2",        icon: <AwsIcon src={ecsSvg}         alt="ECS" />,             accent: COMPUTE,     typeCategory: "compute" },
  { id: "load-balancer",   name: "Load Balancer",   description: "Application and network balancers",   icon: <AwsIcon src={albSvg}         alt="Load Balancer" />,   accent: NETWORK,     typeCategory: "networking" },
  { id: "rds",             name: "RDS",             description: "Managed relational databases",        icon: <AwsIcon src={rdsSvg}         alt="RDS" />,             accent: DATABASE,    typeCategory: "database" },
  { id: "elastic-cache",   name: "ElastiCache",     description: "Redis and Memcached caches",          icon: <AwsIcon src={elasticacheSvg} alt="ElastiCache" />,     accent: DATABASE,    typeCategory: "database" },
  { id: "iam-role",        name: "IAM Role",        description: "Permissions for a service",           icon: <AwsIcon src={iamSvg}         alt="IAM" />,             accent: SECURITY,    typeCategory: "security" },
  { id: "secrets-manager", name: "Secrets Manager", description: "Stored and rotated secrets",          icon: <AwsIcon src={secretsSvg}     alt="Secrets Manager" />, accent: SECURITY,    typeCategory: "security" },
  { id: "cloudwatch",      name: "CloudWatch",      description: "Logs, metrics and alarms",            icon: <AwsIcon src={cloudwatchSvg}  alt="CloudWatch" />,      accent: MANAGEMENT,  typeCategory: "monitoring" },
  // Containers group services on the canvas. There is no AWS icon for a Region or Subnet.
  { id: "region",          name: "AWS Region",      description: "Where the services run",              icon: <RegionIcon />,                                         accent: INFRA,       typeCategory: "container-infra" },
  { id: "vpc",             name: "VPC",             description: "Isolated virtual network",            icon: <AwsIcon src={vpcSvg}         alt="VPC" />,             accent: NETWORK,     typeCategory: "container-infra" },
  { id: "subnet",          name: "Subnet",          description: "A range of addresses in a VPC",       icon: <SubnetIcon />,                                         accent: STORAGE,     typeCategory: "container-infra" },
];

const BY_ID = new Map(ALL_SERVICES.map((s) => [s.id, s]));

export function getService(type: string): AwsService | undefined {
  return BY_ID.get(type);
}

export function getServiceIcon(type: string): ReactNode {
  return BY_ID.get(type)?.icon ?? null;
}

// ─── By type ──────────────────────────────────────────────────────────────────

const TYPE_CATEGORY_META: { id: ServiceTypeCategory; label: string }[] = [
  { id: "serverless",      label: "Serverless" },
  { id: "database",        label: "Database" },
  { id: "storage",         label: "Storage" },
  { id: "networking",      label: "Networking" },
  { id: "messaging",       label: "Messaging" },
  { id: "compute",         label: "Compute" },
  { id: "security",        label: "Security" },
  { id: "monitoring",      label: "Monitoring" },
  { id: "container-infra", label: "Groups" },
];

export interface AwsTypeCategory {
  id: ServiceTypeCategory;
  label: string;
  services: AwsService[];
}

export const AWS_TYPE_CATEGORIES: AwsTypeCategory[] = TYPE_CATEGORY_META.map((meta) => ({
  ...meta,
  services: ALL_SERVICES.filter((s) => s.typeCategory === meta.id),
})).filter((cat) => cat.services.length > 0);
