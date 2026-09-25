import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithFlowProvider } from "../../../test/flow-test-utils";
import { PromptNode } from "./PromptNode";

describe("PromptNode Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders textarea, handles text changes and reports character count", () => {
    const onDataChange = vi.fn();
    renderWithFlowProvider(
      <PromptNode
        id="prompt-1"
        data={{
          promptText: "A majestic dragon soaring above the clouds",
          templateVariables: ["{segment_number}"],
        }}
        selected={false}
        onDataChange={onDataChange}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: /prompt input/i });
    expect(textarea).toHaveValue("A majestic dragon soaring above the clouds");

    // Check character count display (42 chars)
    expect(screen.getByText(/42 \/ 2000/)).toBeVisible();

    // Check variable chips
    expect(screen.getByText("{segment_number}")).toBeVisible();

    // Simulate user editing text
    fireEvent.change(textarea, { target: { value: "New prompt text" } });
    expect(onDataChange).toHaveBeenCalledWith("prompt-1", {
      promptText: "New prompt text",
    });
  });

  it("handles empty state gracefully with placeholder", () => {
    renderWithFlowProvider(
      <PromptNode
        id="prompt-empty"
        data={{ promptText: "", templateVariables: [] }}
        selected={false}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: /prompt input/i });
    expect(textarea).toHaveValue("");
    expect(screen.getByText(/0 \/ 2000/)).toBeVisible();
  });
});
