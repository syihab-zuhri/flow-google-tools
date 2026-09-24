# SRS: Flow Studio — Software Requirements Specification

> **Document ID:** DOC-SRS-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-PLAN-001 (PLANNING.md), DOC-MANIFEST-001 (PROJECT_MANIFEST.md)  
> **Contract:** PLANNING v5.2

---

## 1. Product Context

### 1.1 Deskripsi Produk

Flow Studio adalah aplikasi desktop Windows yang memungkinkan pembuatan video AI berdurasi panjang (3–5 menit) dengan cara menyambung (chaining) segmen video 10 detik yang dihasilkan oleh Google Flow. Aplikasi ini mengatasi keterbatasan Google Flow yang hanya menghasilkan klip pendek per request dengan menyediakan pipeline visual berbasis node editor untuk mengatur urutan generasi, menjaga kontinuitas visual antar segmen, dan mengekspor hasil akhir sebagai satu video utuh.

### 1.2 Problem Statement

Google Flow menghasilkan video AI berkualitas tinggi namun dibatasi maksimal 10 detik per generasi. Pembuatan video panjang secara manual memerlukan proses berulang: generate segmen → unduh → ekstrak frame terakhir → unggah kembali sebagai referensi → tulis prompt lanjutan → generate segmen berikutnya. Proses ini memakan waktu, rentan inkonsistensi visual, dan tidak scalable untuk produksi konten reguler.

### 1.3 Value Proposition

- **Otomasi pipeline**: Eliminasi proses manual berulang melalui sequential pipeline execution.
- **Kontinuitas visual**: Frame extraction + style lock menjaga konsistensi antar segmen tanpa intervensi manual.
- **Multi-account pooling**: Rotasi otomatis antar akun Google Flow untuk memaksimalkan kuota kredit harian.
- **Visual pipeline builder**: Node editor intuitif untuk merancang alur generasi video secara visual.

### 1.4 Scope Produk

- **Tipe aplikasi:** Desktop app, single-user, offline-capable (kecuali saat generate video).
- **Platform target:** Windows 10/11 x64.
- **Penggunaan:** Personal tool — bukan SaaS, tidak ada multi-user, tidak ada server deployment.
- **Distribusi:** Portable executable atau installer lokal.

---

## 2. System Boundary

### 2.1 Diagram Batas Sistem

```
┌──────────────────────────────────────────────────────────────┐
│                      FLOW STUDIO (Tauri 2.x)                 │
│  ┌──────────────────────┐    ┌─────────────────────────────┐ │
│  │   React 19 Frontend  │    │     Rust Backend             │ │
│  │   @xyflow/react       │◄──►│     flow-router module      │ │
│  │   Zustand state mgmt │    │     SQLite + AES-256-GCM     │ │
│  │   Video preview       │    │     FFmpeg orchestration     │ │
│  └──────────────────────┘    └──────────┬──────────────────┘ │
│                                         │                     │
└─────────────────────────────────────────┼─────────────────────┘
                                          │
                    ┌─────────────────────┼──────────────────────┐
                    │                     │                      │
           ┌────────▼───────┐   ┌────────▼───────┐   ┌─────────▼──────┐
           │ Google Flow    │   │  FFmpeg         │   │  Local          │
           │ Backend (HTTP) │   │  (CLI binary)   │   │  Filesystem     │
           │ + Playwright   │   │                 │   │                 │
           │   fallback     │   │                 │   │                 │
           └────────────────┘   └─────────────────┘   └────────────────┘
```

### 2.2 Trust Boundaries

| Boundary | Inside | Outside | Risiko |
|---|---|---|---|
| Credential vault | Encrypted SQLite store | Plaintext memory saat decrypt | Memory dump exposure |
| Network boundary | Tauri process | Google Flow backend | Session hijacking, API throttle |
| Filesystem boundary | Project directory | System directories | Path traversal pada file import |
| IPC boundary | React frontend | Rust backend via Tauri commands | Command injection via malformed IPC |

---

## 3. Actors dan External Systems

### 3.1 Actors

| Actor | Tipe | Deskripsi |
|---|---|---|
| Owner | Human (sole user) | Satu-satunya pengguna aplikasi. Membangun pipeline video, mengelola akun, mengekspor hasil. Tidak ada role lain — ini personal tool. |

### 3.2 External Systems

| System | Tipe | Protokol | Deskripsi |
|---|---|---|---|
| Google Flow Backend | External service | HTTPS (reverse-engineered API) | Menerima prompt + referensi, menghasilkan video 10 detik. Primary integration via HTTP request langsung. |
| Playwright Headless Browser | Fallback integration | Browser automation | Fallback bila reverse-engineered HTTP endpoint berubah atau terblokir. Mengoperasikan Google Flow via headless browser. |
| FFmpeg | Local system tool | CLI subprocess | Digunakan untuk frame extraction, video concatenation, format conversion, dan transcoding. Harus tersedia di PATH atau bundled. |
| Local Filesystem | Local system | OS file API | Penyimpanan project files, generated video assets, dan credential vault. |

---

## 4. Functional Requirements

### 4.1 Account Management

| ID | Requirement | Priority | Source | Dependencies | Verification Method |
|---|---|---|---|---|---|
| FR-001 | Sistem menerima penambahan akun Google Flow melalui import cookie/session data. Owner mem-paste atau memuat file cookie yang diekstrak dari browser. Sistem memvalidasi session dan menyimpan credential terenkripsi ke vault. | P0 | Owner | FR-040, FR-041 | Test: Import cookie valid → akun muncul di daftar dengan status "Active". Import cookie invalid → error message ditampilkan, tidak ada data tersimpan. |
| FR-002 | Sistem menghapus akun Google Flow dari vault. Penghapusan mencakup credential, cached credit data, dan session state. Operasi irreversible dengan konfirmasi dialog. | P0 | Owner | FR-001 | Test: Hapus akun → credential terhapus dari SQLite, tidak recoverable. Konfirmasi dialog muncul sebelum eksekusi. |
| FR-003 | Sistem menampilkan sisa kredit per akun: kuota harian dan kuota bulanan. Data diambil dari Google Flow backend saat health check atau on-demand refresh. | P0 | Owner | FR-001, FR-005 | Test: Akun aktif menampilkan angka kredit yang sesuai dengan data Google Flow. Akun tanpa koneksi menampilkan "Last known: [angka], updated: [timestamp]". |
| FR-004 | Saat akun aktif kehabisan kredit (daily atau monthly), sistem otomatis beralih ke akun berikutnya yang masih memiliki kredit. Urutan rotasi mengikuti daftar akun sesuai prioritas yang ditentukan Owner. Jika semua akun habis, pipeline di-pause dengan notifikasi. | P0 | Owner | FR-001, FR-003 | Test: Akun A kredit habis → generasi berikutnya menggunakan Akun B. Semua akun habis → pipeline pause, UI menampilkan "All accounts depleted". |
| FR-005 | Sistem melakukan health check terhadap validitas session setiap akun. Health check dijalankan: (a) saat aplikasi startup, (b) sebelum pipeline execution dimulai, (c) on-demand via tombol refresh. Hasil: Active, Expired, atau Error. | P0 | Owner | FR-001 | Test: Session valid → status "Active". Cookie expired → status "Expired" dengan opsi re-auth (FR-006). Network error → status "Error" dengan retry option. |
| FR-006 | Sistem menyediakan embedded webview untuk re-autentikasi session yang expired. Owner login ulang di webview, sistem mengekstrak cookie/session baru secara otomatis dan memperbarui vault. | P1 | Owner | FR-001, FR-005, FR-041 | Test: Session expired → klik "Re-authenticate" → webview Google login muncul → login sukses → session updated, status kembali "Active". |

