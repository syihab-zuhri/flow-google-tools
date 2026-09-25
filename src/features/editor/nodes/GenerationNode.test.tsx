import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithFlowProvider } from "../../../test/flow-test-utils";
import { GenerationNode } from "./GenerationNode";

describe("GenerationNode Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders model options, aspect ratio and ports in idle state", () => {
    const onDataChange = vi.fn();
    renderWithFlowProvider(
      <GenerationNode
        id="gen-1"
        data={{
          model: "veo-3.1",
          aspectRatio: "16:9",
          status: "idle",
        }}
        selected={false}
        onDataChange={onDataChange}
      />,
    );

    expect(screen.getByRole("combobox", { name: /select model/i })).toHaveValue(
      "veo-3.1",
    );
    expect(
      screen.getByRole("combobox", { name: /select aspect ratio/i }),
    ).toHaveValue("16:9");
    expect(screen.getByText(/Ready/i)).toBeVisible();

    // Change model
    const select = screen.getByRole("combobox", { name: /select model/i });
    fireEvent.change(select, { target: { value: "gemini-omni" } });
    expect(onDataChange).toHaveBeenCalledWith("gen-1", {
      model: "gemini-omni",
    });
  });

  it("renders loading state with progress indicator when generating", () => {
    renderWithFlowProvider(
      <GenerationNode
        id="gen-1"
        data={{
          model: "veo-3.1",
          aspectRatio: "16:9",
          status: "generating",
        }}
        selected={true}
      />,
    );

    expect(screen.getByText(/Generating\.\.\./i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /cancel generation/i }),
    ).toBeVisible();
  });

  it("renders error state with retry button when failed", () => {
    renderWithFlowProvider(
      <GenerationNode
        id="gen-1"
        data={{
          model: "veo-3.1",
          aspectRatio: "16:9",
          status: "failed",
          error: "Credit quota exhausted on selected account",
        }}
        selected={false}
      />,
    );

    expect(screen.getByText(/Credit quota exhausted/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /retry generation/i }),
    ).toBeVisible();
  });
});
