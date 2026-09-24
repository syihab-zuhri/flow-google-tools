# Flow Studio

Local-first desktop workstation for building, reviewing, and exporting coherent long-form AI video workflows.

## Status

Phase 0 — repository foundations in progress.

The product blueprint is in `docs/`. Hermes-only project instructions are in `AGENTS.md`.

## Planned stack

- Desktop shell: Tauri 2.x
- Frontend: React + TypeScript
- Native core: Rust
- Persistence: SQLite
- Media processing: FFmpeg
- Node canvas: `@xyflow/react`

## Repository layout

```text
.
├── AGENTS.md              Hermes project rules
├── docs/                  Approved blueprint and implementation contracts
├── src/                   React frontend
├── src-tauri/             Tauri native application
├── crates/flow-core/      Framework-independent Rust domain logic
├── tests/                 Cross-layer tests
└── README.md
```

## Safety boundary

Flow Studio will integrate with external generation providers only through official supported interfaces or explicit user-driven handoff. It does not collect browser credentials, replay sessions, bypass anti-automation controls, or rotate accounts to evade quotas.

## Getting started

Development prerequisites and local setup are specified in `docs/ENVIRONMENT.md`. Implementation tasks and acceptance criteria are in `docs/TASKS.md`.
