import type { Meta, StoryObj } from "@storybook/react";
import { CanvasWorkspace } from "./CanvasWorkspace";
import { useFlowGraphStore } from "./flow-graph-store";

const meta: Meta<typeof CanvasWorkspace> = {
  title: "Canvas/CanvasWorkspace",
  component: CanvasWorkspace,
  parameters: {
    layout: "fullscreen",
    a11y: {
      test: "error",
    },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasWorkspace>;

export const Empty: Story = {
  decorators: [
    (Story) => {
      useFlowGraphStore.getState().clearGraph();
      return (
        <div style={{ height: "100vh", width: "100vw" }}>
          <Story />
        </div>
      );
    },
  ],
};

export const PopulatedGraph: Story = {
  decorators: [
    (Story) => {
      const store = useFlowGraphStore.getState();
      store.clearGraph();
      const p1 = store.addNode("prompt", { x: 50, y: 100 });
      const img1 = store.addNode("image", { x: 50, y: 340 });
      const gen1 = store.addNode("generate", { x: 420, y: 180 });

      if (p1 && gen1) {
        store.connectEdges({
          source: p1.id,
          target: gen1.id,
          sourceHandle: "prompt-out",
          targetHandle: "prompt-in",
        });
      }

      if (img1 && gen1) {
        store.connectEdges({
          source: img1.id,
          target: gen1.id,
          sourceHandle: "image-out",
          targetHandle: "image-in",
        });
      }

      return (
        <div style={{ height: "100vh", width: "100vw" }}>
          <Story />
        </div>
      );
    },
  ],
};