### 4.2 Node Editor

| ID | Requirement | Priority | Source | Dependencies | Verification Method |
|---|---|---|---|---|---|
| FR-010 | Sistem menyediakan canvas berbasis @xyflow/react dengan infinite pan (drag canvas) dan zoom (scroll wheel, pinch). Canvas mendukung minimap untuk navigasi cepat. | P0 | Owner | — | Test: Pan dan zoom berfungsi smooth. Canvas tidak memiliki hard boundary. Minimap mencerminkan posisi viewport. |
| FR-011 | Owner dapat membuat Prompt node yang berisi text input untuk generation prompt. Prompt node mendukung multi-line text, character count display, dan template variables (e.g., `{segment_number}`, `{previous_context}`). | P0 | Owner | FR-010 | Test: Prompt node dibuat → text area muncul. Teks tersimpan saat node di-deselect. Template variables di-resolve saat pipeline execution. |
| FR-012 | Owner dapat membuat Image/Reference node melalui file picker atau drag-drop. Format yang didukung: PNG, JPG, WEBP. Node menampilkan thumbnail preview dari gambar yang dimuat. | P0 | Owner | FR-010 | Test: Drag file PNG ke canvas → Image node terbuat dengan thumbnail. File picker memfilter format yang didukung. File non-image ditolak dengan error. |
| FR-013 | Owner dapat membuat Video/Clip node untuk mengimpor video klip existing sebagai referensi. Format yang didukung: MP4, WEBM. Node menampilkan thumbnail frame pertama. | P0 | Owner | FR-010 | Test: Import MP4 → Video node terbuat dengan thumbnail frame pertama. File corrupt → error message. |
| FR-014 | Owner menghubungkan node melalui draggable edges. Edges memiliki type constraint: output port Prompt/Image/Video → input port Generation node. Koneksi invalid ditolak secara visual (edge snap-back). | P0 | Owner | FR-010, FR-011, FR-012, FR-013 | Test: Drag dari output ke input → edge terbentuk. Drag ke port yang incompatible → edge tidak terbentuk, visual feedback. |
| FR-015 | Owner dapat menghapus node dan edge. Hapus node menghapus semua connected edges. Mendukung multi-select (Shift+click atau drag-select) dan batch delete (Delete key). | P0 | Owner | FR-010, FR-014 | Test: Select node → Delete → node dan edges terhapus. Multi-select + Delete → batch removal. Undo via Ctrl+Z mengembalikan state. |
| FR-016 | Setiap Generation node memiliki panel konfigurasi untuk parameter generasi: (a) model selection (Gemini Omni, Veo 3.1, Nano Banana), (b) aspect ratio, (c) seed value (optional). Default model configurable di project settings. | P0 | Owner | FR-010 | Test: Buka panel konfigurasi → dropdown model menampilkan 3 opsi. Perubahan tersimpan per node. Default model diambil dari project settings. |
| FR-017 | Setelah generasi selesai, node menampilkan preview video hasil generasi langsung di canvas. Preview mendukung play/pause dan seekbar. Klik kanan node → opsi "Open in system player". | P0 | Owner | FR-010, FR-024 | Test: Generasi selesai → video preview muncul di node. Play/pause berfungsi. Klik kanan → context menu dengan opsi external player. |
| FR-018 | Owner menyimpan dan memuat project. Format project: JSON file berisi graph structure (nodes, edges, positions), generation parameters, dan relative path ke generated assets. File project portable — path relatif terhadap project directory. | P0 | Owner | FR-010, FR-014 | Test: Save → file `.flowproj` terbuat. Load → graph state identik dengan saat disimpan. Load di directory berbeda → assets dengan relative path tetap valid jika di-copy bersama. |

### 4.3 Continuity Engine

| ID | Requirement | Priority | Source | Dependencies | Verification Method |
|---|---|---|---|---|---|
| FR-020 | Setelah segmen video selesai di-generate, sistem otomatis mengekstrak frame terakhir menggunakan FFmpeg (`-sseof -1 -frames:v 1`). Frame disimpan sebagai PNG di project directory. | P0 | Owner | FR-017, FFmpeg | Test: Video 10 detik di-generate → frame terakhir diekstrak sebagai PNG. File PNG valid dan resolusi sesuai video source. |
| FR-021 | Frame terakhir yang diekstrak (FR-020) otomatis di-inject sebagai reference image untuk generasi segmen berikutnya dalam pipeline. Injection terjadi tanpa intervensi Owner. | P0 | Owner | FR-020 | Test: Segmen N selesai → frame terakhir jadi input referensi segmen N+1. Request ke Google Flow menyertakan image reference. |
| FR-022 | Sistem membawa konteks prompt antar segmen. Mekanisme: (a) prompt sebelumnya di-append ke prompt berikutnya dengan prefix "Continuing from: ...", (b) Owner dapat menulis prompt override per segmen. Context window dibatasi 3 segmen terakhir untuk menghindari prompt terlalu panjang. | P0 | Owner | FR-011 | Test: Segmen 5 mengandung konteks dari segmen 3, 4, 5. Segmen 1–2 sudah di-truncate dari context window. Override prompt menggantikan inherited context. |
| FR-023 | Style lock menjaga konsistensi visual lintas segmen melalui kombinasi: (a) reference image injection (FR-021), (b) style descriptor yang persistent di setiap prompt (e.g., "cinematic lighting, 4K, consistent color palette"), (c) Owner-defined style lock text yang otomatis di-prepend ke setiap prompt dalam pipeline. | P0 | Owner | FR-021, FR-022 | Test: Pipeline 5 segmen dengan style lock "anime style, cel shading" → setiap request ke Google Flow menyertakan prefix tersebut. Style lock text editable di project settings. |
| FR-024 | Pipeline dieksekusi secara sequential: segmen N harus selesai sepenuhnya (generate + download + frame extract) sebelum segmen N+1 dimulai. Execution state ditampilkan di UI per node: Queued → Generating → Downloading → Extracting Frame → Complete / Failed. | P0 | Owner | FR-020, FR-021 | Test: Pipeline 3 segmen → eksekusi berurutan, tidak paralel. UI menampilkan status per node secara real-time. Node Failed menghentikan pipeline (dengan opsi retry atau skip). |

