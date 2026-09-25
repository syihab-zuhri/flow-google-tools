import React, { useState } from "react";
import { useFlowBridge } from "./use-flow-bridge";

interface BridgeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BridgeDrawer: React.FC<BridgeDrawerProps> = ({ isOpen, onClose }) => {
  const { info, loading, error, startBridge, stopBridge, dispatchJob } = useFlowBridge();
  const [copied, setCopied] = useState(false);
  const [testPrompt, setTestPrompt] = useState("A cinematic drone shot of a misty fjord at sunrise");
  const [dispatching, setDispatching] = useState(false);

  if (!isOpen) return null;

  const isRunning = info?.running ?? false;
  const isConnected = (info?.activeConnections ?? 0) > 0;

  const handleCopyToken = () => {
    if (info?.token) {
      navigator.clipboard.writeText(info.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTestDispatch = async () => {
    if (!testPrompt.trim()) return;
    setDispatching(true);
    await dispatchJob({
      prompt: testPrompt,
      kind: "image",
      model: "Nano Banana 2",
      aspectRatio: "16:9",
      variations: 1,
    });
    setDispatching(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-xl border border-[#334155] bg-[#0f172a] p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#334155]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0C2D5C] text-[#BA7517] font-bold">
              ⚡
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Browser Bridge (Google Flow)</h2>
              <p className="text-xs text-slate-400">Direct pipeline to ZFlow Batcher extension</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-[#1e293b] hover:text-white"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-950/50 border border-red-800 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-4">
          {/* Status Row */}
          <div className="flex items-center justify-between rounded-lg bg-[#1e293b] p-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  !isRunning ? "bg-slate-500" : isConnected ? "bg-emerald-500 animate-pulse" : "bg-[#BA7517]"
                }`}
              />
              <span className="text-xs font-semibold">
                {!isRunning
                  ? "Server Stopped"
                  : isConnected
                  ? "ZFlow Batcher Connected ✓"
                  : "Server Listening (Awaiting Extension)"}
              </span>
            </div>
            <div className="flex gap-2">
              {!isRunning ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => startBridge()}
                  className="rounded-md bg-[#185FA5] hover:bg-[#1e40af] px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                >
                  Start Server
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => stopBridge()}
                  className="rounded-md bg-red-800 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                >
                  Stop Server
                </button>
              )}
            </div>
          </div>

          {/* Pairing token */}
          {isRunning && info?.token && (
            <div className="rounded-lg border border-[#334155] bg-[#1e293b]/50 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Pairing Token (ws://127.0.0.1:{info.port})</span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="text-xs font-semibold text-[#BA7517] hover:underline"
                >
                  {copied ? "Copied! ✓" : "Copy Token"}
                </button>
              </div>
              <p className="font-mono text-xs text-slate-400 break-all select-all bg-[#0f172a] p-2 rounded border border-[#334155]">
                {info.token}
              </p>
              <p className="text-[11px] text-slate-400">
                Paste token ini ke tab <b>Bridge</b> pada ekstensi ZFlow Batcher di browser Chrome.
              </p>
            </div>
          )}

          {/* Test Dispatch Form */}
          {isRunning && isConnected && (
            <div className="rounded-lg border border-[#334155] bg-[#1e293b]/30 p-3 space-y-2">
              <label className="text-xs font-medium text-slate-300">Test Dispatch from Flow Studio</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  className="flex-1 rounded-md border border-[#334155] bg-[#0f172a] px-3 py-1.5 text-xs text-white"
                  placeholder="Enter prompt..."
                />
                <button
                  type="button"
                  disabled={dispatching || !testPrompt.trim()}
                  onClick={handleTestDispatch}
                  className="rounded-md bg-[#BA7517] hover:bg-[#92540f] px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                >
                  {dispatching ? "Sending..." : "Dispatch"}
                </button>
              </div>
            </div>
          )}

          {/* Jobs List */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Active / Recent Jobs ({info?.jobs.length ?? 0})</span>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-[#334155] bg-[#0f172a] divide-y divide-[#1e293b]">
              {!info?.jobs || info.jobs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 italic">No jobs dispatched yet.</div>
              ) : (
                info.jobs.map((job) => (
                  <div key={job.jobId} className="p-2.5 flex items-center justify-between text-xs">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="truncate font-medium text-white">{job.prompt}</div>
                      <div className="text-[11px] text-slate-400">
                        {job.phase ? `Phase: ${job.phase}` : `State: ${job.state}`}
                        {job.files?.length > 0 && ` • ${job.files.length} file(s) saved`}
                        {job.error && <span className="text-red-400"> • Error: {job.error}</span>}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        job.state === "succeeded"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : job.state === "failed"
                          ? "bg-red-950 text-red-400 border border-red-800"
                          : job.state === "running"
                          ? "bg-amber-950 text-amber-400 border border-amber-800 animate-pulse"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {job.state}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-[#1e293b] hover:bg-[#334155] px-4 py-2 text-xs font-semibold text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
