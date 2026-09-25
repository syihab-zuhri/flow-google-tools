import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFlowBridge } from "./use-flow-bridge";
import { commands } from "../../bindings";

vi.mock("../../bindings", () => ({
  commands: {
    bridgeStatus: vi.fn(),
    bridgeStart: vi.fn(),
    bridgeStop: vi.fn(),
    bridgeDispatch: vi.fn(),
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("useFlowBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes and fetches status", async () => {
    vi.mocked(commands.bridgeStatus).mockResolvedValue({
      status: "ok",
      data: {
        running: false,
        boundAddress: "127.0.0.1",
        port: 48210,
        token: null,
        activeConnections: 0,
        pendingJobCount: 0,
        jobs: [],
      },
    });

    const { result } = renderHook(() => useFlowBridge());

    await act(async () => {
      await result.current.refreshStatus();
    });

    expect(result.current.info?.running).toBe(false);
    expect(result.current.info?.port).toBe(48210);
  });

  it("handles startBridge and stores generated token", async () => {
    vi.mocked(commands.bridgeStart).mockResolvedValue({
      status: "ok",
      data: {
        running: true,
        boundAddress: "127.0.0.1",
        port: 48210,
        token: "tok-abc-123",
        activeConnections: 0,
        pendingJobCount: 0,
        jobs: [],
      },
    });

    const { result } = renderHook(() => useFlowBridge());

    await act(async () => {
      const res = await result.current.startBridge();
      expect(res.ok).toBe(true);
    });

    expect(result.current.info?.running).toBe(true);
    expect(result.current.info?.token).toBe("tok-abc-123");
  });

  it("dispatches job and updates state", async () => {
    vi.mocked(commands.bridgeDispatch).mockResolvedValue({
      status: "ok",
      data: {
        running: true,
        boundAddress: "127.0.0.1",
        port: 48210,
        token: null,
        activeConnections: 1,
        pendingJobCount: 1,
        jobs: [
          {
            jobId: "j-test-1",
            prompt: "cyberpunk city",
            kind: "video",
            state: "awaiting",
            phase: null,
            error: null,
            files: [],
            assets: [],
          },
        ],
      },
    });

    const { result } = renderHook(() => useFlowBridge());

    await act(async () => {
      const res = await result.current.dispatchJob({
        jobId: "j-test-1",
        prompt: "cyberpunk city",
      });
      expect(res.ok).toBe(true);
    });

    expect(result.current.info?.jobs.length).toBe(1);
    expect(result.current.info?.jobs[0].jobId).toBe("j-test-1");
  });
});
