import type { Meta, StoryObj } from "@storybook/react";
import { PromptNode } from "./PromptNode";

const meta: Meta<typeof PromptNode> = {
  title: "Canvas/Nodes/PromptNode",
  component: PromptNode,
  args: {
    id: "prompt-story-1",
    data: {
      promptText:
        "A cinematic camera panning across a futuristic cyber city in dense rain.",
      templateVariables: ["{segment_number}"],
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
type Story = StoryObj<typeof PromptNode>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    selected: true,
  },
};

export const Empty: Story = {
  args: {
    data: {
      promptText: "",
      templateVariables: [],
    },
  },
};

export const ErrorOverLimit: Story = {
  args: {
    data: {
      promptText: "A".repeat(2005),
      templateVariables: [],
    },
  },
};

export const WithVariables: Story = {
  args: {
    data: {
      promptText:
        "Continuing from {previous_context}: scene {segment_number} begins with dramatic entrance.",
      templateVariables: ["{segment_number}", "{previous_context}"],
    },
  },
};
