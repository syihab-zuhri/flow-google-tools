import { CheckCircle2, Download, Film, Loader2, X } from "lucide-react";
import { useState } from "react";
import type { OutputFormat, ResolutionPreset } from "../../bindings";

export interface ExportFormValues {
  format: OutputFormat;
  resolution: ResolutionPreset;
  filename: string;
  outputDirectory: string;
}

export interface VideoExportModalProps {
  isOpen: boolean;
  projectId: string;
  segmentCount: number;
  isExporting: boolean;
  progressPercent: number;
  exportedPath?: string | null;
  error?: string | null;
  onClose: () => void;
  onExport: (values: ExportFormValues) => void;
}

export function VideoExportModal({
  isOpen,
  projectId,
  segmentCount,
  isExporting,
  progressPercent,
  exportedPath,
  error,
  onClose,
  onExport,
}: VideoExportModalProps) {
  const [format, setFormat] = useState<OutputFormat>("mp4");
  const [resolution, setResolution] = useState<ResolutionPreset>("1080p");
  const [filename, setFilename] = useState(`${projectId}_final`);
  const [outputDirectory, setOutputDirectory] = useState("/exports");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExport({
      format,
      resolution,
      filename,
      outputDirectory,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <section
        aria-label="Video Export Dialog"
        className="flex w-full max-w-lg flex-col rounded-xl border border-[#334155] bg-[#0b0f19] text-slate-100 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] bg-[#0C2D5C] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
            <h2 className="text-sm font-semibold tracking-wide text-blue-100">
              Export Video Sequence ({segmentCount} Segments)
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close export modal"
            onClick={onClose}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-md text-slate-300 hover:bg-[#185FA5] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-500/50 bg-[#450a0a] p-2.5 text-xs text-red-200"
            >
              {error}
            </div>
          )}

          {exportedPath && (
            <div className="rounded-md border border-emerald-500/50 bg-[#064e3b] p-2.5 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="truncate">Saved: {exportedPath}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="export-format-select"
                className="block text-xs font-medium text-slate-400 mb-1"
              >
                Format
              </label>
              <select
                id="export-format-select"
                aria-label="Select format"
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
                disabled={isExporting}
                className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs text-slate-200 focus:border-[#185FA5] focus:outline-none"
              >
                <option value="mp4">MP4 (H.264 / AAC)</option>
                <option value="webm">WebM (VP9 / Opus)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="export-res-select"
                className="block text-xs font-medium text-slate-400 mb-1"
              >
                Resolution
              </label>
              <select
                id="export-res-select"
                aria-label="Select resolution"
                value={resolution}
                onChange={(e) =>
                  setResolution(e.target.value as ResolutionPreset)
                }
                disabled={isExporting}
                className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs text-slate-200 focus:border-[#185FA5] focus:outline-none"
              >
                <option value="original">Original</option>
                <option value="1080p">1080p (Full HD)</option>
                <option value="720p">720p (HD)</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="export-filename-input"
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              File Name
            </label>
            <input
              id="export-filename-input"
              aria-label="Output file name"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              disabled={isExporting}
              className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs text-slate-200 focus:border-[#185FA5] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="export-dir-input"
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              Output Folder
            </label>
            <input
              id="export-dir-input"
              aria-label="Output directory"
              value={outputDirectory}
              onChange={(e) => setOutputDirectory(e.target.value)}
              disabled={isExporting}
              className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-[#185FA5] focus:outline-none"
            />
          </div>

          {/* Progress Indicator */}
          {isExporting ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#BA7517]" />
                  Rendering video sequence {progressPercent}%
                </span>
              </div>
              <div className="h-2 w-full rounded bg-[#1e293b] overflow-hidden">
                <div
                  className="h-full bg-[#BA7517] transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#334155]">
            <button
              type="button"
              onClick={onClose}
              className="flex h-[34px] items-center rounded-md border border-[#334155] bg-[#1e293b] px-3 text-xs text-slate-300 hover:bg-[#334155] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              aria-label="Start export process"
              disabled={isExporting || segmentCount === 0}
              className="flex h-[34px] items-center gap-1.5 rounded-md bg-[#BA7517] hover:bg-[#d97706] text-white px-4 text-xs font-semibold shadow disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {isExporting ? "Exporting..." : "Start Export"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
