import {
  Clapperboard,
  Film,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Play,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { useFlowGraphStore } from "./flow-graph-store";

export interface CanvasToolbarProps {
  onRunPipeline?: () => void;
  isRunning?: boolean;
}

export function CanvasToolbar({
  onRunPipeline,
  isRunning = false,
}: CanvasToolbarProps) {
  const nodes = useFlowGraphStore((state) => state.nodes);
  const edges = useFlowGraphStore((state) => state.edges);
  const historyPast = useFlowGraphStore((state) => state.historyPast);
  const historyFuture = useFlowGraphStore((state) => state.historyFuture);
  const addNode = useFlowGraphStore((state) => state.addNode);
  const undo = useFlowGraphStore((state) => state.undo);
  const redo = useFlowGraphStore((state) => state.redo);
  const clearGraph = useFlowGraphStore((state) => state.clearGraph);

  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;
  const isNearLimit = nodes.length >= 80;
  const isAtLimit = nodes.length >= 100;

  const handleClear = () => {
    if (nodes.length === 0) return;
    if (window.confirm("Clear all nodes from the canvas?")) {
      clearGraph();
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Canvas Editor Toolbar"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[#334155] bg-[#0b0f19] px-4 py-2 text-slate-200"
    >
      {/* Node Creation Palette */}
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Add:
        </span>
        <button
          type="button"
          aria-label="Add Prompt Node"
          onClick={() => addNode("prompt")}
          disabled={isAtLimit}
          className="flex h-[34px] items-center gap-1.5 rounded-md border border-[#2563eb]/40 bg-[#172554] px-2.5 text-xs font-semibold text-blue-200 hover:bg-[#1d4ed8] hover:text-white disabled:opacity-50 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          Prompt
        </button>

        <button
          type="button"
          aria-label="Add Image Node"
          onClick={() => addNode("image")}
          disabled={isAtLimit}
          className="flex h-[34px] items-center gap-1.5 rounded-md border border-[#059669]/40 bg-[#064e3b] px-2.5 text-xs font-semibold text-emerald-200 hover:bg-[#059669] hover:text-white disabled:opacity-50 transition-colors"
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Image
        </button>

        <button
          type="button"
          aria-label="Add Video Node"
          onClick={() => addNode("video")}
          disabled={isAtLimit}
          className="flex h-[34px] items-center gap-1.5 rounded-md border border-[#7c3aed]/40 bg-[#2e1065] px-2.5 text-xs font-semibold text-violet-200 hover:bg-[#7c3aed] hover:text-white disabled:opacity-50 transition-colors"
        >
          <Film className="h-3.5 w-3.5" aria-hidden="true" />
          Video
        </button>

        <button
          type="button"
          aria-label="Add Generation Node"
          onClick={() => addNode("generate")}
          disabled={isAtLimit}
          className="flex h-[34px] items-center gap-1.5 rounded-md border border-[#d97706]/40 bg-[#451a03] px-2.5 text-xs font-semibold text-amber-200 hover:bg-[#d97706] hover:text-white disabled:opacity-50 transition-colors"
        >
          <Clapperboard className="h-3.5 w-3.5" aria-hidden="true" />
          Generate
        </button>

        {onRunPipeline ? (
          <button
            type="button"
            aria-label="Run Sequence Pipeline"
            onClick={onRunPipeline}
            disabled={isRunning || nodes.length === 0}
            className="flex h-[34px] items-center gap-1.5 rounded-md border border-[#BA7517] bg-[#BA7517] px-3 text-xs font-bold text-white shadow hover:bg-[#d97706] disabled:opacity-50 transition-colors"
          >
            {isRunning ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            )}
            Run Pipeline
          </button>
        ) : null}
      </div>

      {/* History & Graph Controls */}
      <div className="flex items-center gap-3">
        {/* Node & Edge Status */}
        <div className="flex items-center gap-2 border-r border-[#334155] pr-3 text-xs">
          <span
            className={`font-mono ${
              isAtLimit
                ? "text-red-400 font-bold"
                : isNearLimit
                  ? "text-amber-400 font-medium"
                  : "text-slate-400"
            }`}
          >
            {nodes.length} / 100 Nodes
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400 font-mono">{edges.length} Edges</span>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Undo change"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-[#334155] bg-[#1e293b] text-slate-300 hover:bg-[#334155] disabled:opacity-40 disabled:hover:bg-[#1e293b] transition-colors"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Redo change"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-[#334155] bg-[#1e293b] text-slate-300 hover:bg-[#334155] disabled:opacity-40 disabled:hover:bg-[#1e293b] transition-colors"
          >
            <Redo2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Clear */}
        <button
          type="button"
          aria-label="Clear Canvas"
          onClick={handleClear}
          disabled={nodes.length === 0}
          title="Clear all nodes"
          className="flex h-[34px] items-center gap-1.5 rounded-md border border-red-900/50 bg-[#7f1d1d]/30 px-2.5 text-xs text-red-300 hover:bg-[#7f1d1d]/60 disabled:opacity-30 disabled:hover:bg-[#7f1d1d]/30 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      </div>
    </div>
  );
}
