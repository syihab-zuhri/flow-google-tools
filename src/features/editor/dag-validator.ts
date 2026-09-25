export type FlowNodeType = "prompt" | "image" | "video" | "generate";

export interface FlowNodeDescriptor {
  id: string;
  type: FlowNodeType;
}

export interface FlowConnection {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export type PortDataType = "text" | "image" | "video";

export interface PortConnectionQuery {
  sourceType: FlowNodeType;
  sourceHandle?: string | null;
  targetType: FlowNodeType;
  targetHandle?: string | null;
}

export interface ConnectionValidationResult {
  valid: boolean;
  reason?: string;
}

export function getSourcePortType(
  nodeType: FlowNodeType,
  handleId?: string | null,
): PortDataType | null {
  if (nodeType === "prompt" && handleId === "prompt-out") {
    return "text";
  }
  if (nodeType === "image" && handleId === "image-out") {
    return "image";
  }
  if (nodeType === "video" && handleId === "video-out") {
    return "video";
  }
  if (nodeType === "generate") {
    if (handleId === "frame-out") {
      return "image";
    }
    if (handleId === "video-out") {
      return "video";
    }
  }
  return null;
}

export function getTargetPortType(
  nodeType: FlowNodeType,
  handleId?: string | null,
): PortDataType | null {
  if (nodeType === "generate") {
    if (handleId === "prompt-in") {
      return "text";
    }
    if (handleId === "image-in") {
      return "image";
    }
    if (handleId === "context-video-in") {
      return "video";
    }
  }
  return null;
}

export function canConnectPorts(query: PortConnectionQuery): boolean {
  const sourcePort = getSourcePortType(query.sourceType, query.sourceHandle);
  const targetPort = getTargetPortType(query.targetType, query.targetHandle);

  if (!sourcePort || !targetPort) {
    return false;
  }

  return sourcePort === targetPort;
}

export function detectCycleWithNewEdge(
  newSource: string,
  newTarget: string,
  existingEdges: readonly FlowConnection[],
): boolean {
  if (newSource === newTarget) {
    return true;
  }

  const adjacency = new Map<string, string[]>();

  for (const edge of existingEdges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }

  const visited = new Set<string>();
  const stack = [newTarget];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (current === newSource) {
      return true;
    }

    if (!visited.has(current)) {
      visited.add(current);
      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
  }

  return false;
}

export function validateEdgeConnection(
  connection: FlowConnection,
  nodes: readonly FlowNodeDescriptor[],
  existingEdges: readonly FlowConnection[],
): ConnectionValidationResult {
  if (connection.source === connection.target) {
    return {
      valid: false,
      reason: "Cannot connect a node to itself.",
    };
  }

  const sourceNode = nodes.find((node) => node.id === connection.source);
  const targetNode = nodes.find((node) => node.id === connection.target);

  if (!sourceNode || !targetNode) {
    return {
      valid: false,
      reason: "Source or target node not found in graph.",
    };
  }

  const isDuplicate = existingEdges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
      (edge.targetHandle ?? null) === (connection.targetHandle ?? null),
  );

  if (isDuplicate) {
    return {
      valid: false,
      reason: "Connection already exists.",
    };
  }

  const portsCompatible = canConnectPorts({
    sourceType: sourceNode.type,
    sourceHandle: connection.sourceHandle,
    targetType: targetNode.type,
    targetHandle: connection.targetHandle,
  });

  if (!portsCompatible) {
    return {
      valid: false,
      reason: "Port types are incompatible.",
    };
  }

  if (
    detectCycleWithNewEdge(connection.source, connection.target, existingEdges)
  ) {
    return {
      valid: false,
      reason: "Connection would create a cyclic dependency.",
    };
  }

  return { valid: true };
}

export function getExecutionOrder(
  nodes: readonly FlowNodeDescriptor[],
  edges: readonly FlowConnection[],
): string[] | null {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (!inDegree.has(edge.target) || !adjacency.has(edge.source)) {
      continue;
    }
    const currentIn = inDegree.get(edge.target) ?? 0;
    inDegree.set(edge.target, currentIn + 1);

    const neighbors = adjacency.get(edge.source) ?? [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }

  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const ordered: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    ordered.push(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      const remainingDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, remainingDegree);
      if (remainingDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (ordered.length !== nodes.length) {
    return null;
  }

  return ordered;
}
