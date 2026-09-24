import { isTauri } from "@tauri-apps/api/core";
import {
  commands,
  type IpcError,
  type ProviderMode,
  type WorkspaceStatusResponse,
} from "../../bindings";
import type { WorkspaceRuntime } from "./workspace-status.types";

export type { IpcError, ProviderMode, WorkspaceStatusResponse };

export interface WorkspaceStatusData {
  databasePath: string;
  migrationCount: number;
  providerMode: ProviderMode;
  runtime: WorkspaceRuntime;
}

export class WorkspaceLoadError extends Error {
  readonly ipcError?: IpcError;

  constructor(message: string, ipcError?: IpcError) {
    super(message);
    this.name = "WorkspaceLoadError";
    this.ipcError = ipcError;
  }
}

const browserPreviewStatus: WorkspaceStatusData = {
  databasePath: "Not created in browser preview.",
  migrationCount: 0,
  providerMode: "manual_handoff",
  runtime: "browser_preview",
};

export async function loadWorkspaceStatus(): Promise<WorkspaceStatusData> {
  if (!isTauri()) {
    return browserPreviewStatus;
  }

  const result = await commands.workspaceStatus();

  if (result.status === "error") {
    throw new WorkspaceLoadError(result.error.message, result.error);
  }

  return {
    ...result.data,
    runtime: "native",
  };
}
