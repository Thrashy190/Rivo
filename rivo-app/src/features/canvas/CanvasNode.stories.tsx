import type { Meta, StoryObj } from "@storybook/react-vite";
import { CanvasNode } from "./CanvasNode";
import type { CanvasNode as CanvasNodeType } from "./useCanvas";

const VIEWPORT = { x: 0, y: 0, zoom: 1 };

const meta: Meta<typeof CanvasNode> = {
  component: CanvasNode,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="relative w-64 h-40 bg-page">
        <Story />
      </div>
    ),
  ],
  args: {
    viewport: VIEWPORT,
    onMove: () => {},
    onRemove: () => {},
    onNodeClick: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof CanvasNode>;

function node(overrides: Partial<CanvasNodeType>): CanvasNodeType {
  return {
    id: "lambda-1",
    type: "lambda",
    label: "Lambda Function",
    position: { x: 24, y: 24 },
    config: { name: "my-handler" },
    variant: "service",
    ...overrides,
  };
}

export const Lambda: Story = {
  args: { node: node({ type: "lambda", label: "Lambda Function" }) },
};

export const ApiGateway: Story = {
  args: { node: node({ id: "apigw-1", type: "api-gateway", label: "API Gateway", config: { name: "my-api" } }) },
};

export const DynamoDB: Story = {
  args: { node: node({ id: "ddb-1", type: "dynamodb", label: "DynamoDB Table", config: { name: "users" } }) },
};

export const S3: Story = {
  args: { node: node({ id: "s3-1", type: "s3", label: "S3 Bucket", config: { name: "my-bucket" } }) },
};

export const EC2: Story = {
  args: { node: node({ id: "ec2-1", type: "ec2", label: "EC2 Instance", config: { name: "web-server" } }) },
};
