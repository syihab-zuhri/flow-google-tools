import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Edge } from "@xyflow/react";
import {
  commands,
  type LoadProjectResponse,
  type SaveProjectRequest,
  type SaveProjectResponse,
} from "../../bindings";
import { useFlowGraphStore, type FlowCustomNode } from "./flow-graph-store";

interface ProjectPersistenceState {
  projectName: string | null;
  filePath: string | null;
  isSaving: boolean;
  isLoading: boolean;
  lastSavedAt: string | null;
  error: string | null;
}

export interface ProjectPersistence extends ProjectPersistenceState {
  saveProject: (filePath: string, projectName: string) => Promise<void>;
  loadProject: (filePath: string) => Promise<void>;
  saveAs: (filePath?: string, projectName?: string) => Promise<void>;
  clearError: () => void;
}

function serializeGraph(nodes: FlowCustomNode[], edges: Edge[]) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type ?? "prompt",
      position: { x: node.position.x, y: node.position.y },
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function deserializeGraph(response: LoadProjectResponse) {
  const loadedNodes: FlowCustomNode[] = response.graph.nodes.map((node) => ({
    id: node.id,
    type: (node.type as FlowCustomNode["type"]) ?? "prompt",
    position: { x: node.position.x ?? 0, y: node.position.y ?? 0 },
    data: (node.data as Record<string, unknown>) ?? {},
  }));

  const loadedEdges: Edge[] = response.graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
  }));

  return { loadedNodes, loadedEdges };
}

async function executeSave(
  filePath: string,
  projectName: string,
): Promise<SaveProjectResponse> {
  const { nodes, edges } = useFlowGraphStore.getState();
  const request: SaveProjectRequest = {
    filePath,
    projectName,
    settings: {
      defaultModel: "veo-3.1",
      autoSaveIntervalSeconds: 30,
      styleLockText: null,
    },
    graph: serializeGraph(nodes, edges),
  };

  const result = await commands.saveProject(request);
  if (result.status === "error") {
    throw new Error(result.error.message);
  }
  useFlowGraphStore.setState({ isDirty: false });
  return result.data;
}

async function executeLoad(filePath: string): Promise<LoadProjectResponse> {
  const result = await commands.loadProject(filePath);
  if (result.status === "error") {
    throw new Error(result.error.message);
  }
  const { loadedNodes, loadedEdges } = deserializeGraph(result.data);
  useFlowGraphStore.getState().setGraph(loadedNodes, loadedEdges);
  return result.data;
}

function usePersistenceShortcuts(onSave: () => void, onOpen: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      if (isCtrlOrMeta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave();
      }
      if (isCtrlOrMeta && event.key.toLowerCase() === "o") {
        event.preventDefault();
        onOpen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, onOpen]);
}

function useSaveProjectAction(
  setState: Dispatch<SetStateAction<ProjectPersistenceState>>,
) {
  return useCallback(
    async (filePath: string, projectName: string): Promise<void> => {
      setState((prev) => ({ ...prev, isSaving: true, error: null }));
      try {
        const saved = await executeSave(filePath, projectName);
        setState((prev) => ({
          ...prev,
          filePath,
          projectName,
          isSaving: false,
          lastSavedAt: saved.savedAt,
          error: null,
        }));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setState((prev) => ({ ...prev, isSaving: false, error: msg }));
        throw error;
      }
    },
    [setState],
  );
}

function useLoadProjectAction(
  setState: Dispatch<SetStateAction<ProjectPersistenceState>>,
) {
  return useCallback(
    async (filePath: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const loaded = await executeLoad(filePath);
        setState((prev) => ({
          ...prev,
          filePath,
          projectName: loaded.projectName,
          isLoading: false,
          lastSavedAt: loaded.updatedAt,
          error: null,
        }));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setState((prev) => ({ ...prev, isLoading: false, error: msg }));
        throw error;
      }
    },
    [setState],
  );
}

export function useProjectPersistence(): ProjectPersistence {
  const [state, setState] = useState<ProjectPersistenceState>({
    projectName: null,
    filePath: null,
    isSaving: false,
    isLoading: false,
    lastSavedAt: null,
    error: null,
  });

  const filePathRef = useRef(state.filePath);
  const projectNameRef = useRef(state.projectName);

  useEffect(() => {
    filePathRef.current = state.filePath;
    projectNameRef.current = state.projectName;
  }, [state.filePath, state.projectName]);

  const saveProject = useSaveProjectAction(setState);
  const loadProject = useLoadProjectAction(setState);

  const saveAs = useCallback(
    async (filePath?: string, projectName?: string): Promise<void> => {
      const targetPath = filePath ?? filePathRef.current;
      const targetName =
        projectName ?? projectNameRef.current ?? "Untitled Project";
      if (!targetPath) return;
      await saveProject(targetPath, targetName);
    },
    [saveProject],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const handleShortcutSave = useCallback(() => {
    if (filePathRef.current && projectNameRef.current) {
      void saveProject(filePathRef.current, projectNameRef.current);
    }
  }, [saveProject]);

  const handleShortcutOpen = useCallback(() => {}, []);

  usePersistenceShortcuts(handleShortcutSave, handleShortcutOpen);

  return {
    ...state,
    saveProject,
    loadProject,
    saveAs,
    clearError,
  };
}
