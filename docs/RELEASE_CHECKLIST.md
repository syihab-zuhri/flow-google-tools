# RELEASE_CHECKLIST.md — Production Release Gate Verification & Launch Go/No-Go Framework

> **Project:** Flow Studio  
> **Document ID:** DOC-REL-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-TEST-001, DOC-RUN-001  
> **Supersedes:** None  

---

## 1. Executive Summary & Ringkasan Dokumen

Dokumen ini mendefinisikan kriteria kelulusan produksi formal (*Production Release Gates*) dan kerangka kerja pengambilan keputusan peluncuran (*Launch Go/No-Go Decision Framework*) untuk aplikasi desktop **Flow Studio**. Dokumen ini berfungsi sebagai gerbang verifikasi final sebelum biner rilis Windows (*installer* NSIS `.exe` dan paket MSI) ditandatangani secara digital (*code-signed*) dan didistribusikan ke pengguna akhir.

Sesuai mandat arsitektur dalam `PLANNING_v5.2.md` §11.24, `DOC-TEST-001`, dan `DOC-RUN-001`, Flow Studio beroperasi pada paradigma **High-Security Tier Local-First Workstation**. Seluruh kriteria kelulusan dalam daftar periksa ini bersifat **wajib (mandatory)**, deterministik, berbasis bukti empiris (*evidence-backed*), dan tidak dapat dibatalkan oleh toleransi subjektif.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          FLOW STUDIO RELEASE GATE PIPELINE                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [GATE 1: PRODUCT]       ──►  All P0 Features, Objectives OBJ-01..05 & Traceability    │
│  [GATE 2: ENGINEERING]   ──►  CI Green, aislop >= 75, Zero HARD Violations, SLOs       │
│  [GATE 3: SECURITY]      ──►  Argon2id + AES-GCM, Zero-Log, Lockout, Zero Open Ports   │
│  [GATE 4: DESIGN & A11Y] ──►  CSF3 Stories (6 States), axe-core ERROR Mode, Tokens     │
│  [GATE 5: DESKTOP OPS]   ──►  NSIS/MSI Clean Installs, FFmpeg Sidecar, SQLite Backup   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                       FINAL GO / NO-GO CALL SHEET & SIGN-OFF                           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Go/No-Go Decision Framework

Kerangka kerja keputusan Go/No-Go mengatur protokol evaluasi formal peluncuran. Keputusan diambil dalam *Release Readiness Review Meeting* yang dihadiri oleh seluruh penanggung jawab teknis (*sign-off stakeholders*).

### 2.1 Taksonomi Keputusan (Decision Taxonomy)

Setiap sesi review wajib menghasilkan satu dari tiga status keputusan berikut:

| Keputusan | Definisi & Kriteria Ambang Batas | Tindakan Lanjutan |
|---|---|---|
| **GO (PROCEED)** | **100% item Gate Kritis (P0) lulus verifikasi tanpa catatan.**<br>- Zero open S1/S2 defects.<br>- Seluruh SLO performa, audit keamanan, dan integritas installer terbukti via log pengujian.<br>- Skor *aislop* $\ge 75$ dan zero HARD violations. | Biner disetujui untuk penandatanganan digital EV Code Signing, publikasi rilis GitHub, dan distribusi installer. |
| **NO-GO (ABORT)** | **Ditemukan $\ge 1$ kegagalan pada item gerbang kritis (P0 / P0-equivalent).**<br>- Adanya regresi keamanan, kegagalan sanitasi kredensial, atau port listening terbuka.<br>- Kegagalan kompilasi/instalasi NSIS/MSI pada Windows 10/11.<br>- Pelanggaran HARD rules atau pembengkakan latensi melebihi batas SLO. | Rilis dibatalkan seketika. Biner ditarik dari staging. Tim teknik memfokuskan investigasi pada *blocker* utama. Tanggal peluncuran dijadwalkan ulang. |
| **CONDITIONAL GO (SCOPE REDUCTION)** | **Fitur non-kritis (P1/P2) mengalami kegagalan, namun seluruh fitur inti P0 dan fondasi keamanan 100% stabil.**<br>- Fitur yang bermasalah dapat dinonaktifkan secara aman (*feature flag / circuit breaker*) tanpa merusak integritas alur utama (*Critical User Journeys*).<br>- Mendapat persetujuan bulat dari Architect, Product Lead, dan Security Lead. | Fitur yang cacat di-descope via *formal Change Request* (CR) sesuai `PLANNING_v5.2.md` §12. Dokumentasi rilis diperbarui dengan *Known Limitations*. |

### 2.2 Aturan Baku Penegakan NO-GO (Strict No-Go Rules)

