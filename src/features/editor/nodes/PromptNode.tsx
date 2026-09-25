import { Handle, Position } from "@xyflow/react";
import { MessageSquare, Variable } from "lucide-react";
import { type ChangeEvent } from "react";
import { useFlowGraphStore, type PromptNodeData } from "../flow-graph-store";

export interface PromptNodeProps {
  id: string;
  data: PromptNodeData;
  selected?: boolean;
  onDataChange?: (id: string, updated: Partial<PromptNodeData>) => void;
}

const MAX_PROMPT_LENGTH = 2000;

export function PromptNode({
  id,
  data,
  selected = false,
  onDataChange,
}: PromptNodeProps) {
  const storeUpdate = useFlowGraphStore((state) => state.updateNodeData);
  const handleUpdate = onDataChange ?? storeUpdate;

  const promptText = data.promptText ?? "";
  const charCount = promptText.length;
  const isOverLimit = charCount > MAX_PROMPT_LENGTH;

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    handleUpdate(id, { promptText: e.target.value });
  };

  const handleInsertVariable = (variable: string) => {
    const updated = promptText ? `${promptText} ${variable}` : variable;
    handleUpdate(id, { promptText: updated });
  };

  return (
    <section
      aria-label="Prompt Input Node"
      className={`relative w-[280px] rounded-lg border bg-[#1e293b] text-slate-100 shadow-lg transition-all ${
        selected
          ? "border-[#3b82f6] shadow-[0_0_16px_-2px_rgba(59,130,246,0.5)]"
          : "border-[#334155]"
      } ${isOverLimit ? "border-[#ef4444]" : ""}`}
    >
      <div className="flex items-center justify-between border-b border-[#334155] bg-[#172554] px-3 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageSquare
            className="h-4 w-4 text-[#3b82f6]"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
            Prompt
          </span>
        </div>
        <span
          className={`font-mono text-[11px] ${
            isOverLimit ? "font-bold text-red-400" : "text-slate-400"
          }`}
        >
          {charCount} / {MAX_PROMPT_LENGTH}
        </span>
      </div>

      <div className="p-3">
        <textarea
          id={`prompt-textarea-${id}`}
          aria-label="Prompt Input"
          rows={4}
          value={promptText}
          onChange={handleChange}
          placeholder="Describe the scene, action, lighting, camera angle..."
          className="w-full resize-none rounded-md border border-[#334155] bg-[#0b0f19] p-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:border-[#3b82f6] focus:outline-none"
        />

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Variable className="h-3 w-3" aria-hidden="true" />
            Tags:
          </span>
          <button
            type="button"
            onClick={() => handleInsertVariable("{segment_number}")}
            className="rounded bg-[#131d2e] px-1.5 py-0.5 text-[10px] font-mono text-blue-400 hover:bg-[#1e293b] border border-[#2563eb]/40"
          >
            &#123;segment_number&#125;
          </button>
          <button
            type="button"
            onClick={() => handleInsertVariable("{previous_context}")}
            className="rounded bg-[#131d2e] px-1.5 py-0.5 text-[10px] font-mono text-emerald-400 hover:bg-[#1e293b] border border-[#059669]/40"
          >
            &#123;previous_context&#125;
          </button>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="prompt-out"
        className="!h-3 !w-3 !rounded-full !border-2 !border-[#0b0f19] !bg-[#3b82f6] hover:scale-125 transition-transform"
      />
    </section>
  );
}
