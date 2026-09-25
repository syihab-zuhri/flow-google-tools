import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  commands,
  type OutputFormat,
  type ResolutionPreset,
} from "../../bindings";

export interface VideoExportState {
  isPreviewing: boolean;
  isExporting: boolean;
  previewUrl: string | null;
  segmentMarkers: number[];
  totalDurationSeconds: number;
  exportedPath: string | null;
  progressPercent: number;
  error: string | null;
}

export interface FinalExportParams {
  projectId: string;
  segmentPaths: string[];
  format: OutputFormat;
  resolution: ResolutionPreset;
  outputPath: string;
}

const INITIAL_STATE: VideoExportState = {
  isPreviewing: false,
  isExporting: false,
  previewUrl: null,
  segmentMarkers: [],
  totalDurationSeconds: 0,
  exportedPath: null,
  progressPercent: 0,
  error: null,
};

async function executePreview(projectId: string, segmentPaths: string[]) {
  const res = await commands.previewExport(projectId, segmentPaths);
  if (res.status === "error") {
    throw new Error(res.error.message);
  }
  return res.data;
}

async function executeExport(params: FinalExportParams) {
  const res = await commands.concatSegments({
    clientRequestId: `req-${Date.now()}`,
    projectId: params.projectId,
    segmentPaths: params.segmentPaths,
    outputPath: params.outputPath,
    format: params.format,
    resolution: params.resolution,
  });
  if (res.status === "error") {
    throw new Error(res.error.message);
  }
  return res.data;
}

function usePreviewAction(
  setExportState: Dispatch<SetStateAction<VideoExportState>>,
) {
  return useCallback(
    async (projectId: string, segmentPaths: string[]) => {
      if (segmentPaths.length === 0) {
        setExportState((prev) => ({
          ...prev,
          error: "At least one segment is required for preview.",
        }));
        return;
      }

      setExportState((prev) => ({ ...prev, isPreviewing: true, error: null }));
      try {
        const data = await executePreview(projectId, segmentPaths);
        setExportState((prev) => ({
          ...prev,
          isPreviewing: false,
          previewUrl: data.previewFilePath,
          segmentMarkers: data.segmentMarkers.map((m) => m ?? 0),
          totalDurationSeconds: data.totalDurationSeconds ?? 0,
          error: null,
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setExportState((prev) => ({
          ...prev,
          isPreviewing: false,
          error: msg,
        }));
      }
    },
    [setExportState],
  );
}

function useExportAction(
  setExportState: Dispatch<SetStateAction<VideoExportState>>,
) {
  return useCallback(
    async (params: FinalExportParams) => {
      setExportState((prev) => ({
        ...prev,
        isExporting: true,
        progressPercent: 10,
        error: null,
      }));

      try {
        const data = await executeExport(params);
        setExportState((prev) => ({
          ...prev,
          isExporting: false,
          progressPercent: 100,
          exportedPath: data.outputPath,
          error: null,
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setExportState((prev) => ({
          ...prev,
          isExporting: false,
          progressPercent: 0,
          error: msg,
        }));
      }
    },
    [setExportState],
  );
}

export function useVideoExport() {
  const [exportState, setExportState] =
    useState<VideoExportState>(INITIAL_STATE);

  const generatePreview = usePreviewAction(setExportState);
  const exportFinalVideo = useExportAction(setExportState);

  const resetExportState = useCallback(() => {
    setExportState(INITIAL_STATE);
  }, []);

  return {
    exportState,
    generatePreview,
    exportFinalVideo,
    resetExportState,
  };
}