Berdasarkan aturan tata kelola `PLANNING_v5.2.md` §11.24:
1. **Dilarang Rasionalisasi "Sisa Kecil":** Jika ada satu item P0 atau kriteria keamanan yang gagal, rilis **dilarang keras** diloloskan dengan alasan "hanya tersisa bug kecil" atau "akan diperbaiki pada patch berikutnya". NO-GO wajib dideklarasikan secara eksplisit.
2. **Dokumentasi Kegagalan:** Setiap deklarasi NO-GO wajib disertai laporan tiket insiden, akar penyebab (*root cause*), dampak teknis, dan perkiraan durasi perbaikan (*ETA*).
3. **Pilihan Eskalasi NO-GO:**
   - **Opsi A (Fix & Re-test):** Memperbaiki cacat kode dalam jendela waktu *code freeze*, menjalankan ulang seluruh test suite regresi dari awal.
   - **Opsi B (Scope Reduction):** Menurunkan cakupan fitur ke backlog P1/P2 hanya jika fitur tersebut bukan bagian dari kontrak MVP primer (OBJ-01 s/d OBJ-05).
   - **Opsi C (Postpone Launch):** Menggeser tanggal rilis target jika perbaikan membutuhkan perubahan struktural atau refaktorisasi arsitektur.

---

## 3. Product Gates (Verifikasi Fungsional & Kriteria MVP)

Product Gates memastikan seluruh kapabilitas inti yang dijanjikan dalam kontrak spesifikasi telah diimplementasikan secara tuntas, tanpa *stub*, dan memenuhi *Definition of MVP Success*.

### 3.1 Verifikasi Definisi Keberhasilan MVP (OBJ-01 s/d OBJ-05)

| Target Objektif | Deskripsi Persyaratan Bisnis | Kriteria Penerimaan Terukur (*Measurable Target*) | Metode Verifikasi & Bukti Pengujian | Status Kelulusan |
|---|---|---|---|:---:|
| **OBJ-01** | Menghasilkan video koheren berdurasi panjang dari *chained segments*. | Output video final berdurasi **3–5 menit** (setara **18–30 segmen** berurutan) berhasil digenerasi dan digabungkan dalam satu sesi kerja tanpa intervensi manual. | Eksekusi E2E pipeline 18 node di canvas. File output `.mp4` berdurasi $\ge 180$ detik dengan visual motion mulus. Verifikasi durasi via `ffprobe`. | `[ ] PASS`<br>`[ ] FAIL` |
| **OBJ-02** | Memaksimalkan utilisasi kredit dari *multiple accounts*. | Auto-rotasi akun berjalan mulus tanpa saklar manual; utilisasi kredit mencapai **$\ge 95\%$** dari kapasitas seluruh akun Google aktif sebelum status *all-depleted*. | Simulasi kehabisan kuota akun aktif; Flow Router beralih otomatis ke akun cadangan dalam pool tanpa memutus pipeline berjalan. | `[ ] PASS`<br>`[ ] FAIL` |
| **OBJ-03** | Menjaga kontinuitas visual lintas segmen (*Visual Continuity*). | Injeksi otomatis frame terakhir segmen $N$ sebagai referensi segmen $N+1$ disertai *prompt context carry-over*. Mencapai **VCS $\ge 3.8 / 5.0$** dan **Junction SSIM $\ge 0.72$**. | Evaluasi terhadap 15 skenario kanonikal *Golden Dataset* (`GOLD-001` s/d `GOLD-015`) menggunakan skrip automated SSIM analyzer. | `[ ] PASS`<br>`[ ] FAIL` |
| **OBJ-04** | Menyediakan alur kerja visual berbasis graf yang intuitif. | Editor graf berbasis node (@xyflow/react) mendukung alur: Prompt $\to$ Image $\to$ Video $\to$ Concat $\to$ Export dalam satu canvas tak terbatas (*infinite canvas*). | Pengujian interaktif UI: pembuatan graf 20+ node, validasi koneksi tipe port, pencegahan cycle DAG, pan/zoom lancar. | `[ ] PASS`<br>`[ ] FAIL` |
| **OBJ-05** | Mengamankan kredensial akun pengguna secara mutlak. | Seluruh cookie sesi dan token otentikasi disimpan dengan enkripsi **AES-256-GCM** yang kuncinya diderivasi melalui **Argon2id**. Kredensial tidak pernah tersimpan atau bocor dalam format plaintext di disk maupun berkas log. | Inspeksi biner SQLite, audit berkas log `%APPDATA%/FlowStudio/logs/`, pengujian penetrasi memori via automated sanitizers. | `[ ] PASS`<br>`[ ] FAIL` |

### 3.2 Matriks Kelengkapan Fitur Tingkat P0 (P0 Feature Gates)

