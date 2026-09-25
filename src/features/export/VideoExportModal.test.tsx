import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoExportModal } from "./VideoExportModal";

describe("VideoExportModal Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders export format, resolution options, and triggers export", () => {
    const onExport = vi.fn();
    const onClose = vi.fn();

    render(
      <VideoExportModal
        isOpen={true}
        projectId="scifi_chainer"
        segmentCount={4}
        isExporting={false}
        progressPercent={0}
        onClose={onClose}
        onExport={onExport}
      />,
    );

    expect(screen.getByText(/Export Video Sequence/i)).toBeVisible();
    expect(screen.getByLabelText(/select format/i)).toHaveValue("mp4");
    expect(screen.getByLabelText(/select resolution/i)).toHaveValue("1080p");

    // Change format to webm
    fireEvent.change(screen.getByLabelText(/select format/i), {
      target: { value: "webm" },
    });
    expect(screen.getByLabelText(/select format/i)).toHaveValue("webm");

    // Submit export
    const startBtn = screen.getByRole("button", {
      name: /start export process/i,
    });
    fireEvent.click(startBtn);

    expect(onExport).toHaveBeenCalledWith({
      format: "webm",
      resolution: "1080p",
      filename: "scifi_chainer_final",
      outputDirectory: "/exports",
    });
  });

  it("displays progress state while rendering", () => {
    render(
      <VideoExportModal
        isOpen={true}
        projectId="scifi_chainer"
        segmentCount={4}
        isExporting={true}
        progressPercent={65}
        onClose={() => {}}
        onExport={() => {}}
      />,
    );

    expect(screen.getByText(/Rendering video sequence 65%/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /start export process/i }),
    ).toBeDisabled();
  });
});
