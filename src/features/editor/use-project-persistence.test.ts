import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commands } from "../../bindings";
import { useFlowGraphStore } from "./flow-graph-store";
import { useProjectPersistence } from "./use-project-persistence";

vi.mock("../../bindings", () => ({
  commands: {
    saveProject: vi.fn(),
    loadProject: vi.fn(),
  },
}));

interface MockedPersistenceCommands {
  saveProject: ReturnType<typeof vi.fn>;
  loadProject: ReturnType<typeof vi.fn>;
}

const persistenceCommands = commands as typeof commands &
  MockedPersistenceCommands;

describe("useProjectPersistence", () => {
  beforeEach(() => {
    useFlowGraphStore.getState().clearGraph();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("saves the current graph with the expected IPC request and clears isDirty", async () => {
    const node = useFlowGraphStore
      .getState()
      .addNode("prompt", { x: 100, y: 200 });

    if (!node) {
      throw new Error("Expected the graph store to create a prompt node.");
    }

    persistenceCommands.saveProject.mockResolvedValue({
      status: "ok",
      data: {
        savedPath: "/tmp/test.flowproj",
        savedAt: "2026-09-25T10:00:00Z",
        fileSizeBytes: 1024,
      },
    });

    const { result } = renderHook(() => useProjectPersistence());

    await act(async () => {
      await result.current.saveProject("/tmp/test.flowproj", "Test Project");
    });

    expect(persistenceCommands.saveProject).toHaveBeenCalledWith({
      filePath: "/tmp/test.flowproj",
      projectName: "Test Project",
      settings: {
        defaultModel: "veo-3.1",
        autoSaveIntervalSeconds: 30,
        styleLockText: null,
      },
      graph: {
        nodes: [
          {
            id: node.id,
            type: "prompt",
            position: { x: 100, y: 200 },
            data: { promptText: "", templateVariables: [] },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });
    expect(useFlowGraphStore.getState().isDirty).toBe(false);
    expect(result.current.filePath).toBe("/tmp/test.flowproj");
    expect(result.current.projectName).toBe("Test Project");
    expect(result.current.lastSavedAt).toBe("2026-09-25T10:00:00Z");
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("loads graph nodes and edges into the flow graph store via setGraph", async () => {
    persistenceCommands.loadProject.mockResolvedValue({
      status: "ok",
      data: {
        projectName: "Loaded Project",
        version: "1.0.0",
        settings: {
          defaultModel: "veo-3.1",
          autoSaveIntervalSeconds: 30,
          styleLockText: null,
        },
        graph: {
          nodes: [
            {
              id: "prompt-abc",
              type: "prompt",
              position: { x: 50, y: 75 },
              data: { promptText: "test prompt", templateVariables: [] },
            },
          ],
          edges: [
            {
              id: "e-1",
              source: "prompt-abc",
              target: "generate-xyz",
              sourceHandle: "prompt-out",
              targetHandle: "prompt-in",
            },
          ],
          viewport: { x: 10, y: 20, zoom: 1.5 },
        },
        assets: [],
        updatedAt: "2026-09-25T10:00:00Z",
      },
    });

    const { result } = renderHook(() => useProjectPersistence());

    await act(async () => {
      await result.current.loadProject("/tmp/loaded.flowproj");
    });

    expect(persistenceCommands.loadProject).toHaveBeenCalledWith(
      "/tmp/loaded.flowproj",
    );
    expect(useFlowGraphStore.getState().nodes).toEqual([
      {
        id: "prompt-abc",
        type: "prompt",
        position: { x: 50, y: 75 },
        data: { promptText: "test prompt", templateVariables: [] },
      },
    ]);
    expect(useFlowGraphStore.getState().edges).toEqual([
      {
        id: "e-1",
        source: "prompt-abc",
        target: "generate-xyz",
        sourceHandle: "prompt-out",
        targetHandle: "prompt-in",
      },
    ]);
    expect(useFlowGraphStore.getState().isDirty).toBe(false);
    expect(result.current.filePath).toBe("/tmp/loaded.flowproj");
    expect(result.current.projectName).toBe("Loaded Project");
    expect(result.current.lastSavedAt).toBe("2026-09-25T10:00:00Z");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("surfaces and rethrows an IPC save failure", async () => {
    persistenceCommands.saveProject.mockResolvedValue({
      status: "error",
      error: {
        message: "Failed to save project: Permission denied",
      },
    });

    const { result } = renderHook(() => useProjectPersistence());

    await act(async () => {
      await expect(
        result.current.saveProject("/tmp/blocked.flowproj", "Blocked Project"),
      ).rejects.toThrow("Failed to save project: Permission denied");
    });

    expect(result.current.error).toBe(
      "Failed to save project: Permission denied",
    );
    expect(result.current.isSaving).toBe(false);
  });

  it("surfaces and rethrows an IPC load failure", async () => {
    persistenceCommands.loadProject.mockResolvedValue({
      status: "error",
      error: {
        message: "Failed to load project: File not found",
      },
    });

    const { result } = renderHook(() => useProjectPersistence());

    await act(async () => {
      await expect(
        result.current.loadProject("/tmp/nonexistent.flowproj"),
      ).rejects.toThrow("Failed to load project: File not found");
    });

    expect(result.current.error).toBe("Failed to load project: File not found");
    expect(result.current.isLoading).toBe(false);
  });

  it("clearError resets error back to null", async () => {
    persistenceCommands.saveProject.mockResolvedValue({
      status: "error",
      error: {
        message: "Disk full",
      },
    });

    const { result } = renderHook(() => useProjectPersistence());

    await act(async () => {
      await expect(
        result.current.saveProject("/tmp/full.flowproj", "Full Disk"),
      ).rejects.toThrow("Disk full");
    });

    expect(result.current.error).toBe("Disk full");

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("saveAs delegates to saveProject with specified arguments", async () => {
    persistenceCommands.saveProject.mockResolvedValue({
      status: "ok",
      data: {
        savedPath: "/tmp/save-as.flowproj",
        savedAt: "2026-09-25T12:00:00Z",
        fileSizeBytes: 2048,
      },
    });

    const { result } = renderHook(() => useProjectPersistence());

    await act(async () => {
      await result.current.saveAs("/tmp/save-as.flowproj", "Save As Project");
    });

    expect(persistenceCommands.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: "/tmp/save-as.flowproj",
        projectName: "Save As Project",
      }),
    );
    expect(result.current.filePath).toBe("/tmp/save-as.flowproj");
    expect(result.current.projectName).toBe("Save As Project");
  });

  it("triggers save on Ctrl+S when filePath and projectName are set", async () => {
    persistenceCommands.saveProject.mockResolvedValue({
      status: "ok",
      data: {
        savedPath: "/tmp/active.flowproj",
        savedAt: "2026-09-25T13:00:00Z",
        fileSizeBytes: 512,
      },
    });

    const { result } = renderHook(() => useProjectPersistence());

    await act(async () => {
      await result.current.saveProject(
        "/tmp/active.flowproj",
        "Active Project",
      );
    });

    expect(persistenceCommands.saveProject).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    });

    expect(persistenceCommands.saveProject).toHaveBeenCalledTimes(2);
  });

  it("does not trigger save on Ctrl+S if filePath is not set", async () => {
    renderHook(() => useProjectPersistence());

    await act(async () => {
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    });

    expect(persistenceCommands.saveProject).not.toHaveBeenCalled();
  });

  it("prevents default event on Ctrl+O", async () => {
    renderHook(() => useProjectPersistence());

    const event = new KeyboardEvent("keydown", {
      key: "o",
      ctrlKey: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