| Feature ID | Modul Sistem | Kapabilitas Utama | Kriteria Keberhasilan (*Acceptance Criteria*) | Ref Dokumen | Status |
|---|---|---|---|---|:---:|
| **FEAT-FLOW_ROUTER** | Rust Core (`flow-router`) | Account Management & Pool | Penambahan, penghapusan, dan pelacakan status multi-akun Google Flow berfungsi stabil. | `PRD/ACCOUNT_POOL.md`<br>`SRS: FR-001..FR-006` | `[ ] PASS` |
| | | Reverse-Engineered HTTP Client | Komunikasi HTTPS TLS 1.3 ke endpoint Google Flow via `reqwest` terisolasi; penanganan cookie jar otomatis. | `API.md: API-GEN-001`<br>`SRS: FR-007` | `[ ] PASS` |
| | | Automatic Account Rotation | Deteksi error kuota (HTTP 429 / depleted) memicu transisi akun instan dengan random jitter 2–5 detik. | `SRS: FR-008` | `[ ] PASS` |
| | | Video Generation Dispatch | Text-to-Video, Image-to-Video, dan Video-to-Video terkirim dengan payload deterministik. | `SRS: FR-009` | `[ ] PASS` |
| | | Status Polling & Video Download | Polling asynchronous status render dengan batas *timeout* cerdas; pengunduhan segmen MP4 utuh. | `API.md: API-GEN-002`<br>`SRS: FR-010` | `[ ] PASS` |
| **FEAT-NODE_EDITOR** | React 19 Frontend | Canvas Pan, Zoom, Grid | Canvas interaktif berbasis GPU render; seleksi multi-node, snap-to-grid, dan navigasi viewport. | `PRD/NODE_EDITOR.md`<br>`SRS: FR-011..FR-014` | `[ ] PASS` |
| | | 3 Node Types (Prompt, Image, Video) | Node Card modular merender parameter konfigurasi, indikator status, dan thumbnail preview secara dinamis. | `SRS: FR-015` | `[ ] PASS` |
| | | Directed Acyclic Graph (DAG) Enforcement | Deteksi dan pencegahan koneksi siklik (*cycle prevention*) secara real-time saat pembuatan edge. | `SRS: FR-016` | `[ ] PASS` |
| | | Sequential Pipeline Execution | Eksekusi deterministik segmen per segmen; penguncian konkurensi tunggal (*Single Active Pipeline*). | `API.md: §5.1`<br>`SRS: FR-017` | `[ ] PASS` |
| **FEAT-CONTINUITY** | Hybrid (Rust + FFmpeg) | Last-Frame Extraction | Ekstraksi frame presisi milidetik terakhir segmen video menjadi file PNG lossless via sidecar FFmpeg. | `PRD/CONTINUITY_ENGINE.md`<br>`SRS: FR-020` | `[ ] PASS` |
| | | Context & Style Injection | Penggabungan konteks prompt sebelumnya dan injeksi image reference frame ke request node berikutnya. | `SRS: FR-021` | `[ ] PASS` |
| **FEAT-VIDEO_EXPORT** | Rust Engine (`export`) | FFmpeg Concat Demuxer | Penggabungan seluruh segmen MP4 tanpa re-encoding menggunakan *demuxer concat file list*. | `PRD/VIDEO_EXPORT.md`<br>`SRS: FR-030` | `[ ] PASS` |
| | | Atomic Export & Progress IPC | Tracking progress persentase (0–100%) dialirkan via IPC event `export://progress` ke antarmuka pengguna. | `API.md: API-EXP-001`<br>`SRS: FR-033` | `[ ] PASS` |
| **FEAT-VAULT** | Rust Core (`crypto`) | Argon2id KDF & AES-256-GCM | Kunci enkripsi diderivasi dengan aman; enkripsi/dekripsi terautentikasi dengan verifikasi tag 16-byte. | `SECURITY.md: §4`<br>`SRS: FR-040, FR-041` | `[ ] PASS` |
| | | Inactivity Auto-Lock & Zeroize | Vault terkunci otomatis setelah 15 menit idle; memori kunci master dibersihkan total via `zeroize`. | `SRS: FR-042`<br>`SECURITY.md: §5` | `[ ] PASS` |

---

## 4. Engineering Quality Gates

Engineering Quality Gates menjamin bahwa arsitektur perangkat lunak dibangun di atas fondasi yang kokoh, terbebas dari *anti-AI-slop signatures*, memiliki cakupan pengujian yang memadai, dan mematuhi anggaran performa desktop (*Service Level Objectives*).

### 4.1 CI Pipeline Status (Continuous Integration Baseline)

Seluruh tahapan dalam pipeline otomatis GitHub Actions / Local Build Script wajib berstatus **GREEN (Exit Code 0)**:

```bash
# Perintah eksekusi verifikasi penuh pipeline CI
pnpm lint && pnpm typecheck && cargo clippy -- -D warnings && cargo test && pnpm test:run
```

- [ ] **Linting Frontend:** `pnpm lint` (ESLint Strict) selesai dengan **0 error dan 0 warning**. Tidak ada bypass rule.
- [ ] **Typecheck Frontend:** `pnpm typecheck` (`tsc --noEmit`) selesai dengan **0 error**. Opsi `strict: true` aktif.
- [ ] **Static Analysis Backend:** `cargo clippy --all-targets -- -D warnings` selesai dengan **0 warning**.
- [ ] **Rust Unit & Integration Tests:** `cargo test --all` menghasilkan **100% kelulusan** (0 failed, 0 filtered out). Cakupan kode line coverage $\ge 85\%$ pada modul inti (`vault`, `account_pool`, `continuity_engine`, `export`).
- [ ] **Frontend Vitest Suites:** `pnpm test:run` menghasilkan **100% kelulusan** (0 failed). Cakupan store & DAG validator $\ge 80\%$.
- [ ] **Tauri E2E Execution:** Playwright Tauri runner menyelesaikan skenario CUJ-01 hingga CUJ-04 tanpa kegagalan atau *flaky tests*.

