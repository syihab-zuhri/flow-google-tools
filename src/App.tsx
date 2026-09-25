import { useState } from "react";
import { CanvasWorkspace } from "./features/editor/CanvasWorkspace";
import { useWorkspaceStatus } from "./features/workspace/use-workspace-status";
import { MasterPasswordModal } from "./features/vault/MasterPasswordModal";
import { useVault } from "./features/vault/use-vault";
import { BridgeDrawer } from "./features/bridge/BridgeDrawer";
import { useFlowBridge } from "./features/bridge/use-flow-bridge";
import "./App.css";

const appCopy = {
  label: "Flow Studio",
  loading: "Opening local workspace...",
  errorTitle: "Workspace initialization failed",
  retry: "Retry workspace setup",
} as const;

const workspaceStatusCopy = {
  error: {
    label: "Workspace connection error",
    dotClassName: "bg-red-500",
  },
  loading: {
    label: "Connecting to workspace",
    dotClassName:
      "bg-[#BA7517] motion-safe:animate-pulse motion-reduce:animate-none",
  },
  ready: {
    label: "Workspace connected",
    dotClassName: "bg-emerald-500",
  },
} as const;

function App() {
  const { state, reload } = useWorkspaceStatus();
  const { vaultState, setupVault, unlockVault, lockVault } = useVault();
  const { info: bridgeInfo } = useFlowBridge();
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [isBridgeDrawerOpen, setIsBridgeDrawerOpen] = useState(false);
  const workspaceStatus = workspaceStatusCopy[state.kind];

  const bridgeBadgeColor =
    bridgeInfo?.running && (bridgeInfo?.activeConnections ?? 0) > 0
      ? "bg-emerald-500 animate-pulse"
      : bridgeInfo?.running
      ? "bg-[#BA7517]"
      : "bg-slate-600";

  const vaultBadgeColor =
    vaultState.state === "unlocked"
      ? "bg-emerald-500"
      : vaultState.state === "locked"
        ? "bg-[#BA7517]"
        : "bg-blue-500";

  return (
    <main className="app-shell">
      <aside className="app-identity" aria-label={appCopy.label}>
        <div className="app-identity__mark" aria-hidden="true">
          FS
        </div>
        <span className="app-identity__eyebrow [writing-mode:vertical-rl] rotate-180">
          {appCopy.label}
        </span>

        {/* Browser Bridge button */}
        <button
          type="button"
          aria-label="Open Browser Bridge"
          onClick={() => setIsBridgeDrawerOpen(true)}
          title={`Browser Bridge: ${
            !bridgeInfo?.running
              ? "Stopped"
              : (bridgeInfo?.activeConnections ?? 0) > 0
              ? "Connected"
              : "Listening"
          }`}
          className="mt-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-[#334155] bg-[#1e293b] hover:bg-[#334155] transition-colors"
        >
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${bridgeBadgeColor}`}
          />
        </button>

        {/* Vault lock button in sidebar */}
        <button
          type="button"
          aria-label={`Open Credential Vault (${vaultState.state})`}
          onClick={() => setIsVaultModalOpen(true)}
          title={`Vault: ${vaultState.state}`}
          className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-[#334155] bg-[#1e293b] hover:bg-[#334155] transition-colors"
        >
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${vaultBadgeColor}`}
          />
        </button>

        <output
          aria-label={workspaceStatus.label}
          className="mb-2 flex h-4 w-4 items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${workspaceStatus.dotClassName}`}
          />
        </output>
      </aside>

      <section
        aria-label="Canvas workspace"
        className="min-h-0 overflow-hidden"
      >
        {state.kind === "loading" && (
          <div className="grid h-full place-items-center">
            <output className="app-state" aria-live="polite">
              <span className="app-state__indicator" aria-hidden="true" />
              <p>{appCopy.loading}</p>
            </output>
          </div>
        )}

        {state.kind === "error" && (
          <div className="grid h-full place-items-center">
            <section className="app-state app-state--error" role="alert">
              <h2>{appCopy.errorTitle}</h2>
              <p>{state.message}</p>
              <button
                className="app-action !min-h-[34px]"
                type="button"
                onClick={() => void reload()}
              >
                {appCopy.retry}
              </button>
            </section>
          </div>
        )}

        {state.kind === "ready" && <CanvasWorkspace />}
      </section>

      <MasterPasswordModal
        isOpen={isVaultModalOpen}
        vaultState={vaultState.state}
        hasActiveLockout={vaultState.hasActiveLockout}
        lockoutRemainingSeconds={vaultState.lockoutRemainingSeconds}
        isLoading={vaultState.isLoading}
        error={vaultState.error}
        onClose={() => setIsVaultModalOpen(false)}
        onSetup={setupVault}
        onUnlock={unlockVault}
        onLock={lockVault}
      />

      <BridgeDrawer
        isOpen={isBridgeDrawerOpen}
        onClose={() => setIsBridgeDrawerOpen(false)}
      />
    </main>
  );
}

export default App;