### 4.4 Video Export

| ID | Requirement | Priority | Source | Dependencies | Verification Method |
|---|---|---|---|---|---|
| FR-030 | Sistem menggabungkan semua segmen video dalam pipeline menjadi satu file video menggunakan FFmpeg concat demuxer. Audio track (jika ada) di-merge. Transition antar segmen: hard cut (default). | P0 | Owner | FR-024, FFmpeg | Test: 5 segmen @ 10 detik → output 50 detik. Video playable tanpa artifact di junction point. Audio continuous. |
| FR-031 | Sebelum export final, Owner dapat preview full concatenated video di embedded video player. Player mendukung play/pause, seek, dan segment marker overlay yang menunjukkan batas antar segmen. | P1 | Owner | FR-030 | Test: Preview menampilkan video gabungan. Segment markers visible di seekbar. Seek ke marker melompat ke awal segmen. |
| FR-032 | Owner dapat mengekspor segmen individual tanpa concatenation. Opsi export tersedia via context menu pada node atau batch export dialog. | P1 | Owner | FR-017 | Test: Klik kanan node → "Export segment" → file tersimpan di lokasi pilihan. Batch export → semua segmen tersimpan dengan naming `[project]_seg_[N].[ext]`. |
| FR-033 | Owner memilih format output dan resolusi saat export. Format: MP4 (H.264), WEBM (VP9). Resolusi: Original, 1080p, 720p. Transcoding dilakukan via FFmpeg. | P1 | Owner | FR-030, FFmpeg | Test: Export MP4 1080p → file output sesuai format dan resolusi. Export WEBM → codec VP9 terverifikasi. Resolusi output sesuai pilihan. |

### 4.5 Security — Credential Management

| ID | Requirement | Priority | Source | Dependencies | Verification Method |
|---|---|---|---|---|---|
| FR-040 | Saat pertama kali membuka credential vault, Owner menetapkan master password. Pada sesi berikutnya, Owner harus memasukkan master password untuk mengakses vault. Tidak ada password recovery — jika lupa, vault harus di-reset (semua credential hilang). | P0 | Owner | — | Test: First launch → dialog set master password. Subsequent launch → dialog unlock. Password salah 3x → cooldown 30 detik. |
| FR-041 | Semua credential (cookie, session token) dienkripsi menggunakan AES-256-GCM sebelum disimpan ke SQLite. Encryption key diderivasi dari master password menggunakan Argon2id (memory: 64MB, iterations: 3, parallelism: 1). Salt unik per credential entry. | P0 | Owner | FR-040 | Test: Database file di-inspect langsung → credential tidak readable. Dekripsi dengan master password yang benar → data valid. Dekripsi dengan password salah → fail. |
| FR-042 | Credential vault otomatis terkunci setelah periode inaktivitas yang configurable (default: 15 menit). Lock berarti encryption key dihapus dari memory. Unlock memerlukan master password kembali. Pipeline yang sedang berjalan tidak terinterupsi — vault lock hanya berlaku untuk operasi baru yang memerlukan credential. | P0 | Owner | FR-040, FR-041 | Test: Tidak ada aktivitas 15 menit → vault terkunci. Operasi yang butuh credential → prompt unlock. Pipeline in-progress tetap berjalan hingga selesai atau memerlukan credential baru. |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-001 | Node editor canvas render performance | 60fps dengan hingga 100 nodes dan 200 edges pada hardware minimum (Intel i5 Gen 8, 8GB RAM, integrated GPU) | Benchmark: Chrome DevTools Performance tab, measure frame timing selama pan/zoom dengan 100 nodes. Pass jika P95 frame time < 16.67ms. | PROPOSED |
| NFR-002 | Video generation request dispatch latency | < 2 detik dari trigger pipeline step hingga HTTP request terkirim ke Google Flow backend | Instrument: Timestamp log di pipeline executor. Measure interval antara step trigger dan request send. | PROPOSED |
| NFR-008 | Application cold start time | < 3 detik dari executable launch hingga main window rendered dan interactive (tanpa vault unlock) | Measure: Stopwatch atau startup timestamp logging. Exclude vault unlock dialog interaction time. | PROPOSED |

### 5.2 Reliability

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-003 | Auto-retry failed generation | Maksimal 3 retry attempts dengan exponential backoff (2s, 4s, 8s) sebelum marking node sebagai Failed. Retry hanya untuk transient error (network timeout, 5xx). Non-retryable error (400, 403) langsung Failed. | Test: Simulasi network timeout → 3 retry → fail. Simulasi 400 → immediate fail. | PROPOSED |

### 5.3 Security dan Privacy

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-004 | Credential protection at rest | Semua credential dienkripsi AES-256-GCM. Credential tidak pernah ditulis ke log file, temp file, console output, atau crash dump. Encryption key (derived dari master password) hanya ada di memory selama vault unlocked. | Audit: grep codebase untuk plaintext credential write. Inspect log output saat operasi credential. Review crash handler untuk memory sanitization. | CONFIRMED |

### 5.4 Usability

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-005 | Unattended pipeline execution | Pipeline 30 segmen (≈5 menit video) dapat berjalan hingga selesai tanpa intervensi manual setelah initial setup (prompt, referensi, model selection). Kegagalan di-handle otomatis oleh retry (NFR-003) atau skip-and-continue. | Test: Setup pipeline 30 segmen → execute → tidak ada dialog/prompt yang memerlukan input selama eksekusi (kecuali vault re-unlock jika timeout). | PROPOSED |

