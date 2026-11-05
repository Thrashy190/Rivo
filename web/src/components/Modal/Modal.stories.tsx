import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Modal } from "./Modal";
import { Button } from "../Button/Button";

const meta: Meta<typeof Modal> = {
  component: Modal,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof Modal>;

function Trigger({ size, title }: { size?: "sm" | "md" | "lg" | "xl"; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size={size}>
        <div className="p-6">
          <p className="text-sm text-ink-dim">
            Modal content goes here. Click outside or press Escape to close.
          </p>
        </div>
      </Modal>
    </>
  );
}

export const Default: Story = { render: () => <Trigger title="Modal title" /> };
export const Small: Story = { render: () => <Trigger size="sm" title="Small modal" /> };
export const Large: Story = { render: () => <Trigger size="lg" title="Large modal" /> };
export const NoTitle: Story = { render: () => <Trigger /> };
