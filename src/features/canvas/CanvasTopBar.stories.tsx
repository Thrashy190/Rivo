import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { CanvasTopBar } from "./CanvasTopBar";

const INFRA_MODEL = { version: "1", nodes: [], edges: [] };

const meta: Meta<typeof CanvasTopBar> = {
  component: CanvasTopBar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="bg-page">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {
    projectName: "production-vpc",
    nodeCount: 0,
    viewport: { x: 0, y: 0, zoom: 1 },
    onZoomChange: () => {},
    onExportJSON: () => INFRA_MODEL,
  },
};

export default meta;
type Story = StoryObj<typeof CanvasTopBar>;

export const Empty: Story = {};

export const WithNodes: Story = {
  args: {
    nodeCount: 7,
    viewport: { x: 0, y: 0, zoom: 1.5 },
    onExportJSON: () => ({
      ...INFRA_MODEL,
      nodes: Array.from({ length: 7 }, (_, i) => ({
        id: `lambda-${i}`,
        type: "lambda",
        position: { x: i * 80, y: 0 },
        config: { name: `fn-${i}` },
      })),
    }),
  },
};
