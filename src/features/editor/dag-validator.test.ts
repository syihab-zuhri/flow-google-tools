import { describe, expect, it } from "vitest";
import {
  canConnectPorts,
  detectCycleWithNewEdge,
  getExecutionOrder,
  validateEdgeConnection,
  type FlowConnection,
  type FlowNodeDescriptor,
} from "./dag-validator";

describe("DAG Validator & Port Rules", () => {
  const nodes: FlowNodeDescriptor[] = [
    { id: "prompt-1", type: "prompt" },
    { id: "image-1", type: "image" },
    { id: "video-1", type: "video" },
    { id: "gen-1", type: "generate" },
    { id: "gen-2", type: "generate" },
  ];

  describe("canConnectPorts", () => {
    it("allows valid connections to Generation node inputs", () => {
      // Prompt text to prompt-in
      expect(
        canConnectPorts({
          sourceType: "prompt",
          sourceHandle: "prompt-out",
          targetType: "generate",
          targetHandle: "prompt-in",
        }),
      ).toBe(true);

      // Image to image-in
      expect(
        canConnectPorts({
          sourceType: "image",
          sourceHandle: "image-out",
          targetType: "generate",
          targetHandle: "image-in",
        }),
      ).toBe(true);

      // Video to context-video-in
      expect(
        canConnectPorts({
          sourceType: "video",
          sourceHandle: "video-out",
          targetType: "generate",
          targetHandle: "context-video-in",
        }),
      ).toBe(true);

      // Generation frame-out (last frame) to next Generation image-in (continuity)
      expect(
        canConnectPorts({
          sourceType: "generate",
          sourceHandle: "frame-out",
          targetType: "generate",
          targetHandle: "image-in",
        }),
      ).toBe(true);

      // Generation video-out to next Generation context-video-in (chaining)
      expect(
        canConnectPorts({
          sourceType: "generate",
          sourceHandle: "video-out",
          targetType: "generate",
          targetHandle: "context-video-in",
        }),
      ).toBe(true);
    });

    it("rejects incompatible port type connections", () => {
      // Text to image port
      expect(
        canConnectPorts({
          sourceType: "prompt",
          sourceHandle: "prompt-out",
          targetType: "generate",
          targetHandle: "image-in",
        }),
      ).toBe(false);

      // Image to prompt port
      expect(
        canConnectPorts({
          sourceType: "image",
          sourceHandle: "image-out",
          targetType: "generate",
          targetHandle: "prompt-in",
        }),
      ).toBe(false);

      // Connection to non-generate node
      expect(
        canConnectPorts({
          sourceType: "prompt",
          sourceHandle: "prompt-out",
          targetType: "image",
          targetHandle: "image-in",
        }),
      ).toBe(false);
    });
  });

  describe("validateEdgeConnection", () => {
    const existingEdges: FlowConnection[] = [
      {
        id: "e1",
        source: "prompt-1",
        target: "gen-1",
        sourceHandle: "prompt-out",
        targetHandle: "prompt-in",
      },
      {
        id: "e2",
        source: "gen-1",
        target: "gen-2",
        sourceHandle: "video-out",
        targetHandle: "context-video-in",
      },
    ];

    it("rejects self-connection", () => {
      const result = validateEdgeConnection(
        {
          source: "gen-1",
          target: "gen-1",
          sourceHandle: "frame-out",
          targetHandle: "image-in",
        },
        nodes,
        existingEdges,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Cannot connect a node to itself.");
    });

    it("rejects duplicate edges between same handles", () => {
      const result = validateEdgeConnection(
        {
          source: "prompt-1",
          target: "gen-1",
          sourceHandle: "prompt-out",
          targetHandle: "prompt-in",
        },
        nodes,
        existingEdges,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Connection already exists.");
    });

    it("rejects cycles (e.g. gen-2 connecting back to gen-1)", () => {
      const result = validateEdgeConnection(
        {
          source: "gen-2",
          target: "gen-1",
          sourceHandle: "video-out",
          targetHandle: "context-video-in",
        },
        nodes,
        existingEdges,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe(
        "Connection would create a cyclic dependency.",
      );
    });

    it("accepts valid acyclic and type-compatible connection", () => {
      const result = validateEdgeConnection(
        {
          source: "image-1",
          target: "gen-1",
          sourceHandle: "image-out",
          targetHandle: "image-in",
        },
        nodes,
        existingEdges,
      );
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe("detectCycleWithNewEdge and getExecutionOrder", () => {
    it("computes topological execution order of generation nodes", () => {
      const allNodes: FlowNodeDescriptor[] = [
        { id: "p1", type: "prompt" },
        { id: "g1", type: "generate" },
        { id: "g2", type: "generate" },
        { id: "g3", type: "generate" },
      ];
      const edges: FlowConnection[] = [
        { id: "e1", source: "p1", target: "g1" },
        { id: "e2", source: "g1", target: "g2" },
        { id: "e3", source: "g2", target: "g3" },
      ];

      const order = getExecutionOrder(allNodes, edges);
      expect(order).toEqual(["p1", "g1", "g2", "g3"]);
    });

    it("returns null order when cycle exists", () => {
      const cyclicNodes: FlowNodeDescriptor[] = [
        { id: "a", type: "generate" },
        { id: "b", type: "generate" },
      ];
      const cyclicEdges: FlowConnection[] = [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "a" },
      ];

      expect(getExecutionOrder(cyclicNodes, cyclicEdges)).toBeNull();
      expect(
        detectCycleWithNewEdge("b", "a", [{ source: "a", target: "b" }]),
      ).toBe(true);
    });
  });
});
