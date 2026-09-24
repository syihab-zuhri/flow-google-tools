# PRD Index: Flow Studio Feature Directory

> **Project:** Flow Studio
> **Document ID:** DOC-PRD-IDX-001
> **Version:** 1.0.0
> **Status:** Draft
> **Owner:** Software Architect & Planning Lead
> **Last Updated:** 2026-09-24
> **Depends On:** DOC-SRS-001
> **Supersedes:** None

---

## 1. Pendahuluan & Ringkasan Eksekutif

Dokumen ini berfungsi sebagai **Master Directory & Index** untuk seluruh spesifikasi *Product Requirements Document* (PRD) pada sistem **Flow Studio** (*Flow Chainer*). PRD mendefinisikan secara mendalam perilaku produk, user workflow, boundary conditions, edge cases, interaksi antarmuka (UI/UX), hingga kontrak fungsional tiap fitur yang diturunkan langsung dari Dokumen Kebutuhan Sistem (**DOC-SRS-001**) dan Rencana Produk (**DOC-PLAN-001**).

### 1.1 Tujuan Index
1. **Peta Navigasi Sentral:** Menyediakan akses terstruktur ke seluruh dokumen PRD aktif (P0) maupun PRD yang ditangguhkan (*deferred* P1/P2).
2. **Kesesuaian Ruang Lingkup (Scope Boundary):** Memastikan batas fitur antara MVP (*Minimum Viable Product*) dan pasca-MVP terdefinisi dengan ketat tanpa kebocoran cakupan (*scope creep*).
3. **Penyelarasan Arsitektur & Traceability:** Menyambungkan setiap Product Feature ID (`FEAT-*`) ke Functional Requirement ID (`FR-*`), skema database (`ERD.md`), API contract (`API.md`), dan skenario pengujian (`TEST-*`).

---

## 2. Konvensi Penamaan & Standar Dokumen

| Entitas | Pola Penamaan | Contoh | Penjelasan |
|---|---|---|---|
| **Feature ID** | `FEAT-[MODULE_KEY]` | `FEAT-ACCOUNT_POOL` | Pengenal unik fitur pada level arsitektur dan bisnis. |
| **Document ID** | `DOC-PRD-[SUBKEY]-001` | `DOC-PRD-ACT-001` | Nomor registrasi formal dokumen pada repositori proyek. |
| **File Path** | `PRD/[UPPER_SNAKE_CASE].md` | `PRD/ACCOUNT_POOL.md` | Lokasi berkas fisik Markdown di dalam direktori `PRD/`. |
| **Index File** | `PRD/_INDEX.md` | `DOC-PRD-IDX-001` | Dokumen indeks utama yang memuat katalog seluruh PRD. |

---

## 3. Matriks Direktori Dokumen PRD (P0 Core MVP)

Fitur-fitur P0 berikut merupakan kapabilitas inti yang wajib hadir pada Milestone MVP. Ketiadaan salah satu fitur di bawah ini akan menggagalkan proposisi nilai utama (*value proposition*) Flow Studio.

