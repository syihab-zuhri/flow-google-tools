import {
  getExecutionOrder,
  type FlowConnection,
  type FlowNodeDescriptor,
} from "./dag-validator";

export interface GenerationStepParams {
  nodeId: string;
  prompt: string;
  maxRetries?: number;
  initialBackoffMs?: number;
}

export interface GenerationStepResult {
  success: boolean;
  outputPath?: string;
  lastFramePath?: string;
  error?: string;
}

export interface ComposePromptParams {
  currentPrompt: string;
  historyPrompts: string[];
  styleLock?: string | null;
}

export function buildNodeExecutionSequence(
  nodes: FlowNodeDescriptor[],
  edges: FlowConnection[],
): { isValid: boolean; order: string[] } {
  const result = getExecutionOrder(nodes, edges);
  if (!result) {
    return {
      isValid: false,
      order: [],
    };
  }
  return {
    isValid: true,
    order: result,
  };
}

export function composeContinuityPrompt(params: ComposePromptParams): string {
  const parts: string[] = [];

  const styleCleaned = params.styleLock?.trim();
  if (styleCleaned) {
    parts.push(`[Style Lock: ${styleCleaned}]`);
  }

  const relevantHistory = params.historyPrompts
    .map((p) => p.trim())
    .filter((p) => Boolean(p))
    .slice(-3);

  if (relevantHistory.length > 0) {
    parts.push(`Continuing from: ${relevantHistory.join(" -> ")}.`);
  }

  const current = params.currentPrompt.trim();
  if (parts.length > 0) {
    parts.push(`Next scene: ${current}`);
    return parts.join(" ");
  }

  return current;
}

export async function executeGenerationStep(
  params: GenerationStepParams,
  worker: (
    nodeId: string,
  ) => Promise<{ outputPath: string; lastFramePath?: string }>,
): Promise<GenerationStepResult> {
  const maxRetries = params.maxRetries ?? 3;
  const initialBackoff = params.initialBackoffMs ?? 2000;

  let attempt = 0;
  let lastError = "";

  while (attempt < maxRetries) {
    try {
      const output = await worker(params.nodeId);
      return {
        success: true,
        outputPath: output.outputPath,
        lastFramePath: output.lastFramePath,
      };
    } catch (err) {
      attempt += 1;
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        const backoff = initialBackoff * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  return {
    success: false,
    error: lastError,
  };
}
