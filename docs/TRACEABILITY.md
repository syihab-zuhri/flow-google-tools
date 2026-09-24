# TRACEABILITY MATRIX: Flow Studio

> **Project:** Flow Studio  
> **Document ID:** DOC-TRC-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-SRS-001, DOC-TASK-001, DOC-TEST-001  
> **Supersedes:** None  

---

## 1. Traceability Methodology & Coverage Summary

### 1.1 Metodologi Closed-Loop Traceability

Dokumen Requirement Traceability Matrix (RTM) ini menetapkan rantai integritas teknis dua arah (*bidirectional traceability*) untuk seluruh siklus hidup pengembangan Flow Studio. Mengacu pada tata kelola **PLANNING v5.2 §11.19**, setiap kebutuhan sistem wajib ditelusuri secara ketat melalui 8 mata rantai tertutup (*8-point Closed-Loop Traceability*):

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Requirement │ ──► │ Feature/PRD │ ──► │   API/UI    │ ──► │ Data Entity │
│   (SRS.md)  │     │   (PRD/*)   │     │  (API.md)   │     │  (ERD.md)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Status    │ ◄── │   Test ID   │ ◄── │   Task ID   │ ◄── │ Permission  │
│  (Covered)  │     │(TESTING.md) │     │ (TASKS.md)  │     │(PERMISSION) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. **Requirement (FR/NFR):** Pernyataan spesifikasi formal kebutuhan fungsional atau non-fungsional pada `DOC-SRS-001`.
2. **Feature / PRD:** Dokumen Product Requirement Document (`DOC-PRD-*`) yang mendefinisikan perilaku fungsional dan *acceptance criteria*.
3. **API / UI:** Kontrak antarmuka IPC Tauri (`API.md`), REST/HTTP endpoint, dan komponen visual antarmuka pengguna (`DESIGN.md`, `DSD.md`).
4. **Data Entity:** Tabel basis data SQLite, kolom skema, atau berkas format proyek `.flowproj` (`ERD.md`).
5. **Permission Rule:** Aturan kepemilikan data, penguncian brankas (*vault state guard*), dan sanitasi argumen sistem operasi (`PERMISSION.md`, `SECURITY.md`).
6. **Task ID:** Paket kerja teknis atomik yang dapat diverifikasi pada `DOC-TASK-001`.
7. **Test ID:** Prosedur pengujian otomatis (Unit, Integration, E2E, Golden Dataset) pada `DOC-TEST-001`.
8. **Status:** Derajat pemenuhan penelusuran (`Covered` atau `Gap Identified`).

---

### 1.2 Ringkasan Metrik Cakupan (*Coverage Summary*)

Sesuai kriteria kualitas fase blueprint, seluruh kebutuhan berprioritas **P0 (MVP-Blocking)** wajib berstatus **Covered** dengan rasio kelengkapan loop $100\%$ sebelum implementasi diserahterimakan (*handoff*).

| Kategori Kebutuhan | Total Didefinisikan | Target Cakupan | Realisasi Cakupan | Rasio Ketercakupan | Status Kepatuhan |
|---|---|---|---|---|---|
| **Functional Requirements (P0)** | 24 | 100% | 24 | 24 / 24 | ✅ **100% COVERED** |
| **Functional Requirements (P1)** | 3 | 100% | 3 | 3 / 3 | ✅ **100% COVERED** |
| **Total Functional Requirements (FR)** | **27** | **100%** | **27** | **27 / 27** | ✅ **100% COVERED** |
| **Non-Functional Requirements (NFR Core)** | 10 | 100% | 10 | 10 / 10 | 10 / 10 | ✅ **100% COVERED** |
| **Critical User Journeys (UJ)** | 4 | 100% | 4 | 4 / 4 | 4 / 4 | ✅ **100% COVERED** |

#### Distribusi Kebutuhan Fungsional Berdasarkan Domain Modul:
- **Account Pool Management (FR-001 s/d FR-006):** 6 Kebutuhan (5 P0, 1 P1) — Ketercakupan: **6/6 (100%)**
- **Node Editor & Visual Canvas (FR-010 s/d FR-018):** 9 Kebutuhan (9 P0) — Ketercakupan: **9/9 (100%)**
- **Continuity Engine & Chaining (FR-020 s/d FR-024):** 5 Kebutuhan (5 P0) — Ketercakupan: **5/5 (100%)**
- **Video Export & Concatenation (FR-030 s/d FR-033):** 4 Kebutuhan (1 P0, 3 P1) — Ketercakupan: **4/4 (100%)**
- **Security & Credential Vault (FR-040 s/d FR-042):** 3 Kebutuhan (3 P0) — Ketercakupan: **3/3 (100%)**

---

## 2. Master Functional Traceability Matrix

Tabel di bawah ini memetakan seluruh **27 Kebutuhan Fungsional (FR-001 s/d FR-042)** secara lengkap dan detail sesuai konvensi kolom standar PLANNING v5.2 §11.19.

| Requirement ID | Requirement Name | PRD Feature | API Operation / UI Component | Data Entity | Permission Rule | Task ID | Test ID | Status |
|---|---|---|---|---|---|---|---|---|
| **FR-001** | Account Import via Cookie/Session | `FEAT-ACCOUNT_POOL`<br>(`PRD/ACCOUNT_POOL.md`) | `API-ACCT-001`<br>(`add_account`)<br>UI: `AccountDrawer`, `AddAccountModal` | `accounts`<br>(`encrypted_cookie`, `encryption_salt`, `encryption_nonce`) | Vault State `UNLOCKED`, Rule: `ACCOUNT_WRITE`<br>(Owner only, zero-plaintext in logs) | `TASK-P2-002`<br>`TASK-P2-004`<br>`TASK-P2-006` | `TEST-SETUP-001`<br>`test_account_crud_operations` | **Covered** |
| **FR-002** | Account Deletion & Permanent Eradication | `FEAT-ACCOUNT_POOL`<br>(`PRD/ACCOUNT_POOL.md`) | `API-ACCT-002`<br>(`remove_account`)<br>UI: `AccountDrawer`, Confirm Dialog | `accounts`<br>(Cascade delete to `generation_log`, `health_check_log`) | Vault State `UNLOCKED`, Rule: `ACCOUNT_DELETE`<br>(Tolak jika `in_use == true`) | `TASK-P2-004`<br>`TASK-P2-006` | `test_account_crud_operations`<br>`TEST-SETUP-001` | **Covered** |
| **FR-003** | Account Credit Tracking & Display | `FEAT-ACCOUNT_POOL`<br>(`PRD/ACCOUNT_POOL.md`) | `API-ACCT-003`<br>(`list_accounts`),<br>`API-ACCT-004`<br>(`get_account_credits`)<br>UI: `CreditMeter`, `AccountBadge` | `accounts`<br>(`daily_credits_remaining`, `monthly_credits_remaining`, `last_credit_sync`) | Vault State `UNLOCKED`, Rule: `ACCOUNT_READ`<br>(Metadata exposed, cookie excluded) | `TASK-P2-003`<br>`TASK-P2-006` | `test_credit_cost_estimation_standard_segment`<br>`TEST-CHAIN-001` | **Covered** |
| **FR-004** | Automated Account Rotation & Failover | `FEAT-ACCOUNT_POOL`<br>(`PRD/ACCOUNT_POOL.md`) | Modul Internal:<br>`flow-router::rotation`<br>UI: `PipelineStatusBanner`, Event: `account:session_warning` | `accounts`<br>(`is_active`, `priority_index`),<br>`generation_log` | Vault State `UNLOCKED`, Rule: `SYSTEM_ROUTING_EXECUTE`<br>(Failover to next active account) | `TASK-P2-005`<br>`TASK-P4-006` | `test_account_selection_highest_credit_priority`<br>`test_all_accounts_depleted_failsafe`<br>`TEST-CHAIN-001` | **Covered** |
| **FR-005** | Account Session Health Check | `FEAT-ACCOUNT_POOL`<br>(`PRD/ACCOUNT_POOL.md`) | `API-ACCT-005`<br>(`health_check_account`)<br>UI: `AccountDrawer` Refresh Action, Status Pill | `accounts`<br>(`status`: Active/Expired/Error, `last_health_check`) | Vault State `UNLOCKED`, Rule: `ACCOUNT_READ_WRITE`<br>(Startup, pre-flight, and on-demand) | `TASK-P2-001`<br>`TASK-P2-004` | `test_account_selection_health_filter`<br>`TEST-SETUP-001` | **Covered** |
| **FR-006** | Embedded Webview Session Re-Authentication | `FEAT-ACCOUNT_POOL`<br>(`PRD/ACCOUNT_POOL.md`) | `API-ACCT-006`<br>(`reauth_account`)<br>UI: Secondary WebView2 Window, `ReauthModal` | `accounts`<br>(`encrypted_cookie`, `status`, `updated_at`) | Vault State `UNLOCKED`, Rule: `ACCOUNT_REAUTH`<br>(Isolated WebView2 partition) | `TASK-P2-007`<br>`TASK-P7-003` | `TEST-SETUP-001`<br>`test_account_crud_operations` | **Covered** |
| **FR-010** | Visual Infinite Canvas & Minimap Navigation | `FEAT-NODE_EDITOR`<br>(`PRD/NODE_EDITOR.md`) | Komponen UI:<br>`@xyflow/react` Canvas,<br>`MiniMap`, `Controls`, `Background` | `projects`<br>(JSON `graph_data`: nodes, edges, viewport zoom/pan) | Public Client UI Rule<br>(No vault requirement for pan/zoom/view) | `TASK-P3-001`<br>`TASK-P3-002` | `test_canvas_mount_initializes_viewport`<br>`test_node_drag_updates_position_in_store`<br>`TEST-NODE-001` | **Covered** |
| **FR-011** | Prompt Node & Template Variable Interpolation | `FEAT-NODE_EDITOR`<br>(`PRD/NODE_EDITOR.md`) | Komponen UI:<br>`PromptNode`<br>(`CMP-PROMPT-NODE`),<br>Variable Highlighter | `projects`<br>(Node data: `prompt_text`, `template_variables`) | Public Client UI Rule<br>(In-memory Zustand store mutation) | `TASK-P3-003`<br>`TASK-P4-004` | `TEST-NODE-001`<br>`test_sliding_context_window_assembly` | **Covered** |
| **FR-012** | Image Reference Node & Asset Ingestion | `FEAT-NODE_EDITOR`<br>(`PRD/NODE_EDITOR.md`) | Komponen UI:<br>`ImageNode`,<br>Native Windows File Picker / Drag-and-Drop | `projects`<br>(Node data: `image_path` relative to project directory) | Filesystem Read Sandbox Rule<br>(Whitelist: `.png`, `.jpg`, `.jpeg`, `.webp`) | `TASK-P3-004` | `TEST-SEC-021`<br>`TEST-NODE-001` | **Covered** |
| **FR-013** | Video Reference Node & Thumbnail Preview | `FEAT-NODE_EDITOR`<br>(`PRD/NODE_EDITOR.md`) | Komponen UI:<br>`VideoNode`,<br>Embedded Mini Player, Context Menu | `projects`<br>(Node data: `video_path` relative, thumbnail cache) | Filesystem Read Sandbox Rule<br>(Whitelist: `.mp4`, `.webm`) | `TASK-P3-005` | `TEST-NODE-001`<br>`TEST-SEC-021` | **Covered** |
| **FR-014** | Draggable Edges & Port Type Validation | `FEAT-NODE_EDITOR`<br>(`PRD/NODE_EDITOR.md`) | Komponen UI:<br>`@xyflow/react` Handle,<br>`CustomEdge`, Topology Guard | `projects`<br>(`edges` array: source, target, sourceHandle, targetHandle) | Graph Schema Invariant Rule<br>(Strict Port Typing & DAG Cycle Detection) | `TASK-P3-007`<br>`TASK-P3-008` | `test_enforce_directed_acyclic_graph_no_cycles`<br>`test_prevent_self_connection`<br>`TEST-NODE-001` | **Covered** |
| **FR-015** | Node & Edge Deletion with Undo/Redo | `FEAT-NODE_EDITOR`<br>(`PRD/NODE_EDITOR.md`) | Komponen UI:<br>Zustand Graph Store,<br>Keyboard Shortcuts (Del, Ctrl+Z, Ctrl+Y) | `projects`<br>(Zustand history stack, max 50 snapshots) | Public Client UI Rule<br>(Atomic edge cascade on node removal) | `TASK-P3-002` | `test_node_deletion_removes_connected_edges`<br>`TEST-NODE-001` | **Covered** |
| **FR-016** | Generation Parameter Configuration | `FEAT-NODE_EDITOR`<br>(`PRD/NODE_EDITOR.md`) | `API-GEN-001`<br>(`generate_video`)<br>UI: `GenerationNode`, `NodeConfigPanel` | `segments`<br>(`model_name`, `aspect_ratio`, `seed`, `status`) | Vault State `UNLOCKED` (saat execution),<br>Config edit: Public Client UI | `TASK-P3-006` | `TEST-NODE-001`<br>`test_generation_config_validation` | **Covered** |
| **FR-017** | Canvas Video Result Preview & Shell Integration | `FEAT-NODE_EDITOR`<br>(`PRD/NODE_EDITOR.md`) | `API-GEN-002`<br>(`get_generation_status`)<br>UI: `GenerationNode` Card, Context Menu | `segments`<br>(`output_video_path`, `duration_seconds`) | OS Shell Execute Allowed Path Rule<br>(Buka file hanya di project directory) | `TASK-P3-005`<br>`TASK-P4-007` | `TEST-CHAIN-001`<br>`test_ipc_event_emission_stream` | **Covered** |
| **FR-018** | Project Persistence & Portability (.flowproj) | `FEAT-NODE_EDITOR`<br>(`PRD/NODE_EDITOR.md`) | `API-PROJ-001`<br>(`save_project`),<br>`API-PROJ-002`<br>(`load_project`)<br>UI: Project Menu Dialog | `projects` (SQLite) & berkas `.flowproj` JSON pada disk lokal | Filesystem Boundary Rule<br>(Relative path assets, anti-path traversal) | `TASK-P3-009` | `TEST-SEC-020`<br>`TEST-SEC-022`<br>`TEST-SETUP-001` | **Covered** |
| **FR-020** | Automated Last-Frame Extraction via FFmpeg | `FEAT-CONTINUITY_ENGINE`<br>(`PRD/CONTINUITY_ENGINE.md`) | `API-CONT-001`<br>(`extract_frame`)<br>Subprocess: FFmpeg Sidecar | `segments`<br>(`last_frame_path`) | Whitelist Subprocess Execution Rule<br>(FFmpeg CLI direct invoke, no cmd.exe) | `TASK-P4-001`<br>`TASK-P4-002` | `test_frame_extraction_argument_assembly`<br>`TEST-CHAIN-001` | **Covered** |
| **FR-021** | Next-Segment Visual Reference Injection | `FEAT-CONTINUITY_ENGINE`<br>(`PRD/CONTINUITY_ENGINE.md`) | Modul Internal:<br>`continuity::orchestrator`<br>UI: Auto Reference Connector | `segments`<br>(`input_reference_frame_path`), Google Flow HTTP Payload | Internal Engine IPC Rule<br>(Otomatis menyuntikkan PNG tanpa prompt manual) | `TASK-P4-003`<br>`TASK-P4-006` | `TEST-CHAIN-001`<br>`GOLD-001` s/d `GOLD-015` | **Covered** |
| **FR-022** | Sliding Context Window Prompt Carry-Over | `FEAT-CONTINUITY_ENGINE`<br>(`PRD/CONTINUITY_ENGINE.md`) | `API-CONT-002`<br>(`get_prompt_context`)<br>UI: Effective Prompt Inspector | `segments`<br>(`effective_prompt`, `override_prompt`) | Internal Engine Rule<br>(Maksimal 3 segmen terakhir, manual override priority) | `TASK-P4-004` | `TEST-CHAIN-001`<br>`test_sliding_context_window_assembly` | **Covered** |
| **FR-023** | Global Visual Style Lock | `FEAT-CONTINUITY_ENGINE`<br>(`PRD/CONTINUITY_ENGINE.md`) | `API-CONT-003`<br>(`set_style_lock`)<br>UI: Project Settings Style Lock Input | `projects`<br>(JSON field: `settings.style_lock_text`) | Vault State `UNLOCKED` (Execution),<br>Project Setting Mutation Rule | `TASK-P4-005` | `TEST-CHAIN-001`<br>`GOLD-001` s/d `GOLD-015` | **Covered** |
| **FR-024** | Sequential Pipeline Orchestration & FSM | `FEAT-CONTINUITY_ENGINE`<br>(`PRD/CONTINUITY_ENGINE.md`) | `API-GEN-001`<br>(`generate_video`),<br>`API-GEN-003`<br>(`cancel_generation`)<br>UI: `PipelineToolbar`, `NodeStatusBadge` | `segments`<br>(`status`: Queued, Generating, Downloading, Extracting, Complete, Failed) | Vault State `UNLOCKED`,<br>Singleton Pipeline Execution Mutex Rule | `TASK-P4-006`<br>`TASK-P4-007` | `TEST-CHAIN-001`<br>`test_pipeline_state_transitions` | **Covered** |
| **FR-030** | FFmpeg Video Concatenation & Audio Merge | `FEAT-VIDEO_EXPORT`<br>(`PRD/VIDEO_EXPORT.md`) | `API-EXP-001`<br>(`concat_segments`)<br>Subprocess: FFmpeg Concat Demuxer | `projects`<br>(Compiled video file on disk, temp demuxer manifest) | Whitelist Subprocess Execution Rule,<br>Path Sanitization Rule (`-map_metadata -1`) | `TASK-P5-001` | `test_ffmpeg_concatenation_process`<br>`TEST-EXPORT-001` | **Covered** |
| **FR-031** | Full Video Stitch Preview & Segment Markers | `FEAT-VIDEO_EXPORT`<br>(`PRD/VIDEO_EXPORT.md`) | `API-EXP-002`<br>(`preview_export`)<br>UI: `FullVideoPreviewModal`, Interactive Seekbar | Berkas preview sementara (`%TEMP%/FlowStudio/...`) | Client UI / Local Media Stream Rule<br>(Temp file cleanup on modal dismiss) | `TASK-P5-003`<br>`TASK-P5-004` | `TEST-EXPORT-001`<br>`test_preview_marker_seek` | **Covered** |
| **FR-032** | Individual & Batch Segment Export | `FEAT-VIDEO_EXPORT`<br>(`PRD/VIDEO_EXPORT.md`) | `API-EXP-004`<br>(`export_segment`)<br>UI: Node Context Menu, Batch Export Dialog | `segments`<br>(`output_video_path`), Target User Directory | Filesystem Write Sandbox Rule<br>(Naming: `[project]_seg_[00N].[ext]`) | `TASK-P5-002`<br>`TASK-P5-005` | `TEST-EXPORT-001`<br>`test_individual_segment_export` | **Covered** |
| **FR-033** | Video Transcoding Presets & Progress Tracking | `FEAT-VIDEO_EXPORT`<br>(`PRD/VIDEO_EXPORT.md`) | `API-EXP-003`<br>(`export_video`)<br>UI: `ExportModal`, `ExportProgressBar` | Berkas final output (`.mp4`, `.webm`), Event `export:progress` | Filesystem Write Sandbox Rule<br>(Format MP4 H.264 / WEBM VP9; 1080p, 720p) | `TASK-P5-002`<br>`TASK-P5-005` | `TEST-EXPORT-001`<br>`test_ipc_event_emission_stream` | **Covered** |
| **FR-040** | Master Password Lifecycle & Emergency Reset | `FEAT-CREDENTIAL_VAULT`<br>(`PERMISSION.md`, `SECURITY.md`) | `API-VAULT-001`<br>(`setup_vault`),<br>`API-VAULT-002`<br>(`unlock_vault`),<br>`API-VAULT-005`<br>(`reset_vault`)<br>UI: `MasterPasswordModal` | `credential_vault`<br>(`master_password_hash`, `salt`, `iterations`, `canary_ciphertext`) | State Lifecycle Gate:<br>`UNINITIALIZED` -> `LOCKED` -> `UNLOCKED`,<br>Anti-Brute Force Rule (3 failed -> 30s cooldown) | `TASK-P1-001`<br>`TASK-P1-003`<br>`TASK-P1-004`<br>`TASK-P1-006` | `TEST-SEC-001`<br>`TEST-SEC-010`<br>`TEST-SETUP-001` | **Covered** |
| **FR-041** | Cryptographic At-Rest Enclave (AES-256-GCM) | `FEAT-CREDENTIAL_VAULT`<br>(`PERMISSION.md`, `SECURITY.md`) | Subsystem Internal:<br>`vault::crypto`<br>(Argon2id + AES-256-GCM) | `accounts`<br>(`encrypted_cookie`, `encryption_salt`, `encryption_nonce`) | Zero-Plaintext Storage Invariant,<br>Ephemeral Key Enclave (`secrecy::SecretBox`) | `TASK-P1-001`<br>`TASK-P1-002` | `TEST-SEC-002`<br>`test_aes_256_gcm_roundtrip`<br>`test_argon2id_key_derivation_deterministic` | **Covered** |
| **FR-042** | Vault Inactivity Auto-Lock & RAM Zeroization | `FEAT-CREDENTIAL_VAULT`<br>(`PERMISSION.md`, `SECURITY.md`) | `API-VAULT-003`<br>(`lock_vault`),<br>`API-VAULT-004`<br>(`check_vault_status`)<br>Daemon: Watchdog Timer | In-memory key buffer (`zeroize::ZeroizeOnDrop`) | Watchdog Inactivity Timeout Rule<br>(15 min idle -> RAM zeroization, State `LOCKED`, pipeline in-flight uninterrupted) | `TASK-P1-005`<br>`TASK-P1-002` | `TEST-SEC-011`<br>`test_zeroize_on_drop_memory_cleanup` | **Covered** |

---

## 3. Non-Functional Traceability Matrix

Tabel di bawah ini memetakan seluruh **10 Kebutuhan Non-Fungsional Inti (NFR-001 s/d NFR-010)** dari SRS.md §5 terhadap mekanisme arsitektur, metode verifikasi, referensi tugas, dan skenario pengujian penjamin mutunya.

| NFR ID | Metric / Target | Architectural Mechanism | Verification Method / Task | Test ID | Status |
|---|---|---|---|---|---|
| **NFR-001** | **Canvas Render Performance:**<br>60fps stabil dengan $\le 100$ nodes dan $\le 200$ edges pada hardware target (Intel i5 Gen 8, 8GB RAM, iGPU). P95 frame time $< 16.67\text{ ms}$. | Virtualisasi `@xyflow/react`, CSS hardware transforms (`transform: translate3d`), debounced Zustand selectors, dan viewport culling untuk simpul di luar layar. | Benchmark Chrome DevTools Performance profile saat pan/zoom 100 node graf aktif.<br>Task: `TASK-P3-001`. | `test_canvas_mount_initializes_viewport`<br>`TEST-NODE-001` | **Covered** |
| **NFR-002** | **Generation Request Latency:**<br>$< 2\text{ detik}$ dari pemicuan pipeline step hingga dispatch HTTP request terkirim ke Google Flow backend. | Rust Tokio asynchronous task pool, pre-warmed connection keep-alive pool pada `reqwest::Client`, serialisasi payload in-memory tanpa write ke disk. | Logging timestamp berpresisi milidetik pada Rust pipeline executor antara pemicuan step dan emisi HTTP socket.<br>Task: `TASK-P2-001`, `TASK-P4-006`. | `test_credit_cost_estimation_standard_segment`<br>`TEST-CHAIN-001` | **Covered** |
| **NFR-003** | **Generation Resilience & Retry:**<br>Maksimal 3 kali retry dengan exponential backoff ($2\text{s}, 4\text{s}, 8\text{s}$) untuk transient failure (network timeout, HTTP 5xx); immediate fail untuk HTTP 400/403. | Resilient retry middleware pada `flow-router`, isolasi error klasifikasi (transient vs terminal), dan delay generator berbasis `tokio::time::sleep`. | Simulasi fault injection: pemutusan jaringan (3x retry -> fail) dan injeksi status 400 (immediate fail).<br>Task: `TASK-P2-005`, `TASK-P4-006`. | `test_pipeline_state_transitions`<br>`TEST-CHAIN-001` | **Covered** |
| **NFR-004** | **Credential Protection at Rest & Zero Leak:**<br>Enkripsi AES-256-GCM. Kredensial tidak pernah ditulis ke berkas log, temp file, console output, atau crash dump. Kunci KEK hanya ada di RAM saat status `UNLOCKED`. | Enkripsi otentikasi simetris via `ring`/`aes-gcm`, Argon2id KDF ($m=64\text{MB}, t=3, p=1$), pembungkus `secrecy::SecretBox`, masking log otomatis `[REDACTED_SECRET]`, serta sanitasi dump panic. | Audit static analysis (grep pola token), validasi log trace saat login/generasi, dan inspeksi SQLite binary.<br>Task: `TASK-P0-004`, `TASK-P0-005`, `TASK-P1-002`, `TASK-P1-007`. | `TEST-SEC-002`<br>`TEST-SEC-012`<br>`TEST-SEC-020` | **Covered** |
| **NFR-005** | **Unattended Pipeline Execution:**<br>Pipeline 30 segmen ($\approx 5\text{ menit}$ video) dapat berjalan mandiri hingga selesai tanpa dialog prompt yang memerlukan intervensi Owner setelah konfigurasi awal. | State machine sekuensial otonom, auto-extraction last-frame PNG via FFmpeg, auto-injection referensi visual, dan auto-rotation akun saat kuota tiris. | Eksekusi unattended pipeline stress test 30 segmen pada mock server Google Flow hingga tahap ekspor final.<br>Task: `TASK-P4-006`, `TASK-P6-004`. | `TEST-CHAIN-001`<br>`TEST-EXP-E003` | **Covered** |
| **NFR-006** | **Project File Footprint:**<br>Ukuran berkas proyek `.flowproj` $< 10\text{MB}$ untuk 100 node (di luar aset video biner). Aset video disimpan terpisah dengan referensi path relatif. | Format serialisasi JSON terkompresi tanpa menyematkan blob media (*binary decoupling*); penyimpanan media berada di subdirektori `./assets/`. | Pengujian ukuran file pada skenario batas: serialisasi 100 node prompt & metadata menghasilkan ukuran $< 1\text{MB}$.<br>Task: `TASK-P3-009`. | `test_project_serialization_size`<br>`TEST-SEC-022` | **Covered** |
| **NFR-007** | **Windows Compatibility:**<br>Kompatibilitas penuh pada Windows 10 ($21\text{H}2+$) dan Windows 11 x64. Tidak ada dependensi lingkungan eksternal selain WebView2 runtime. | Target kompilasi native Tauri 2.x Rust (`x86_64-pc-windows-msvc`), packaging NSIS installer tanpa kebutuhan hak administrator, integrasi WebView2 bootstrapper. | Instalasi dan verifikasi uji asap (*smoke test*) pada mesin virtual bersih Windows 10 21H2 dan Windows 11 23H2.<br>Task: `TASK-P0-001`, `TASK-P7-001`, `TASK-P7-002`, `TASK-P7-003`. | `TEST-SETUP-001`<br>`TEST-CHAIN-001` | **Covered** |
| **NFR-008** | **Application Cold Start Time:**<br>$< 3\text{ detik}$ dari klik executable hingga jendela utama desktop ter-render dan interaktif (tanpa menghitung durasi ketik master password). | Inisialisasi basis data SQLite non-blocking (WAL mode), *code splitting* dynamic bundle React 19 via Vite, pemuatan lazy untuk font dan icons lokal. | Pengukuran waktu cold-start otomatis via telemetri startup dan stopwatch runner process pada Windows target hardware.<br>Task: `TASK-P0-001`, `TASK-P7-004`. | `test_cold_start_benchmark`<br>`TEST-SETUP-001` | **Covered** |
| **NFR-009** | **WCAG 2.2 Level AA Accessibility:**<br>100% elemen interaktif dapat diakses via keyboard, kompatibel pembaca layar, rasio kontras teks $\ge 4.5:1$ (komponen $\ge 3:1$), indikator fokus terlihat. | Desain token berbasis palet Slate Tailwind dengan rasio kontras tervalidasi, focus outline ring `#3B82F6`, ARIA attributes pada modal dialog, shortcut keyboard kanvas. | Pemindaian otomatis `@axe-core/playwright` pada seluruh halaman dengan konfigurasi zero error violation; audit navigasi keyboard murni.<br>Task: `TASK-P6-001`, `TASK-P6-002`. | `test_axe_core_wcag_compliance`<br>`TEST-NODE-001` | **Covered** |
| **NFR-010** | **Anti-AI-Slop & Clean Code Quality:**<br>Skor `aislop` $\ge 75$ per file, 0 HARD violations (tanpa narasi komentar berlebih, swallowed exception, TODO stub, hardcoded secret), kompleksitas siklomatik $\le 15$, baris kode $\le 500$ LOC. | Penegakan linter ketat pada pre-commit hook dan pipeline CI: `cargo clippy -- -D warnings`, `eslint --max-warnings 0`, `prettier`, dan scanner `aislop`. | CI GitHub Actions Quality Gate memblokir merge PR jika terdapat pelanggaran linter atau skor kualitas di bawah ambang batas.<br>Task: `TASK-P0-002`, `TASK-P6-005`. | `test_ci_quality_gates`<br>`test_lint_no_slop_violations` | **Covered** |

---

## 4. User Journey Traceability

Seksi ini memvalidasi kelengkapan penelusuran untuk seluruh **Critical User Journeys (UJ-001 s/d UJ-004)** yang didefinisikan pada SRS.md §7 dan skenario E2E pada TESTING.md §9.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     UJ-001      │ ───►  │     UJ-002      │ ───►  │     UJ-003      │ ───►  │     UJ-004      │
│ First-Time Setup│       │ Create Project  │       │ Generate Video  │       │  Export Video   │
│(Vault & Account)│       │ (Canvas & Graph)│       │(Chaining & Auto)│       │(Concat & Output)│
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 4.1 Pemetaan Terperinci Alur Pengguna

| Journey ID | Nama Skenario & Tujuan Pengguna | Kebutuhan Terkait (FR / NFR) | Komponen & Operasi IPC | Task Implementasi | Test Scenario E2E & Validasi | Status |
|---|---|---|---|---|---|---|
| **UJ-001** | **First-Time Setup**<br>*Tujuan:* Menyiapkan brankas kredensial perdana, menetapkan Master Password, dan mendaftarkan minimal satu akun Google Flow aktif ke pool. | **Primary:**<br>FR-040, FR-041, FR-001<br>**Supporting:**<br>FR-003, FR-005, NFR-004, NFR-008 | `API-VAULT-001`<br>(`setup_vault`),<br>`API-ACCT-001`<br>(`add_account`),<br>`API-ACCT-005`<br>(`health_check_account`),<br>UI: `MasterPasswordModal`, `AccountDrawer` | `TASK-P0-001`<br>`TASK-P0-004`<br>`TASK-P0-005`<br>`TASK-P1-001`<br>`TASK-P1-003`<br>`TASK-P1-006`<br>`TASK-P2-001`<br>`TASK-P2-004` | **`TEST-SETUP-001`**<br>(First-Time Vault Initialization & Account Setup)<br>`TEST-SEC-001`<br>`TEST-SEC-010` | **Covered** |
| **UJ-002** | **Create New Video Project**<br>*Tujuan:* Merancang alur video multi-segmen pada kanvas node editor: menyusun prompt, memuat referensi gambar/video, mengatur edge, dan menyimpan berkas `.flowproj`. | **Primary:**<br>FR-010, FR-011, FR-012, FR-013, FR-014, FR-018<br>**Supporting:**<br>FR-015, FR-016, FR-023, NFR-001, NFR-006 | `API-PROJ-001`<br>(`save_project`),<br>`API-PROJ-002`<br>(`load_project`),<br>UI: `@xyflow/react` Canvas, `PromptNode`, `ImageNode`, `VideoNode`, `CustomEdge` | `TASK-P3-001`<br>`TASK-P3-002`<br>`TASK-P3-003`<br>`TASK-P3-004`<br>`TASK-P3-005`<br>`TASK-P3-006`<br>`TASK-P3-007`<br>`TASK-P3-008`<br>`TASK-P3-009` | **`TEST-NODE-001`**<br>(Node Canvas Graph Construction & DAG Validation)<br>`TEST-SEC-020`<br>`TEST-SEC-021`<br>`TEST-SEC-022` | **Covered** |
| **UJ-003** | **Generate Long Video**<br>*Tujuan:* Menjalankan pipeline pembuatan video multi-segmen secara otonom dengan injeksi referensi frame terakhir, chaining prompt context, dan rotasi akun otomatis saat kuota habis. | **Primary:**<br>FR-020, FR-021, FR-022, FR-024, FR-004<br>**Supporting:**<br>FR-003, FR-016, FR-017, FR-023, FR-042, NFR-002, NFR-003, NFR-005 | `API-GEN-001`<br>(`generate_video`),<br>`API-CONT-001`<br>(`extract_frame`),<br>`API-CONT-002`<br>(`get_prompt_context`),<br>Modul: `flow-router::rotation`,<br>UI: `PipelineToolbar`, `NodeCard` status | `TASK-P2-001`<br>`TASK-P2-003`<br>`TASK-P2-005`<br>`TASK-P4-001`<br>`TASK-P4-002`<br>`TASK-P4-003`<br>`TASK-P4-004`<br>`TASK-P4-005`<br>`TASK-P4-006`<br>`TASK-P4-007` | **`TEST-CHAIN-001`**<br>(Chained Sequential Generation with Auto-Rotation)<br>`GOLD-001` s/d `GOLD-015`<br>`TEST-SEC-011` | **Covered** |
| **UJ-004** | **Export Final Video**<br>*Tujuan:* Meninjau pratinjau kompilasi video gabungan dengan indikator batas segmen interaktif, lalu mengekspor berkas video resolusi penuh (.mp4 / .webm) via FFmpeg. | **Primary:**<br>FR-030, FR-031, FR-033<br>**Supporting:**<br>FR-032, NFR-004, NFR-007 | `API-EXP-001`<br>(`concat_segments`),<br>`API-EXP-002`<br>(`preview_export`),<br>`API-EXP-003`<br>(`export_video`),<br>`API-EXP-004`<br>(`export_segment`),<br>UI: `FullVideoPreviewModal`, `ExportModal` | `TASK-P5-001`<br>`TASK-P5-002`<br>`TASK-P5-003`<br>`TASK-P5-004`<br>`TASK-P5-005` | **`TEST-EXPORT-001`**<br>(Final Video Concatenation & Export Pipeline)<br>`TEST-EXP-E001`<br>`TEST-EXP-E003` | **Covered** |

---

### 4.2 Analisis Keterhubungan Langkah Alur (*Step-Level Interaction Mapping*)

Setiap langkah dalam happy-path User Journey memiliki korelasi langsung ke unit tugas dan pengujian untuk memastikan zero-gap execution:

1. **Alur UJ-001 (Setup Awal):**
   - Langkah 1–5 (Master Password Initialization): Terhubung ke `FR-040`, `TASK-P1-001`, `TASK-P1-006`, diverifikasi via `TEST-SETUP-001` (Langkah 1–4).
   - Langkah 6–12 (Pendaftaran Akun Google Flow & Health Check): Terhubung ke `FR-001`, `FR-003`, `FR-005`, `TASK-P2-002`, `TASK-P2-004`, diverifikasi via `TEST-SETUP-001` (Langkah 5–8).
2. **Alur UJ-002 (Pembuatan Proyek):**
   - Langkah 1–3 (Inisialisasi Kanvas & File Proyek): Terhubung ke `FR-010`, `FR-018`, `TASK-P3-001`, `TASK-P3-009`, diverifikasi via `TEST-NODE-001` (Langkah 1–2).
   - Langkah 4–8 (Penyusunan Simpul Prompt & Aset): Terhubung ke `FR-011`, `FR-012`, `FR-013`, `TASK-P3-003`, `TASK-P3-004`, diverifikasi via `TEST-NODE-001` (Langkah 3–5).
   - Langkah 9–12 (Konfigurasi Parameter & Validasi Topologi DAG): Terhubung ke `FR-014`, `FR-016`, `FR-023`, `TASK-P3-007`, `TASK-P3-008`, diverifikasi via `TEST-NODE-001` (Langkah 6–8).
3. **Alur UJ-003 (Generasi Berantai Sekuensial):**
   - Langkah 1–4 (Pre-flight Validation & Pipeline Trigger): Terhubung ke `FR-005`, `FR-024`, `TASK-P4-006`, diverifikasi via `TEST-CHAIN-001` (Langkah 1–3).
   - Langkah 5–8 (Ekstraksi Frame & Chaining Otomatis Segmen 1 ke Segmen 2): Terhubung ke `FR-020`, `FR-021`, `FR-022`, `TASK-P4-002`, `TASK-P4-003`, `TASK-P4-004`, diverifikasi via `TEST-CHAIN-001` (Langkah 4–5).
   - Langkah 9–11 (Failover Rotasi Akun Otomatis & Penyelesaian): Terhubung ke `FR-004`, `FR-017`, `TASK-P2-005`, `TASK-P4-007`, diverifikasi via `TEST-CHAIN-001` (Langkah 6–7).
4. **Alur UJ-004 (Pratinjau & Ekspor Akhir):**
   - Langkah 1–5 (Stitch Preview dengan Segment Markers): Terhubung ke `FR-031`, `TASK-P5-003`, `TASK-P5-004`, diverifikasi via `TEST-EXPORT-001` (Langkah 1–4).
   - Langkah 6–9 (Ekspor Final FFmpeg Concat & Transcoding): Terhubung ke `FR-030`, `FR-033`, `TASK-P5-001`, `TASK-P5-002`, `TASK-P5-005`, diverifikasi via `TEST-EXPORT-001` (Langkah 5–7).

---

## 5. Traceability Maintenance Protocol

Protokol ini mengatur tata kelola pemeliharaan matriks ketertelusuran sepanjang siklus hidup proyek Flow Studio, memastikan bahwa dokumen `TRACEABILITY.md` tetap menjadi sumber kebenaran tunggal (*single source of truth*) yang mutakhir saat terjadi revisi rancangan atau manajemen perubahan (*change management*).

### 5.1 Protokol Manajemen Perubahan (*Change Management Workflow*)

Setiap perubahan pada spesifikasi kebutuhan, arsitektur, basis data, atau kontrak API wajib mengikuti alur 5-tahap verifikasi dampak:

```
┌────────────────────┐
│ 1. Change Trigger  │  (Permintaan fitur baru, penyesuaian API Google Flow, bug S1/S2)
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ 2. Impact Analysis │  (Telusuri rantai upstream/downstream: SRS -> PRD -> API -> DB -> Test)
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ 3. Matrix Updating │  (Pembaruan serentak ID terkait pada TRACEABILITY.md)
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ 4. Artifact Sync   │  (Sinkronisasi kode, skema ERD, API contract, dan task backlog)
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ 5. Gate Validation │  (Pemeriksaan konsistensi CI & Sign-Off Software Architect)
└────────────────────┘
```

1. **Pemicu Perubahan (Change Trigger):** Perubahan dapat dipicu oleh pembaruan kontrak tidak resmi Google Flow (reverse-engineered endpoint), penemuan limitasi hardware, atau optimasi alur pengguna.
2. **Analisis Dampak (Impact Analysis):** Penanggung jawab perubahan (*Assignee*) wajib memeriksa `TRACEABILITY.md` untuk mengidentifikasi seluruh artefak terdampak:
   - Bila `FR-xxx` berubah $\rightarrow$ Periksa `DOC-PRD-*`, skema `ERD.md`, payload `API.md`, serta task terkait di `TASKS.md`.
   - Bila `API-xxx` berubah $\rightarrow$ Periksa dependensi fungsi frontend, Rust command handler, dan skenario `TEST-*`.
3. **Pembaruan Matriks Ketertelusuran (Matrix Updating):** Sebelum commit disetujui, `TRACEABILITY.md` harus diperbarui. Status kebutuhan diubah menjadi `Under Review` selama masa modifikasi, dan kembali ke `Covered` setelah seluruh mata rantai terhubung ulang.
4. **Sinkronisasi Artefak (Artifact Synchronization):**
   - Perubahan skema basis data wajib menghasilkan berkas migrasi baru (`V00X__*.sql`).
   - Setiap endpoint baru wajib didaftarkan pada binding `tauri-specta` (`src/bindings.ts`).
   - Skenario uji baru wajib ditambahkan pada `TESTING.md`.
5. **Verifikasi Quality Gate (Gate Validation):** Script CI memvalidasi ketiadaan *orphan requirements* atau *untracked tasks*.

---

### 5.2 Aturan Penelusuran Dua Arah (*Bi-directional Traceability Rules*)

Untuk mencegah munculnya fitur liar (*gold plating*) maupun kebutuhan yang terabaikan (*orphan requirements*), tim pengembang wajib mematuhi aturan ketertelusuran dua arah berikut:

#### A. Forward Traceability (Kebutuhan $\rightarrow$ Implementasi & Pengujian)
- Setiap nomor kebutuhan `FR-*` dan `NFR-*` pada `SRS.md` **harus memiliki minimal 1 Task ID** pada `TASKS.md`.
- Setiap nomor kebutuhan **harus memiliki minimal 1 Test ID** pada `TESTING.md`.
- Kebutuhan tanpa task implementasi atau skenario uji dikategorikan sebagai **Defect Arsitektur (Severity S1)**.

#### B. Backward Traceability (Kode/Pengujian $\rightarrow$ Kebutuhan)
- Setiap Pull Request (PR) atau commit fitur baru pada git **wajib mencantumkan Task ID dan Requirement ID** pada pesan commit dengan konvensi:  
  `feat(domain): deskripsi pekerjaan [TASK-PX-XXX] [FR-XXX]`
- Dilarang menambahkan *Tauri Command* baru pada `src-tauri/src/` atau komponen halaman pada `src/` yang tidak memiliki nomor registrasi di `API.md` dan `TRACEABILITY.md`.
- Kode yang tidak memiliki dasar kebutuhan bisnis dikategorikan sebagai *code bloat* dan wajib dihapus saat review.

---

### 5.3 Audit Cadence & Penegakan CI Quality Gate

1. **Otomasi Pemeriksaan Konsistensi (CI Automated Traceability Lint):**
   - Skrip pipeline GitHub Actions menjalankan pengujian regex untuk mencocokkan seluruh referensi ID antara `SRS.md`, `TASKS.md`, `TESTING.md`, dan `TRACEABILITY.md`.
   - Pipeline akan berstatus `FAILED` jika ditemukan ID yang terputus (*broken link*), status P0 selain `Covered`, atau tabel ketertelusuran yang tidak lengkap.
2. **Kadensi Audit Mingguan:**
   - **Lead Architect & QA Lead** melakukan review rutin setiap hari Kamis untuk memeriksa status implementasi task terhadap target coverage.
   - Setiap rilis versi minor ($1.X.0$) mewajibkan audit 100% loop closure untuk seluruh fitur yang disertakan dalam paket distribusi.
3. **Matriks Peran dan Tanggung Jawab RACI:**

| Peran Tim | Pembuatan Kebutuhan (FR/NFR) | Perancangan API / ERD | Implementasi Kode (Task) | Pembuatan Test Suite | Pemeliharaan TRACEABILITY.md |
|---|---|---|---|---|---|
| **Software Architect** | **Accountable (A)** | **Accountable (A)** | Consulted (C) | Consulted (C) | **Accountable (A)** |
| **Tech Lead** | Consulted (C) | Responsible (R) | **Responsible (R)** | Consulted (C) | Responsible (R) |
| **Backend / Frontend Dev** | Informed (I) | Informed (I) | **Responsible (R)** | Responsible (R) | Informed (I) |
| **QA / Test Engineer** | Consulted (C) | Informed (I) | Informed (I) | **Accountable (A)** | Responsible (R) |
| **DevOps Lead** | Informed (I) | Informed (I) | Responsible (R) | Responsible (R) | Informed (I) |

---

*Dokumen ini merupakan spesifikasi matriks ketertelusuran kanonikal Flow Studio (`DOC-TRC-001`). Setiap perubahan pada alur sistem atau penambahan kebutuhan wajib melalui prosedur pembaruan dokumen ini secara atomik.*
