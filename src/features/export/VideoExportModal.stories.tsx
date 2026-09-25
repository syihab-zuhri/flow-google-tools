import type { Meta, StoryObj } from "@storybook/react";
import { VideoExportModal } from "./VideoExportModal";

const meta: Meta<typeof VideoExportModal> = {
  title: "Export/VideoExportModal",
  component: VideoExportModal,
  args: {
    isOpen: true,
    projectId: "demo_scifi_project",
    segmentCount: 5,
    isExporting: false,
    progressPercent: 0,
    onClose: () => {},
    onExport: () => {},
  },
  parameters: {
    layout: "fullscreen",
    a11y: {
      test: "error",
    },
  },
};

export default meta;
type Story = StoryObj<typeof VideoExportModal>;

export const Default: Story = {};

export const InProgress: Story = {
  args: {
    isExporting: true,
    progressPercent: 72,
  },
};

export const Complete: Story = {
  args: {
    exportedPath: "/exports/demo_scifi_project_final.mp4",
  },
};

export const WithError: Story = {
  args: {
    error: "FFmpeg process failed: Insufficient disk space on drive.",
  },
};
