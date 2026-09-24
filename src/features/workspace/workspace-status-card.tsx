import type { WorkspaceStatusData } from "./workspace-status.types";
import { workspaceCopy } from "./workspace-copy";

export function WorkspaceStatusCard({
  databasePath,
  migrationCount,
  providerMode,
  runtime,
}: WorkspaceStatusData) {
  const migrationLabel =
    migrationCount === 1
      ? workspaceCopy.migrations
      : workspaceCopy.migrationsPlural;
  const statusLabel =
    runtime === "native" ? workspaceCopy.ready : "Local workspace preview";

  return (
    <section
      aria-labelledby="workspace-status-heading"
      className="workspace-status"
    >
      <div className="workspace-status__header">
        <div>
          <p className="workspace-status__eyebrow">{workspaceCopy.heading}</p>
          <h2 id="workspace-status-heading">{statusLabel}</h2>
        </div>
        <output className="workspace-status__badge">
          {workspaceCopy.runtimeModes[runtime]}
        </output>
      </div>
      <dl className="workspace-status__details">
        <div>
          <dt>{workspaceCopy.database}</dt>
          <dd title={databasePath}>{databasePath}</dd>
        </div>
        <div>
          <dt>{workspaceCopy.provider}</dt>
          <dd>{workspaceCopy.providerModes[providerMode]}</dd>
        </div>
        <div>
          <dt>Schema</dt>
          <dd>
            {migrationCount} {migrationLabel}
          </dd>
        </div>
      </dl>
    </section>
  );
}
