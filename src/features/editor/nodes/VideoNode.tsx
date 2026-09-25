import { Handle, Position } from "@xyflow/react";
import { Film, Trash2, UploadCloud } from "lucide-react";
import { type ChangeEvent } from "react";
import { useFlowGraphStore, type VideoNodeData } from "../flow-graph-store";

export interface VideoNodeProps {
  id: string;
  data: VideoNodeData;
  selected?: boolean;
  onDataChange?: (id: string, updated: Partial<VideoNodeData>) => void;
}

const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".webm"];

function formatDuration(seconds?: number): string {
  if (seconds === undefined || Number.isNaN(seconds)) {
    return "00:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function VideoNode({
  id,
  data,
  selected = false,
  onDataChange,
}: VideoNodeProps) {
  const storeUpdate = useFlowGraphStore((state) => state.updateNodeData);
  const handleUpdate = onDataChange ?? storeUpdate;

  const hasVideo = Boolean(
    data.videoPath || data.fileName || data.thumbnailUrl,
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    handleUpdate(id, {
      fileName: file.name,
      videoPath: file.name,
      thumbnailUrl: objectUrl,
      duration: 10.0,
      resolution: "1920x1080",
    });
  };

  const handleClear = () => {
    handleUpdate(id, {
      fileName: undefined,
      videoPath: undefined,
      duration: undefined,
      resolution: undefined,
      thumbnailUrl: undefined,
    });
  };

  return (
    <section
      aria-label="Video Reference Node"
      className={`relative w-[280px] rounded-lg border bg-[#1e293b] text-slate-100 shadow-lg transition-all ${
        selected
          ? "border-[#8b5cf6] shadow-[0_0_16px_-2px_rgba(139,92,246,0.5)]"
          : "border-[#334155]"
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#334155] bg-[#2e1065] px-3 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-[#8b5cf6]" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-200">
            Video Reference
          </span>
        </div>
        {hasVideo ? (
          <button
            type="button"
            aria-label="Clear video clip"
            onClick={handleClear}
            className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="p-3">
        {hasVideo ? (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-md border border-[#334155] bg-[#0b0f19] aspect-video flex items-center justify-center relative group">
              {data.thumbnailUrl ? (
                <video
                  src={data.thumbnailUrl}
                  controls
                  className="max-h-full max-w-full object-contain"
                >
                  <track kind="captions" />
                </video>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <Film className="h-8 w-8 text-violet-500/60 mb-1" />
                  <span className="text-[11px] text-slate-400 font-mono">
                    {data.fileName ?? "video.mp4"}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="truncate max-w-[140px]" title={data.fileName}>
                {data.fileName ?? "video.mp4"}
              </span>
              <div className="flex items-center gap-2">
                <span>{formatDuration(data.duration)}</span>
                {data.resolution ? (
                  <span className="rounded bg-[#131d2e] px-1 py-0.5 border border-[#334155]">
                    {data.resolution}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#475569] bg-[#0b0f19]/60 p-4 text-center cursor-pointer hover:border-[#8b5cf6] transition-colors">
            <UploadCloud
              className="h-7 w-7 text-violet-500/80 mb-2"
              aria-hidden="true"
            />
            <span className="text-xs text-slate-300 font-medium">
              Drop video clip here
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              MP4 or WEBM
            </span>
            <input
              type="file"
              accept={SUPPORTED_VIDEO_EXTENSIONS.join(",")}
              aria-label="Upload video clip"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="video-out"
        className="!h-3 !w-3 !rounded-full !border-2 !border-[#0b0f19] !bg-[#8b5cf6] hover:scale-125 transition-transform"
      />
    </section>
  );
}
