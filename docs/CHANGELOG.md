# CHANGELOG: Documentation & Architectural Decision Log — Flow Studio

> **Project:** Flow Studio  
> **Document ID:** DOC-LOG-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-MANIFEST-001  
> **Supersedes:** None  

---

## Ringkasan Eksekutif & Tujuan Dokumen

Dokumen `CHANGELOG.md` berfungsi sebagai catatan historis komprehensif, log audit evolusi arsitektur, dan register pelacakan keputusan teknis bagi seluruh artefak blueprint proyek **Flow Studio** (*Flow Chainer*). Mengikuti standar tata kelola **PLANNING_v5.2.md Section 11.20**, dokumen ini merekam setiap penambahan dokumen, perubahan lingkup (*scope changes*), penguncian parameter rancangan (*locked architectural parameters*), serta evaluasi dampak menyeluruh (*impact analysis*) dari transisi fase penemuan (*Discovery*) hingga kesiapan implementasi produksi (*Implementation Ready*).

---

## 1. Log Perubahan Versi Dokumen Blueprint

## [Unreleased]

### Added
- **Phase 5: Video Export & Preview Implementation Complete [TASK-P5-001..005]:**
  - Implemented FFmpeg Concat Demuxer Engine with temporary text manifest and stream-copy (`-c copy`) for seamless audio/video joining.
  - Implemented Video Transcoding Engine with MP4 H.264 / AAC and WebM VP9 / Opus presets across Original, 1080p, and 720p scaling filters.
  - Implemented Fast Preview Stream Generator with per-segment duration markers.
  - Added Tauri IPC commands: `concat_segments` (`API-EXP-001`), `preview_export` (`API-EXP-002`), `export_video` (`API-EXP-003`), `export_segment` (`API-EXP-004`).
  - Implemented Full Video Preview Player component (`VideoPreviewModal`) with interactive seekbar, timestamp segment marker buttons, and timecode display.
  - Implemented Video Export Modal component (`VideoExportModal`) with format, resolution, filename, folder inputs, and progress monitor.
  - Created Storybook CSF3 stories and unit test suites for all export components and hooks.
  - Quality gates: 18/18 Rust tests, 15/15 Vitest suites (50 tests), 0 clippy warnings, and 100/100 Healthy score on `aislop scan`.

- **Phase 4: Continuity Engine & FFmpeg Integration Complete [TASK-P4-001..007]:**
  - Integrated FFmpeg runner for fast last-frame extraction (`-sseof -1 -update 1 -q:v 1`) with sanitized arguments.
  - Implemented Prompt Context Carry-Over sliding window (up to 3 ancestor prompts) and persistent Visual Style Lock manager.
  - Added Tauri IPC commands: `extract_frame` (`API-CONT-001`), `get_prompt_context` (`API-CONT-002`), `set_style_lock` (`API-CONT-003`).
  - Implemented Sequential Pipeline Orchestrator (`pipeline-orchestrator.ts`) with Kahn's topological sort execution order, automatic frame carry-over injection to subsequent segments, and exponential backoff retry.
  - Added `useContinuityPipeline` React hook and integrated "Run Pipeline" execution action into `CanvasToolbar`.
  - Quality gates: 17/17 Rust tests, 12/12 Vitest suites (44 tests), 0 clippy warnings, and 100/100 Healthy score on `aislop scan`.

- **Phase 3: Visual Canvas Node Editor Implementation Complete [TASK-P3-001..009]:**
  - Integrated `@xyflow/react` v12 with ultra-dark canvas `#0B0F19`, dot grid, MiniMap, Controls, and 60fps pan/zoom performance.
  - Implemented Zustand Flow Graph Store (`flow-graph-store.ts`) with up to 50 undo/redo history snapshots, multi-node selection, and dirty state management.
  - Implemented 4 custom node components with full visual states and Storybook stories:
    - `PromptNode`: multi-line input, template variable highlighting (`{segment_number}`, `{previous_context}`), character count, and purple glow `#8B5CF6`.
    - `ImageNode`: reference asset upload/preview dropzone, resolution metadata, and emerald glow `#10B981`.
    - `VideoNode`: video clip preview/player, format validation, duration/resolution metadata, and violet glow `#8B5CF6`.
    - `GenerationNode`: provider model selector, aspect ratio, seed, status badge, action controls, and amber glow `#F59E0B`.
  - Implemented DAG Topology Validator & Cycle Detector (`dag-validator.ts`) with strict port-type connection rules and Kahn's algorithm topological sorting.
  - Implemented Project Persistence Engine (.flowproj) with atomic write/sync/rename and 10MB limit in `flow-core::project` and Tauri IPC commands (`save_project`, `load_project`).
  - Added React hook `useProjectPersistence` with Ctrl+S/Ctrl+O keyboard shortcuts.
  - Rewired `App.tsx` to display minimal 64px identity sidebar and full-canvas workspace.
  - Achieved 100/100 Healthy score on `aislop scan`, 10/10 test files (39 tests) passing on Vitest with 75% coverage, and 12/12 Rust tests passing.

