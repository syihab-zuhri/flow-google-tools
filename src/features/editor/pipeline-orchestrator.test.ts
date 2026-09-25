import { describe, expect, it, vi } from "vitest";
import {
  buildNodeExecutionSequence,
  composeContinuityPrompt,
  executeGenerationStep,
  type GenerationStepParams,
} from "./pipeline-orchestrator";
import type { FlowConnection, FlowNodeDescriptor } from "./dag-validator";

describe("Pipeline Orchestrator", () => {
  it("determines correct topological execution sequence for chained generation nodes", () => {
    const nodes: FlowNodeDescriptor[] = [
      { id: "gen-2", type: "generate" },
      { id: "prompt-1", type: "prompt" },
      { id: "gen-1", type: "generate" },
    ];

    const edges: FlowConnection[] = [
      {
        source: "prompt-1",
        target: "gen-1",
        sourceHandle: "prompt-out",
        targetHandle: "prompt-in",
      },
      {
        source: "gen-1",
        target: "gen-2",
        sourceHandle: "video-out",
        targetHandle: "context-video-in",
      },
    ];

    const sequence = buildNodeExecutionSequence(nodes, edges);
    expect(sequence.isValid).toBe(true);
    // gen-1 must execute before gen-2
    const gen1Index = sequence.order.indexOf("gen-1");
    const gen2Index = sequence.order.indexOf("gen-2");
    expect(gen1Index).toBeLessThan(gen2Index);
  });

  it("composes continuity prompt by collecting ancestors prompt history", () => {
    const currentPrompt = "The spaceship enters hyperspace.";
    const historyPrompts = [
      "Scene 1: Launching from orbital dock.",
      "Scene 2: Clearing planetary orbit.",
    ];
    const styleLock = "70mm IMAX cinematic sci-fi";

    const composed = composeContinuityPrompt({
      currentPrompt,
      historyPrompts,
      styleLock,
    });

    expect(composed).toContain("[Style Lock: 70mm IMAX cinematic sci-fi]");
    expect(composed).toContain("Continuing from: ");
    expect(composed).toContain("Next scene: The spaceship enters hyperspace.");
  });

  it("handles retry with exponential backoff on transient failure", async () => {
    let callCount = 0;
    const mockWorker = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount < 2) {
        throw new Error("Temporary rate limit 429");
      }
      return {
        outputPath: "/assets/clip_01.mp4",
        lastFramePath: "/assets/clip_01_frame.png",
      };
    });

    const params: GenerationStepParams = {
      nodeId: "gen-1",
      prompt: "A neon cyborg runs through alley.",
      maxRetries: 3,
      initialBackoffMs: 10,
    };

    const result = await executeGenerationStep(params, mockWorker);
    expect(result.success).toBe(true);
    expect(callCount).toBe(2);
    expect(result.outputPath).toBe("/assets/clip_01.mp4");
  });
});