### 5.5 Storage

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-006 | Project file size | File project (graph JSON + settings) < 10MB excluding generated video assets. Video assets disimpan terpisah di subdirectory project dengan referensi relative path. | Measure: Project dengan 100 nodes → file size. | PROPOSED |

### 5.6 Compatibility

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-007 | Windows compatibility | Windows 10 (21H2+) dan Windows 11 x64. Tidak ada dukungan untuk ARM, macOS, atau Linux. WebView2 runtime (bundled oleh Tauri 2.x). | Test: Install dan jalankan di Windows 10 21H2 dan Windows 11 23H2. Verifikasi semua fitur P0 berfungsi. | CONFIRMED |

### 5.7 Accessibility

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-009 | WCAG 2.2 AA baseline | Semua UI components memenuhi WCAG 2.2 AA: (a) keyboard navigation untuk semua interactive elements, (b) screen reader compatibility untuk dialogs dan forms, (c) color contrast ratio ≥ 4.5:1 untuk text, ≥ 3:1 untuk large text dan UI components, (d) focus indicators visible. Node editor canvas: keyboard shortcuts untuk node creation, deletion, dan navigation. | axe-core automated scan pada semua views. Manual keyboard navigation test. Contrast ratio check via browser DevTools. | PROPOSED |

### 5.8 Code Quality

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-010 | Anti-AI-slop code quality | aislop score ≥ 75 pada setiap file. Zero HARD violations (narrative comments, swallowed exceptions, TODO stubs, hardcoded secrets, debug leftovers). Cyclomatic complexity per function ≤ 15. File length ≤ 500 lines (excluding generated types). | CI: aislop linter pada setiap commit. ESLint + clippy untuk TypeScript dan Rust. Complexity threshold di ESLint config. | PROPOSED |

### 5.9 Maintainability

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-011 | Modular architecture | Frontend: feature-based folder structure. Backend Rust: module per domain (account, pipeline, export, security). Setiap module memiliki public API boundary yang jelas. Coupling antar module melalui defined interfaces, bukan direct struct access. | Code review: module dependency graph tidak memiliki circular dependencies. | PROPOSED |

### 5.10 Observability

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-012 | Local diagnostic logging | Structured logging (JSON format) ke file lokal. Log levels: ERROR, WARN, INFO, DEBUG. Log rotation: max 10MB per file, max 5 files. Sensitive data (credential, cookie) tidak pernah di-log — mask atau omit. Generation pipeline: log setiap step transition dengan timestamp dan duration. | Grep log files untuk credential patterns → zero match. Verify rotation saat log file > 10MB. | PROPOSED |

### 5.11 Backup dan Recovery

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-013 | Project auto-save | Auto-save project state setiap 60 detik saat ada perubahan (dirty flag). Auto-save ke `.flowproj.autosave` di project directory. Crash recovery: saat startup, detect autosave file dan offer restore. RPO: 60 detik. RTO: < 10 detik (load autosave). | Test: Edit project → kill process → restart → autosave restore dialog muncul → state recovered. | PROPOSED |

### 5.12 Localization dan Timezone

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-014 | UI language | English-only UI. Timestamps ditampilkan dalam local timezone OS. Tidak ada kebutuhan i18n/l10n untuk personal tool. | Visual inspection. | CONFIRMED |

### 5.13 Data Retention

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-015 | Generated asset retention | Video assets tetap di project directory hingga Owner menghapus secara manual. Tidak ada automatic cleanup. Temporary files (intermediate frames, partial downloads) dibersihkan setelah pipeline step selesai atau setelah failure cleanup. | Test: Pipeline selesai → temp directory kosong. Project directory berisi final assets saja. | PROPOSED |

### 5.14 Cost Efficiency

| ID | Requirement | Target | Verification Method | Status |
|---|---|---|---|---|
| NFR-016 | Credit usage optimization | Sistem tidak mengirim duplicate generation request untuk segmen yang sudah berhasil. Retry hanya pada failure. Credit counter di-update setelah setiap generation call untuk mencegah overshoot pada account rotation. | Test: Segmen sukses → re-run pipeline → segmen yang sudah ada di-skip (cache hit). Retry hanya pada segmen Failed. | PROPOSED |

---

## 6. Personas

### 6.1 Persona: Owner — Solo AI Content Creator

| Atribut | Detail |
|---|---|
| **Nama representatif** | Rian |
| **Profil** | Content creator independen yang menggunakan AI video generation untuk memproduksi konten YouTube, Instagram Reels, dan portfolio kreatif. Memiliki beberapa subscription Google Flow untuk memaksimalkan kuota generasi. |
| **Goals** | Memproduksi video AI koheren berdurasi 3–5 menit tanpa proses manual yang repetitif. Mengoptimalkan penggunaan kredit lintas multiple account. |
| **Pain points** | (1) Proses manual copy-paste frame terakhir sebagai referensi sangat tedious. (2) Inkonsistensi visual antar segmen merusak kualitas video final. (3) Kehabisan kredit di tengah produksi menghentikan workflow. (4) Tidak ada cara visual untuk merencanakan alur narasi video multi-segmen. |
| **Technical proficiency** | Intermediate — familiar dengan desktop apps, basic command line, browser DevTools untuk cookie extraction. Tidak menulis kode. |
| **Environment** | Windows 10/11 desktop, koneksi internet stabil, FFmpeg terinstall atau bersedia install. |
| **Usage pattern** | Sesi produksi 2–4 jam, 3–5 kali per minggu. Biasanya membuat 1–2 project per sesi. |

---

## 7. User Journeys

### 7.1 Journey 1: First-Time Setup

**Tujuan:** Owner menyiapkan aplikasi untuk pertama kali — mengatur master password dan mengimpor akun Google Flow.

#### Happy Path

1. Owner meluncurkan Flow Studio untuk pertama kali.
2. Sistem menampilkan welcome screen dengan setup wizard.
3. Owner diminta membuat master password untuk credential vault.
4. Owner memasukkan dan mengkonfirmasi master password (minimum 8 karakter).
5. Vault ter-initialize dengan master password.
6. Sistem menampilkan halaman Account Management (kosong).
7. Owner klik "Add Account" → dialog import muncul.
8. Owner mem-paste cookie string yang diekstrak dari browser (via DevTools atau extension).
9. Sistem memvalidasi cookie terhadap Google Flow backend (health check).
10. Validasi sukses → akun ditambahkan ke daftar dengan status "Active" dan sisa kredit ditampilkan.
11. Owner mengulangi langkah 7–10 untuk akun tambahan.
12. Setup selesai — Owner dapat mulai membuat project.

