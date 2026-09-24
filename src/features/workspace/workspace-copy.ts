import type { ProviderMode, WorkspaceRuntime } from "./workspace-status.types";

export const workspaceCopy = {
  heading: "Workspace",
  ready: "Local workspace ready",
  preview: "Browser preview",
  database: "Local database",
  migrations: "migration applied",
  migrationsPlural: "migrations applied",
  provider: "Generation mode",
  runtimeModes: {
    native: "Native desktop",
    browser_preview: "Browser preview",
  } satisfies Record<WorkspaceRuntime, string>,
  providerModes: {
    manual_handoff: "Manual handoff",
    official_api: "Official API",
  } satisfies Record<ProviderMode, string>,
} as const;