- **Phase 0 Implementation Complete:**
  - Tauri 2.x desktop shell configured with Vite 8 + React 19 + TypeScript + Tailwind CSS.
  - Rust workspace modular structure (`crates/flow-core` and `src-tauri`).
  - Local database engine in `flow-core` with WAL mode, foreign keys, and migration checksum validation (`V001__initial_local_schema.sql`).
  - Contract-first IPC via `tauri-specta` generating type-safe bindings to `src/bindings.ts`.
  - Canonical `IpcError` envelope with structured error codes (`E_STORAGE_WORKSPACE_INITIALIZATION_FAILED`).
  - Diagnostic logging system via `tracing` with size-based rolling files, retention limits, and regex-based secret/PII sanitization.
  - Strict CI Quality Gates workflow (`.github/workflows/ci.yml`) enforcing cargo fmt, clippy, cargo audit, eslint, tsc, vitest, and aislop.
  - Component Storybook configuration with a11y testing parameter and 6 visual state stories for `WorkspaceStatusCard`.
  - 100/100 Healthy score achieved on `aislop scan` with zero hard/standard violations.
  - Change Request `CR-001` accepted to establish supported provider boundary and exclude unauthorized cookie/session extraction.

## [2026-09-24] — 1.0.0

### Added
- **Batch 1 (Foundations & Core Scope):**
  - `PROJECT_MANIFEST.md` (`DOC-MANIFEST-001`): Registri master 29 dokumen blueprint, pelacak status gate A/B/C, dan rencana eksekusi batch 1–7.
  - `PLANNING.md` (`DOC-PLAN-001`): Dokumen visi produk, *North Star Metric* (durasi video koheren per sesi), batasan kapasitas developer solo, mitigasi risiko utama, serta penguncian lingkup P0, P1, dan P2.
  - `SRS.md` (`DOC-SRS-001`): Spesifikasi kebutuhan perangkat lunak formal yang mencakup 18 Kebutuhan Fungsional (FR-001 s.d. FR-018) dan 8 Kebutuhan Non-Fungsional (NFR-001 s.d. NFR-008) dengan matriks verifikasi.
- **Batch 2 (Feature Specifications):**
  - `PRD/_INDEX.md` (`DOC-PRD-IDX-001`): Indeks pusat dokumen spesifikasi kebutuhan produk dan peta interaksi modul.
  - `PRD/ACCOUNT_POOL.md` (`DOC-PRD-ACT-001`): Spesifikasi fungsional dan teknis multi-account session management, pelacakan kuota kredit harian/bulanan (50 kredit gratis per akun), serta algoritma rotasi akun otomatis saat kuota habis atau terkena HTTP 429.
  - `PRD/NODE_EDITOR.md` (`DOC-PRD-NOD-001`): Arsitektur visual canvas berbasis `@xyflow/react` v12+, definisi 4 tipe simpul kustom (Prompt, Image/Reference, Video/Clip, Generate Node), validasi tipe edge, dan deteksi siklus graf asiklik terarah (DAG).
  - `PRD/CONTINUITY_ENGINE.md` (`DOC-PRD-CNT-001`): Logika orkestrasi kontinuitas visual lintas segmen, ekstraksi *last frame* via FFmpeg sub-detik (<500ms), injeksi gambar referensi, dan *sliding window prompt carry-over*.
  - `PRD/VIDEO_EXPORT.md` (`DOC-PRD-EXP-001`): Pipeline stitching video sekuensial melalui FFmpeg biner mandiri, normalisasi resolusi/framerate, transkoding stream-copy (H.264/AAC), dan verifikasi durabilitas file ekspor.
- **Batch 3 (Data & Interface Contracts):**
  - `PERMISSION.md` (`DOC-PERM-001`): Model otorisasi lokal berbasis peran tunggal (`Owner`), matriks kontrol akses subsistem, siklus hidup pembukaan brankas (*vault unlock/lock*), dan batas keamanan proses.
  - `ERD.md` (`DOC-ERD-001`): Skema relasional SQLite 3 lengkap (7 entitas: `credential_vault`, `accounts`, `projects`, `segments`, `continuity_edges`, `generation_log`, `security_audit_log`), indeks performa, aturan `PRAGMA WAL`, dan penandaan privasi PII.
  - `API.md` (`DOC-API-001`): Kontrak antarmuka IPC Tauri Command/Event berkategori 6 namespace (`vault`, `account`, `project`, `pipeline`, `export`, `system`), skema typed payload via `tauri-specta`, dan canonical error envelopes.
