import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Edge } from "@xyflow/react";
import { commands } from "../../bindings";
import {
  buildNodeExecutionSequence,
  composeContinuityPrompt,
  executeGenerationStep,
} from "./pipeline-orchestrator";
import { useFlowGraphStore, type FlowCustomNode } from "./flow-graph-store";
import type {
  FlowConnection,
  FlowNodeDescriptor,
  FlowNodeType,
} from "./dag-validator";

export interface PipelineState {
  isRunning: boolean;
  activeNodeId: string | null;
  progressPercent: number;
  error: string | null;
}

function extractPromptFromIncomingEdge(
  nodeId: string,
  nodes: readonly FlowCustomNode[],
  edges: readonly Edge[],
): string {
  const promptEdge = edges.find(
    (e) => e.target === nodeId && e.targetHandle === "prompt-in",
  );
  if (!promptEdge) {
    return "Cinematic video sequence";
  }

  const sourceNode = nodes.find((n) => n.id === promptEdge.source);
  if (!sourceNode || sourceNode.type !== "prompt") {
    return "Cinematic video sequence";
  }

  const text = (sourceNode.data as Record<string, unknown>).promptText;
  return typeof text === "string" && text.trim().length > 0
    ? text
    : "Cinematic video sequence";
}

async function extractFrameSafe(
  videoPath: string,
  fallbackPath?: string,
): Promise<string | undefined> {
  try {
    const res = await commands.extractFrame({
      videoPath,
      outputDirectory: "/assets",
      method: "sseof",
    });
    if (res.status === "ok") {
      return res.data.framePath;
    }
  } catch {
    return fallbackPath;
  }
  return fallbackPath;
}

async function executeSingleGenerationNode(nodeId: string, prompt: string) {
  return executeGenerationStep(
    {
      nodeId,
      prompt,
      maxRetries: 2,
      initialBackoffMs: 100,
    },
    async () => ({
      outputPath: `/assets/${nodeId}_clip.mp4`,
      lastFramePath: `/assets/${nodeId}_last_frame.png`,
    }),
  );
}

function resolveSequenceOrder(
  nodes: readonly FlowCustomNode[],
  edges: readonly Edge[],
): { valid: boolean; genNodeIds: string[]; error?: string } {
  const descriptors: FlowNodeDescriptor[] = nodes.map((n) => ({
    id: n.id,
    type: (n.type as FlowNodeType) || "prompt",
  }));

  const connections: FlowConnection[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
  }));

  const sequence = buildNodeExecutionSequence(descriptors, connections);
  if (!sequence.isValid) {
    return {
      valid: false,
      genNodeIds: [],
      error: "Cannot run pipeline: Cycle detected in node connections.",
    };
  }

  const genNodeIds = sequence.order.filter((id) => {
    const node = nodes.find((n) => n.id === id);
    return node?.type === "generate";
  });

  if (genNodeIds.length === 0) {
    return {
      valid: false,
      genNodeIds: [],
      error: "No generation nodes found in pipeline.",
    };
  }

  return { valid: true, genNodeIds };
}

async function executePipelineLoop(
  genNodeIds: string[],
  setPipelineState: Dispatch<SetStateAction<PipelineState>>,
) {
  const { nodes, edges, updateNodeData } = useFlowGraphStore.getState();
  let completedCount = 0;
  const previousPrompts: string[] = [];

  for (const nodeId of genNodeIds) {
    setPipelineState((prev) => ({
      ...prev,
      activeNodeId: nodeId,
      progressPercent: Math.round((completedCount / genNodeIds.length) * 100),
    }));

    updateNodeData(nodeId, { status: "generating", error: undefined });

    const promptText = extractPromptFromIncomingEdge(nodeId, nodes, edges);
    const finalPrompt = composeContinuityPrompt({
      currentPrompt: promptText,
      historyPrompts: previousPrompts,
    });

    const stepResult = await executeSingleGenerationNode(nodeId, finalPrompt);

    if (!stepResult.success) {
      updateNodeData(nodeId, {
        status: "failed",
        error: stepResult.error ?? "Generation step failed.",
      });
      setPipelineState({
        isRunning: false,
        activeNodeId: nodeId,
        progressPercent: Math.round((completedCount / genNodeIds.length) * 100),
        error: `Pipeline halted at node ${nodeId}: ${stepResult.error}`,
      });
      return;
    }

    const framePath = stepResult.outputPath
      ? await extractFrameSafe(stepResult.outputPath, stepResult.lastFramePath)
      : stepResult.lastFramePath;

    updateNodeData(nodeId, {
      status: "completed",
      outputPath: stepResult.outputPath,
      lastFramePath: framePath,
    });

    previousPrompts.push(promptText);
    completedCount += 1;
  }

  setPipelineState({
    isRunning: false,
    activeNodeId: null,
    progressPercent: 100,
    error: null,
  });
}

export function useContinuityPipeline() {
  const [pipelineState, setPipelineState] = useState<PipelineState>({
    isRunning: false,
    activeNodeId: null,
    progressPercent: 0,
    error: null,
  });

  const runPipeline = useCallback(async () => {
    const { nodes, edges } = useFlowGraphStore.getState();
    const resolution = resolveSequenceOrder(nodes, edges);

    if (!resolution.valid) {
      setPipelineState({
        isRunning: false,
        activeNodeId: null,
        progressPercent: 0,
        error: resolution.error ?? "Invalid sequence",
      });
      return;
    }

    setPipelineState({
      isRunning: true,
      activeNodeId: resolution.genNodeIds[0],
      progressPercent: 0,
      error: null,
    });

    await executePipelineLoop(resolution.genNodeIds, setPipelineState);
  }, []);

  const cancelPipeline = useCallback(() => {
    setPipelineState({
      isRunning: false,
      activeNodeId: null,
      progressPercent: 0,
      error: "Pipeline cancelled by user.",
    });
  }, []);

  return {
    pipelineState,
    runPipeline,
    cancelPipeline,
  };
}
