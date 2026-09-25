import { ReactFlowProvider } from "@xyflow/react";
import { render, type RenderOptions } from "@testing-library/react";
import { type ReactElement } from "react";

export function renderWithFlowProvider(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <ReactFlowProvider>{children}</ReactFlowProvider>
    ),
    ...options,
  });
}