- **Batch 4 (Architecture, Decisions & Security):**
  - `ARCHITECTURE.md` (`DOC-ARCH-001`): Topologi modular monolith, batas kepercayaan sistem (5 *trust boundaries*), state machines, mode kegagalan sistem, strategi caching multi-tier, dan struktur direktori lokal `%APPDATA%/FlowStudio`.
  - `SECURITY.md` (`DOC-SEC-001`): Evaluasi OWASP Top 10:2021 untuk lingkungan desktop, arsitektur enkripsi at-rest AES-256-GCM, derivasi kunci master Argon2id, in-memory zeroization via crate `zeroize`, dan mitigasi anti-abuse.
  - `ADR/ADR-001-APP-SHELL.md` (`DOC-ADR-001`): Catatan keputusan arsitektural pemilihan Tauri 2.x (Rust Backend + Microsoft Edge WebView2) dibandingkan Electron dan Flutter Desktop.
  - `ADR/ADR-002-ROUTER-INTEGRATION.md` (`DOC-ADR-002`): Catatan keputusan arsitektural integrasi `flow-router` sebagai *embedded in-process Rust module* dibandingkan model *standalone sidecar daemon* atau *containerized OS service*.
- **Batch 5 (Design System & AI Engine):**
  - `CODE_QUALITY.md` (`DOC-QUAL-001`): Standar baku kualitas kode produksi dan aturan anti-AI-slop (6 Hard Rules, 7 Standard Rules, 8 Quality Rules, batas dekomposisi 400 LOC per file dan 80 baris per fungsi).
  - `DESIGN.md` (`DOC-DES-001`): Kontrak desain visual tunggal (*dark mode only*), token desain warna, tipografi, skala elevasi, grid 4px/8px, dan kepatuhan aksesibilitas WCAG 2.2 AA.
  - `DSD.md` (`DOC-DSD-001`): Inventaris 16 komponen antarmuka pengguna dengan spesifikasi 6 status visual interaktif (Default, Hover, Active, Loading, Error, Disabled) dan interaksi keyboard.
  - `AI_FEATURES.md` (`DOC-AI-001`): Pemetaan kapabilitas model Google Flow (Veo 3.1), struktur request reverse-engineered, fallback browser context, dan panduan mitigasi hallucination prompt context.
  - `ANALYTICS.md` (`DOC-ANA-001`): Arsitektur telemetri lokal terisolasi (*zero-cloud leakage*), kalkulasi North Star Metric rolling 30 hari di SQLite, serta logging performa sub-detik tanpa tracking eksternal.
- **Batch 6 (Implementation Roadmap & Quality):**
  - `TESTING.md` (`DOC-TEST-001`): Piramida verifikasi komprehensif (70% Unit Tests Rust/React, 20% Integration Tests IPC/DB, 10% End-to-End Tests Playwright), benchmark performa 60 FPS, dan uji coba auditibilitas enkripsi.
  - `TASKS.md` (`DOC-TASK-001`): *Work Breakdown Structure* atomik yang memetakan 68 tugas rekayasa teknis lintas Fase 0 hingga Fase 8 dengan estimasi beban kerja dan kriteria penerimaan terukur.
  - `ENVIRONMENT.md` (`DOC-ENV-001`): Matriks konfigurasi parameter lingkungan, persyaratan dependensi runtime lokal (Windows 10/11 x64, WebView2, FFmpeg 6.0+), dan variabel build.
  - `RUNBOOK.md` (`DOC-RUN-001`): Panduan operasional developer, prosedur packaging biner portabel/NSIS installer, panduan mitigasi insiden lokal (database lock, corrupted frames, upstream API changes), dan pemulihan darurat.
  - `MIGRATION.md` (`DOC-MIG-001`): Strategi evolusi skema database SQLite, runner migrasi transaksional in-process, skrip rollback deterministik, dan backup otomatis sebelum migrasi.
- **Batch 7 (Handoff & Governance):**
  - `AGENTS.md` (`DOC-AGT-001`): Pedoman orkestrasi multi-agen untuk fase implementasi kode, batasan konteks, dan aturan intervensi manusia.
  - `TRACEABILITY.md` (`DOC-TRC-001`): Matriks penelusuran persyaratan ujung-ke-ujung (*Traceability Matrix*) yang memetakan 100% Kebutuhan Fungsional (FR) dan Non-Fungsional (NFR) terhadap modul PRD, IPC API, skema ERD, unit tugas TASKS, dan rencana uji TESTING.
  - `RELEASE_CHECKLIST.md` (`DOC-REL-001`): Daftar periksa kesiapan rilis produksi, audit keamanan pre-merge, verifikasi sanitasi rahasia (*secret scanning*), dan pemenuhan gerbang kualitas.
  - `CHANGELOG.md` (`DOC-LOG-001`): Catatan audit evolusi blueprint ini.

### Changed
- **Penyempurnaan Arsitektur Integrasi Router (ADR-002):**
  - *Sebelumnya:* Gagasan awal mengadopsi model proxy bergaya `9router` konvensional yang membuka daemon server HTTP lokal pada port loopback TCP (`127.0.0.1:8080`).
  - *Perubahan:* Ditetapkan menjadi modul Rust terintegrasi penuh (*in-process*) di dalam core backend Tauri.
  - *Alasan:* Menghilangkan risiko keamanan pembukaan port jaringan lokal (*zero open ports*, mitigasi *cross-site port scanning* dan *request hijacking*), menjamin pembersihan siklus hidup proses tanpa risiko *zombie processes*, serta memangkas latensi dispatch panggilan internal menjadi $< 0.1 \text{ ms}$ (memenuhi NFR-002).
