import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { RegisterForm } from "./RegisterForm";

const meta: Meta<typeof RegisterForm> = {
  component: RegisterForm,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="bg-page flex items-center justify-center min-h-screen p-8">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof RegisterForm>;

export const Default: Story = {};