#### Alternate Path

- **A1: Owner sudah memiliki file cookie (JSON export):** Pada langkah 8, Owner memilih "Import from file" dan memilih file JSON. Sistem parsing file dan mengekstrak cookie.
- **A2: Owner hanya memiliki satu akun:** Setup tetap berjalan normal. Account rotation (FR-004) tidak aktif — pipeline menggunakan satu akun saja.

#### Failure Path

- **F1: Cookie invalid atau expired:** Pada langkah 9, validasi gagal. Sistem menampilkan error "Session expired or invalid. Please extract fresh cookies from an active Google Flow session." Akun tidak ditambahkan. Owner harus mendapatkan cookie baru.
- **F2: Network error saat validasi:** Sistem menampilkan error "Cannot reach Google Flow. Check your internet connection." dengan tombol Retry. Akun disimpan dengan status "Unverified" — usable tapi belum dikonfirmasi.
- **F3: Master password terlalu lemah:** Sistem menolak password di bawah 8 karakter dengan pesan "Master password must be at least 8 characters." Owner harus memasukkan password yang memenuhi requirement.

---

### 7.2 Journey 2: Create New Video Project

**Tujuan:** Owner membangun pipeline generasi video dengan node editor — mengatur prompts, referensi gambar, dan koneksi antar segmen.

#### Happy Path

1. Owner klik "New Project" → dialog nama project dan lokasi penyimpanan.
2. Owner memberi nama project dan memilih directory.
3. Sistem membuat project directory dan menampilkan canvas kosong.
4. Owner membuat Prompt node pertama (klik kanan canvas → "Add Prompt Node" atau drag dari toolbar).
5. Owner mengetik generation prompt pada node tersebut (e.g., "A futuristic city at sunset, cinematic 4K").
6. Owner membuat Image node dengan drag-drop referensi gambar ke canvas.
7. Owner menghubungkan Prompt node dan Image node ke Generation slot pertama via drag edge.
8. Owner membuat Prompt node kedua untuk segmen berikutnya.
9. Owner mengkonfigurasi model di panel konfigurasi (e.g., pilih "Veo 3.1").
10. Owner mengaktifkan Style Lock di project settings — memasukkan style descriptor.
11. Owner mengulangi langkah 4–9 untuk segmen tambahan.
12. Owner menyimpan project (Ctrl+S) → file `.flowproj` tersimpan.

#### Alternate Path

- **A1: Import existing video sebagai starting point:** Owner membuat Video/Clip node, import MP4, dan menghubungkannya sebagai referensi untuk segmen pertama. Frame terakhir dari klip imported di-extract sebagai reference.
- **A2: Load existing project:** Owner memilih "Open Project" → pilih file `.flowproj` → graph ter-restore dengan semua nodes, edges, dan settings.
- **A3: Duplicate node untuk iterasi cepat:** Owner select node → Ctrl+D → node duplikat terbuat dengan prompt yang sama. Owner hanya perlu memodifikasi prompt.

#### Failure Path

- **F1: File referensi corrupt:** Saat drag-drop file gambar, file tidak dapat di-decode. Sistem menampilkan error "Cannot load image: file may be corrupted or in unsupported format." Node tidak terbuat.
- **F2: Disk full saat save:** Sistem menampilkan error "Cannot save project: insufficient disk space." Project state tetap di memory — Owner dapat free disk space dan retry save.
- **F3: Invalid connection attempt:** Owner mencoba menghubungkan dua Prompt nodes tanpa Generation slot perantara. Edge snap-back dengan visual feedback (port highlight merah). Tooltip: "Prompt nodes cannot connect directly to each other."

---

### 7.3 Journey 3: Generate Long Video

**Tujuan:** Owner menjalankan pipeline generasi video, memonitor progress, dan menangani failure.

#### Happy Path

1. Owner membuka project dengan pipeline yang sudah dibangun (e.g., 18 segmen untuk video 3 menit).
2. Owner klik "Execute Pipeline" pada toolbar.
3. Sistem melakukan pre-flight check: (a) vault unlocked, (b) minimal satu akun Active, (c) semua node memiliki input yang valid.
4. Pre-flight pass → pipeline execution dimulai.
5. Segmen 1: status berubah Queued → Generating → Downloading → Extracting Frame → Complete.
6. Frame terakhir segmen 1 otomatis di-inject ke segmen 2 sebagai reference (FR-021).
7. Prompt context dari segmen 1 dibawa ke segmen 2 (FR-022).
8. Proses berulang untuk setiap segmen berikutnya.
9. Saat akun pertama kehabisan kredit di segmen 8, sistem otomatis switch ke akun kedua (FR-004). Pipeline tidak terinterupsi.
10. Semua 18 segmen selesai di-generate.
11. Sistem menampilkan notifikasi "Pipeline complete: 18/18 segments generated successfully."

#### Alternate Path

- **A1: Owner mem-pause pipeline:** Owner klik "Pause" → segmen yang sedang di-generate tetap berjalan hingga selesai, segmen berikutnya tidak dimulai. Owner klik "Resume" → pipeline dilanjutkan dari segmen berikutnya.
- **A2: Owner men-skip segmen gagal:** Segmen 5 gagal setelah 3 retry → Owner klik "Skip & Continue" → pipeline melanjutkan ke segmen 6 tanpa frame reference dari segmen 5. Segmen 5 ditandai "Skipped".
- **A3: Vault lock selama pipeline:** Vault auto-lock setelah inaktivitas → pipeline yang sedang berjalan tetap berjalan (credential sudah in-use). Saat pipeline memerlukan credential baru (e.g., account rotation), prompt unlock muncul.

#### Failure Path

