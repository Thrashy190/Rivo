import { useParams } from "react-router";
import { ProjectsHeader } from "../features/projects/ProjectsHeader";
import { ProjectsSidebar } from "../features/projects/ProjectsSidebar";
import { SpaceView } from "../features/spaces/SpaceView";
import type { Project } from "../features/projects/ProjectCard";

const SPACE_NAMES: Record<string, string> = {
  personal: "Personal",
  "team-alpha": "Team Alpha",
};

// Demo projects scoped to spaces — replace with API data when backend is ready
const SPACE_PROJECTS: Record<string, Project[]> = {
  personal: [
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
  ],
  "team-alpha": [],
};

export function SpacePage() {
  const { id = "" } = useParams<{ id: string }>();
  const spaceName = SPACE_NAMES[id] ?? id;
  const projects = SPACE_PROJECTS[id] ?? [];

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      <ProjectsHeader />
      <div className="flex flex-1 overflow-hidden">
        <ProjectsSidebar />
        <SpaceView spaceId={id} spaceName={spaceName} projects={projects} />
      </div>
    </div>
  );
}