### 4.2 Standar Mutu Kode & Anti-AI-Slop Scanner (`CODE_QUALITY.md`)

Sesuai `DOC-QUAL-001` dan `PLANNING_v5.2.md` §11.24, seluruh basis kode (TypeScript dan Rust) dipindai menggunakan *aislop scanner*:

$$\text{Final Score} = 100 - (\text{HARD} \times 15) - (\text{STD} \times 5) - (\text{QUAL} \times 2)$$

- [ ] **Ambang Batas Skor aislop:** Nilai akhir skor kualitas kode **$\ge 75 / 100$** pada seluruh repositori.
- [ ] **Verifikasi Hard Rules (Toleransi Mutlak: Nol Pelanggaran):**
  - [ ] **HARD-001 (No Swallowed Exceptions):** Tidak ada blok `catch` kosong atau penelanan error `let _ = ...` tanpa log/rethrow terstruktur.
  - [ ] **HARD-002 (No Hallucinated Imports):** Seluruh package terdaftar sah di `package.json` dan `Cargo.toml`.
  - [ ] **HARD-003 (No Stubs / TODO / FIXME):** Nol penanda tugas sementara (`TODO`, `FIXME`, `HACK`, `todo!()`, `unimplemented!()`) pada kode produksi.
  - [ ] **HARD-004 (No Hardcoded Secrets):** Nol kunci privat, cookie, atau token mentah di seluruh branch repositori.
  - [ ] **HARD-005 (No Silent Fallbacks):** Respon upstream cacat wajib memicu error terstruktur, bukan mengembalikan default semu.
  - [ ] **HARD-006 (No Infinite Loops):** Seluruh loop dan polling network memiliki guard waktu/iterasi maksimal (*guaranteed termination*).
- [ ] **Batasan Kompleksitas & Panjang Berkas:**
  - [ ] Kompleksitas siklomatis (*Cyclomatic Complexity*) per fungsi $\le 15$.
  - [ ] Panjang berkas sumber $\le 500$ baris (tidak termasuk berkas tipe definisi otomatis).

### 4.3 Service Level Objectives (SLOs) Performa Desktop (`RUNBOOK.md` §6)

Pengujian performa dieksekusi pada mesin acuan standar pengujian minimum (Intel Core i5 Generasi ke-8, RAM 8GB, SSD SATA, Windows 10 x64):

| SLO ID | Metrik Indikator Kinerja (*SLI*) | Target Ambang Batas (*SLO*) | Hasil Pengukuran Riil | Status Kelulusan |
|---|---|---|---|:---:|
| **SLO-001** | **Generation Dispatch Latency**<br>Durasi sejak eksekusi node dipicu hingga HTTP POST pertama terkirim ke Google Flow. | **P95 < 2.0 detik**<br>(Rolling window 50 inferensi) | Terukur: `_____ detik` | `[ ] PASS`<br>`[ ] FAIL` |
| **SLO-002** | **Canvas Interactive Frame Rate**<br>Tingkat kelancaran pan, zoom, dan seleksi pada graf dengan beban 50 node dan 100 edge. | **P95 $\ge$ 60 FPS**<br>(Frame render time $\le 16.67$ ms) | Terukur: `_____ FPS` | `[ ] PASS`<br>`[ ] FAIL` |
| **SLO-003** | **Pipeline Crash Recovery**<br>Pemulihan status pipeline pasca terminasi paksa tanpa kehilangan data segmen selesai. | **100% Deterministic Auto-Resume**<br>(0 segmen selesai digenerasi ulang) | Terukur: `_____ %` | `[ ] PASS`<br>`[ ] FAIL` |
| **SLO-004** | **Application Cold Start Time**<br>Durasi peluncuran biner aplikasi hingga antarmuka canvas siap menerima input pengguna. | **Cold Start < 3.0 detik**<br>(Dari klik biner hingga render tuntas) | Terukur: `_____ detik` | `[ ] PASS`<br>`[ ] FAIL` |

---

## 5. Security & Privacy Gates

Security & Privacy Gates memverifikasi ketahanan kriptografi, ketiadaan kebocoran data sensitif (*Zero-Leakage Guarantee*), serta penegakan pembatasan akses sistem operasi sesuai spesifikasi `SECURITY.md`.

### 5.1 Integritas Kriptografi Credential Vault

- [ ] **Derivasi Kunci Argon2id Terverifikasi (`TEST-SEC-001`):**
  - Parameter algoritma tepat: Variasi `Argon2id`, Alokasi Memori: **64 MB (65,536 KiB)**, Iterasi Waktu (*t_cost*): **3**, Paralelisme (*p_cost*): **1**, Panjang Kunci Output: **32 bytes (256-bit)**.
  - Nilai *salt* kriptografis unik 16-byte (menggunakan CSPRNG `rand::rngs::OsRng`) dihasilkan per inisialisasi vault.