- **F1: Pre-flight check gagal:** Vault locked → prompt unlock. Tidak ada akun Active → redirect ke Account Management. Node tanpa input → highlight node yang bermasalah.
- **F2: Generation timeout (semua retry habis):** Segmen N gagal setelah 3 retry → node status "Failed" (merah). Dialog muncul: "Segment N failed after 3 attempts. [Retry] [Skip & Continue] [Stop Pipeline]."
- **F3: Semua akun kehabisan kredit:** Saat account rotation dan semua akun depleted → pipeline di-pause. Notifikasi: "All accounts have exhausted their credits. Pipeline paused at segment N. Add credits or accounts to continue."
- **F4: Network disconnection:** Sistem mendeteksi network loss → pause pipeline → retry connection setiap 30 detik. Setelah koneksi pulih, pipeline dilanjutkan otomatis. Setelah 5 menit tanpa koneksi → pipeline di-stop dengan state tersimpan untuk resume nanti.
- **F5: FFmpeg frame extraction gagal:** Frame extract error pada segmen N → retry extract. Jika tetap gagal, pipeline lanjut tanpa frame reference (hanya prompt context). Warning ditampilkan: "Frame extraction failed for segment N. Continuing without visual reference."

---

### 7.4 Journey 4: Export Final Video

**Tujuan:** Owner mem-preview video gabungan dan mengekspornya sebagai file final.

#### Happy Path

1. Pipeline selesai — semua segmen berstatus Complete.
2. Owner klik "Preview Full Video" di toolbar.
3. Sistem menjalankan FFmpeg concat → temporary preview file terbuat.
4. Embedded video player menampilkan preview dengan segment markers di seekbar.
5. Owner menonton preview, puas dengan hasilnya.
6. Owner klik "Export" → dialog export settings muncul.
7. Owner memilih format (MP4 H.264), resolusi (1080p), dan lokasi output.
8. Sistem menjalankan FFmpeg export dengan progress bar.
9. Export selesai → file tersimpan, notifikasi "Export complete" dengan link "Open in Explorer".

#### Alternate Path

- **A1: Export per-segmen:** Owner tidak ingin concatenate — klik kanan pada node → "Export Segment" → segmen individual di-export ke lokasi pilihan.
- **A2: Batch export segmen:** Owner membuka Export dialog → pilih "Export segments individually" → semua segmen di-export ke folder dengan naming convention `[project]_seg_[001].[ext]`.
- **A3: Re-export dengan format berbeda:** Owner sudah export MP4, ingin WEBM juga → buka Export dialog → pilih WEBM VP9 → export kedua dijalankan.

#### Failure Path

- **F1: Segmen missing saat concat:** Beberapa segmen berstatus Failed/Skipped → sistem menampilkan warning "3 segments missing. Export will skip these segments. Continue?" dengan daftar segmen yang di-skip.
- **F2: Disk space insufficient untuk export:** Sistem mengecek estimated output size sebelum export. Jika disk space kurang → error "Insufficient disk space. Need approximately [X] GB. Available: [Y] GB."
- **F3: FFmpeg crash selama export:** Sistem mendeteksi FFmpeg process exit with error → menampilkan error log. Partial output file dibersihkan. Owner dapat retry atau export dengan settings berbeda (e.g., lower resolution).

---

## 8. Business Constraints

| ID | Constraint | Dampak |
|---|---|---|
| BC-001 | Personal tool — tidak ada revenue model, tidak ada pengguna selain Owner. | Tidak perlu multi-user auth, RBAC, billing, atau customer support infrastructure. |
| BC-002 | Google Flow API adalah reverse-engineered — tidak ada official API contract atau SLA. | API dapat berubah tanpa notice. Arsitektur harus memiliki fallback (Playwright) dan abstraction layer agar perubahan API tidak memerlukan rewrite seluruh aplikasi. |
| BC-003 | Penggunaan multiple akun Google Flow melanggar ToS Google. | Risiko akun diblokir. Mitigasi: informational warning di UI (bukan enforcement blocker). Credential storage harus extra secure — jika database bocor, semua akun terancam. |
| BC-004 | FFmpeg sebagai dependency eksternal. | Harus bundled atau installer harus memvalidasi keberadaan FFmpeg di PATH. Fallback jika FFmpeg tidak ditemukan: disable video export features, tampilkan setup instruction. |
| BC-005 | Tidak ada budget untuk SaaS/cloud infrastructure. | Semua processing lokal. Tidak ada server-side component. Tidak ada cloud storage. |

---

## 9. Data Requirements

### 9.1 Data Entities

| Entity | Deskripsi | Sensitivity | Storage |
|---|---|---|---|
| Account Credential | Cookie/session token Google Flow, encrypted | **HIGH** — akses ke akun Google pengguna | SQLite, AES-256-GCM encrypted |
| Master Password Hash | Argon2id hash dari master password | **HIGH** — gateway ke credential vault | SQLite |
| Account Metadata | Email/label akun, credit balance, last health check timestamp | MEDIUM | SQLite, plaintext |
| Project Graph | Node positions, edges, connections, generation parameters | LOW | JSON file (`.flowproj`) |
| Generation Prompt | Text prompt per node | LOW | Embedded dalam project graph JSON |
| Reference Image | User-supplied image file | LOW | File di project directory |
| Generated Video Segment | Video output dari Google Flow | LOW | File di project directory |
| Extracted Frame | Frame terakhir dari segmen, PNG | LOW | File di project directory |
| Application Settings | Default model, auto-lock timeout, export preferences | LOW | SQLite atau JSON config |
| Application Log | Structured log entries | LOW (tapi harus di-sanitize dari credential data) | Log files, rotated |

### 9.2 Data Flow

```
Owner Input (prompt, image, config)
       │
       ▼
┌─────────────────┐
│  Project State   │◄──── Save/Load (.flowproj JSON)
│  (Zustand store) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐    credential     ┌──────────────────┐
│  Pipeline        │───────────────►  │  Credential Vault │
│  Executor        │◄───────────────  │  (SQLite+AES)     │
└────────┬────────┘    decrypted      └──────────────────┘
         │              session
         ▼
┌─────────────────┐    HTTP request   ┌──────────────────┐
│  Flow Router     │─────────────────►│  Google Flow      │
│  (Rust module)   │◄─────────────────│  Backend          │
└────────┬────────┘    video stream   └──────────────────┘
         │
         ▼
┌─────────────────┐    subprocess     ┌──────────────────┐
│  Asset Manager   │─────────────────►│  FFmpeg           │
│                  │◄─────────────────│                   │
└────────┬────────┘  frame/concat     └──────────────────┘
         │
         ▼
   Local Filesystem
   (project directory)
```

### 9.3 Data Retention

