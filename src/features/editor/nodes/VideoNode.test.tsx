import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithFlowProvider } from "../../../test/flow-test-utils";
import { VideoNode } from "./VideoNode";

describe("VideoNode Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders empty video dropzone when no video is loaded", () => {
    renderWithFlowProvider(
      <VideoNode id="video-1" data={{}} selected={false} />,
    );

    expect(screen.getByText(/drop video clip here/i)).toBeVisible();
    expect(screen.getByLabelText(/upload video clip/i)).toBeDefined();
  });

  it("renders video metadata and allows clearing attached clip", () => {
    const onDataChange = vi.fn();
    renderWithFlowProvider(
      <VideoNode
        id="video-1"
        data={{
          fileName: "scene_01.mp4",
          duration: 9.8,
          resolution: "1920x1080",
          videoPath: "scene_01.mp4",
        }}
        selected={false}
        onDataChange={onDataChange}
      />,
    );

    expect(screen.getAllByText("scene_01.mp4")[0]).toBeVisible();
    expect(screen.getByText(/00:09/)).toBeVisible();
    expect(screen.getByText("1920x1080")).toBeVisible();

    const clearButton = screen.getByRole("button", {
      name: /clear video clip/i,
    });
    fireEvent.click(clearButton);
    expect(onDataChange).toHaveBeenCalledWith("video-1", {
      fileName: undefined,
      videoPath: undefined,
      duration: undefined,
      resolution: undefined,
      thumbnailUrl: undefined,
    });
  });
});
