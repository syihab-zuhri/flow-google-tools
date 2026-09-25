import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFlowGraphStore } from "./flow-graph-store";
import { useContinuityPipeline } from "./use-continuity-pipeline";

vi.mock("../../bindings", () => ({
  commands: {
    extractFrame: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        framePath: "/assets/clip_frame.png",
        resolution: { width: 1920, height: 1080 },
        extractionDurationMs: 50,
      },
    }),
  },
}));

describe("useContinuityPipeline hook", () => {
  beforeEach(() => {
    useFlowGraphStore.getState().clearGraph();
  });

  it("handles empty graph without throwing", async () => {
    const { result } = renderHook(() => useContinuityPipeline());

    await act(async () => {
      await result.current.runPipeline();
    });

    expect(result.current.pipelineState.isRunning).toBe(false);
    expect(result.current.pipelineState.error).toContain("No generation nodes");
  });

  it("executes single generation node to completion", async () => {
    const store = useFlowGraphStore.getState();
    const genNode = store.addNode("generate");
    expect(genNode).not.toBeNull();

    const { result } = renderHook(() => useContinuityPipeline());

    await act(async () => {
      await result.current.runPipeline();
    });

    expect(result.current.pipelineState.isRunning).toBe(false);
    expect(result.current.pipelineState.progressPercent).toBe(100);

    const updatedNodes = useFlowGraphStore.getState().nodes;
    expect(updatedNodes[0].data.status).toBe("completed");
  });
});