- [ ] **Enkripsi AES-256-GCM & Uji Penetrasi Tamper (`TEST-SEC-002`):**
  - Inisialisasi cipher AES-256-GCM menggunakan IV/Nonce acak 12-byte per transaksi enkripsi.
  - **Uji Integritas Tag:** Modifikasi 1-bit buatan pada *ciphertext* database SQLite terbukti memicu kegagalan autentikasi tag 16-byte secara instan, menolak dekripsi, dan mencatat alert keamanan.
- [ ] **Pembersihan Memori Kritis (*In-Memory Zeroization*) (`TEST-SEC-003`):**
  - Struktur data penyimpan *Master Derived Key* dan *Plaintext Session Cookies* mengimplementasikan trait `zeroize::ZeroizeOnDrop`.
  - Verifikasi inspeksi memory dump pasca-lock membuktikan buffer sensitif tertimpa nilai `0x00` secara sempurna.

### 5.2 Kebijakan Nol Kebocoran Kredensial (Zero-Leakage Verification)

- [ ] **Zero Plaintext Credentials on Disk:**
  - Pemeriksaan langsung terhadap berkas SQLite database (`%APPDATA%/FlowStudio/flow_studio.db`):
    - Kolom `accounts.encrypted_cookies` berisi payload terenkripsi biner/hex (bukan JSON/string ASCII).
    - Kolom `accounts.encrypted_tokens` berisi payload terenkripsi biner/hex.
    - Kolom `credential_vault.master_password_hash` memuat PHC string standar Argon2id, tanpa password asli.
- [ ] **Zero Plaintext Credentials in Logs:**
  - Pemindaian regex otomatis (*automated secret leak scanner*) terhadap seluruh berkas log pada `%APPDATA%/FlowStudio/logs/*.log`:
    - Pencarian pola cookie Google (`SID=`, `HSID=`, `SSID=`, `SAPISID=`) menghasilkan **0 temuan**.
    - Pencarian token otentikasi Bearer/OAuth menghasilkan **0 temuan**.
    - Berkas *crash dump* `%TEMP%/FlowStudio_Crash_*.dmp` tersanitasi penuh (zero credentials).

### 5.3 Kontrol Anti-Brute-Force & Proteksi Akses Lokal

- [ ] **Mekanisme Lockout Master Password Teruji (`TEST-SEC-010`):**
  - Memasukkan password salah sebanyak **3 (tiga) kali berturut-turut** memicu transisi state vault ke `COOLDOWN`.
  - Pada status `COOLDOWN`, seluruh pemanggilan IPC unlock ditolak seketika selama **30 detik penuh**.
  - Upaya unlock baru yang dikirimkan saat masa cooldown sedang berjalan terbukti mereset timer jeda kembali ke 30 detik (*penalty extension*).
- [ ] **Watchdog Inaktivitas Auto-Lock (`TEST-SEC-011`):**
  - Ketiadaan interaksi mouse/keyboard selama **15 menit** otomatis mengunci vault, menghapus master key dari memori, dan mengembalikan antarmuka ke layar terkunci.

### 5.4 Audit Dependensi & Batasan Jaringan Sistem (Network Perimeter)

- [ ] **Audit Keamanan Dependensi Bersih:**
  - `cargo audit` dieksekusi pada backend Rust: **0 vulnerabilitas Critical atau High**.
  - `pnpm audit --prod` dieksekusi pada dependensi frontend: **0 vulnerabilitas Critical atau High**.
- [ ] **Konfirmasi Nol Port Terbuka (0 Inbound Listening Ports):**
  - Sesuai `DOC-ADR-002` (penolakan proxy HTTP lokal), Flow Studio berkomunikasi secara *in-process* via Rust backend.
  - Pemindaian soket lokal menggunakan perintah Windows PowerShell saat aplikasi berjalan:
    ```powershell
    Get-NetTCPConnection -OwningProcess (Get-Process FlowStudio).Id | Where-Object State -eq "Listen"
    ```
  - **Hasil Evaluasi:** Mengembalikan **0 baris** (tidak ada listener port TCP/UDP lokal yang terbuka). Seluruh lalu lintas jaringan adalah *outbound HTTPS TLS 1.3* langsung ke domain Google Flow.

---

## 6. Component & Design Consistency Gates

Component & Design Consistency Gates memastikan bahwa antarmuka pengguna memenuhi standar aksesibilitas tertinggi, bebas dari regresi visual, dan mematuhi kontrak sistem desain (`DESIGN.md`).

### 6.1 Verifikasi Komponen P0 dalam Storybook (CSF3 Standard)

Setiap komponen tingkat P0 wajib memiliki berkas story berformat **Component Story Format v3 (CSF3)** dan merender secara lengkap **6 Visual States Wajib**:

