import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { PlusIcon } from "../icons";

const meta: Meta<typeof Button> = {
  component: Button,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: "primary", children: "Deploy infrastructure" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Cancel" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Settings" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Delete project" },
};

export const WithIcon: Story = {
  args: {
    variant: "primary",
    children: (
      <>
        <PlusIcon />
        New Project
      </>
    ),
  },
};

export const Small: Story = {
  args: { variant: "secondary", size: "sm", children: "View logs" },
};

export const Large: Story = {
  args: { variant: "primary", size: "lg", children: "Get started" },
};

export const FullWidth: Story = {
  args: { variant: "primary", fullWidth: true, children: "Sign in" },
};

export const Disabled: Story = {
  args: { variant: "primary", disabled: true, children: "Deploying..." },
};
