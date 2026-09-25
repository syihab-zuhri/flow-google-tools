import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithFlowProvider } from "../../../test/flow-test-utils";
import { ImageNode } from "./ImageNode";

describe("ImageNode Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders empty upload dropzone when no image is loaded", () => {
    renderWithFlowProvider(
      <ImageNode id="image-1" data={{}} selected={false} />,
    );

    expect(screen.getByText(/drop reference image here/i)).toBeVisible();
    expect(screen.getByLabelText(/upload reference image/i)).toBeDefined();
  });

  it("renders preview thumbnail and file details when image is provided", () => {
    const onDataChange = vi.fn();
    renderWithFlowProvider(
      <ImageNode
        id="image-1"
        data={{
          fileName: "character-portrait.png",
          thumbnailUrl: "data:image/png;base64,synthetic-preview",
          fileSize: 1024 * 50,
        }}
        selected={false}
        onDataChange={onDataChange}
      />,
    );

    expect(screen.getByText("character-portrait.png")).toBeVisible();
    expect(screen.getByAltText(/reference preview/i)).toHaveAttribute(
      "src",
      "data:image/png;base64,synthetic-preview",
    );

    const clearButton = screen.getByRole("button", {
      name: /clear reference image/i,
    });
    fireEvent.click(clearButton);
    expect(onDataChange).toHaveBeenCalledWith("image-1", {
      fileName: undefined,
      thumbnailUrl: undefined,
      imagePath: undefined,
      fileSize: undefined,
    });
  });
});
