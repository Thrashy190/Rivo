import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { ProjectCard } from "./ProjectCard";
import type { Project } from "./ProjectCard";

const meta: Meta<typeof ProjectCard> = {
  component: ProjectCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="bg-page p-6 max-w-sm">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProjectCard>;

const baseProject: Project = {
  id: "proj_01",
  name: "production-vpc",
  description: "Main VPC with public/private subnets across 3 AZs",
  status: "deployed",
  region: "us-east-1",
  environment: "production",
  updatedAt: "2h ago",
  accentColor: "#6366f1",
  href: "/workspaces/acme/projects/proj_01",
};

export const Deployed: Story = {
  args: { project: baseProject },
};

export const Editable: Story = {
  args: { project: baseProject, onRename: () => {}, onMove: () => {}, onDelete: () => {} },
};

export const Draft: Story = {
  args: {
    project: { ...baseProject, id: "proj_02", name: "staging-cluster", status: "draft", accentColor: "#f59e0b" },
  },
};

export const Deploying: Story = {
  args: {
    project: { ...baseProject, id: "proj_03", name: "data-pipeline", status: "deploying", accentColor: "#10b981", updatedAt: "just now" },
  },
};

export const Failed: Story = {
  args: {
    project: { ...baseProject, id: "proj_04", name: "legacy-migration", status: "failed", accentColor: "#ef4444", updatedAt: "5m ago" },
  },
};

export const NoDescription: Story = {
  args: {
    project: { ...baseProject, id: "proj_05", description: undefined, accentColor: "#8b5cf6" },
  },
};
