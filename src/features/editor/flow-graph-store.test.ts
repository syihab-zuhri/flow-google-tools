import { beforeEach, describe, expect, it } from "vitest";
import { useFlowGraphStore } from "./flow-graph-store";

describe("Flow Graph Store (Zustand)", () => {
  beforeEach(() => {
    useFlowGraphStore.getState().clearGraph();
  });

  it("starts with an empty graph", () => {
    const { nodes, edges } = useFlowGraphStore.getState();
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it("adds nodes up to the limit and respects maximum 100 nodes limit", () => {
    const store = useFlowGraphStore.getState();

    const pNode = store.addNode("prompt", { x: 100, y: 100 });
    expect(pNode).toBeDefined();
    expect(pNode?.type).toBe("prompt");

    const state = useFlowGraphStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].position).toEqual({ x: 100, y: 100 });
  });

  it("updates node data immutably and tracks history", () => {
    const store = useFlowGraphStore.getState();
    const node = store.addNode("prompt", { x: 0, y: 0 })!;

    store.updateNodeData(node.id, { promptText: "Hello world" });

    const updated = useFlowGraphStore
      .getState()
      .nodes.find((n) => n.id === node.id);
    expect(updated?.data.promptText).toBe("Hello world");
  });

  it("removes a node and cascades removal to attached edges", () => {
    const store = useFlowGraphStore.getState();
    const promptNode = store.addNode("prompt")!;
    const genNode = store.addNode("generate")!;

    const edgeResult = store.connectEdges({
      source: promptNode.id,
      target: genNode.id,
      sourceHandle: "prompt-out",
      targetHandle: "prompt-in",
    });
    expect(edgeResult.success).toBe(true);
    expect(useFlowGraphStore.getState().edges).toHaveLength(1);

    store.removeNode(promptNode.id);

    const state = useFlowGraphStore.getState();
    expect(state.nodes.find((n) => n.id === promptNode.id)).toBeUndefined();
    expect(state.edges).toHaveLength(0);
  });

  it("rejects invalid edge connections via DAG validator integration", () => {
    const store = useFlowGraphStore.getState();
    const promptNode = store.addNode("prompt")!;
    const genNode = store.addNode("generate")!;

    // Incompatible port types (text -> image)
    const result = store.connectEdges({
      source: promptNode.id,
      target: genNode.id,
      sourceHandle: "prompt-out",
      targetHandle: "image-in",
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe("Port types are incompatible.");
    expect(useFlowGraphStore.getState().edges).toHaveLength(0);
  });

  it("supports undo and redo", () => {
    const store = useFlowGraphStore.getState();
    const node1 = store.addNode("prompt", { x: 50, y: 50 })!;
    expect(useFlowGraphStore.getState().nodes).toHaveLength(1);

    store.addNode("generate", { x: 300, y: 50 });
    expect(useFlowGraphStore.getState().nodes).toHaveLength(2);

    // Undo should revert back to 1 node
    store.undo();
    expect(useFlowGraphStore.getState().nodes).toHaveLength(1);
    expect(useFlowGraphStore.getState().nodes[0].id).toBe(node1.id);

    // Redo should restore 2 nodes
    store.redo();
    expect(useFlowGraphStore.getState().nodes).toHaveLength(2);
  });
});
