import type { Meta, StoryObj } from "@storybook/react-vite";
import { CanvasSidebar } from "./CanvasSidebar";

const meta: Meta<typeof CanvasSidebar> = {
  component: CanvasSidebar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="h-screen bg-page flex">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CanvasSidebar>;

export const Default: Story = {};
