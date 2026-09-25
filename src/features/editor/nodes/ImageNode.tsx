import { Handle, Position } from "@xyflow/react";
import { Image as ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { type ChangeEvent } from "react";
import { useFlowGraphStore, type ImageNodeData } from "../flow-graph-store";

export interface ImageNodeProps {
  id: string;
  data: ImageNodeData;
  selected?: boolean;
  onDataChange?: (id: string, updated: Partial<ImageNodeData>) => void;
}

const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export function ImageNode({
  id,
  data,
  selected = false,
  onDataChange,
}: ImageNodeProps) {
  const storeUpdate = useFlowGraphStore((state) => state.updateNodeData);
  const handleUpdate = onDataChange ?? storeUpdate;

  const hasImage = Boolean(
    data.thumbnailUrl || data.imagePath || data.fileName,
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      handleUpdate(id, {
        fileName: file.name,
        fileSize: file.size,
        thumbnailUrl: reader.result as string,
        imagePath: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    handleUpdate(id, {
      fileName: undefined,
      thumbnailUrl: undefined,
      imagePath: undefined,
      fileSize: undefined,
    });
  };

  return (
    <section
      aria-label="Image Reference Node"
      className={`relative w-[280px] rounded-lg border bg-[#1e293b] text-slate-100 shadow-lg transition-all ${
        selected
          ? "border-[#10b981] shadow-[0_0_16px_-2px_rgba(16,185,129,0.5)]"
          : "border-[#334155]"
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#334155] bg-[#064e3b] px-3 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[#10b981]" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
            Image Reference
          </span>
        </div>
        {hasImage ? (
          <button
            type="button"
            aria-label="Clear reference image"
            onClick={handleClear}
            className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="p-3">
        {hasImage ? (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-md border border-[#334155] bg-[#0b0f19] aspect-video flex items-center justify-center">
              <img
                src={data.thumbnailUrl}
                alt="Reference preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate font-mono" title={data.fileName}>
                {data.fileName ?? "image.png"}
              </span>
              {data.fileSize ? (
                <span className="font-mono">
                  {(data.fileSize / 1024).toFixed(0)} KB
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#475569] bg-[#0b0f19]/60 p-4 text-center cursor-pointer hover:border-[#10b981] transition-colors">
            <UploadCloud
              className="h-7 w-7 text-emerald-500/80 mb-2"
              aria-hidden="true"
            />
            <span className="text-xs text-slate-300 font-medium">
              Drop reference image here
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              PNG, JPG, or WEBP
            </span>
            <input
              type="file"
              accept={SUPPORTED_EXTENSIONS.join(",")}
              aria-label="Upload reference image"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="image-out"
        className="!h-3 !w-3 !rounded-full !border-2 !border-[#0b0f19] !bg-[#10b981] hover:scale-125 transition-transform"
      />
    </section>
  );
}
