import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./Avatar";

const meta: Meta<typeof Avatar> = {
  component: Avatar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: { initials: "J" },
};

export const Initials: Story = {
  args: { initials: "JD", size: "md" },
};

export const Small: Story = {
  args: { initials: "J", size: "sm" },
};

export const Large: Story = {
  args: { initials: "JD", size: "lg" },
};

export const Active: Story = {
  args: { initials: "J", active: true },
};

export const Clickable: Story = {
  args: {
    initials: "J",
    onClick: () => alert("Avatar clicked"),
  },
};
