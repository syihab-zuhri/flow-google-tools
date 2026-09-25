import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoPreviewModal } from "./VideoPreviewModal";

describe("VideoPreviewModal Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders preview player with timecode and segment markers", () => {
    const onClose = vi.fn();
    const onOpenExport = vi.fn();

    render(
      <VideoPreviewModal
        isOpen={true}
        previewUrl="/tmp/preview.mp4"
        totalDurationSeconds={30}
        segmentMarkers={[0, 10, 20]}
        onClose={onClose}
        onOpenExport={onOpenExport}
      />,
    );

    expect(screen.getByText(/Video Preview/i)).toBeVisible();
    expect(screen.getByText(/00:00 \/ 00:30/i)).toBeVisible();

    // Check segment marker buttons
    const markers = screen.getAllByRole("button", { name: /jump to segment/i });
    expect(markers).toHaveLength(3);

    // Click marker
    fireEvent.click(markers[1]);
    expect(screen.getByText(/00:10 \/ 00:30/i)).toBeVisible();

    // Click export action
    const exportBtn = screen.getByRole("button", {
      name: /export full video/i,
    });
    fireEvent.click(exportBtn);
    expect(onOpenExport).toHaveBeenCalled();
  });

  it("calls onClose when clicking close button", () => {
    const onClose = vi.fn();
    render(
      <VideoPreviewModal
        isOpen={true}
        previewUrl="/tmp/preview.mp4"
        totalDurationSeconds={10}
        segmentMarkers={[0]}
        onClose={onClose}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: /close preview/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