| Feature ID | PRD File | Document ID | Prioritas | Status Spesifikasi | Cakupan Utama | SRS Traceability |
|---|---|---|---|---|---|---|
| **FEAT-ACCOUNT_POOL** | [`PRD/ACCOUNT_POOL.md`](./ACCOUNT_POOL.md) | `DOC-PRD-ACT-001` | **P0 (MVP-Blocking)** | ⏳ In Progress | Multi-account session management, cookie import, health check, kuota harian/bulanan, rotasi otomatis akun saat credit exhausted. | FR-001, FR-002, FR-003, FR-004, FR-005 |
| **FEAT-NODE_EDITOR** | [`PRD/NODE_EDITOR.md`](./NODE_EDITOR.md) | `DOC-PRD-NOD-001` | **P0 (MVP-Blocking)** | ⏳ Pending | Visual node canvas (@xyflow/react), port typing, edge connection, Prompt Node, Reference Image Node, Video Node, graph serialization (.flowproj). | FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017, FR-018 |
| **FEAT-CONTINUITY_ENGINE** | [`PRD/CONTINUITY_ENGINE.md`](./CONTINUITY_ENGINE.md) | `DOC-PRD-CNT-001` | **P0 (MVP-Blocking)** | ✅ Draft Ready | Automasi sequential execution, frame extraction via FFmpeg (`-sseof -1`), auto-inject last-frame reference, prompt carry-over window, visual style locking. | FR-020, FR-021, FR-022, FR-023, FR-024 |
| **FEAT-VIDEO_EXPORT** | [`PRD/VIDEO_EXPORT.md`](./VIDEO_EXPORT.md) | `DOC-PRD-EXP-001` | **P0 (MVP-Blocking)** | ⏳ Pending | FFmpeg concatenation (concat demuxer), audio stream merge, video stitching tanpa transcode re-encoding jika format match, transcode MP4/WEBM, preset resolusi. | FR-030, FR-031, FR-032, FR-033 |
| **FEAT-CREDENTIAL_VAULT** | Terintegrasi via `PERMISSION.md` & `PRD/ACCOUNT_POOL.md` | `DOC-PRD-SEC-001` | **P0 (MVP-Blocking)** | ⏳ Pending | Master password lifecycle, Argon2id key derivation, AES-256-GCM encryption untuk session cookies di SQLite, in-memory key scrubbing, auto-lock timeout. | FR-040, FR-041, FR-042 |

---

## 4. Rincian Fitur P0 (Core MVP Scope)

### 4.1 FEAT-ACCOUNT_POOL (Multi-Account Session & Credit Routing)
- **Document Reference:** `PRD/ACCOUNT_POOL.md` (`DOC-PRD-ACT-001`)
- **Tanggung Jawab Teknis:** Modul Rust Backend (`flow-router`) & React Management Modal.
- **Fungsi Utama:**
  1. **Session Ingestion:** Import Google session token/cookies via raw string atau JSON array (hasil export ekstensi browser).
  2. **Active Credit Monitoring:** Tracking sisa kuota harian (*daily credits*) dan bulanan (*monthly tier credits*) dari upstream Google Flow.
  3. **Seamless Failover & Auto-Rotation:** Pemilihan akun aktif otomatis berdasarkan ketersediaan kredit tertinggi atau urutan prioritas yang diatur user. Jika akun aktif *exhausted* (kuota habis/429), router mengalihkan request segmen berikutnya ke akun kedua secara transparan tanpa menghentikan pipeline.
  4. **Health Check Daemon:** Validasi keaktifan session token saat aplikasi dibuka dan sesaat sebelum pipeline dimulai.

### 4.2 FEAT-NODE_EDITOR (Node Canvas, Edge Routing, Pipeline Graph)
- **Document Reference:** `PRD/NODE_EDITOR.md` (`DOC-PRD-NOD-001`)
- **Tanggung Jawab Teknis:** Frontend React 19, `@xyflow/react` v12+, Zustand Graph Store.
- **Fungsi Utama:**
  1. **Infinite Workspace:** Canvas dengan dukungan pan, zoom, grid snapping, multi-selection, dan minimap.
  2. **Typed Node System:**
     - **Prompt Node:** Text prompt input, macro variables (`{segment_index}`, `{previous_context}`), character counter.
     - **Image/Reference Node:** Thumbnail preview, asset dropzone, aspect ratio picker.
     - **Video/Clip Node:** Input media klip referensi atau preview output segmen hasil render.
     - **Generation Node:** Endpoint konfigurasi model Google Flow (Gemini Omni, Veo 3.1, Nano Banana), seed control, generation trigger.
  3. **Edge Validation & Routing:** Aturan koneksi strict (port tipe gambar hanya ke input referensi gambar; output video segmen N ke input konteks segmen N+1).
  4. **Project Graph Persistence:** Simpan dan muat graf pipeline dalam format file `.flowproj` berbasis JSON dengan asset path relatif.

