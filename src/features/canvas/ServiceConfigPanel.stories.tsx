import type { Meta, StoryObj } from "@storybook/react-vite";
import { ServiceConfigPanel } from "./ServiceConfigPanel";
import type { CanvasNode } from "./useCanvas";

function node(type: string, label: string, config: Record<string, unknown>): CanvasNode {
  return { id: `${type}-1`, type, label, position: { x: 0, y: 0 }, config, variant: "service" };
}

const meta: Meta<typeof ServiceConfigPanel> = {
  component: ServiceConfigPanel,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="relative h-screen bg-page overflow-hidden">
        <Story />
      </div>
    ),
  ],
  args: {
    onClose: () => {},
    onUpdate: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof ServiceConfigPanel>;

export const Lambda: Story = {
  args: {
    node: node("lambda", "Lambda Function", {
      name: "my-handler",
      runtime: "nodejs20.x",
      memory: 128,
      timeout: 30,
      handler: "index.handler",
    }),
  },
};

export const ApiGateway: Story = {
  args: {
    node: node("api-gateway", "API Gateway", {
      name: "my-api",
      type: "REST",
      stage: "prod",
      authorizationType: "NONE",
    }),
  },
};

export const DynamoDB: Story = {
  args: {
    node: node("dynamodb", "DynamoDB Table", {
      name: "users",
      billingMode: "PAY_PER_REQUEST",
      partitionKey: "id",
      partitionKeyType: "S",
    }),
  },
};
