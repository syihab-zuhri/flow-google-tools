import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
} from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";
import { CanvasToolbar } from "./CanvasToolbar";
import { useContinuityPipeline } from "./use-continuity-pipeline";
import { useFlowGraphStore, type FlowCustomNode } from "./flow-graph-store";
import { flowNodeTypes } from "./nodes";
import { VideoPreviewModal } from "../export/VideoPreviewModal";
import {
  VideoExportModal,
  type ExportFormValues,
} from "../export/VideoExportModal";
import { useVideoExport } from "../export/use-video-export";

function getNodeColor(node: FlowCustomNode): string {
  switch (node.type) {
    case "prompt":
      return "#3b82f6";
    case "image":
      return "#10b981";
    case "video":
      return "#8b5cf6";
    case "generate":
      return "#f59e0b";
    default:
      return "#64748b";
  }
}

function useCanvasKeyboardShortcuts(undo: () => void, redo: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (cmdOrCtrl && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);
}

function CanvasWorkspaceInner() {
  const nodes = useFlowGraphStore((state) => state.nodes);
  const edges = useFlowGraphStore((state) => state.edges);
  const onNodesChange = useFlowGraphStore((state) => state.onNodesChange);
  const onEdgesChange = useFlowGraphStore((state) => state.onEdgesChange);
  const connectEdges = useFlowGraphStore((state) => state.connectEdges);
  const undo = useFlowGraphStore((state) => state.undo);
  const redo = useFlowGraphStore((state) => state.redo);

  const { pipelineState, runPipeline } = useContinuityPipeline();
  const { exportState, generatePreview, exportFinalVideo } = useVideoExport();

  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  useCanvasKeyboardShortcuts(undo, redo);

  const getSegmentPaths = useCallback(() => {
    return nodes
      .map((n) => {
        const data = n.data as Record<string, unknown>;
        return (data.outputPath || data.videoPath) as string | undefined;
      })
      .filter((p): p is string => typeof p === "string" && p.length > 0);
  }, [nodes]);

  const handleOpenPreview = useCallback(async () => {
    const paths = getSegmentPaths();
    if (paths.length > 0) {
      await generatePreview("flow_studio_proj", paths);
    }
    setIsPreviewOpen(true);
  }, [getSegmentPaths, generatePreview]);

  const handleOpenExport = useCallback(() => {
    setIsPreviewOpen(false);
    setIsExportOpen(true);
  }, []);

  const handleStartExport = useCallback(
    async (values: ExportFormValues) => {
      const paths = getSegmentPaths();
      const filename = values.filename.endsWith(`.${values.format}`)
        ? values.filename
        : `${values.filename}.${values.format}`;
      const fullOut = `${values.outputDirectory}/${filename}`;

      await exportFinalVideo({
        projectId: "flow_studio_proj",
        segmentPaths: paths,
        format: values.format,
        resolution: values.resolution,
        outputPath: fullOut,
      });
    },
    [getSegmentPaths, exportFinalVideo],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const result = connectEdges(connection);
      if (!result.success && result.reason) {
        setConnectionError(result.reason);
        setTimeout(() => setConnectionError(null), 4000);
      }
    },
    [connectEdges],
  );

  return (
    <div className="flex h-full w-full flex-col bg-[#0b0f19]">
      <CanvasToolbar
        onRunPipeline={runPipeline}
        isRunning={pipelineState.isRunning}
        onOpenPreview={handleOpenPreview}
        onOpenExport={handleOpenExport}
      />

      <div className="relative flex-1">
        {pipelineState.error && (
          <div
            role="alert"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-red-500/60 bg-[#450a0a]/90 px-4 py-2 text-xs font-semibold text-red-200 shadow-xl backdrop-blur transition-all"
          >
            {pipelineState.error}
          </div>
        )}

        {connectionError && (
          <div
            role="alert"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-red-500/60 bg-[#450a0a]/90 px-4 py-2 text-xs font-semibold text-red-200 shadow-xl backdrop-blur transition-all"
          >
            {connectionError}
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={flowNodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          fitView
          minZoom={0.2}
          maxZoom={2.0}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "#64748b", strokeWidth: 2 },
          }}
          className="bg-[#0b0f19]"
        >
          <Background color="#1e293b" gap={24} size={1} />
          <Controls className="!border-[#334155] !bg-[#1e293b] !fill-slate-300 [&>button]:!border-b-[#334155] [&>button]:!bg-[#1e293b] [&>button]:hover:!bg-[#334155]" />
          <MiniMap
            nodeColor={getNodeColor}
            maskColor="rgba(11, 15, 25, 0.75)"
            className="!border-[#334155] !bg-[#0b0f19] !rounded-md"
          />
        </ReactFlow>

        <VideoPreviewModal
          isOpen={isPreviewOpen}
          previewUrl={exportState.previewUrl}
          totalDurationSeconds={exportState.totalDurationSeconds}
          segmentMarkers={exportState.segmentMarkers}
          onClose={() => setIsPreviewOpen(false)}
          onOpenExport={handleOpenExport}
        />

        <VideoExportModal
          isOpen={isExportOpen}
          projectId="flow_studio_proj"
          segmentCount={getSegmentPaths().length}
          isExporting={exportState.isExporting}
          progressPercent={exportState.progressPercent}
          exportedPath={exportState.exportedPath}
          error={exportState.error}
          onClose={() => setIsExportOpen(false)}
          onExport={handleStartExport}
        />
      </div>
    </div>
  );
}

export function CanvasWorkspace() {
  return (
    <ReactFlowProvider>
      <CanvasWorkspaceInner />
    </ReactFlowProvider>
  );
}