| Komponen P0 | Path Berkas Storybook | 1. Default | 2. Hover | 3. Active/Selected | 4. Disabled | 5. Loading/Generating | 6. Error/Empty | Status Storybook |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **NodeCard** | `src/components/Canvas/NodeCard.stories.tsx` | [x] | [x] | [x] | [x] | [x] | [x] | `[ ] PASS` |
| **Handle** | `src/components/Canvas/Handle.stories.tsx` | [x] | [x] | [x] | [x] | [x] | [x] | `[ ] PASS` |
| **CanvasControls** | `src/components/Canvas/CanvasControls.stories.tsx` | [x] | [x] | [x] | [x] | [x] | [x] | `[ ] PASS` |
| **MiniMap** | `src/components/Canvas/MiniMap.stories.tsx` | [x] | [x] | [x] | [x] | [x] | [x] | `[ ] PASS` |
| **AccountBadge** | `src/components/Account/AccountBadge.stories.tsx` | [x] | [x] | [x] | [x] | [x] | [x] | `[ ] PASS` |
| **CreditMeter** | `src/components/Account/CreditMeter.stories.tsx` | [x] | [x] | [x] | [x] | [x] | [x] | `[ ] PASS` |
| **MasterPasswordModal** | `src/components/Security/MasterPasswordModal.stories.tsx` | [x] | [x] | [x] | [x] | [x] | [x] | `[ ] PASS` |
| **ExportProgressBar** | `src/components/Export/ExportProgressBar.stories.tsx` | [x] | [x] | [x] | [x] | [x] | [x] | `[ ] PASS` |

### 6.2 Audit Aksesibilitas axe-core (Mode ERROR Aktif)

- [ ] **Penegakan Engine axe-core Mode ERROR:**
  - Automated test runner `@axe-core/playwright` dan `@storybook/addon-a11y` dijalankan dalam konfigurasi ketat.
  - Setiap pelanggaran aksesibilitas langsung mengembalikan status *Exit Code 1* (Build Fail).
  - Hasil pemindaian pada seluruh komponen dan dialog modal: **0 Violations (Zero Violations)**.
- [ ] **Kepatuhan Standar WCAG 2.2 Level AA:**
  - **Rasio Kontras Warna Minimum:**
    - Teks biasa (`#F1F5F9`) terhadap latar belakang card (`#1E293B`) menghasilkan rasio **11.4:1** (melebihi standar WCAG AAA).
    - Teks placeholder (`#94A3B8`) terhadap surface (`#1E293B`) menghasilkan rasio **4.8:1** (Pass WCAG AA $\ge 4.5:1$).
    - Elemen antarmuka interaktif dan fokus border menghasilkan rasio $\ge 3.0:1$.
  - **Aksesibilitas Navigasi Keyboard Penuh:** Seluruh dialog modal, input field, dan node card dapat diakses, dinavigasi, dan dieksekusi menggunakan tombol `Tab`, `Shift+Tab`, `Enter`, `Space`, dan `Escape`. Indikator cincin fokus (*focus ring outline*) terlihat jelas.

### 6.3 Verifikasi Kepatuhan Token Desain (`DESIGN.md`)

- [ ] **Konsistensi Token Desain Antarmuka:**
  - Seluruh warna, tipografi, radius sudut (*border-radius*), dan elevasi bayangan terpetakan secara ketat ke token Tailwind yang didefinisikan dalam `DESIGN.md`.
  - Tipografi antarmuka utama menggunakan keluarga font `Inter`, dan blok input teknis/prompts menggunakan `JetBrains Mono`.
- [ ] **Zero Hardcoded Hex Colors Audit:**
  - Pemindaian statis (*code search*) dijalankan pada folder antarmuka:
    ```bash
    # Memastikan tidak ada hardcoded hex color di luar berkas konfigurasi tema
    git grep -E "#[0-9a-fA-F]{3,6}" -- "src/**/*.tsx" "src/**/*.ts" ":(exclude)src/styles/tokens.ts"
    ```
  - **Hasil Audit:** Mengembalikan **0 kecocokan (zero matches)**. Seluruh komponen memanfaatkan token kelas utilitas terpusat (cth: `bg-surface-dark`, `text-primary-100`, `border-node-prompt-border`).

---

## 7. Desktop Operations Gates

Desktop Operations Gates menguji keandalan biner terdistribusi, integritas instalasi Windows, bundling pustaka multimedia eksternal, transaksionalitas basis data lokal, dan daya tahan aplikasi saat offline.

### 7.1 Integritas Bundel Installer Windows (NSIS & MSI)

- [ ] **Kompilasi Bersih & Deterministic Build:**
  - Perintah `pnpm tauri build --bundles nsis,msi` selesai dengan sukses tanpa peringatan kompilator.
  - Artefak installer terverifikasi pada path:
    - NSIS Setup: `src-tauri/target/release/bundle/nsis/FlowStudio_1.0.0_x64-setup.exe`
    - WiX MSI Package: `src-tauri/target/release/bundle/msi/FlowStudio_1.0.0_x64_en-US.msi`
- [ ] **Pengujian Instalasi pada Lingkungan Bersih (Clean Machine Validation):**
  - **Windows 10 Pro x64 (Build 21H2 atau lebih baru):** Instalasi biner pada VM *clean-state* (tanpa Node.js, Rust, Git, atau build tools terpasang) berhasil 100%. Aplikasi terbuka dan berfungsi normal.
  - **Windows 11 Pro x64 (Build 22H2 atau lebih baru):** Instalasi biner berhasil, integrasi WebView2 terdeteksi otomatis, jendela aplikasi ter-render tanpa anomali grafis.
