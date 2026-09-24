import type { Meta, StoryObj } from "@storybook/react";
import { WorkspaceStatusCard } from "./workspace-status-card";

const meta: Meta<typeof WorkspaceStatusCard> = {
  title: "Workspace/WorkspaceStatusCard",
  component: WorkspaceStatusCard,
  args: {
    databasePath:
      "C:\\Users\\Owner\\AppData\\Roaming\\FlowStudio\\flow_studio.db",
    migrationCount: 1,
    providerMode: "manual_handoff",
    runtime: "native",
  },
  parameters: {
    a11y: {
      test: "error",
    },
  },
};

export default meta;
type Story = StoryObj<typeof WorkspaceStatusCard>;

export const Default: Story = {};

export const BrowserPreview: Story = {
  args: {
    databasePath: "Not created in browser preview.",
    migrationCount: 0,
    runtime: "browser_preview",
  },
};

export const OfficialApiPrepared: Story = {
  args: {
    providerMode: "official_api",
  },
};

export const MultiMigrationApplied: Story = {
  args: {
    migrationCount: 4,
  },
};

export const CompactViewport: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const FocusedDatabaseState: Story = {
  args: {
    databasePath:
      "C:\\Users\\ProductionArtist\\AppData\\Roaming\\FlowStudio\\flow_studio.db",
  },
};
