import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./Input";
import { SearchIcon } from "../icons";

const meta: Meta<typeof Input> = {
  component: Input,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { label: "Email", placeholder: "you@example.com", type: "email" },
};

export const WithHint: Story = {
  args: {
    label: "Password",
    type: "password",
    placeholder: "••••••••",
    hint: "Minimum 8 characters.",
  },
};

export const WithError: Story = {
  args: {
    label: "Email",
    type: "email",
    value: "notvalid",
    error: "Please enter a valid email address.",
    readOnly: true,
  },
};

export const WithRightElement: Story = {
  args: {
    placeholder: "Search projects...",
    rightElement: <SearchIcon className="w-4 h-4 text-slate-500" />,
  },
};

export const Disabled: Story = {
  args: {
    label: "API Key",
    value: "sk-••••••••••••••••",
    disabled: true,
    readOnly: true,
  },
};