- [ ] **Uninstaller Hygiene:** Proses uninstall menghapus seluruh biner eksekusi, shortcut desktop, entri registri, dan membersihkan direktori program tanpa meninggalkan *dangling processes*. Berkas data pengguna di `%APPDATA%/FlowStudio` dipertahankan dengan konfirmasi dialog.
- [ ] **Penandatanganan Digital (*Code Signing*):**
  - Biner `.exe` dan `.msi` ditandatangani menggunakan sertifikat resmi Microsoft Authenticode.
  - Pemeriksaan signature via PowerShell: `Get-AuthenticodeSignature .\FlowStudio_1.0.0_x64-setup.exe` mengembalikan status `Valid`.

### 7.2 Verifikasi Bundling Sidecar FFmpeg

- [ ] **Keberadaan Biner Sidecar x64 Static:**
  - Biner `ffmpeg-x86_64-pc-windows-msvc.exe` dan `ffprobe-x86_64-pc-windows-msvc.exe` (versi FFmpeg 6.0+ static build) terbundel utuh di dalam payload aplikasi.
- [ ] **Operasional Pengawasan Subproses (*FFmpeg Supervisor*):**
  - Backend Rust berhasil memicu eksekusi subproses sidecar via Tauri Sidecar API.
  - Komunikasi stream `stdin`/`stdout` berjalan aman tanpa memory leak.
  - **Process Lifecycle Guard:** Terminasi atau penutupan paksa jendela utama Flow Studio terbukti mematikan seluruh subproses FFmpeg aktif seketika (*zero orphaned background processes*).

### 7.3 Idempotensi & Keandalan Migrasi Database SQLite (`MIGRATION.md`)

- [ ] **Idempotensi Skrip Migrasi:**
  - Seluruh berkas migrasi skema SQL (`V001__initial_schema.sql`, dst.) dikompilasi ke dalam biner Rust via `include_str!`.
  - Eksekusi berulang migrasi pada database yang sudah termigrasi menghasilkan status *no-op* yang aman tanpa error skema.
  - Integritas struktural terkonfirmasi: `PRAGMA integrity_check` dan `PRAGMA foreign_key_check` mengembalikan hasil bersih (`ok` / 0 error).
- [ ] **Prosedur Cadangan Otomatis (*Backup-Before-Migrate*):**
  - Sebelum transaksi migrasi dieksekusi, subsistem membuat berkas cadangan otomatis menggunakan *SQLite Online Backup API*.
  - Berkas cadangan tersimpan dengan format: `%APPDATA%/FlowStudio/backups/flow_studio_backup_v{current_version}_{timestamp}.db`.
  - **Uji Simulasi Rollback:** Simulasi kegagalan migrasi buatan membuktikan bahwa transaksi di-rollback secara otomatis dan basis data dipulihkan utuh dari berkas cadangan tanpa korupsi data.

### 7.4 Penanganan Degradasi Offline & Jaringan (Graceful Offline Handling)

- [ ] **Daya Tahan Saat Koneksi Internet Terputus (Offline State):**
  - Aplikasi diluncurkan dalam kondisi tanpa koneksi internet (*airplane mode*):
    - Antarmuka editor node tetap terbuka 100% responsif.
    - Proyek lokal `.flowproj` dapat dibuat, diedit susunan grafnya, dan disimpan ke disk tanpa freeze atau unhandled error.
    - Pool akun menampilkan indikator visual status `NETWORK_UNREACHABLE` tanpa menghapus data sesi lokal.
- [ ] **Mitigasi Pemutusan Jaringan Saat Pipeline Berjalan:**
  - Pemutusan koneksi di tengah generasi video memicu penanganan *exponential backoff retry* terstruktur.
  - State segmen yang telah berhasil diunduh tersimpan aman di disk lokal, dan pipeline beralih ke status `PAUSED_NETWORK_ERROR`, siap melanjutkan (*auto-resume*) saat koneksi pulih tanpa mengulang segmen awal.

---

## 8. Ringkasan Eksekutif Kesiapan Gerbang (Gate Checklist Summary)

Sebelum menandatangani dokumen ini, seluruh pimpinan domain teknis wajib memverifikasi ringkasan gerbang berikut:

| Gerbang Evaluasi | Ruang Lingkup Verifikasi Kritis | Ambang Batas Wajib | Status Akhir |
|---|---|---|:---:|
| **Gate 1: Product** | Kriteria Sukses MVP (OBJ-01..05), Seluruh Fitur P0, Traceability | 100% Selesai & Terverifikasi | `[ ] PASS` |
| **Gate 2: Engineering** | CI Pipeline, aislop Score, Zero HARD Violations, Target SLO | CI Green, aislop $\ge 75$, SLO Pass | `[ ] PASS` |
| **Gate 3: Security** | Argon2id + AES-GCM, Zero-Log, Lockout 30s, Zero Port Terbuka | 0 Cacat Kritis, Zero Leakage | `[ ] PASS` |
| **Gate 4: Design & A11y** | CSF3 Stories Komponen P0, axe-core Mode ERROR, Token Desain | 0 Violations, Zero Hardcoded Colors | `[ ] PASS` |
| **Gate 5: Desktop Ops** | Installer NSIS/MSI, Sidecar FFmpeg, Backup SQLite, Offline Guard | Clean Install Pass, Deterministic | `[ ] PASS` |

