import { useNavigate } from "react-router";

interface Template {
  id: string;
  name: string;
  description: string;
  tags: string[];
  accent: string;
}

const TEMPLATES: Template[] = [
  {
    id: "tpl_serverless_api",
    name: "Serverless API",
    description: "Lambda + API Gateway + DynamoDB. Full REST API ready to deploy in minutes.",
    tags: ["Lambda", "API GW", "DynamoDB"],
    accent: "#E07B12",
  },
  {
    id: "tpl_crud_backend",
    name: "CRUD Backend",
    description: "API Gateway + Lambda + DynamoDB + IAM Role. Standard create, read, update and delete pattern.",
    tags: ["API GW", "Lambda", "DynamoDB", "IAM"],
    accent: "#8A4FFF",
  },
  {
    id: "tpl_file_processor",
    name: "File Processor",
    description: "S3 triggers a Lambda on upload, processes the file and pushes results to SQS for downstream consumers.",
    tags: ["S3", "Lambda", "SQS"],
    accent: "#569A31",
  },
  {
    id: "tpl_frontend_deploy",
    name: "Frontend Deploy",
    description: "Static site hosted on S3 and distributed globally via CloudFront with custom domain support.",
    tags: ["S3", "CloudFront"],
    accent: "#2165B0",
  },
  {
    id: "tpl_event_pipeline",
    name: "Event-Driven Pipeline",
    description: "SQS queue feeding Lambda workers that fan-out via SNS, with DynamoDB as the event store.",
    tags: ["SQS", "Lambda", "SNS", "DynamoDB"],
    accent: "#FF4B00",
  },
  {
    id: "tpl_container_service",
    name: "Container Microservice",
    description: "ECS Fargate behind an Application Load Balancer, backed by RDS and Secrets Manager.",
    tags: ["ECS", "ALB", "RDS", "Secrets"],
    accent: "#DD344C",
  },
];

function TemplateCard({ template }: { template: Template }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/projects/new")}
      className="shrink-0 w-56 bg-card/60 border border-edge/60 rounded-xl p-4 text-left hover:bg-card hover:border-edge transition-all group"
    >
      <div
        className="w-8 h-1.5 rounded-full mb-3"
        style={{ backgroundColor: template.accent }}
      />
      <p className="text-sm font-medium text-ink/80 group-hover:text-ink transition-colors mb-1">
        {template.name}
      </p>
      <p className="text-xs text-ink-dim leading-relaxed line-clamp-2 mb-3">
        {template.description}
      </p>
      <div className="flex flex-wrap gap-1">
        {template.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-raised text-ink-dim"
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

export function TemplatesStrip() {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-ink-dim uppercase tracking-widest">
          Templates
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {TEMPLATES.map((tpl) => (
          <TemplateCard key={tpl.id} template={tpl} />
        ))}
      </div>
    </div>
  );
}
