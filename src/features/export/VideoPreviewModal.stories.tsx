import type { Meta, StoryObj } from "@storybook/react";
import { VideoPreviewModal } from "./VideoPreviewModal";

const meta: Meta<typeof VideoPreviewModal> = {
  title: "Export/VideoPreviewModal",
  component: VideoPreviewModal,
  args: {
    isOpen: true,
    previewUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    totalDurationSeconds: 40,
    segmentMarkers: [0, 10, 20, 30],
    onClose: () => {},
    onOpenExport: () => {},
  },
  parameters: {
    layout: "fullscreen",
    a11y: {
      test: "error",
    },
  },
};

export default meta;
type Story = StoryObj<typeof VideoPreviewModal>;

export const Default: Story = {};

export const EmptyStream: Story = {
  args: {
    previewUrl: null,
  },
};
