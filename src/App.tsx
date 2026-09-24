import { WorkspaceStatusCard } from "./features/workspace/workspace-status-card";
import { useWorkspaceStatus } from "./features/workspace/use-workspace-status";
import "./App.css";

const appCopy = {
  eyebrow: "Flow Studio",
  title: "Build the next scene before you generate it.",
  description:
    "A local-first workspace for sequencing references, prompts, clips, and export-ready continuity assets.",
  loading: "Opening local workspace...",
  errorTitle: "Workspace initialization failed",
  retry: "Retry workspace setup",
  handoffTitle: "Manual handoff is active",
  handoffDescription:
    "Prepare prompts and reference frames here. Run generation in a supported provider interface, then import the resulting clips into this project.",
  nextTitle: "Next workspace capability",
  nextDescription:
    "Project creation, node editing, and media import follow after the Phase 0 foundation is verified.",
  securityLabel: "No provider session data is collected",
} as const;

function App() {
  const { state, reload } = useWorkspaceStatus();

  return (
    <main className="app-shell">
      <aside className="app-identity">
        <div className="app-identity__mark" aria-hidden="true">
          FS
        </div>
        <div>
          <p className="app-identity__eyebrow">{appCopy.eyebrow}</p>
          <p className="app-identity__label">Local-first video workflow</p>
        </div>
        <p className="app-identity__security">{appCopy.securityLabel}</p>
      </aside>

      <section className="app-workspace" aria-labelledby="app-title">
        <header className="app-workspace__intro">
          <p className="app-workspace__eyebrow">Foundation</p>
          <h1 id="app-title">{appCopy.title}</h1>
          <p>{appCopy.description}</p>
        </header>

        {state.kind === "loading" ? (
          <output className="app-state" aria-live="polite">
            <span className="app-state__indicator" aria-hidden="true" />
            <p>{appCopy.loading}</p>
          </output>
        ) : null}

        {state.kind === "error" ? (
          <section className="app-state app-state--error" role="alert">
            <h2>{appCopy.errorTitle}</h2>
            <p>{state.message}</p>
            <button
              className="app-action"
              type="button"
              onClick={() => void reload()}
            >
              {appCopy.retry}
            </button>
          </section>
        ) : null}

        {state.kind === "ready" ? (
          <div className="app-workspace__ready">
            <WorkspaceStatusCard {...state.data} />
            <section
              className="handoff-boundary"
              aria-labelledby="handoff-title"
            >
              <div className="handoff-boundary__marker" aria-hidden="true" />
              <div>
                <h2 id="handoff-title">{appCopy.handoffTitle}</h2>
                <p>{appCopy.handoffDescription}</p>
              </div>
            </section>
            <section
              className="next-capability"
              aria-labelledby="next-capability-title"
            >
              <p className="next-capability__eyebrow">Phase 0</p>
              <h2 id="next-capability-title">{appCopy.nextTitle}</h2>
              <p>{appCopy.nextDescription}</p>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default App;