---

## 9. Sign-off Matrix & Final Go/No-Go Call Sheet

### 9.1 Matriks Tanda Tangan Penanggung Jawab Teknis (Sign-off Matrix)

Keputusan peluncuran Flow Studio memerlukan persetujuan formal dan tanda tangan digital/kriptografis dari seluruh pihak penanggung jawab berikut:

| Peran Tanggung Jawab | Nama Penanggung Jawab | Keputusan Personal | Tanda Tangan / Verification Hash | Tanggal Evaluasi | Catatan Khusus |
|---|---|:---:|---|:---:|---|
| **Software Architect & Planning Lead** | Architect Lead | `[ ] GO`<br>`[ ] NO-GO` | `___________________________` | 2026-09-24 | Konfirmasi arsitektur & kepatuhan spesifikasi. |
| **Security & Cryptography Lead** | Security Engineer | `[ ] GO`<br>`[ ] NO-GO` | `___________________________` | 2026-09-24 | Validasi vault, anti-abuse, dan zero leakage. |
| **Product Owner** | Product Lead | `[ ] GO`<br>`[ ] NO-GO` | `___________________________` | 2026-09-24 | Verifikasi pemenuhan nilai bisnis MVP. |
| **QA & Test Automation Lead** | Quality Engineer | `[ ] GO`<br>`[ ] NO-GO` | `___________________________` | 2026-09-24 | Verifikasi hasil suite uji unit, E2E, dan a11y. |
| **Release & Desktop Operations Lead** | Release Engineer | `[ ] GO`<br>`[ ] NO-GO` | `___________________________` | 2026-09-24 | Validasi biner installer NSIS/MSI dan sidecar. |

### 9.2 Log Metadata Artefak Rilis Final (Release Artifact Metadata)

```
[BUILD METADATA]
Version Tag         : v1.0.0-release
Target Platform     : Windows 10/11 x64 (MSVC)
Git Commit SHA      : ________________________________________ (40-char hex)
CI Pipeline Run ID  : ____________________
Build Timestamp     : 2026-09-24T___:___:___Z

[ARTIFACT CHECKSUMS (SHA-256)]
NSIS Installer (.exe) : ________________________________________________________________
MSI Package (.msi)    : ________________________________________________________________
FFmpeg Sidecar (.exe) : ________________________________________________________________
```

### 9.3 Final Launch Decision Sheet

Berdasarkan tinjauan menyeluruh terhadap seluruh gerbang mutu produk, rekayasa, keamanan, desain, dan operasional biner:

```
[ KONSENSUS KEPUTUSAN FINAL ]

[ ] GO (PROCEED TO PRODUCTION RELEASE)
    Seluruh kriteria kelulusan terpenuhi 100%. Biner disetujui untuk ditandatangani
    secara digital dan didistribusikan kepada pengguna akhir.

[ ] NO-GO (ABORT RELEASE)
    Ditemukan cacat pemblokir (blocking issues). Biner ditarik kembali ke fase pengembangan.
    Alasan Pemblokiran : _______________________________________________________________
    Target Resolusi    : _______________________________________________________________

[ ] CONDITIONAL GO (SCOPE REDUCTION)
    Rilis disetujui dengan pengecualian modul non-kritis yang di-descope via Change Request.
    Modul yang Dikecualikan : __________________________________________________________
    Nomor Tiket CR          : __________________________________________________________
```

---

## 10. Prosedur Pasca-Keputusan (Post-Decision Protocols)

1. **Protokol Jika Keputusan GO:**
   - Melakukan eksekusi *Authenticode Signing* pada biner final menggunakan sertifikat EV di lingkungan HSM aman.
   - Mengunggah installer dan berkas *checksum* SHA-256 ke *release repository* resmi.
   - Mengaktifkan pemantauan telemetri diagnostik lokal selama periode *Hypercare* (24 jam pertama pasca rilis).
2. **Protokol Jika Keputusan NO-GO:**
   - Membuat tiket insiden keparahan S1/S2 pada repositori kerja.
   - Mengembalikan branch rilis ke status *Code Freeze Remediation*.
   - Menjadwalkan sesi *Go/No-Go Review Meeting* ulang setelah seluruh perbaikan diverifikasi oleh CI pipeline.
3. **Kriteria Rollback Cepat (*Emergency Rollback Triggers*):**
   - Ditemukan kebocoran kredensial plaintext pada kondisi runtime mesin pengguna.
   - Terjadi crash aplikasi fatal saat cold start (*unhandled panic*) pada lebih dari 1% pengguna Windows bersih.
   - Korupsinya database SQLite akibat proses migrasi yang tidak terpulihkan oleh cadangan otomatis.