### 4.3 FEAT-CONTINUITY_ENGINE (Frame Extraction, Context Chaining, Style Lock)
- **Document Reference:** `PRD/CONTINUITY_ENGINE.md` (`DOC-PRD-CNT-001`)
- **Tanggung Jawab Teknis:** Tauri Orchestrator, Rust Sidecar worker, FFmpeg binary wrapper.
- **Fungsi Utama:**
  1. **Deterministic Sequential Chaining:** Memastikan segmen ke-$N$ berstatus `COMPLETE` sebelum memicu eksekusi segmen ke-$(N+1)$.
  2. **Automatic Frame Extraction:** Memanggil perintah FFmpeg headless untuk mengekstrak frame milidetik terakhir dari video segmen $N$ (`-sseof -1 -frames:v 1`) ke file PNG tanpa penurunan resolusi.
  3. **Context Injection:** Menyuntikkan frame hasil ekstraksi sebagai *reference image* request API pada segmen $(N+1)$.
  4. **Prompt Carry-Over:** Menggabungkan teks prompt dari 3 segmen terakhir secara bergulir (*sliding context window*) untuk menjaga continuity narasi.
  5. **Global Style Lock:** Menempelkan deskriptor visual persisten (misal: `"35mm cinematic film grain, volumetric lighting, photorealistic"`) ke setiap prompt segmen secara otomatis.

### 4.4 FEAT-VIDEO_EXPORT (FFmpeg Concatenation, Transcode, Export)
- **Document Reference:** `PRD/VIDEO_EXPORT.md` (`DOC-PRD-EXP-001`)
- **Tanggung Jawab Teknis:** FFmpeg Core Driver, File System Exporter, Video Player Component.
- **Fungsi Utama:**
  1. **Concatenation Demuxer Engine:** Menggabungkan file video individual dari masing-masing node segmen secara berurutan menjadi satu berkas video utuh berdurasi panjang.
  2. **Zero-Loss Stitching:** Melakukan stream-copy (`-c copy`) jika seluruh segmen memiliki codec, resolusi, dan timebase yang identik untuk menghemat waktu rendering.
  3. **Transcode Pipeline:** Opsi transcode ke format MP4 (H.264 / AAC) atau WebM (VP9 / Opus) dengan pilihan target resolusi (720p, 1080p, atau Original).
  4. **Stitch Preview & Segment Markers:** Pratinjau video gabungan dengan indikator visual penanda sambungan (*junction points*) antar segmen pada seekbar.

### 4.5 FEAT-CREDENTIAL_VAULT (Master Password & AES-256-GCM Encryption)
- **Document Reference:** `PERMISSION.md` (`DOC-PERM-001`) & `SECURITY.md` (`DOC-SEC-001`), terhubung ke `PRD/ACCOUNT_POOL.md`
- **Tanggung Jawab Teknis:** Rust Crypto Subsystem (`ring` / `aes-gcm`, `argon2`).
- **Fungsi Utama:**
  1. **Master Password Authentication:** Verifikasi identitas lokal tanpa hardcoded backdoor. Jika lupa master password, vault harus di-reset sepenuhnya untuk menjamin zero-knowledge.
  2. **Cryptographic Key Derivation:** Menggunakan Argon2id (memory: 64 MB, iterations: 3, parallelism: 1) untuk menghasilkan 256-bit Key Encryption Key (KEK).
  3. **AES-256-GCM Data Protection:** Setiap entri cookie/token dienkripsi dengan 96-bit nonce acak dan 128-bit authentication tag sebelum disimpan ke SQLite lokal.
  4. **Auto-Lock & Key Zeroization:** Memori kunci enkripsi di-zeroize (`secrecy` / `zeroize`) setelah 15 menit user idle.

---

## 5. Fitur P1 — PRD Deferred (Post-MVP Specifications)

Fitur-fitur kategori **P1** telah disetujui dalam roadmap produk (`PLANNING.md`), namun penulisan dokumen spesifikasi PRD individualnya **ditangguhkan (*deferred*)** hingga fase implementasi P0 selesai dan terverifikasi di Gate C.