| Data | Retention | Cleanup |
|---|---|---|
| Credentials | Sampai Owner menghapus akun (FR-002) atau reset vault | Manual deletion atau vault reset |
| Project files | Indefinite — Owner mengelola manual | Manual deletion |
| Generated video assets | Indefinite — tersimpan di project directory | Manual deletion |
| Temporary files (partial downloads, intermediate frames) | Dihapus otomatis setelah pipeline step complete atau failure cleanup | Automatic |
| Application logs | Max 5 file × 10MB = 50MB. Log tertua di-rotate (overwrite) | Automatic rotation |

---

## 10. Compliance dan Privacy Requirements

### 10.1 Credential Sensitivity Classification

| Aspek | Klasifikasi | Kontrol |
|---|---|---|
| Data classification | **HIGH SENSITIVITY** — credential memberikan akses penuh ke akun Google pengguna | AES-256-GCM encryption at rest, Argon2id key derivation |
| Exposure risk | Jika database file bocor tanpa encryption → akses ke semua stored Google accounts | Master password required, auto-lock timeout |
| Logging policy | Credential value tidak pernah di-log dalam bentuk apapun (plaintext, encoded, partial) | Log sanitization: mask any string matching cookie/token pattern |
| Memory handling | Encryption key (derived dari master password) dihapus dari memory saat vault locked | Secure memory wipe pada lock event |
| Backup consideration | Credential database boleh di-backup oleh OS backup tools, tapi tetap encrypted | Encryption-at-rest memastikan backup file tetap protected |

### 10.2 Privacy Considerations

