import { Handle, Position } from "@xyflow/react";
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { type ChangeEvent } from "react";
import { useFlowGraphStore, type GenerateNodeData } from "../flow-graph-store";

export interface GenerationNodeProps {
  id: string;
  data: GenerateNodeData;
  selected?: boolean;
  onDataChange?: (id: string, updated: Partial<GenerateNodeData>) => void;
  onExecute?: (id: string) => void;
  onCancel?: (id: string) => void;
}

const MODEL_OPTIONS = [
  { value: "veo-3.1", label: "Veo 3.1 (High Fidelity)" },
  { value: "gemini-omni", label: "Gemini Omni (Multi-Modal)" },
  { value: "nano-banana", label: "Nano Banana (Fast Draft)" },
];

const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait)" },
  { value: "1:1", label: "1:1 (Square)" },
];

export function GenerationNode({
  id,
  data,
  selected = false,
  onDataChange,
  onExecute,
  onCancel,
}: GenerationNodeProps) {
  const storeUpdate = useFlowGraphStore((state) => state.updateNodeData);
  const handleUpdate = onDataChange ?? storeUpdate;

  const status = data.status ?? "idle";

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    handleUpdate(id, { model: e.target.value });
  };

  const handleRatioChange = (e: ChangeEvent<HTMLSelectElement>) => {
    handleUpdate(id, { aspectRatio: e.target.value });
  };

  const handleSeedChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
    handleUpdate(id, { seed: val });
  };

  const handleStart = () => {
    handleUpdate(id, { status: "generating", error: undefined });
    onExecute?.(id);
  };

  const handleStop = () => {
    handleUpdate(id, { status: "idle" });
    onCancel?.(id);
  };

  const handleRetry = () => {
    handleUpdate(id, { status: "generating", error: undefined });
    onExecute?.(id);
  };

  return (
    <section
      aria-label="Video Generation Node"
      className={`relative w-[320px] rounded-lg border bg-[#1e293b] text-slate-100 shadow-lg transition-all ${
        selected
          ? "border-[#f59e0b] shadow-[0_0_20px_-2px_rgba(245,158,11,0.5)]"
          : "border-[#334155]"
      } ${status === "failed" ? "border-[#ef4444]" : ""}`}
    >
      {/* Input Ports (Left) */}
      <div className="absolute -left-3 top-[32%] flex items-center">
        <Handle
          type="target"
          position={Position.Left}
          id="prompt-in"
          className="!h-3 !w-3 !rounded-full !border-2 !border-[#0b0f19] !bg-[#3b82f6] hover:scale-125 transition-transform"
        />
        <span className="ml-4 text-[9px] font-mono uppercase text-[#3b82f6] tracking-wider pointer-events-none select-none">
          Prompt
        </span>
      </div>

      <div className="absolute -left-3 top-[54%] flex items-center">
        <Handle
          type="target"
          position={Position.Left}
          id="image-in"
          className="!h-3 !w-3 !rounded-full !border-2 !border-[#0b0f19] !bg-[#10b981] hover:scale-125 transition-transform"
        />
        <span className="ml-4 text-[9px] font-mono uppercase text-[#10b981] tracking-wider pointer-events-none select-none">
          Image
        </span>
      </div>

      <div className="absolute -left-3 top-[76%] flex items-center">
        <Handle
          type="target"
          position={Position.Left}
          id="context-video-in"
          className="!h-3 !w-3 !rounded-full !border-2 !border-[#0b0f19] !bg-[#8b5cf6] hover:scale-125 transition-transform"
        />
        <span className="ml-4 text-[9px] font-mono uppercase text-[#8b5cf6] tracking-wider pointer-events-none select-none">
          Context
        </span>
      </div>

      {/* Output Ports (Right) */}
      <div className="absolute -right-3 top-[44%] flex items-center justify-end">
        <span className="mr-4 text-[9px] font-mono uppercase text-[#8b5cf6] tracking-wider pointer-events-none select-none">
          Video
        </span>
        <Handle
          type="source"
          position={Position.Right}
          id="video-out"
          className="!h-3 !w-3 !rounded-full !border-2 !border-[#0b0f19] !bg-[#8b5cf6] hover:scale-125 transition-transform"
        />
      </div>

      <div className="absolute -right-3 top-[72%] flex items-center justify-end">
        <span className="mr-4 text-[9px] font-mono uppercase text-[#10b981] tracking-wider pointer-events-none select-none">
          Frame
        </span>
        <Handle
          type="source"
          position={Position.Right}
          id="frame-out"
          className="!h-3 !w-3 !rounded-full !border-2 !border-[#0b0f19] !bg-[#10b981] hover:scale-125 transition-transform"
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#334155] bg-[#451a03] px-3 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-[#f59e0b]" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-200">
            AI Video Segment
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          {status === "idle" && (
            <span className="flex items-center gap-1 text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Ready
            </span>
          )}
          {status === "generating" && (
            <span className="flex items-center gap-1 text-blue-400 font-semibold animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating...
            </span>
          )}
          {status === "completed" && (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <CheckCircle2 className="h-3 w-3" />
              Done
            </span>
          )}
          {status === "failed" && (
            <span className="flex items-center gap-1 text-red-400 font-semibold">
              <AlertCircle className="h-3 w-3" />
              Failed
            </span>
          )}
        </div>
      </div>

      {/* Configuration Body */}
      <div className="p-3 space-y-2.5">
        <div>
          <label
            htmlFor={`model-select-${id}`}
            className="block text-[11px] font-medium text-slate-400 mb-1"
          >
            Model
          </label>
          <select
            id={`model-select-${id}`}
            aria-label="Select Model"
            value={data.model ?? "veo-3.1"}
            onChange={handleModelChange}
            disabled={status === "generating"}
            className="w-full rounded-md border border-[#334155] bg-[#0b0f19] px-2.5 py-1.5 text-xs text-slate-200 focus:border-[#f59e0b] focus:outline-none"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor={`aspect-ratio-${id}`}
              className="block text-[11px] font-medium text-slate-400 mb-1"
            >
              Aspect Ratio
            </label>
            <select
              id={`aspect-ratio-${id}`}
              aria-label="Select Aspect Ratio"
              value={data.aspectRatio ?? "16:9"}
              onChange={handleRatioChange}
              disabled={status === "generating"}
              className="w-full rounded-md border border-[#334155] bg-[#0b0f19] px-2 py-1.5 text-xs text-slate-200 focus:border-[#f59e0b] focus:outline-none"
            >
              {ASPECT_RATIO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`seed-input-${id}`}
              className="block text-[11px] font-medium text-slate-400 mb-1"
            >
              Seed (Optional)
            </label>
            <input
              id={`seed-input-${id}`}
              type="number"
              aria-label="Seed Number"
              placeholder="Random"
              value={data.seed ?? ""}
              onChange={handleSeedChange}
              disabled={status === "generating"}
              className="w-full rounded-md border border-[#334155] bg-[#0b0f19] px-2 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-[#f59e0b] focus:outline-none"
            />
          </div>
        </div>

        {/* Error notice if failed */}
        {status === "failed" && data.error ? (
          <div className="rounded-md border border-red-500/40 bg-red-950/40 p-2 text-[11px] text-red-300">
            {data.error}
          </div>
        ) : null}

        {/* Action Controls */}
        <div className="pt-1">
          {status === "idle" && (
            <button
              type="button"
              onClick={handleStart}
              className="w-full flex items-center justify-center gap-1.5 rounded-md bg-[#BA7517] hover:bg-[#d97706] text-white py-1.5 text-xs font-semibold shadow transition-colors"
            >
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              Generate Segment
            </button>
          )}

          {status === "generating" && (
            <button
              type="button"
              aria-label="Cancel Generation"
              onClick={handleStop}
              className="w-full flex items-center justify-center gap-1.5 rounded-md border border-[#ef4444] bg-[#7f1d1d]/40 text-red-200 hover:bg-[#7f1d1d]/70 py-1.5 text-xs font-semibold transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel Generation
            </button>
          )}

          {status === "failed" && (
            <button
              type="button"
              aria-label="Retry Generation"
              onClick={handleRetry}
              className="w-full flex items-center justify-center gap-1.5 rounded-md bg-[#185FA5] hover:bg-[#1e88e5] text-white py-1.5 text-xs font-semibold shadow transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry Generation
            </button>
          )}

          {status === "completed" && (
            <button
              type="button"
              onClick={handleStart}
              className="w-full flex items-center justify-center gap-1.5 rounded-md border border-[#334155] bg-[#131d2e] hover:bg-[#1e293b] text-slate-300 py-1.5 text-xs font-medium transition-colors"
            >
              <RefreshCw
                className="h-3.5 w-3.5 text-slate-400"
                aria-hidden="true"
              />
              Regenerate
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