| ID | Fitur | Kategori | Ringkasan Fungsionalitas | Kriteria Pemicu Penulisan PRD (Activation Trigger) |
|---|---|---|---|---|
| **P1-01** | **Credit Dashboard** | Monitoring / UI | Tampilan visual analitik kuota terpusat: grafik konsumsi kredit harian, estimasi sisa waktu produksi, dan breakdown per model AI. | Setelah `FEAT-ACCOUNT_POOL` stabil dan endpoint credit usage telemetri tersedia di Rust router. |
| **P1-02** | **Audio Support** | Media Engine | Pemanfaatan kemampuan audio generation native (Veo 3.1) dan multiplexing audio track langsung ke hasil video. | Setelah Google Flow endpoint secara resmi mengembalikan stream audio tersinkronisasi. |
| **P1-03** | **Style Presets** | Pipeline / UX | Pustaka gaya siap pakai (Cinematic, Anime Shonen, 90s VHS, Hyper-realistic 3D) yang dapat diterapkan sekali klik ke seluruh node. | Pasca validasi konsistensi visual `FEAT-CONTINUITY_ENGINE` pada MVP. |
| **P1-04** | **Storyboard View** | Editor Canvas | Tampilan linear berbasis kartu adegan horisontal sebagai alternatif kanvas graf node bagi pengguna non-teknis. | Setelah struktur data graph (`.flowproj`) di-decouple sepenuhnya dari library layout canvas. |
| **P1-05** | **Template Pipeline** | Proyek / Workflow | Kemampuan menyimpan dan membagikan struktur graf pipeline (contoh: "5-Scene Narrative Hook") sebagai reusable blueprint. | Ketika skema serialization JSON pada `FEAT-NODE_EDITOR` mencapai versi stabil v1.0. |
| **P1-06** | **Undo/Redo History** | Editor Canvas | History stack lengkap untuk penambahan, penghapusan, dan pengubahan posisi node/edge di canvas. | Implementasi Zustand undo/redo middleware pada store frontend. |
| **P1-07** | **Batch Queue** | Pipeline Orchestration| Antrean multi-proyek untuk merender beberapa berkas `.flowproj` berturut-turut tanpa intervensi manual pengguna. | Setelah single pipeline execution daemon di Rust backend terbukti memory-leak free. |
| **P1-08** | **Smart Retry** | AI Continuity | Otomasi deteksi artefak/glitch atau regenerasi otomatis segmen jika status API gagal atau frame drop terdeteksi. | Evaluasi kebutuhan metrik kualitas video pasca rilis MVP. |

---

## 6. Diagram Aliran Data & Ketergantungan Fitur (Feature Dependency Graph)

```
[ Master Password Unlock ]
           │
           ▼
┌─────────────────────────┐
│  FEAT-CREDENTIAL_VAULT  │ ──(Decrypt Cookies)──┐
└─────────────────────────┘                      │
                                                 ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│    FEAT-NODE_EDITOR     │           │    FEAT-ACCOUNT_POOL    │
│  - Prompt Node          │           │  - Active Token Rotary  │
│  - Reference Node       │           │  - Quota Health Monitor │
│  - Graph Sequence (.fp) │           └─────────────────────────┘
└───────────┬─────────────┘                        │
            │ (Pipeline Graph Definition)          │ (Authenticated Session)
            ▼                                      ▼
┌───────────────────────────────────────────────────────────────┐
│                   FEAT-CONTINUITY_ENGINE                      │
│  1. Dispatch Generation (Segment N)                           │
│  2. Download & Persist Video Segment                          │
│  3. FFmpeg Headless Extract Final Frame (-sseof -1)           │
│  4. Inject Frame + Prompt Carry-Over -> Segment N+1           │
└───────────────────────────────┬───────────────────────────────┘
                                │ (All Segments Complete)
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                      FEAT-VIDEO_EXPORT                        │
│  - Concat Demuxer Assembly (Stitch Segments 1..N)             │
│  - Audio Track Alignment & Optional Resolution Transcode      │
│  - Final Output (.mp4 / .webm) Export to File System          │
└───────────────────────────────────────────────────────────────┘
```

