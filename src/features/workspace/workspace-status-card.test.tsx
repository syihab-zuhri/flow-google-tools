import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceStatusCard } from "./workspace-status-card";

describe("WorkspaceStatusCard", () => {
  it("shows a ready local workspace without a provider connection", () => {
    render(
      <WorkspaceStatusCard
        databasePath="C:\\Users\\Owner\\AppData\\Roaming\\Flow Studio\\flow_studio.db"
        migrationCount={1}
        providerMode="manual_handoff"
        runtime="native"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Local workspace ready" }),
    ).toBeVisible();
    expect(screen.getByText("Manual handoff")).toBeVisible();
    expect(screen.getByText("1 migration applied")).toBeVisible();
  });
});
