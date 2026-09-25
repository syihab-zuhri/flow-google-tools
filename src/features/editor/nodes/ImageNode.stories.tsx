import type { Meta, StoryObj } from "@storybook/react";
import { ImageNode } from "./ImageNode";

const meta: Meta<typeof ImageNode> = {
  title: "Canvas/Nodes/ImageNode",
  component: ImageNode,
  args: {
    id: "image-story-1",
    data: {
      fileName: "hero_concept_v1.png",
      thumbnailUrl:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='90' fill='%23172554'><rect width='160' height='90'/><text x='30' y='50' fill='%2338bdf8' font-size='12'>Hero Image</text></svg>",
      fileSize: 1024 * 128,
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
type Story = StoryObj<typeof ImageNode>;

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
