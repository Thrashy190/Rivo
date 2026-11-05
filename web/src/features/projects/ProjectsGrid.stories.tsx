import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { ProjectsGrid } from "./ProjectsGrid";

const meta: Meta<typeof ProjectsGrid> = {
  component: ProjectsGrid,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/projects"]}>
        <div className="bg-page min-h-screen">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof ProjectsGrid>;

export const Default: Story = {};
