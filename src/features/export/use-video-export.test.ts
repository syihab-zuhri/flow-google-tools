import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVideoExport } from "./use-video-export";

vi.mock("../../bindings", () => ({
  commands: {
    previewExport: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        previewFilePath: "/tmp/previews/proj1_preview.mp4",
        segmentMarkers: [0.0, 10.0, 20.0],
        totalDurationSeconds: 30.0,
      },
    }),
    concatSegments: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        success: true,
        outputPath: "/tmp/exports/final_output.mp4",
        durationSeconds: 30.0,
        fileSizeBytes: 1024 * 1024 * 12,
      },
    }),
  },
}));

describe("useVideoExport hook", () => {
  it("handles preview generation and updates preview state", async () => {
    const { result } = renderHook(() => useVideoExport());

    await act(async () => {
      await result.current.generatePreview("proj1", [
        "/tmp/seg1.mp4",
        "/tmp/seg2.mp4",
        "/tmp/seg3.mp4",
      ]);
    });

    expect(result.current.exportState.previewUrl).toBe(
      "/tmp/previews/proj1_preview.mp4",
    );
    expect(result.current.exportState.segmentMarkers).toEqual([
      0.0, 10.0, 20.0,
    ]);
    expect(result.current.exportState.totalDurationSeconds).toBe(30.0);
    expect(result.current.exportState.error).toBeNull();
  });

  it("handles final export with parameters and returns exported path", async () => {
    const { result } = renderHook(() => useVideoExport());

    await act(async () => {
      await result.current.exportFinalVideo({
        projectId: "proj1",
        segmentPaths: ["/tmp/seg1.mp4", "/tmp/seg2.mp4"],
        format: "mp4",
        resolution: "1080p",
        outputPath: "/tmp/exports/final_output.mp4",
      });
    });

    expect(result.current.exportState.exportedPath).toBe(
      "/tmp/exports/final_output.mp4",
    );
    expect(result.current.exportState.isExporting).toBe(false);
  });
});
