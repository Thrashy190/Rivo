import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DropdownMenu } from "./DropdownMenu";
import { Avatar } from "../Avatar/Avatar";

const meta: Meta<typeof DropdownMenu> = {
  component: DropdownMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

// Wrapper that shows it attached to an Avatar trigger
function WithAvatar({ align }: { align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <Avatar
        initials="J"
        active={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <DropdownMenu
          align={align}
          onClose={() => setOpen(false)}
          header={
            <div>
              <p className="text-xs font-medium text-white">Juan García</p>
              <p className="text-[11px] text-zinc-500">juan@rivo.dev</p>
            </div>
          }
          sections={[
            {
              items: [
                { label: "Profile", icon: <span>👤</span>, onClick: () => {} },
                { label: "Settings", icon: <span>⚙️</span>, onClick: () => {} },
              ],
            },
            {
              items: [
                {
                  label: "Sign out",
                  icon: <span>→</span>,
                  variant: "danger",
                  onClick: () => alert("Sign out"),
                },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}

export const AttachedToAvatar: Story = {
  render: () => <WithAvatar />,
};

export const AlignLeft: Story = {
  render: () => <WithAvatar align="left" />,
};

export const WithSectionHeadings: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div className="relative inline-block">
        <Avatar initials="J" active={open} onClick={() => setOpen((v) => !v)} />
        {open && (
          <DropdownMenu
            onClose={() => setOpen(false)}
            sections={[
              {
                heading: "Account",
                items: [
                  { label: "Profile", onClick: () => {} },
                  { label: "Settings", onClick: () => {} },
                ],
              },
              {
                heading: "Team",
                items: [
                  { label: "Invite members", onClick: () => {} },
                  { label: "Manage team", onClick: () => {} },
                ],
              },
              {
                items: [
                  { label: "Sign out", variant: "danger", onClick: () => {} },
                ],
              },
            ]}
          />
        )}
      </div>
    );
  },
};
