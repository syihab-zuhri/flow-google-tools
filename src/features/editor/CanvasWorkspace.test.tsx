import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CanvasWorkspace } from "./CanvasWorkspace";
import { useFlowGraphStore } from "./flow-graph-store";

describe("CanvasWorkspace Component", () => {
  beforeEach(() => {
    useFlowGraphStore.getState().clearGraph();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders toolbar with add node actions and empty canvas status", () => {
    render(<CanvasWorkspace />);

    expect(
      screen.getByRole("button", { name: /add prompt node/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /add image node/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /add video node/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /add generation node/i }),
    ).toBeVisible();
    expect(screen.getByText(/0 \/ 100 Nodes/i)).toBeVisible();
  });

  it("adds a prompt node when clicking Add Prompt", () => {
    render(<CanvasWorkspace />);

    const addPromptBtn = screen.getByRole("button", {
      name: /add prompt node/i,
    });
    fireEvent.click(addPromptBtn);

    expect(screen.getByText(/1 \/ 100 Nodes/i)).toBeVisible();
    expect(useFlowGraphStore.getState().nodes).toHaveLength(1);
    expect(useFlowGraphStore.getState().nodes[0].type).toBe("prompt");
  });

  it("adds an image, video, and generation node properly", () => {
    render(<CanvasWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /add image node/i }));
    fireEvent.click(screen.getByRole("button", { name: /add video node/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /add generation node/i }),
    );

    expect(screen.getByText(/3 \/ 100 Nodes/i)).toBeVisible();
    const state = useFlowGraphStore.getState();
    expect(state.nodes.map((n) => n.type)).toEqual([
      "image",
      "video",
      "generate",
    ]);
  });

  it("triggers undo and redo actions via toolbar buttons", () => {
    render(<CanvasWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /add prompt node/i }));
    expect(useFlowGraphStore.getState().nodes).toHaveLength(1);

    const undoBtn = screen.getByRole("button", { name: /undo change/i });
    fireEvent.click(undoBtn);
    expect(useFlowGraphStore.getState().nodes).toHaveLength(0);

    const redoBtn = screen.getByRole("button", { name: /redo change/i });
    fireEvent.click(redoBtn);
    expect(useFlowGraphStore.getState().nodes).toHaveLength(1);
  });
});
