import { CanvasWorkspace } from "./features/editor/CanvasWorkspace";
import { useWorkspaceStatus } from "./features/workspace/use-workspace-status";
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
  const workspaceStatus = workspaceStatusCopy[state.kind];

  return (
    <main className="app-shell">
      <aside className="app-identity" aria-label={appCopy.label}>
        <div className="app-identity__mark" aria-hidden="true">
          FS
        </div>
        <span className="app-identity__eyebrow [writing-mode:vertical-rl] rotate-180">
          {appCopy.label}
        </span>
        <output
          aria-label={workspaceStatus.label}
          className="mt-auto mb-2 flex h-4 w-4 items-center justify-center"
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
    </main>
  );
}

export default App;
