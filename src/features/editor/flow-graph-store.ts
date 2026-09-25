import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import { create } from "zustand";
import {
  validateEdgeConnection,
  type FlowConnection,
  type FlowNodeDescriptor,
  type FlowNodeType,
} from "./dag-validator";

export interface PromptNodeData {
  promptText: string;
  templateVariables: string[];
}

export interface ImageNodeData {
  imagePath?: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface VideoNodeData {
  videoPath?: string;
  thumbnailUrl?: string;
  duration?: number;
  resolution?: string;
  fileName?: string;
}

export interface GenerateNodeData {
  model: string;
  aspectRatio: string;
  seed?: number;
  status: "idle" | "generating" | "completed" | "failed";
  error?: string;
  outputPath?: string;
  lastFramePath?: string;
}

export type FlowNodeData =
  | PromptNodeData
  | ImageNodeData
  | VideoNodeData
  | GenerateNodeData;

export type FlowCustomNode = Node<Record<string, unknown>, FlowNodeType>;

export interface FlowGraphSnapshot {
  nodes: FlowCustomNode[];
  edges: Edge[];
}

export interface FlowGraphState {
  nodes: FlowCustomNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  historyPast: FlowGraphSnapshot[];
  historyFuture: FlowGraphSnapshot[];
  isDirty: boolean;

  // Actions
  addNode: (
    type: FlowNodeType,
    position?: { x: number; y: number },
  ) => FlowCustomNode | null;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  removeNode: (id: string) => void;
  removeNodes: (ids: string[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  onNodesChange: OnNodesChange<FlowCustomNode>;
  onEdgesChange: OnEdgesChange;
  connectEdges: (connection: Connection) => {
    success: boolean;
    reason?: string;
  };
  removeEdge: (id: string) => void;
  setGraph: (nodes: FlowCustomNode[], edges: Edge[]) => void;
  clearGraph: () => void;
  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY_STEPS = 50;
const MAX_NODES_LIMIT = 100;

function createDefaultNodeData(type: FlowNodeType): Record<string, unknown> {
  switch (type) {
    case "prompt":
      return { promptText: "", templateVariables: [] } satisfies PromptNodeData;
    case "image":
      return {} satisfies ImageNodeData;
    case "video":
      return {} satisfies VideoNodeData;
    case "generate":
      return {
        model: "veo-3.1",
        aspectRatio: "16:9",
        status: "idle",
      } satisfies GenerateNodeData;
  }
}

let nodeIdCounter = 0;

function generateUniqueId(type: FlowNodeType): string {
  nodeIdCounter += 1;
  return `${type}-${Date.now().toString(36)}-${nodeIdCounter}`;
}

export const useFlowGraphStore = create<FlowGraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  historyPast: [],
  historyFuture: [],
  isDirty: false,

  addNode: (type, position = { x: 250, y: 150 }) => {
    const { nodes, edges, historyPast } = get();
    if (nodes.length >= MAX_NODES_LIMIT) {
      return null;
    }

    const newNode: FlowCustomNode = {
      id: generateUniqueId(type),
      type,
      position,
      data: createDefaultNodeData(type),
    };

    const snapshot: FlowGraphSnapshot = {
      nodes: [...nodes],
      edges: [...edges],
    };

    set({
      nodes: [...nodes, newNode],
      historyPast: [...historyPast.slice(-MAX_HISTORY_STEPS + 1), snapshot],
      historyFuture: [],
      isDirty: true,
    });

    return newNode;
  },

  updateNodeData: (id, partialData) => {
    const { nodes, edges, historyPast } = get();
    const snapshot: FlowGraphSnapshot = {
      nodes: [...nodes],
      edges: [...edges],
    };

    set({
      nodes: nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...partialData,
            },
          };
        }
        return node;
      }),
      historyPast: [...historyPast.slice(-MAX_HISTORY_STEPS + 1), snapshot],
      historyFuture: [],
      isDirty: true,
    });
  },

  removeNode: (id) => {
    get().removeNodes([id]);
  },

  removeNodes: (ids) => {
    const { nodes, edges, historyPast, selectedNodeId } = get();
    const idSet = new Set(ids);

    const snapshot: FlowGraphSnapshot = {
      nodes: [...nodes],
      edges: [...edges],
    };

    set({
      nodes: nodes.filter((node) => !idSet.has(node.id)),
      edges: edges.filter(
        (edge) => !idSet.has(edge.source) && !idSet.has(edge.target),
      ),
      selectedNodeId:
        selectedNodeId && idSet.has(selectedNodeId) ? null : selectedNodeId,
      historyPast: [...historyPast.slice(-MAX_HISTORY_STEPS + 1), snapshot],
      historyFuture: [],
      isDirty: true,
    });
  },

  setSelectedNodeId: (id) => {
    set({ selectedNodeId: id });
  },

  onNodesChange: (changes: NodeChange<FlowCustomNode>[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isDirty: true,
    });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },

  connectEdges: (connection: Connection) => {
    const { nodes, edges, historyPast } = get();

    if (!connection.source || !connection.target) {
      return { success: false, reason: "Incomplete connection endpoints." };
    }

    const descriptors: FlowNodeDescriptor[] = nodes.map((node) => ({
      id: node.id,
      type: (node.type as FlowNodeType) || "prompt",
    }));

    const existingConnections: FlowConnection[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }));

    const proposed: FlowConnection = {
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
    };

    const validation = validateEdgeConnection(
      proposed,
      descriptors,
      existingConnections,
    );

    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    const newEdge: Edge = {
      id: `e-${connection.source}-${connection.sourceHandle || "out"}-${connection.target}-${connection.targetHandle || "in"}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      animated: true,
    };

    const snapshot: FlowGraphSnapshot = {
      nodes: [...nodes],
      edges: [...edges],
    };

    set({
      edges: [...edges, newEdge],
      historyPast: [...historyPast.slice(-MAX_HISTORY_STEPS + 1), snapshot],
      historyFuture: [],
      isDirty: true,
    });

    return { success: true };
  },

  removeEdge: (id) => {
    const { nodes, edges, historyPast } = get();
    const snapshot: FlowGraphSnapshot = {
      nodes: [...nodes],
      edges: [...edges],
    };

    set({
      edges: edges.filter((edge) => edge.id !== id),
      historyPast: [...historyPast.slice(-MAX_HISTORY_STEPS + 1), snapshot],
      historyFuture: [],
      isDirty: true,
    });
  },

  setGraph: (nodes, edges) => {
    set({
      nodes,
      edges,
      selectedNodeId: null,
      historyPast: [],
      historyFuture: [],
      isDirty: false,
    });
  },

  clearGraph: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      historyPast: [],
      historyFuture: [],
      isDirty: false,
    });
  },

  undo: () => {
    const { historyPast, historyFuture, nodes, edges } = get();
    if (historyPast.length === 0) {
      return;
    }

    const previous = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, -1);
    const currentSnapshot: FlowGraphSnapshot = { nodes, edges };

    set({
      nodes: previous.nodes,
      edges: previous.edges,
      historyPast: newPast,
      historyFuture: [currentSnapshot, ...historyFuture],
      isDirty: true,
    });
  },

  redo: () => {
    const { historyPast, historyFuture, nodes, edges } = get();
    if (historyFuture.length === 0) {
      return;
    }

    const next = historyFuture[0];
    const newFuture = historyFuture.slice(1);
    const currentSnapshot: FlowGraphSnapshot = { nodes, edges };

    set({
      nodes: next.nodes,
      edges: next.edges,
      historyPast: [...historyPast, currentSnapshot],
      historyFuture: newFuture,
      isDirty: true,
    });
  },
}));
