import { useCallback, useEffect, useRef, useState } from "react";
import { loadWorkspaceStatus } from "./workspace-status-loader";
import type { WorkspaceStatusData } from "./workspace-status.types";

export type WorkspaceLoadState =
  | { kind: "loading" }
  | { kind: "ready"; data: WorkspaceStatusData }
  | { kind: "error"; message: string };

const workspaceInitializationMessage =
  "The local workspace could not be initialized. Retry the setup or inspect local diagnostics.";

export function useWorkspaceStatus() {
  const [state, setState] = useState<WorkspaceLoadState>({ kind: "loading" });
  const requestSequence = useRef(0);

  const reload = useCallback(async () => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setState({ kind: "loading" });

    try {
      const data = await loadWorkspaceStatus();

      if (requestSequence.current === requestId) {
        setState({ kind: "ready", data });
      }
    } catch {
      if (requestSequence.current === requestId) {
        setState({ kind: "error", message: workspaceInitializationMessage });
      }
    }
  }, []);

  useEffect(() => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    let isMounted = true;

    void loadWorkspaceStatus()
      .then((data) => {
        if (isMounted && requestSequence.current === requestId) {
          setState({ kind: "ready", data });
        }
      })
      .catch(() => {
        if (isMounted && requestSequence.current === requestId) {
          setState({ kind: "error", message: workspaceInitializationMessage });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { state, reload };
}