| Aspek | Kebijakan |
|---|---|
| Data collection | Tidak ada telemetry atau data collection ke pihak ketiga. Semua data tetap lokal. |
| Third-party data sharing | Prompt dan referensi dikirim ke Google Flow untuk generasi — ini inherent dari fungsi produk. Owner bertanggung jawab atas konten yang di-generate. |
| PII handling | Aplikasi tidak memproses PII pengguna lain. Cookie/session milik Owner sendiri. |
| Regulatory | Tidak ada kebutuhan GDPR/UU PDP karena personal tool tanpa data pengguna lain. Cookie storage tunduk pada Google ToS (Owner's responsibility). |

### 10.3 Security Controls Summary

| Layer | Control | Implementation |
|---|---|---|
| Encryption at rest | AES-256-GCM | Rust `aes-gcm` crate, unique nonce per encryption operation |
| Key derivation | Argon2id | `argon2` crate: memory 64MB, iterations 3, parallelism 1, 32-byte output |
| Auto-lock | Inactivity timeout | Configurable (default 15 min), timer reset pada setiap user interaction |
| Input validation | Cookie format validation | Regex + structural validation sebelum storage |
| Network security | HTTPS only | Reject non-HTTPS connections ke Google Flow |
| Filesystem security | Project directory scoping | Path traversal prevention: canonicalize dan validate semua file path within project boundary |

---

## 11. Out of Scope

| Item | Alasan |
|---|---|
| Multi-user support | Personal tool, satu pengguna saja. |
| Cloud sync atau remote storage | Tidak ada budget atau kebutuhan. Project files lokal. |
| macOS / Linux support | Target hanya Windows 10/11 x64. |
| Mobile companion app | Desktop-only workflow. |
| Real-time collaboration | Single user. |
| Video editing (trim, effects, transitions) | Focus pada generation pipeline, bukan video editor. Post-production di aplikasi lain. |
| Audio generation atau music | Di luar scope — Owner menambahkan audio di post-production. |
| Google Flow official API integration | Tidak ada official API. Seluruh integrasi berbasis reverse-engineering. |
| Automatic Google account creation | Etis dan legal concern. Owner membawa akun sendiri. |
| Watermark removal atau content manipulation | Di luar scope dan potential legal issue. |
| Plugin system atau extensibility API | Over-engineering untuk personal tool. |
| Automatic update mechanism | Owner melakukan update manual. |

---

## 12. Dependency Map

```
FR-040 (Master Password)
  └──► FR-041 (AES-256-GCM Encryption)
         └──► FR-001 (Add Account)
                ├──► FR-002 (Remove Account)
                ├──► FR-003 (Display Credits)
                │      └──► FR-004 (Auto-Rotate Account)
                ├──► FR-005 (Health Check)
                │      └──► FR-006 (Re-authenticate)
                └──► FR-042 (Auto-Lock Vault)

FR-010 (Canvas Pan/Zoom)
  ├──► FR-011 (Prompt Node)
  ├──► FR-012 (Image Node)
  ├──► FR-013 (Video Node)
  ├──► FR-014 (Connect Edges)
  │      └──► FR-015 (Delete Nodes/Edges)
  ├──► FR-016 (Generation Parameters)
  ├──► FR-017 (Preview Result)
  └──► FR-018 (Save/Load Project)

FR-017 (Preview Result) + FR-024 (Sequential Pipeline)
  └──► FR-020 (Extract Last Frame)
         └──► FR-021 (Inject Frame as Reference)
                └──► FR-022 (Carry Prompt Context)
                       └──► FR-023 (Style Lock)

FR-024 (Sequential Pipeline) + FFmpeg
  └──► FR-030 (Concatenate Segments)
         ├──► FR-031 (Preview Full Video)
         ├──► FR-032 (Export Per-Segment)
         └──► FR-033 (Output Format/Resolution)
```

---

## 13. Traceability Summary

| FR ID | Acceptance Criteria Ref | Test Ref | PRD Ref |
|---|---|---|---|
| FR-001 | AC dalam FR-001 verification | TEST-ACC-001 | PRD/ACCOUNT_POOL.md |
| FR-002 | AC dalam FR-002 verification | TEST-ACC-002 | PRD/ACCOUNT_POOL.md |
| FR-003 | AC dalam FR-003 verification | TEST-ACC-003 | PRD/ACCOUNT_POOL.md |
| FR-004 | AC dalam FR-004 verification | TEST-ACC-004 | PRD/ACCOUNT_POOL.md |
| FR-005 | AC dalam FR-005 verification | TEST-ACC-005 | PRD/ACCOUNT_POOL.md |
| FR-006 | AC dalam FR-006 verification | TEST-ACC-006 | PRD/ACCOUNT_POOL.md |
| FR-010 | AC dalam FR-010 verification | TEST-NOD-010 | PRD/NODE_EDITOR.md |
| FR-011 | AC dalam FR-011 verification | TEST-NOD-011 | PRD/NODE_EDITOR.md |
| FR-012 | AC dalam FR-012 verification | TEST-NOD-012 | PRD/NODE_EDITOR.md |
| FR-013 | AC dalam FR-013 verification | TEST-NOD-013 | PRD/NODE_EDITOR.md |
| FR-014 | AC dalam FR-014 verification | TEST-NOD-014 | PRD/NODE_EDITOR.md |
| FR-015 | AC dalam FR-015 verification | TEST-NOD-015 | PRD/NODE_EDITOR.md |
| FR-016 | AC dalam FR-016 verification | TEST-NOD-016 | PRD/NODE_EDITOR.md |
| FR-017 | AC dalam FR-017 verification | TEST-NOD-017 | PRD/NODE_EDITOR.md |
| FR-018 | AC dalam FR-018 verification | TEST-NOD-018 | PRD/NODE_EDITOR.md |
| FR-020 | AC dalam FR-020 verification | TEST-CNT-020 | PRD/CONTINUITY_ENGINE.md |
| FR-021 | AC dalam FR-021 verification | TEST-CNT-021 | PRD/CONTINUITY_ENGINE.md |
| FR-022 | AC dalam FR-022 verification | TEST-CNT-022 | PRD/CONTINUITY_ENGINE.md |
| FR-023 | AC dalam FR-023 verification | TEST-CNT-023 | PRD/CONTINUITY_ENGINE.md |
| FR-024 | AC dalam FR-024 verification | TEST-CNT-024 | PRD/CONTINUITY_ENGINE.md |
| FR-030 | AC dalam FR-030 verification | TEST-EXP-030 | PRD/VIDEO_EXPORT.md |
| FR-031 | AC dalam FR-031 verification | TEST-EXP-031 | PRD/VIDEO_EXPORT.md |
| FR-032 | AC dalam FR-032 verification | TEST-EXP-032 | PRD/VIDEO_EXPORT.md |
| FR-033 | AC dalam FR-033 verification | TEST-EXP-033 | PRD/VIDEO_EXPORT.md |
| FR-040 | AC dalam FR-040 verification | TEST-SEC-040 | PRD/ACCOUNT_POOL.md |
| FR-041 | AC dalam FR-041 verification | TEST-SEC-041 | PRD/ACCOUNT_POOL.md |
| FR-042 | AC dalam FR-042 verification | TEST-SEC-042 | PRD/ACCOUNT_POOL.md |

---

## 14. Glossary

| Term | Definisi |
|---|---|
| **Google Flow** | Platform generasi video AI milik Google yang menghasilkan klip video hingga 10 detik berdasarkan text prompt dan/atau referensi gambar. |
| **Segmen** | Satu unit video 10 detik yang dihasilkan oleh satu kali request ke Google Flow. |
| **Pipeline** | Urutan segmen yang terhubung dalam node editor, dieksekusi secara sequential untuk menghasilkan video panjang. |
| **Node** | Elemen visual di canvas yang merepresentasikan satu unit dalam pipeline: Prompt node, Image node, Video node, atau Generation node. |
| **Edge** | Koneksi visual antar nodes yang mendefinisikan alur data (prompt → generation, image → generation). |
| **Frame Extraction** | Proses mengambil frame terakhir dari video segmen menggunakan FFmpeg untuk dijadikan referensi segmen berikutnya. |
| **Style Lock** | Mekanisme menjaga konsistensi visual lintas segmen melalui kombinasi reference image injection dan persistent style descriptor di prompt. |
| **Continuity Engine** | Subsystem yang mengelola frame extraction, prompt context chaining, dan style lock untuk menjaga koherensi antar segmen. |
| **Credential Vault** | Penyimpanan terenkripsi (SQLite + AES-256-GCM) untuk cookie/session Google Flow. Dilindungi master password. |
| **Account Rotation** | Mekanisme otomatis berpindah ke akun Google Flow berikutnya saat akun aktif kehabisan kredit. |
| **Health Check** | Validasi berkala terhadap session cookie untuk memastikan akun masih aktif dan dapat digunakan. |
| **flow-router** | Modul Rust di backend Tauri yang menangani HTTP communication ke Google Flow, termasuk request construction, response parsing, dan error handling. |
| **Tauri 2.x** | Framework desktop app yang menggunakan webview OS (WebView2 di Windows) sebagai frontend renderer dengan Rust backend. Alternatif ringan dari Electron. |
| **@xyflow/react** | Library React untuk membangun node-based editor dengan fitur pan, zoom, drag-connect, dan custom node rendering. |
| **Zustand** | Library state management untuk React, ringan dan unopinionated. Digunakan untuk menyimpan application state di frontend. |
| **AES-256-GCM** | Algoritma enkripsi simetris dengan authenticated encryption. Memastikan confidentiality dan integrity data. |
| **Argon2id** | Algoritma password hashing yang resistant terhadap GPU dan ASIC attacks. Digunakan untuk derive encryption key dari master password. |
| **FFmpeg** | Tool command-line open source untuk video/audio processing: transcoding, concatenation, frame extraction, format conversion. |
| **Playwright** | Library browser automation. Digunakan sebagai fallback integration jika reverse-engineered HTTP endpoint tidak berfungsi. |
| **Reverse-Engineered HTTP** | Integrasi yang dibangun berdasarkan observasi network traffic Google Flow, bukan official API documentation. Rentan terhadap perubahan tanpa notice. |
| **Concat Demuxer** | Metode FFmpeg untuk menggabungkan video files tanpa re-encoding, menggunakan file daftar input. |
| **aislop score** | Metrik code quality yang mengukur kepatuhan terhadap anti-AI-slop rules — mendeteksi narrative comments, swallowed exceptions, generic names, dan patterns lain yang menurunkan kualitas kode. |
| **WCAG 2.2 AA** | Web Content Accessibility Guidelines level AA — standar aksesibilitas yang mencakup keyboard navigation, screen reader support, dan contrast ratio. |
| **WebView2** | Microsoft Edge-based webview runtime yang digunakan Tauri 2.x di Windows sebagai rendering engine untuk frontend. |
| **Project File (.flowproj)** | File JSON yang menyimpan graph structure, node configurations, dan relative paths ke assets. Format native untuk save/load project. |
| **IPC (Inter-Process Communication)** | Mekanisme komunikasi antara React frontend dan Rust backend di Tauri, menggunakan command invocation. |
| **Generation Node** | Node logis dalam pipeline yang merepresentasikan satu request generasi video ke Google Flow, menerima input dari Prompt dan/atau Image/Video nodes. |

---

## Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-09-24 | Software Architect & Planning Lead | Initial SRS creation — full functional requirements, non-functional requirements, personas, user journeys, data requirements, compliance, glossary. |