---

## 7. Standar Struktur Berkas PRD

Setiap berkas spesifikasi fitur individual (`PRD/[FEATURE_NAME].md`) yang dibuat wajib mematuhi kerangka bab baku berikut:

1. **Document Header Block:** Format standar (Project, Document ID, Version, Status, Owner, Last Updated, Depends On, Supersedes).
2. **Overview & Business Value:** Latar belakang fitur, problem statement, dan proposisi nilai.
3. **User Stories & Personas:** Format *"Sebagai [Role], saya ingin [Aksi], sehingga [Manfaat]"*.
4. **Functional Specifications (Deep Dive):** Rincian tiap requirement, input-output logic, boundary conditions, dan edge case handling.
5. **UI/UX & Component Specifications:** Interaksi visual, state machine (idle, loading, error, success), keyboard shortcuts, dan referensi DSD.
6. **Data Models & State Transitions:** Aturan validasi entitas, skema tabel SQLite terkait, atau Zustand state shape.
7. **IPC & External Interfaces:** Command Tauri yang dipanggil dan struktur payload request/response.
8. **Error Handling & Failure Modes:** Tabel skenario kegagalan, pesan error ramah pengguna (*humanized errors*), dan strategi mitigasi/recovery.
9. **Acceptance Criteria & Verification Plan:** Kriteria uji lulus (Gherkin style / Given-When-Then) yang berkorelasi dengan `TESTING.md`.

---

## 8. Matriks Keterlacakan Komprehensif (Traceability Matrix)

| Feature PRD | SRS Ref | ERD Table Ref | Tauri IPC / API Endpoint | Security & Permission | Test Case Suite |
|---|---|---|---|---|---|
| **FEAT-ACCOUNT_POOL** | FR-001 s/d FR-005 | `accounts`, `credit_logs` | `cmd_account_list`, `cmd_account_import`, `cmd_account_delete`, `cmd_account_health_check` | Auth Unlock Required, Rate-limiting per account | `TEST-ACC-001` s/d `TEST-ACC-005` |
| **FEAT-NODE_EDITOR** | FR-010 s/d FR-018 | `projects`, `nodes`, `edges` | `cmd_project_save`, `cmd_project_load`, `cmd_asset_import` | Local filesystem sandboxing | `TEST-NOD-010` s/d `TEST-NOD-018` |
| **FEAT-CONTINUITY_ENGINE**| FR-020 s/d FR-024 | `pipeline_runs`, `segments` | `cmd_pipeline_start`, `cmd_pipeline_pause`, `cmd_pipeline_status` | Process isolation, Safe temp file retention | `TEST-CNT-020` s/d `TEST-CNT-024` |
| **FEAT-VIDEO_EXPORT** | FR-030 s/d FR-033 | `export_jobs` | `cmd_export_concat`, `cmd_export_cancel`, `cmd_export_preview` | Sanitized FFmpeg CLI args, disk space guard | `TEST-EXP-030` s/d `TEST-EXP-033` |
| **FEAT-CREDENTIAL_VAULT** | FR-040 s/d FR-042 | `vault_meta`, `credentials` | `cmd_vault_init`, `cmd_vault_unlock`, `cmd_vault_lock`, `cmd_vault_status` | Argon2id + AES-256-GCM, in-memory zeroization | `TEST-SEC-040` s/d `TEST-SEC-042` |

---

## 9. Governance & Siklus Pembaruan Dokumen

1. **Review Frequency:** Dokumen Index ini ditinjau setiap awal iterasi *sprint* atau saat terjadi perubahan prioritas di `PLANNING.md`.
2. **Approval Gate:** Penambahan atau perubahan fitur P0 memerlukan persetujuan dari *Software Architect & Planning Lead*.
3. **P1 Activation Protocol:** Fitur P1 yang akan dipromosikan ke tahap implementasi harus melewati pembuatan dokumen PRD lengkap di direktori `PRD/` dengan menaikkan status dokumen pada berkas index ini.
