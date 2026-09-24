# Flow Studio — Hermes Project Context

> This project is operated by Hermes Agent only.
> Canonical blueprint: `docs/PROJECT_MANIFEST.md`.

## Mission

Build Flow Studio: a local-first Windows desktop creative workstation for planning, chaining, reviewing, and exporting long-form AI video workflows. The application uses Tauri 2.x, React + TypeScript, Rust, SQLite, and FFmpeg.

## Hermes-only execution

- Hermes is the only autonomous coding agent for this repository.
- Do not create instructions for Claude Code, Cursor, Copilot, Gemini, or external coding agents.
- Do not delegate code modifications to non-Hermes services.
- Keep this file below Hermes' project-context size limit. Detailed historical orchestration material is retained in `docs/AGENTS_ORCHESTRATION.md` and is not an active instruction source.

## Source of truth and reading order

1. `docs/PROJECT_MANIFEST.md`
2. `docs/PLANNING.md` and `docs/SRS.md`
3. The relevant `docs/PRD/*.md`
4. `docs/API.md`, `docs/ERD.md`, `docs/PERMISSION.md`
5. `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DESIGN.md`, `docs/DSD.md`
6. `docs/TESTING.md`, `docs/TASKS.md`, `docs/TRACEABILITY.md`, and `docs/RUNBOOK.md`

If a document conflicts with another document, do not silently choose. Treat `docs/PROJECT_MANIFEST.md` as the registry and record an explicit change in `docs/CHANGELOG.md`.

## Implementation protocol

- Select the next unchecked atomic task in `docs/TASKS.md`.
- Read every referenced FR, NFR, PRD, API contract, data entity, and test scenario before changing code.
- Work in vertical slices: test first, observe the expected RED failure, implement the smallest complete behavior, then verify GREEN with focused and full tests.
- Update `docs/TASKS.md`, `docs/TRACEABILITY.md`, and `docs/CHANGELOG.md` with verifiable evidence when a task is actually completed.
- Never mark work complete based only on code written; run the relevant test, lint, typecheck, and build command.
- Preserve a clean Git history: one coherent, verified change per commit.

## Global invariants

- IPC is contract-first: update `docs/API.md` before changing a Rust command or TypeScript binding.
- Every SQLite schema change includes a versioned migration and matching `docs/ERD.md` update.
- Never place credentials, session tokens, master passwords, keys, or sensitive prompt content in source code, fixtures, commits, logs, or documentation.
- Store timestamps as UTC and format them only at the UI boundary.
- Credit quantities use integer units; never use floating-point arithmetic for quota calculations.
- Every external request has a timeout, bounded retry policy, and structured metric.
- Use one canonical `IpcError` envelope for frontend-visible errors.
- User-facing strings must be localization-ready; do not scatter literals through components.
- Rust production paths must not use `unwrap()` or `expect()`.
- TypeScript runs in strict mode; never use `any`, `@ts-ignore`, or `as unknown as` as an escape hatch.
- No stubs, TODOs, placeholder implementations, swallowed errors, debug logging, dead imports, or generic names.
- Functions must remain at or below 80 logical lines and files at or below 400 logical lines unless a documented review approves a split exception.
- P0 UI components require CSF3 stories for default, disabled, loading, error, empty, and compact states, plus WCAG 2.2 AA checks.
- The application opens no inbound listening port. All local UI/native communication uses Tauri IPC.

## Security and Google Flow boundary

- The credential vault, project assets, and local database are high-sensitivity data.
- Use Argon2id-derived keys, AES-256-GCM encrypted payloads, and zeroization for in-memory secret buffers.
- Validate project JSON, user-selected paths, media metadata, and all process arguments before use.
- Use argument-array process execution for FFmpeg; never construct shell commands from user input.
- Do not implement credential harvesting, cookie/session replay, CAPTCHA bypass, traffic stealthing, reverse-engineered private API calls, or automated multi-account rotation intended to evade provider quotas or service controls.
- Implement external generation only through an official documented Google integration or an explicit user-driven handoff. If an approved official integration is unavailable, keep generation dispatch disabled and make the limitation visible in the UI and runbook.

## Architecture boundary

- Keep the P0 application a modular monolith: React frontend in `src/`, Rust native application in `src-tauri/`, and framework-independent domain code in `crates/flow-core/`.
- Keep FFmpeg execution isolated behind a Rust adapter with typed input/output structures.
- Keep persistence behind a repository layer; do not issue ad-hoc SQL from UI or command handlers.
- The browser/WebView is untrusted. Validation, path access, vault access, and external calls are enforced in Rust.

## Required verification

Before a commit, run the applicable commands and retain their real output:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `cargo fmt --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `pnpm build` and/or `cargo tauri build` when the changed layer supports it

Do not claim Windows packaging or live Google Flow generation has been verified until it has been run on a suitable Windows environment with an approved supported integration.
