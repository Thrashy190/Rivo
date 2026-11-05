import type { Meta, StoryObj } from "@storybook/react-vite";
import { JsonViewer } from "./JsonViewer";

const meta: Meta<typeof JsonViewer> = {
  component: JsonViewer,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof JsonViewer>;

const SAMPLE = {
  version: "1",
  nodes: [
    { id: "lambda-1", type: "lambda", position: { x: 120, y: 80 }, config: { name: "my-api", runtime: "nodejs20.x", memory: 256, timeout: 30, handler: "index.handler" } },
    { id: "api-gateway-2", type: "api-gateway", position: { x: 320, y: 80 }, config: { name: "my-api-gw", apiType: "REST", stage: "prod", authorizationType: "NONE" } },
    { id: "dynamodb-3", type: "dynamodb", position: { x: 220, y: 260 }, config: { name: "users-table", billingMode: "PAY_PER_REQUEST", partitionKey: "id", pointInTimeRecovery: true } },
  ],
  edges: [
    { id: "e1", source: "api-gateway-2", target: "lambda-1", type: "depends_on" },
    { id: "e2", source: "lambda-1", target: "dynamodb-3", type: "references" },
  ],
};

export const Default: Story = { args: { data: SAMPLE } };
export const Simple: Story = { args: { data: { version: "1", nodes: [], edges: [] } } };
export const Nested: Story = {
  args: {
    data: {
      level1: { level2: { level3: { value: 42, active: true, name: "deep", empty: null } } },
      list: ["alpha", "beta", "gamma"],
      count: 3,
    },
  },
};
