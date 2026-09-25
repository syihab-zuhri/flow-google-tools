import type { Meta, StoryObj } from "@storybook/react";
import { GenerationNode } from "./GenerationNode";

const meta: Meta<typeof GenerationNode> = {
  title: "Canvas/Nodes/GenerationNode",
  component: GenerationNode,
  args: {
    id: "gen-story-1",
    data: {
      model: "veo-3.1",
      aspectRatio: "16:9",
      status: "idle",
    },
    selected: false,
  },
  parameters: {
    a11y: {
      test: "error",
    },
  },
};

export default meta;
type Story = StoryObj<typeof GenerationNode>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    selected: true,
  },
};

export const Generating: Story = {
  args: {
    data: {
      model: "veo-3.1",
      aspectRatio: "16:9",
      status: "generating",
    },
    selected: true,
  },
};

export const Completed: Story = {
  args: {
    data: {
      model: "veo-3.1",
      aspectRatio: "16:9",
      status: "completed",
    },
  },
};

export const FailedError: Story = {
  args: {
    data: {
      model: "veo-3.1",
      aspectRatio: "16:9",
      status: "failed",
      error: "Upstream rate limit (429) - Account daily quota reached.",
    },
  },
};