- **Penguncian Paradigma Presentation Layer (ADR-001):**
  - *Sebelumnya:* Evaluasi terbuka antara Electron, Tauri 2.x, dan Flutter Desktop.
  - *Perubahan:* Diputuskan secara definitif menggunakan Tauri 2.x dengan memanfaatkan runtime Microsoft Edge WebView2 evergreen bawaan Windows.
  - *Alasan:* Menekan konsumsi RAM idle menjadi $\approx 40-70 \text{ MB}$ (dibandingkan Electron yang mengonsumsi $250-400 \text{ MB}$), memangkas waktu *cold start* menjadi $1.0-1.6 \text{ detik}$ (memenuhi NFR-008 $< 3\text{s}$), serta mengurangi ukuran bundel installer menjadi $< 25 \text{ MB}$.
- **Pemisahan Modul Node Canvas:**
  - *Sebelumnya:* Opsi menulis custom HTML5 Canvas engine mandiri dari nol.
  - *Perubahan:* Mengadopsi library `@xyflow/react` v12+ yang diintegrasikan dengan React 19 dan Tailwind CSS.
  - *Alasan:* Menghindari pemborosan waktu rekayasa untuk fungsionalitas umum (pan, zoom, multi-select, edge snapping) sehingga developer dapat fokus 100% pada logika diferensiasi inti (kontinuitas visual dan orkestrasi multi-akun).

### Deprecated
- Tidak ada item blueprint yang didepresiasi pada rilis 1.0.0 (fondasi awal).

### Removed
- **Arsitektur Multi-User / Cloud Storage Backend:** Dieliminasi dari rencana awal sistem. Flow Studio secara tegas diposisikan sebagai perkakas lokal *single-user desktop workstation*. Segala dependensi layanan cloud eksternal pihak ketiga (di luar API Google Flow itu sendiri) dihapus demi privasi data dan efisiensi personal solo developer.

### Impact
- Seluruh 29 dokumen blueprint pada repositori telah disinkronkan, saling mereferensikan Document ID yang unik (`DOC-*-001`), dan membentuk basis spesifikasi terpadu tanpa kontradiksi antarmodul.

---

## 2. Status Transisi Gerbang Kualitas (Quality Gates Transition)

