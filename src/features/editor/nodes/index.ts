import { type NodeTypes } from "@xyflow/react";
import { GenerationNode } from "./GenerationNode";
import { ImageNode } from "./ImageNode";
import { PromptNode } from "./PromptNode";
import { VideoNode } from "./VideoNode";

export { GenerationNode } from "./GenerationNode";
export { ImageNode } from "./ImageNode";
export { PromptNode } from "./PromptNode";
export { VideoNode } from "./VideoNode";

export const flowNodeTypes: NodeTypes = {
  prompt: PromptNode,
  image: ImageNode,
  video: VideoNode,
  generate: GenerationNode,
};
