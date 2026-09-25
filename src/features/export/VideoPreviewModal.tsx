import { Download, Film, Pause, Play, X } from "lucide-react";
import { useRef, useState } from "react";

export interface VideoPreviewModalProps {
  isOpen: boolean;
  previewUrl: string | null;
  totalDurationSeconds: number;
  segmentMarkers: number[];
  onClose: () => void;
  onOpenExport?: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

interface VideoPreviewDialogProps {
  previewUrl: string | null;
  totalDurationSeconds: number;
  segmentMarkers: number[];
  onClose: () => void;
  onOpenExport?: () => void;
}

function VideoPreviewDialog({
  previewUrl,
  totalDurationSeconds,
  segmentMarkers,
  onClose,
  onOpenExport,
}: VideoPreviewDialogProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const togglePlay = () => {
    if (!videoRef.current) {
      setIsPlaying(!isPlaying);
      return;
    }
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      void videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const jumpToTime = (timeSec: number) => {
    setCurrentTime(timeSec);
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
    }
  };

  const progressPercent =
    totalDurationSeconds > 0 ? (currentTime / totalDurationSeconds) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <section
        aria-label="Video Preview Player"
        className="flex w-full max-w-3xl flex-col rounded-xl border border-[#334155] bg-[#0b0f19] text-slate-100 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] bg-[#0C2D5C] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
            <h2 className="text-sm font-semibold tracking-wide text-blue-100">
              Video Preview
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-md text-slate-300 hover:bg-[#185FA5] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Video Player Display */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          {previewUrl ? (
            <video
              ref={videoRef}
              src={previewUrl}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onEnded={() => setIsPlaying(false)}
              className="h-full w-full object-contain"
            >
              <track kind="captions" />
            </video>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500">
              <Film className="h-12 w-12 stroke-1 mb-2" />
              <span className="text-xs">No video stream loaded</span>
            </div>
          )}
        </div>

        {/* Timeline Seekbar with Segment Markers */}
        <div className="border-t border-[#334155] bg-[#1e293b] p-3 space-y-2">
          <div className="relative h-3 w-full rounded bg-[#0b0f19] cursor-pointer">
            <div
              className="h-full rounded bg-[#185FA5] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Markers */}
            {segmentMarkers.map((markerSec, idx) => {
              const markerLeft =
                totalDurationSeconds > 0
                  ? (markerSec / totalDurationSeconds) * 100
                  : 0;
              return (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Jump to segment ${idx + 1}`}
                  onClick={() => jumpToTime(markerSec)}
                  style={{ left: `${markerLeft}%` }}
                  title={`Segment ${idx + 1} (${formatTime(markerSec)})`}
                  className="absolute top-0 bottom-0 w-1.5 -translate-x-1/2 bg-[#BA7517] hover:scale-150 transition-transform"
                />
              );
            })}
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={isPlaying ? "Pause video" : "Play video"}
                onClick={togglePlay}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-[#334155] bg-[#0b0f19] text-white hover:bg-[#334155] transition-colors"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
              </button>
              <span className="font-mono text-slate-300">
                {formatTime(currentTime)} / {formatTime(totalDurationSeconds)}
              </span>
            </div>

            {onOpenExport ? (
              <button
                type="button"
                aria-label="Export full video"
                onClick={onOpenExport}
                className="flex h-[34px] items-center gap-1.5 rounded-md bg-[#BA7517] hover:bg-[#d97706] text-white px-3 font-semibold shadow transition-colors"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Export Settings
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function VideoPreviewModal({
  isOpen,
  previewUrl,
  totalDurationSeconds,
  segmentMarkers,
  onClose,
  onOpenExport,
}: VideoPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <VideoPreviewDialog
      previewUrl={previewUrl}
      totalDurationSeconds={totalDurationSeconds}
      segmentMarkers={segmentMarkers}
      onClose={onClose}
      onOpenExport={onOpenExport}
    />
  );
}
