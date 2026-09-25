import type { Meta, StoryObj } from "@storybook/react";
import { VideoNode } from "./VideoNode";

const meta: Meta<typeof VideoNode> = {
  title: "Canvas/Nodes/VideoNode",
  component: VideoNode,
  args: {
    id: "video-story-1",
    data: {
      fileName: "intro_segment.mp4",
      duration: 10.0,
      resolution: "1920x1080",
      videoPath: "intro_segment.mp4",
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
type Story = StoryObj<typeof VideoNode>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    selected: true,
  },
};

export const Empty: Story = {
  args: {
    data: {},
  },
};
