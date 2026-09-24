# CR-001: Supported External Provider Integration Boundary

> **Project:** Flow Studio  
> **Document ID:** DOC-CR-001  
> **Version:** 1.0.0  
> **Status:** Accepted  
> **Decision Owner:** Software Architect & Planning Lead  
> **Effective Date:** 2026-09-25  
> **Depends On:** DOC-PLAN-001, DOC-SRS-001, DOC-SEC-001  
> **Supersedes:** Provider-integration portions of DOC-PLAN-001, DOC-SRS-001, DOC-API-001, DOC-ERD-001, DOC-PRD-ACT-001, DOC-AI-001, DOC-ADR-002 where they prescribe private endpoint reverse engineering, browser-cookie/session import, browser automation, or account rotation to bypass provider controls.

## Change Classification

**Major.** This changes the external-provider integration boundary while preserving the local-first editor, continuity workflow, asset processing, project persistence, and export scope.

## Context

The initial blueprint describes an integration path based on imported browser sessions, private/reverse-engineered requests, automated browser fallback, and multi-account quota rotation. Those methods are fragile, can expose account credentials, and may conflict with external-provider controls.

## Accepted Decision

Flow Studio will use one of these supported paths only:

1. An official, documented Google API or SDK for the requested capability, configured with credentials and scopes authorized for that API.
2. A user-driven handoff workflow: Flow Studio prepares prompts, reference frames, and project assets; the Owner runs generation in the provider's supported interface; the Owner imports the resulting media into Flow Studio.

Until an official, documented integration is verified and configured, generation dispatch remains unavailable. The UI must state this clearly and provide the manual handoff/export-import route.

## Explicitly Excluded

The application must not implement:

- browser cookie or session-token import;
- session replay or request replay;
- reverse engineering of private HTTP, gRPC, or GraphQL endpoints;
- CAPTCHA bypass, anti-bot evasion, stealth automation, or unattended browser automation;
- automatic switching among accounts to work around quota, subscription, or rate controls;
- collection, storage, or logging of browser authentication material.

## Scope Impact

| Area | Before | After |
|---|---|---|
| Account pool | Imported provider sessions and automated rotation | Not implemented; no account credential vault for provider sessions |
| Provider dispatch | Private endpoint HTTP with browser fallback | Official API adapter only when verified; otherwise manual handoff |
| Credits | Automatic per-account routing | Optional user-entered planning estimate only; never a routing mechanism |
| Credential storage | Provider session cookies encrypted locally | Only official API credentials if an approved official adapter requires them; use OS-managed secret storage or a dedicated approved vault design |
| Core editor | Node graph and pipeline execution | Retained |
| Continuity engine | Last-frame extraction and prompt/context composition | Retained |
| Video processing | FFmpeg extraction, concatenation, export | Retained |

## Requirement Impact

- FR-001 through FR-006 are **Deprecated** pending an official API authentication design.
- FR-040 through FR-042 remain deferred; they apply only if a supported official integration requires an application-level secret vault.
- FR-010 through FR-033 remain active for local graph editing, media import, continuity preparation, and export.
- NFR-004 remains active as a zero-secret-in-logs requirement.
- NFR-005 changes from unattended third-party generation to unattended local processing after user-supplied clips are available.

## Acceptance Criteria

- No source file, fixture, diagnostic log, or project document implements or instructs browser-cookie extraction, session replay, private endpoint calls, or quota-evasion account rotation.
- The initial application can create a local project workspace, store project metadata, import user-selected media, prepare continuity assets, and export media without any provider session material.
- Any future official provider adapter references its official documentation, uses an explicitly authorized credential type, and has separate threat-model, test, and approval updates before implementation.

## Revisit Trigger

Revisit this decision only when Google publishes a documented, supported API or SDK that covers the intended video workflow and the Owner explicitly approves the official-integration design.
