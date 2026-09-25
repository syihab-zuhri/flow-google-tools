import { useState, useEffect, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { commands } from "../../bindings";
import type { BridgeServerInfo, BridgeJobKind, BridgeJobState } from "../../bindings";

export interface BridgeConnectionChangedPayload {
  sequenceId: number;
  timestamp: number;
  connected: boolean;
  extensionVersion: string | null;
  boundPort: number;
  reason: string;
}

export interface BridgeJobEventPayload {
  sequenceId: number;
  timestamp: number;
  jobId: string;
  state: "awaiting" | "running" | "succeeded" | "failed" | "cancelled" | "lost";
  phase: string | null;
  note: string | null;
  error: string | null;
  files: string[];
  assets: string[];
}

export interface DispatchJobParams {
  jobId?: string;
  prompt: string;
  kind?: BridgeJobKind;
  model?: string;
  aspectRatio?: string;
  duration?: string;
  variations?: number;
  autoDownload?: boolean;
}

export function useFlowBridge() {
  const [info, setInfo] = useState<BridgeServerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await commands.bridgeStatus();
      if (res.status === "ok") {
        setInfo(res.data);
      }
    } catch {
      // ignore status refresh errors on initial load
    }
  }, []);

  const startBridge = useCallback(async (port?: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await commands.bridgeStart(port ?? null);
      if (res.status === "ok") {
        setInfo(res.data);
        return { ok: true, data: res.data };
      } else {
        setError(res.error.message);
        return { ok: false, error: res.error.message };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const stopBridge = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await commands.bridgeStop();
      if (res.status === "ok") {
        setInfo(res.data);
        return { ok: true };
      } else {
        setError(res.error.message);
        return { ok: false, error: res.error.message };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const dispatchJob = useCallback(
    async (params: DispatchJobParams) => {
      setError(null);
      const jobId = params.jobId || `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        const res = await commands.bridgeDispatch({
          jobId,
          prompt: params.prompt,
          kind: params.kind || ("video" as BridgeJobKind),
          model: params.model || "Veo 3.1 - Fast",
          aspectRatio: params.aspectRatio || "16:9",
          duration: params.duration || "8s",
          variations: params.variations || 1,
          autoDownload: params.autoDownload !== false,
          downloadPrefix: null,
        });
        if (res.status === "ok") {
          setInfo(res.data);
          return { ok: true, jobId, data: res.data };
        } else {
          setError(res.error.message);
          return { ok: false, error: res.error.message };
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return { ok: false, error: msg };
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    let unlistenConn: UnlistenFn | undefined;
    let unlistenJob: UnlistenFn | undefined;

    void commands.bridgeStatus().then((res) => {
      if (active && res.status === "ok") {
        setInfo(res.data);
      }
    }).catch(() => {
      // ignore
    });

    listen<BridgeConnectionChangedPayload>("bridge:connection_changed", (event) => {
      if (!active) return;
      setInfo((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          activeConnections: event.payload.connected ? 1 : 0,
        };
      });
      void refreshStatus();
    }).then((un) => {
      if (active) {
        unlistenConn = un;
      } else {
        try {
          un();
        } catch {
          // ignore cleanup errors during unmount
        }
      }
    });

    listen<BridgeJobEventPayload>("bridge:job_event", (event) => {
      if (!active) return;
      setInfo((prev) => {
        if (!prev) return prev;
        const job = event.payload;
        const updatedJobs = prev.jobs.map((j) => {
          if (j.jobId !== job.jobId) return j;
          return {
            ...j,
            state: job.state as BridgeJobState,
            phase: job.phase,
            error: job.error,
            files: job.files,
            assets: job.assets,
          };
        });
        return {
          ...prev,
          jobs: updatedJobs,
        };
      });
    }).then((un) => {
      if (active) {
        unlistenJob = un;
      } else {
        try {
          un();
        } catch {
          // ignore cleanup errors during unmount
        }
      }
    });

    return () => {
      active = false;
      try {
        if (unlistenConn) unlistenConn();
      } catch {
        // ignore cleanup errors
      }
      try {
        if (unlistenJob) unlistenJob();
      } catch {
        // ignore cleanup errors
      }
    };
  }, [refreshStatus]);

  return {
    info,
    loading,
    error,
    refreshStatus,
    startBridge,
    stopBridge,
    dispatchJob,
  };
}
