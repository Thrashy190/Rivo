import { ProjectsHeader } from "../features/projects/ProjectsHeader";
import { ProjectsSidebar } from "../features/projects/ProjectsSidebar";
import { TemplatesStrip } from "../features/projects/TemplatesStrip";
import { ProjectsGrid } from "../features/projects/ProjectsGrid";
import type { Project } from "../features/projects/ProjectCard";

const PROJECTS: Project[] = [
  {
    id: "proj_demo",
    name: "serverless-api",
    description: "REST API with Lambda functions and DynamoDB backing, deployed to us-east-1.",
    status: "deployed",
    region: "us-east-1",
    resourceCount: 6,
    updatedAt: "2h ago",
    accentColor: "#6366f1",
  },
];

export function ProjectsPage() {
  return (
    <div className="h-screen flex flex-col bg-page overflow-hidden">
      <ProjectsHeader />

      <div className="flex flex-1 overflow-hidden">
        <ProjectsSidebar />

        <main className="flex-1 overflow-y-auto px-8 py-8">
          <TemplatesStrip />
          <ProjectsGrid projects={PROJECTS} />
        </main>
      </div>
    </div>
  );
}
