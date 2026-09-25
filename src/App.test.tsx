import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  type WorkspaceLoadState,
  useWorkspaceStatus,
} from "./features/workspace/use-workspace-status";

vi.mock("./features/editor/CanvasWorkspace", () => ({
  CanvasWorkspace: () => <div data-testid="canvas-workspace" />,
}));

vi.mock("./features/workspace/use-workspace-status", () => ({
  useWorkspaceStatus: vi.fn(),
}));

const reload = vi.fn(async () => {});
const mockedUseWorkspaceStatus = vi.mocked(useWorkspaceStatus);

function renderApp(state: WorkspaceLoadState) {
  mockedUseWorkspaceStatus.mockReturnValue({ state, reload });

  return render(<App />);
}

describe("App", () => {
  beforeEach(() => {
    mockedUseWorkspaceStatus.mockReset();
    reload.mockClear();
  });

  afterEach(cleanup);

  it("shows a loading message while the workspace initializes", () => {
    renderApp({ kind: "loading" });

    expect(screen.getByText("Opening local workspace...")).toBeVisible();
  });

  it("renders the canvas workspace when the workspace is ready", () => {
    renderApp({
      kind: "ready",
      data: {
        databasePath: "Not created in browser preview.",
        migrationCount: 0,
        providerMode: "manual_handoff",
        runtime: "browser_preview",
      },
    });

    expect(screen.getByTestId("canvas-workspace")).toBeVisible();
  });
});
