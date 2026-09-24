import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("states the manual handoff boundary in browser preview", async () => {
    render(<App />);

    expect(await screen.findByText("Manual handoff is active")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Browser preview");
  });
});