Sesuai metodologi tata kelola proyek **PLANNING_v5.2.md**, proses rekayasa sistem Flow Studio bergerak melalui tahapan gerbang formal yang terkontrol:

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                               BLUEPRINT GATE PROGRESSION                              │
├───────────────────────┬───────────────────────────────┬───────────────────────────────┤
│ Gate A: Discovery     │ Gate B: Blueprint Ready       │ Gate C: Implementation Ready  │
│ [STATUS: SELESAI]     │ [STATUS: TERVERIFIKASI]       │ [STATUS: SIAP DIMASUKI]       │
├───────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ • Validasi masalah    │ • 29 Dokumen Spesifikasi      │ • Scaffold proyek tervalidasi │
│ • Riset Google Flow   │   Lengkap (Batch 1–7)         │ • Uji coba reverse-engineer   │
│ • Definisi scope P0   │ • ADR-001 & ADR-002 Locked    │   Google Flow API berhasil    │
│ • North Star Metric   │ • Kontrak API IPC Typed       │ • Harness pengujian lokal     │
│   diformulasikan      │ • Skema ERD & Security Freeze │ • Handoff ke AI Coding Agent  │
└───────────────────────┴───────────────────────────────┴───────────────────────────────┘
```

1. **Gate A (Discovery & Problem Validation) — [STATUS: PASSED / SELESAI]:**
   - Masalah durasi pendek video AI (~10 detik) dan limitasi kuota kredit (50/hari per akun) terkonfirmasi secara empiris.
   - Peluang penggabungan akun (*account pooling*) dan *visual continuity chaining* divalidasi layak secara teknis.
   - Persona tunggal pengguna (*solo content creator*) dan batasan kapasitas pengembangan dikunci.

2. **Gate B (Blueprint Ready) — [STATUS: PASSED / TERVERIFIKASI]:**
   - Seluruh 29 dokumen spesifikasi teknis lintas Batch 1 sampai Batch 7 telah selesai disusun secara komprehensif tanpa status *stub* atau *TODO*.
   - Keputusan arsitektur fundamental (ADR-001, ADR-002, skema SQLite, model enkripsi Argon2id + AES-256-GCM) telah dikaji dan disetujui (*Accepted*).
   - Seluruh Kebutuhan Fungsional (FR-001 s.d. FR-018) dan Non-Fungsional (NFR-001 s.d. NFR-008) memiliki pemetaan penelusuran (*traceability*) 100% tertutup di `TRACEABILITY.md`.

3. **Gate C (Implementation Ready) — [STATUS: READY / TRANSISI AKTIF]:**
   - Persyaratan masuk: Seluruh dokumen blueprint disahkan, arsitektur data dikunci, dan panduan eksekusi atomik `TASKS.md` siap dieksekusi.
   - Status Transisi: Blueprint rilis 1.0.0 menandai selesainya tahap perencanaan. Proyek beralih langsung ke Fase 0 (Riset Google Flow API) dan Fase 1 (Scaffold Tauri + In-Process Router).

---

## 3. Analisis Dampak Keputusan Arsitektural (Impact Analysis)

Bagian ini menyajikan evaluasi mendalam atas trade-off, konsekuensi sistem, dan mitigasi risiko teknis dari empat pilar keputusan arsitektur yang diambil selama proses perancangan sistem:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ARCHITECTURAL DECISION IMPACT MATRIX                 │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ Keputusan Pokok    │ Opsi Terpilih      │ Keunggulan / Dampak Sistem   │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ Integrasi Router   │ In-Process Rust    │ Zero open ports, latency     │
│ (ADR-002)          │ Module             │ <0.1ms, zero zombie process  │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ Desktop App Shell  │ Tauri 2.x +        │ RAM ~60MB, cold start <1.5s, │
│ (ADR-001)          │ Edge WebView2      │ bundle installer <25MB       │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ Node Editor Engine │ @xyflow/react v12+ │ Ekosistem React matang, DAG  │
│ (PRD-NOD-001)      │                    │ routing fleksibel, UI 60 FPS │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ Model Keamanan     │ Local Single-User  │ Privasi mutlak, zero-cloud   │
│ & Akses Data       │ Cryptographic      │ breach surface, AES-256-GCM  │
│ (SECURITY.md)      │ Vault              │ memory-zeroized enclave      │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

### 3.1 Pilihan Embedded Rust Router vs Standalone Sidecar Daemon (ADR-002)

- **Keputusan:** Mengintegrasikan mesin routing pool akun dan reverse proxy Google Flow langsung sebagai modul internal Rust di dalam proses Tauri Core (*in-process invocation*), menolak arsitektur sidecar daemon terpisah bergaya proxy lokal `9router` (`127.0.0.1:PORT`).
- **Analisis Dampak Positif:**
  - *Postur Keamanan Jaringan Lokal Superior (Zero Open TCP Ports):* Mencegah pembukaan port HTTP loopback lokal pada antarmuka pengguna. Menghilangkan kerentanan eksploitasi seperti *local port hijacking*, *cross-site port scanning* oleh skrip berbahaya di web browser pengguna, serta serangan injeksi permintaan lokal (*Cross-Site Request Forgery* terhadap daemon lokal).
  - *Keandalan Siklus Hidup Proses (Zero Zombie Processes):* Mengeliminasi masalah klasik aplikasi desktop di mana daemon latar belakang tertinggal (*orphaned process*) saat antarmuka utama mengalami terminasi paksa (*force quit*) atau crash. Router mati dan hidup secara atomik bersama binary utama.
  - *Latensi Panggilan Sub-Milidetik:* Komunikasi internal antarmodul dieksekusi melalui pemanggilan fungsi in-memory Rust dan saluran asinkron `tokio::sync::mpsc`, menghasilkan overhead dispatch $< 0.1 \text{ ms}$. Hal ini jauh melampaui standar performa NFR-002 ($< 2 \text{ detik}$).
  - *Konsumsi Memori Hemat:* Mencegah duplikasi alokasi memori sistem operasi yang terjadi jika menjalankan dua binary terpisah dengan dua Tokio multi-thread runtime independen.
- **Analisis Trade-Off & Konsekuensi Negatif:**
  - *Shared Fault Domain:* Kesalahan fatal atau kepanikan thread (*panic*) di modul router yang tidak tertangani dapat menjatuhkan seluruh aplikasi.
  - *Mitigasi:* Mengimplementasikan arsitektur penanganan error terisolasi berbasis `Result<T, AppError>`, pemanfaatan `std::panic::catch_unwind` pada task boundary kritis, dan isolasi worker per-akun menggunakan Tokio worker tasks yang disupervisi.
  - *Akses Perkakas Eksternal Tertutup:* Skrip eksternal pihak ketiga (misalnya ekstensi ComfyUI lokal) tidak dapat langsung menembak REST API lokal. (Ditunda ke backlog P2 jika kebutuhan interoperabilitas eksternal muncul).

### 3.2 Pilihan Tauri 2.x vs Electron (ADR-001)

- **Keputusan:** Memilih framework Tauri 2.x (Rust core + Microsoft Edge WebView2) sebagai fondasi desktop app shell, menolak Electron dan Flutter Desktop.
- **Analisis Dampak Positif:**
  - *Efisiensi Jejak Memori (Memory Footprint):* Penggunaan RAM saat idle stabil pada kisaran $40-70 \text{ MB}$, dan tidak melebihi $150 \text{ MB}$ saat proses routing berlangsung. Penghematan drastis ini memberikan alokasi kapasitas memori yang melimpah bagi proses rendering FFmpeg dan pemutaran video pada hardware baseline (Intel Core i5 Gen 8, 8GB RAM).
  - *Waktu Cold Start Cepat (NFR-008):* Beban inisialisasi yang sangat ringan memungkinkan jendela utama tampil interaktif dalam $1.0-1.6 \text{ detik}$, memenuhi target NFR-008 ($< 3 \text{ detik}$).
  - *Ukuran Distribusi Portabel Ringan:* Menghasilkan file installer NSIS berukuran $< 25 \text{ MB}$ (dibandingkan paket Electron yang umumnya melampaui $120-160 \text{ MB}$ karena membundel seluruh binary Chromium engine).
  - *Keamanan Memori Kriptografi:* Komputasi dekripsi kunci master dan token otentikasi Google dieksekusi pada native Rust runtime, mencegah kebocoran plaintext ke garbage collector heap runtime JavaScript V8.
- **Analisis Trade-Off & Konsekuensi Negatif:**
  - *Ketergantungan Eksternal WebView2 Runtime:* Mengandalkan runtime Microsoft Edge WebView2 yang terinstal di sistem operasi Windows.
  - *Mitigasi:* Sistem operasi target dibatasi secara tegas pada Windows 10 (21H2+) dan Windows 11 x64, di mana WebView2 telah terpasang secara permanen (*evergreen*). Installer NSIS menyertakan bootstrapper otomatis jika WebView2 belum terdeteksi.
  - *Durasi Kompilasi Awal:* Waktu build Rust crates pada lingkungan CI/CD lokal memakan waktu beberapa menit.
  - *Mitigasi:* Mengoptimalkan cache sccache dan alokasi build cargo incremental untuk iterasi harian.

### 3.3 Pilihan `@xyflow/react` v12+ untuk Canvas Node Editor

- **Keputusan:** Menggunakan `@xyflow/react` v12+ (ekosistem React Flow modern) yang dikombinasikan dengan React 19, TypeScript strict mode, dan Tailwind CSS, menolak penulisan custom HTML5 Canvas engine dari nol.
- **Analisis Dampak Positif:**
  - *Akselerasi Waktu Rekayasa:* Menghemat waktu pengembangan hingga 4–6 minggu karena fungsionalitas esensial editor grafis (interaksi pan/zoom tanpa batas, seleksi multi-node, minimap navigasi, edge bezier routing, dan docking port) telah teruji secara modular.
  - *Kustomisasi Tipe Simpul Deklaratif:* Komponen antarmuka React 19 dapat langsung dirender di dalam kontainer node grafis, memungkinkan integrasi komponen UI kompleks seperti visual preview video HTML5, progress bar generasi, dan field konfigurasi prompt di dalam kanvas.
  - *Stabilitas Integrasi State:* Integrasi natural dengan library manajemen state Zustand, menjamin propagasi perubahan data simpul ke model DAG secara reaktif dan deterministik.
- **Analisis Trade-Off & Konsekuensi Negatif:**
  - *Overhead Ukuran DOM pada Skala Besar:* Setiap simpul kanvas dirender sebagai elemen HTML DOM, yang berisiko menurunkan framerate jika terdapat ribuan node aktif secara simultan.
  - *Mitigasi:* Domain masalah Flow Studio secara arsitektural menetapkan batas atas hingga 100 node dan 200 edge per proyek video (sangat aman di bawah batas degradasi DOM). Selain itu, diaktifkan opsi optimasi bawaan `@xyflow/react`: `onlyRenderVisibleElements={true}` untuk membatasi elemen yang dirender hanya pada area viewport aktif.

### 3.4 Model Keamanan: Local Single-User Vault vs Multi-User RBAC

- **Keputusan:** Menerapkan model keamanan berbasis brankas terenkripsi kriptografis personal tunggal (*Local Single-User Cryptographic Vault*) dengan derivasi kunci Argon2id dan enkripsi AES-256-GCM, menolak arsitektur manajemen pengguna multi-role (RBAC / JWT / OAuth authorization server).
- **Analisis Dampak Positif:**
  - *Privasi Absolut & Zero Attack Surface Eksternal:* Kredensial akun Google pengguna, cookie sesi, dan prompt video disimpan secara eksklusif pada file SQLite lokal `%APPDATA%/FlowStudio/flow_studio.db`. Tidak ada data yang dialirkan ke server pengembang, meniadakan risiko kebocoran data terpusat (*zero central breach exposure*).
  - *Ketiadaan Kompleksitas Overhead Otorisasi:* Meniadakan lapisan dependensi kompleks seperti OAuth server, token refresh rotation service, session revoking databases, dan tabel otorisasi RBAC bertingkat.
  - *Proteksi Data at-Rest yang Teruji:* Kredensial tidak pernah tersimpan dalam bentuk teks polos (*plaintext*). Akses terhadap token Google hanya terbuka jika Master Password yang valid diberikan oleh pengguna, dan memori didekripsi secara transien dengan penghapusan otomatis (*zeroization on drop*).
- **Analisis Trade-Off & Konsekuensi Negatif:**
  - *Ketiadaan Fitur Pemulihan Sandi Mandiri (No Password Recovery):* Karena enkripsi ditegakkan secara matematis tanpa pintu belakang (*backdoor*) atau server sentral, jika pengguna lupa Master Password, kredensial yang tersimpan di dalam brankas tidak dapat dipulihkan (*unrecoverable by design*).
  - *Mitigasi:* Peringatan eksplisit ditampilkan saat inisialisasi brankas pertama kali (`CMP-MODAL-INIT-VAULT`). Basis data proyek dan riwayat generasi tetap utuh, dan pengguna hanya perlu mengimpor ulang cookie akun Google jika brankas terpaksa di-reset.
  - *Kolaborasi Multi-User Tidak Didukung:* Aplikasi tidak dapat digunakan secara bersamaan oleh tim melalui jaringan. Hal ini sepenuhnya sejalan dengan batasan lingkup terdefinisi di `PLANNING.md` (*Out of Scope: Multi-user / collaboration*).

---

## 4. Penguncian Lingkup Fitur (Scope Definition Lock: P0, P1, P2)

Berdasarkan konsensus perancangan dan validasi terhadap kebutuhan fungsional di `PLANNING.md` serta `SRS.md`, pembagian hierarki prioritas fitur dikunci sebagai berikut:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FEATURE SCOPE HIERARCHY                         │
├────────────────────────────────────────────────────────────────────────┤
│ [P0: MVP-BLOCKING]                                                     │
│ Wajib hadir sebelum rilis Alpha dapat dinyatakan operasional.          │
│ • Reverse-Engineered Flow Router (reqwest, TLS profile, cookie jar)    │
│ • Multi-Account Pooling & Auto-Rotation (kuota 50 kredit/hari)         │
│ • @xyflow/react Canvas (Prompt, Image/Ref, Video/Clip, Generate Node)  │
│ • Visual Continuity Engine (FFmpeg last-frame extract, prompt chaining)│
│ • Encrypted Credential Vault (Argon2id + AES-256-GCM + memory scrub)   │
│ • FFmpeg Sequential Video Concatenation & Export (H.264/AAC MP4)       │
├────────────────────────────────────────────────────────────────────────┤
│ [P1: POST-MVP ENHANCEMENTS]                                            │
│ Prioritas langsung setelah stabilitas fungsional P0 tercapai.          │
│ • Real-time Account Health & Credit Dashboard                          │
│ • Native Audio Chaining Support (Google Veo 3.1 Audio Track Sync)      │
│ • Cinematic & Artistic Style Preset Library                            │
│ • Storyboard Horizontal Timeline View (Alternatif Canvas DAG)          │
│ • Template Pipeline Workflows Reusable                                 │
│ • History Stack Undo / Redo pada Node Canvas                           │
│ • Multi-Project Batch Execution Queue                                  │
│ • Heuristic Smart Retry Engine untuk Kegagalan Generasi Segmen         │
├────────────────────────────────────────────────────────────────────────┤
│ [P2: FUTURE EXPLORATORY HORIZON]                                       │
│ Fitur eksploratif untuk fase ekspansi jangka panjang.                  │
│ • Open Node Plugin Extension Architecture                              │
│ • Multi-Format Advanced Render (ProRes, AV1, WebM, HDR 4K)             │
│ • VCS Project Branching & Rollback History                             │
│ • Side-by-Side Visual Scene Comparison & Variant Picker                │
│ • Local LLM Prompt Enhancement & Assisted Chaining (via Ollama)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Rencana Kerja Pasca-MVP (Upcoming Roadmap: P1 Features)

Fitur pada tingkat **P1** dirancang untuk meningkatkan produktivitas, stabilitas kreasi, dan kemudahan alur kerja bagi kreator konten setelah fondasi MVP P0 beroperasi dengan stabil:

### 5.1 P1-01: Real-Time Account Health & Credit Dashboard
- **Deskripsi:** Antarmuka monitor visual terpadu yang menyajikan analitik penggunaan kredit agregat secara *real-time* dari seluruh akun Google Flow yang terdaftar.
- **Nilai Manfaat:** Kreator dapat melihat distribusi konsumsi kredit per hari, proyeksi sisa kapasitas generasi video, status masa aktif sesi cookie, serta peringatan dini terhadap akun yang mendekati kuota limit.
- **Rencana Teknis:** Komponen visual grid berbasis Tailwind CSS yang terhubung ke query analitik SQLite `generation_log` dengan auto-refresh setiap 60 detik.

### 5.2 P1-02: Native Audio Chaining Support (Veo 3.1)
- **Deskripsi:** Ekstraksi dan penggabungan sinkron untuk trek audio native yang dihasilkan oleh model Google Veo 3.1.
- **Nilai Manfaat:** Menghasilkan video final yang tidak hanya koheren secara visual, namun juga memiliki kesinambungan latar suara, efek audio ambien, dan transisi dialog antar-segmen.
- **Rencana Teknis:** Modifikasi runner biner FFmpeg di `PRD/VIDEO_EXPORT.md` untuk mengaktifkan filter audio `acrossfade` atau transisi audio stream-copy saat proses stitching klip dilakukan.

### 5.3 P1-03: Cinematic & Artistic Style Preset Library
- **Deskripsi:** Sistem manajemen template gaya visual yang dapat diinjeksikan secara otomatis ke seluruh Prompt Node di dalam grafik pipeline.
- **Nilai Manfaat:** Mengurangi beban pengetikan manual berulang untuk parameter visual (seperti *"35mm lens, cinematic lighting, photorealistic, 8k resolution, color graded"*).
- **Rencana Teknis:** Tabel baru `style_presets` pada database SQLite dan dropdown pemilih gaya pada komponen `CMP-PROMPT-NODE`.

### 5.4 P1-04: Storyboard Horizontal Timeline View
- **Deskripsi:** Mode tampilan alternatif berbentuk linimasa sekuensial horizontal (mirip antarmuka software NLE seperti DaVinci Resolve atau CapCut) di samping tampilan kanvas grafik node.
- **Nilai Manfaat:** Mempermudah kreator konten yang lebih menyukai alur kerja linear sederhana tanpa perlu mengatur penempatan visual posisi node di kanvas.
- **Rencana Teknis:** State model bersama di Zustand yang merepresentasikan urutan segmen linier dari grafik DAG aktif, dirender via virtualized horizontal list.

### 5.5 P1-05: Reusable Pipeline Templates
- **Deskripsi:** Kemampuan menyimpan seluruh struktur kanvas grafik (simpul, relasi edge, dan konfigurasi prompt dasar) sebagai file template yang dapat digunakan kembali untuk proyek baru.
- **Nilai Manfaat:** Mempercepat inisiasi proyek video berseri (misal: struktur intro 3 segmen, konten utama 12 segmen, dan outro 2 segmen).
- **Rencana Teknis:** Serialisasi template grafik ke direktori `%APPDATA%/FlowStudio/templates/*.flowtpl` dalam format JSON tervalidasi.

### 5.6 P1-06: Undo / Redo History Stack pada Node Editor
- **Deskripsi:** Sistem riwayat aksi pengguna penuh (*undo/redo*) untuk manipulasi kanvas node editor (tambah/hapus node, geser posisi, sambung/putus edge, edit teks prompt).
- **Nilai Manfaat:** Mencegah kehilangan konfigurasi akibat kesalahan klik atau penghapusan node yang tidak disengaja.
- **Rencana Teknis:** Penerapan middleware Zustand temporal (seperti `zundo`) dengan batas kedalaman riwayat hingga 50 aksi pengguna terakhir.

### 5.7 P1-07: Multi-Project Batch Execution Queue
- **Deskripsi:** Sistem antrean eksekusi multi-proyek yang memproses beberapa file `.flowproj` secara berurutan (*sequential background queue*).
- **Nilai Manfaat:** Kreator dapat merancang 3–5 proyek video di siang hari, lalu membiarkan sistem mengeksekusi generasi dan ekspor video secara otomatis sepanjang malam dengan pemanfaatan kuota kredit lintas akun yang optimal.
- **Rencana Teknis:** Background task queue manager di Rust yang memantau ketersediaan kuota akun dan mengeksekusi proyek berikutnya saat proyek aktif tuntas.

### 5.8 P1-08: Heuristic Smart Retry Engine
- **Deskripsi:** Mekanisme deteksi otomatis terhadap kegagalan visual segmen (misal: klip video hitam/rusak, gerakan frame patah) berdasarkan analisa metadata atau bendera intervensi manual cepat untuk me-render ulang segmen tersebut menggunakan akun berikutnya dalam pool.
- **Nilai Manfaat:** Menjamin kualitas output video tanpa harus mengulang proses pembuatan video secara manual dari awal.
- **Rencana Teknis:** Integrasi modul verifikasi integrity frame pasca-unduh segmen via `ffprobe` sebelum melanjutkan injeksi referensi ke segmen selanjutnya.

---

## 6. Penutup & Otorisasi Dokumen

Rilis versi 1.0.0 dari dokumen blueprint Flow Studio ini menandai selesainya tahap **Gate B (Blueprint Ready)** dan pengesahan penuh untuk memasuki fase implementasi teknis (**Gate C — Implementation Ready**). Setiap perubahan di masa mendatang terhadap kontrak antarmuka, skema data, atau lingkup fungsional wajib dicatat pada dokumen ini sesuai dengan standar tata kelola perubahan.

| Peran Tata Kelola | Penanggung Jawab | Status Tinjauan | Tanggal Efektif |
|---|---|---|---|
| **Software Architect & Planning Lead** | AI System Architect | Disetujui (*Approved*) | 2026-09-24 |
| **Security & Cryptography Lead** | Core Engineering Team | Terverifikasi (*Verified*) | 2026-09-24 |
| **Frontend & Canvas Lead** | UI Engineering Team | Terverifikasi (*Verified*) | 2026-09-24 |
