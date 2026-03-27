import { useState } from "react";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { ProjectCard } from "./ProjectCard";
import { PlusIcon, SearchIcon, FolderIcon } from "../../components/icons";
import type { Project } from "./ProjectCard";

const MOCK_PROJECTS: Project[] = [
  {
    id: "proj_01",
    name: "production-vpc",
    description: "Main VPC with public/private subnets across 3 AZs",
    status: "deployed",
    region: "us-east-1",
    resourceCount: 14,
    updatedAt: "2h ago",
    accentColor: "#6366f1",
  },
  {
    id: "proj_02",
    name: "staging-cluster",
    description: "EKS cluster for staging environment with auto-scaling node groups",
    status: "draft",
    region: "us-west-2",
    resourceCount: 3,
    updatedAt: "1d ago",
    accentColor: "#f59e0b",
  },
  {
    id: "proj_03",
    name: "data-pipeline",
    description: "Kinesis + Lambda + S3 data ingestion pipeline",
    status: "deploying",
    region: "eu-west-1",
    resourceCount: 8,
    updatedAt: "just now",
    accentColor: "#10b981",
  },
  {
    id: "proj_04",
    name: "legacy-migration",
    description: "RDS migration from on-prem to Aurora PostgreSQL",
    status: "failed",
    region: "us-east-1",
    resourceCount: 21,
    updatedAt: "5m ago",
    accentColor: "#ef4444",
  },
  {
    id: "proj_05",
    name: "cdn-layer",
    description: "CloudFront distribution with WAF and custom origins",
    status: "deployed",
    region: "us-east-1",
    resourceCount: 6,
    updatedAt: "3d ago",
    accentColor: "#8b5cf6",
  },
  {
    id: "proj_06",
    name: "monitoring-stack",
    description: "CloudWatch dashboards, alarms, and SNS notification routing",
    status: "draft",
    region: "us-east-2",
    resourceCount: 11,
    updatedAt: "1w ago",
    accentColor: "#06b6d4",
  },
];

export function ProjectsPage() {
  const [search, setSearch] = useState("");

  const filtered = MOCK_PROJECTS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {MOCK_PROJECTS.length} projects in your workspace
            </p>
          </div>
          <Button size="sm">
            <PlusIcon />
            New project
          </Button>
        </div>

        {/* Search */}
        <div className="mb-8 max-w-xs">
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            rightElement={<SearchIcon className="w-4 h-4 text-zinc-600" />}
          />
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
        <FolderIcon className="w-5 h-5 text-zinc-600" />
      </div>
      <p className="text-sm font-medium text-zinc-400 mb-1">No projects found</p>
      <p className="text-sm text-zinc-600 mb-6">
        Try a different search term or start a new project.
      </p>
      <Button size="sm">
        <PlusIcon />
        New project
      </Button>
    </div>
  );
}
