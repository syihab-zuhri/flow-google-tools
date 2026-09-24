# PRD: Continuity Engine

> **Feature ID:** FEAT-CONTINUITY_ENGINE  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Priority:** P0  
> **Owner:** Backend Agent  
> **Dependencies:** FEAT-ACCOUNT_POOL, FEAT-NODE_EDITOR  
> **Last Updated:** 2026-09-24

---

## 1. Overview

Continuity Engine adalah core engine yang memastikan **visual continuity** dan **narrative consistency** lintas chained 10-second video segments yang di-generate oleh Google Flow. Engine ini beroperasi sebagai orchestrator utama di antara Node Editor (pipeline graph definition) dan Video Export (final stitching).

### 1.1 Problem Statement

Google Flow menghasilkan video klip AI maksimal ~10 detik per generasi. Ketika beberapa klip digabungkan secara naif, hasilnya adalah video yang secara visual tidak koheren — karakter berubah penampilan, setting berubah drastis, dan narasi terputus. Tanpa mekanisme otomatis untuk menjembatani continuity antar segmen, video panjang yang dihasilkan tidak layak pakai.

### 1.2 Solusi

Continuity Engine secara otomatis:
1. **Mengekstrak frame terakhir** dari segmen $N$ menggunakan FFmpeg sebagai reference image.
2. **Meng-inject frame tersebut** sebagai input referensi visual untuk generasi segmen $N+1$.
3. **Membawa konteks prompt** antar segmen melalui sliding context window (3 segmen terakhir).
4. **Mengunci visual style** dengan style descriptor persistent yang di-prepend ke setiap prompt.
5. **Mengeksekusi pipeline secara sequential** — memastikan segmen $N$ selesai sepenuhnya sebelum segmen $N+1$ dimulai.

### 1.3 Business Value

- Mengubah kumpulan klip pendek yang terputus menjadi video panjang koheren 3–5 menit.
- Menghilangkan kebutuhan intervensi manual untuk menjaga konsistensi visual antar segmen.
- Memungkinkan unattended pipeline execution (NFR-005) di mana 30 segmen dapat berjalan tanpa interaksi user setelah initial setup.

**Traceability:** OBJ-03 (PLANNING.md), FR-020 s/d FR-024 (SRS.md), RSK-003 (PLANNING.md).

---

## 2. Goals

| ID | Goal | Measurable Target |
|---|---|---|
| G-CONT-001 | Menjaga visual continuity lintas segmen | ≥80% segmen dalam pipeline menunjukkan konsistensi karakter, warna, dan setting saat di-review manual |
| G-CONT-002 | Otomasi penuh frame extraction dan injection | 100% transisi antar segmen menggunakan reference frame otomatis tanpa intervensi manual (kecuali override eksplisit) |
| G-CONT-003 | Prompt context carry-over yang efektif | Setiap segmen $N+1$ menerima konteks dari 3 segmen terakhir tanpa prompt yang melebihi token limit API |
| G-CONT-004 | Pipeline reliability | Pipeline 30 segmen berjalan hingga selesai dengan retry otomatis; downtime karena engine failure < 1% dari total execution time |
| G-CONT-005 | Frame extraction latency | Ekstraksi frame terakhir selesai dalam < 2 detik per segmen pada hardware minimum (i5 Gen 8 / Ryzen 5 3600) |

---

## 3. Non-Goals (khusus fitur ini)

| Item | Alasan |
|---|---|
| AI-based visual similarity scoring | Evaluasi konsistensi visual dilakukan secara manual oleh Owner; automated scoring adalah scope P2 |
| Audio continuity | Audio handling adalah tanggung jawab FEAT-VIDEO_EXPORT dan fitur P1-02 (Audio Support) |
| Parallel segment generation | Pipeline bersifat strictly sequential (FR-024); parallelism tidak didukung karena dependency chain antar segmen |
| Style transfer / neural style matching | Style lock menggunakan keyword-based approach, bukan neural network inference |
| Automatic quality assessment | Smart retry berbasis heuristic kualitas adalah scope P1-08 |
| Video upscaling / super-resolution | Bukan tanggung jawab Continuity Engine; resolusi output mengikuti resolusi Google Flow |

---

## 4. Actors & Permissions

| Actor | Tipe | Deskripsi | Permissions |
|---|---|---|---|
| **Owner** | Human (Primary) | Solo developer / content creator yang menjalankan pipeline | Full control: configure, start, pause, resume, cancel pipeline; override reference frame; edit style lock; view segment status |
| **Google Flow Backend** | External System | API endpoint Google Flow untuk video generation | Receive generation requests (text-to-video, image-to-video); return video segment |
| **FFmpeg** | Local Binary | FFmpeg binary untuk frame extraction dan video processing | Dipanggil oleh Continuity Engine via Tauri sidecar; akses read ke video segments, write ke frame PNG output |
| **Flow Router** (FEAT-ACCOUNT_POOL) | Internal Module | Rust module yang mengelola multi-account rotation | Menerima generation request dari Continuity Engine; memilih akun aktif; forward request ke Google Flow |
| **Node Editor** (FEAT-NODE_EDITOR) | Internal Module | React frontend yang mendefinisikan pipeline graph | Menyediakan graph definition (node sequence, prompt content, reference images) ke Continuity Engine |

### 4.1 Permission Matrix

| Aksi | Owner | System (Engine) |
|---|---|---|
| Start pipeline | ✅ | ❌ |
| Pause/Resume pipeline | ✅ | ❌ (auto-pause hanya pada failure threshold) |
| Cancel pipeline | ✅ | ❌ |
| Override reference frame | ✅ | ❌ |
| Extract frame (FFmpeg) | ❌ | ✅ (otomatis) |
| Inject reference ke Google Flow | ❌ | ✅ (otomatis) |
| Prompt carry-over | ❌ | ✅ (otomatis, Owner bisa override per node) |
| Apply style lock | ❌ | ✅ (otomatis, Owner mendefinisikan style text) |

---

## 5. Preconditions

| ID | Precondition | Validasi | Aksi jika Gagal |
|---|---|---|---|
| PRE-CONT-001 | Minimal satu segmen video telah berhasil di-generate dalam pipeline | Cek status node pertama: `COMPLETE` | Pipeline tidak dapat berlanjut ke segmen berikutnya; engine menunggu segmen pertama selesai |
| PRE-CONT-002 | FFmpeg binary tersedia dan dapat dieksekusi | Startup health check: `ffmpeg -version` return code 0 | Tampilkan error dialog: "FFmpeg tidak ditemukan. Install FFmpeg dan pastikan tersedia di PATH." Pipeline blocked |
| PRE-CONT-003 | Credential vault unlocked dan minimal satu akun Google Flow aktif | Cek vault status `UNLOCKED` dan `active_accounts.length >= 1` | Redirect Owner ke Account Manager untuk import/activate akun |
| PRE-CONT-004 | Pipeline graph valid (minimal 2 connected generation nodes) | Graph validation pass: setiap Generation Node memiliki Prompt Node input | Tampilkan validation error pada node yang bermasalah |
| PRE-CONT-005 | Disk space cukup untuk menyimpan extracted frames dan video segments | Cek available disk space ≥ 500 MB sebelum pipeline start | Warning dialog: "Disk space rendah. Pipeline mungkin gagal di tengah eksekusi." |

---

## 6. User Stories

### US-CONT-001: Auto Reference Frame Extraction
**Sebagai** Owner,  
**saya ingin** sistem secara otomatis menggunakan frame terakhir dari segmen $N$ sebagai referensi visual untuk segmen $N+1$,  
**sehingga** karakter, setting, dan komposisi visual tetap konsisten tanpa saya harus manual mengekstrak dan mengupload frame.

**Acceptance Criteria:**
- AC-CONT-001a: Setelah segmen $N$ selesai di-generate dan di-download, FFmpeg otomatis mengekstrak frame terakhir sebagai PNG dalam < 2 detik.
- AC-CONT-001b: File PNG tersimpan di `{project_dir}/frames/segment_{N}_last.png` dengan resolusi identik dengan video source.
- AC-CONT-001c: Jika video segmen corrupt atau tidak dapat di-decode, engine melaporkan error spesifik dan menawarkan opsi: retry generation atau skip segment.

### US-CONT-002: Prompt Context Carry-Over
**Sebagai** Owner,  
**saya ingin** konteks prompt dari segmen sebelumnya terbawa ke segmen berikutnya,  
**sehingga** cerita dan narasi tidak kehilangan benang merah.

**Acceptance Criteria:**
- AC-CONT-002a: Prompt segmen $N+1$ berisi konteks dari maksimal 3 segmen terakhir dengan prefix `"Continuing from: ..."`.
- AC-CONT-002b: Konteks di-truncate secara otomatis jika total prompt melebihi 4000 karakter (termasuk style lock + user prompt + carry-over context).
- AC-CONT-002c: Owner dapat menulis prompt override per segmen yang menggantikan inherited context sepenuhnya.

### US-CONT-003: Visual Style Lock
**Sebagai** Owner,  
**saya ingin** mengunci satu gaya visual yang konsisten di seluruh segmen pipeline,  
**sehingga** output video memiliki look-and-feel yang seragam dari awal hingga akhir.

**Acceptance Criteria:**
- AC-CONT-003a: Style lock text yang didefinisikan Owner otomatis di-prepend ke setiap prompt segmen.
- AC-CONT-003b: Style lock dapat di-edit kapan saja sebelum pipeline start; perubahan berlaku untuk semua segmen yang belum di-generate.
- AC-CONT-003c: Style lock bekerja bersamaan dengan reference image injection — keduanya dikirim bersamaan ke Google Flow.

### US-CONT-004: Reference Frame Preview
**Sebagai** Owner,  
**saya ingin** melihat frame referensi yang akan digunakan untuk setiap segmen sebelum generasi dimulai,  
**sehingga** saya bisa memverifikasi bahwa frame yang tepat digunakan sebagai acuan.

**Acceptance Criteria:**
- AC-CONT-004a: Thumbnail frame referensi ditampilkan pada Generation Node di canvas sebelum segmen mulai di-generate.
- AC-CONT-004b: Klik thumbnail membuka preview full-resolution dalam modal.
- AC-CONT-004c: Untuk segmen pertama (tanpa preceding segment), thumbnail menampilkan placeholder "No reference — initial segment" atau reference image manual jika tersedia.

### US-CONT-005: Manual Frame Override
**Sebagai** Owner,  
**saya ingin** bisa mengganti frame referensi otomatis dengan gambar kustom pilihan saya,  
**sehingga** saya memiliki kontrol penuh atas visual direction jika auto-extracted frame tidak ideal.

**Acceptance Criteria:**
- AC-CONT-005a: Setiap Generation Node memiliki opsi "Override Reference" yang memungkinkan upload gambar PNG/JPG/WebP.
- AC-CONT-005b: Manual override ditandai secara visual di UI (badge/icon pada node) agar Owner tahu segmen mana yang menggunakan custom reference.
- AC-CONT-005c: Manual override dapat di-revert ke auto-extracted frame kapan saja sebelum generasi dimulai.
- AC-CONT-005d: Override frame disimpan di `{project_dir}/overrides/segment_{N}_override.{ext}`.

---

## 7. Functional Flow (happy, alternate, failure)

### 7.1 Happy Path — Sequential Pipeline Execution

```
┌─────────────────────────────────────────────────────────┐
│ Owner klik "Start Pipeline" di Node Editor              │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Pre-flight Validation                                    │
│ - Graph valid? (minimal 2 generation nodes connected)    │
│ - FFmpeg available?                                      │
│ - Vault unlocked? Active accounts available?             │
│ - Disk space sufficient?                                 │
└──────────────────────────┬──────────────────────────────┘
                           ▼ (All pass)
┌─────────────────────────────────────────────────────────┐
│ LOOP: Untuk setiap Segment N (1..total)                  │
│                                                          │
│ 1. Set node status: Queued → Generating                  │
│ 2. Compose prompt:                                       │
│    a. Style lock text (prepend)                          │
│    b. User prompt (node-specific)                        │
│    c. Context carry-over (last 3 segments, append)       │
│ 3. Determine reference frame:                            │
│    a. N=1: manual reference atau none                    │
│    b. N>1: auto-extracted frame dari N-1                 │
│            (atau manual override jika set)               │
│ 4. Send request ke Flow Router:                          │
│    - prompt + reference image + model params             │
│    - Flow Router selects active account                  │
│ 5. Poll generation status hingga complete                │
│ 6. Download video segment                                │
│    Node status: Generating → Downloading                 │
│ 7. FFmpeg extract last frame:                            │
│    ffmpeg -sseof -1 -i segment_N.mp4                     │
│           -frames:v 1 segment_N_last.png                 │
│    Node status: Downloading → Extracting Frame           │
│ 8. Store frame → inject sebagai reference N+1            │
│ 9. Summarize prompt context untuk carry-over             │
│    Node status: Extracting Frame → Complete              │
│                                                          │
│ END LOOP                                                 │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Pipeline Complete                                        │
│ - Notify Owner: "Pipeline selesai. N segmen berhasil."   │
│ - Enable "Export Video" button                           │
│ - Emit event: pipeline_complete                          │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Alternate Path — Manual Override

```
1. Owner membuka Generation Node config panel.
2. Owner klik "Override Reference" → file picker.
3. Owner pilih file PNG/JPG/WebP dari file system.
4. File di-copy ke {project_dir}/overrides/.
5. Thumbnail override ditampilkan di node (badge "Manual Override").
6. Saat pipeline execution sampai di node ini, engine menggunakan
   override file, bukan auto-extracted frame.
7. Jika Owner revert override sebelum execution → engine kembali
   ke auto-extracted frame.
```

### 7.3 Alternate Path — Prompt Override per Segment

```
1. Owner mengedit prompt di Generation Node tertentu.
2. Owner mengaktifkan toggle "Override Context" pada node.
3. Prompt carry-over context dari segmen sebelumnya di-bypass.
4. Hanya user prompt + style lock yang dikirim ke Google Flow.
5. Carry-over untuk segmen SETELAHNYA tetap berlanjut:
   context window berisi override prompt + 2 segmen sebelumnya.
```

### 7.4 Failure Path — Generation Failure

```
1. Google Flow mengembalikan error (5xx, timeout, rate limit).
2. Engine melakukan auto-retry sesuai NFR-003:
   - Retry 1: delay 2 detik
   - Retry 2: delay 4 detik
   - Retry 3: delay 8 detik
3. Jika semua retry gagal:
   - Node status: Generating → Failed
   - Pipeline di-pause otomatis (BR-CONT-004)
   - Notifikasi ke Owner: "Segmen N gagal setelah 3 retry."
4. Owner memiliki opsi:
   a. Retry — engine mencoba lagi dengan akun yang sama/berbeda
   b. Skip — segmen di-skip, pipeline lanjut ke N+1
      (frame reference: gunakan frame terakhir dari segmen N-1)
   c. Cancel — pipeline dibatalkan
```

### 7.5 Failure Path — Frame Extraction Failure

```
1. FFmpeg gagal mengekstrak frame (file corrupt, codec issue).
2. Engine log error detail dari FFmpeg stderr.
3. Retry extraction 1x dengan flag tambahan:
   ffmpeg -err_detect ignore_err -sseof -1 -i segment.mp4 ...
4. Jika tetap gagal:
   - Node status: Extracting Frame → Failed
   - Notifikasi: "Frame extraction gagal untuk segmen N."
   - Opsi: gunakan manual override, re-generate segmen, atau skip.
```

### 7.6 Failure Path — Account Exhaustion Mid-Pipeline

```
1. Flow Router mendeteksi akun aktif kehabisan credit (HTTP 429).
2. Flow Router otomatis rotate ke akun berikutnya (FEAT-ACCOUNT_POOL).
3. Jika SEMUA akun exhausted:
   - Pipeline di-pause.
   - Notifikasi: "Semua akun kehabisan credit. Pipeline di-pause."
   - Owner harus menambah akun atau menunggu reset credit.
```

---

## 8. Business Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-CONT-001 | Frame extraction menggunakan FFmpeg dengan output PNG pada resolusi asli video. Command: `ffmpeg -sseof -1 -i {input} -frames:v 1 -q:v 1 {output}.png`. Tidak ada downscaling atau compression. | Hardcoded di extraction function; resolusi di-validasi post-extraction |
| BR-CONT-002 | Prompt context window dibatasi pada 3 segmen terakhir. Segmen lebih lama di-truncate dari context. Jika total context + style lock + user prompt > 4000 karakter, truncate context mulai dari segmen paling lama. | Sliding window implementation di prompt composer; character count validation sebelum API call |
| BR-CONT-003 | Style lock menggunakan kombinasi reference image injection + style keyword yang di-append ke setiap prompt. Style lock text didefinisikan satu kali oleh Owner dan berlaku untuk semua segmen. | Style lock text di-persist dalam project file (.flowproj); auto-prepend oleh prompt composer |
| BR-CONT-004 | Jika generasi segmen gagal 3 kali berturut-turut (setelah retry NFR-003), pipeline otomatis di-pause dan Owner dinotifikasi via UI notification (toast + badge pada node). Pipeline tidak auto-cancel. | Retry counter per node; pause trigger di pipeline orchestrator |
| BR-CONT-005 | Manual frame override selalu mengambil prioritas di atas auto-extracted frame. Override di-set per node dan persist dalam project file. Override dapat di-revert sebelum generasi dimulai. | Override check di reference resolver: `if override_exists → use override, else → use auto_frame` |
| BR-CONT-006 | Pipeline execution bersifat strictly sequential. Segmen $N$ harus berstatus `COMPLETE` (generate + download + frame extract) sebelum segmen $N+1$ dimulai. Tidak ada parallelism. | State machine enforcement di pipeline orchestrator; next segment hanya dipicu oleh event `segment_complete` |
| BR-CONT-007 | Segmen pertama dalam pipeline tidak memiliki auto-reference frame. Owner dapat menyediakan manual reference image sebagai initial seed, atau membiarkan kosong (text-to-video murni). | Conditional logic di reference resolver untuk `segment_index == 0` |
| BR-CONT-008 | Semua artefak intermediate (extracted frames, downloaded segments) disimpan di project directory dan tidak dihapus otomatis. Cleanup adalah tanggung jawab Owner. | File paths relatif terhadap project directory; no auto-delete policy |

---

## 9. Acceptance Criteria

### AC-CONT-001: Frame Extraction Otomatis (FR-020)

```gherkin
Given segmen video 10 detik telah berhasil di-generate dan di-download
When pipeline orchestrator memproses segmen tersebut
Then FFmpeg mengekstrak frame terakhir sebagai PNG
  And file PNG tersimpan di {project_dir}/frames/segment_{N}_last.png
  And resolusi PNG identik dengan resolusi video source
  And waktu ekstraksi < 2 detik
```

### AC-CONT-002: Reference Frame Injection (FR-021)

```gherkin
Given frame terakhir dari segmen N telah diekstrak
  And segmen N+1 siap untuk di-generate
When pipeline orchestrator mengirim request generasi segmen N+1
Then request ke Google Flow menyertakan frame PNG sebagai reference image
  And Owner dapat melihat thumbnail reference di Generation Node N+1
```

### AC-CONT-003: Prompt Context Carry-Over (FR-022)

```gherkin
Given pipeline memiliki 5 segmen (1, 2, 3, 4, 5)
  And segmen 1-4 telah selesai di-generate
When pipeline mempersiapkan prompt untuk segmen 5
Then prompt segmen 5 berisi context dari segmen 3, 4, dan 5's own prompt
  And context dari segmen 1 dan 2 sudah di-truncate
  And total karakter prompt (style lock + user prompt + context) ≤ 4000

Given Owner mengaktifkan "Override Context" pada segmen 3
When pipeline mempersiapkan prompt untuk segmen 3
Then prompt segmen 3 hanya berisi user prompt + style lock
  And carry-over context dari segmen 1-2 di-bypass
```

### AC-CONT-004: Style Lock (FR-023)

```gherkin
Given Owner mendefinisikan style lock text "anime style, cel shading, vibrant colors"
When pipeline mengirim request untuk setiap segmen
Then setiap request ke Google Flow memiliki style lock text di-prepend pada prompt
  And style lock text konsisten di semua segmen
  And style lock text tersimpan dalam file .flowproj
```

### AC-CONT-005: Sequential Pipeline Execution (FR-024)

```gherkin
Given pipeline berisi 3 segmen yang terhubung secara sequential
When Owner menekan "Start Pipeline"
Then segmen 1 dieksekusi terlebih dahulu (Queued → Generating → Downloading → Extracting → Complete)
  And segmen 2 baru dimulai setelah segmen 1 berstatus Complete
  And segmen 3 baru dimulai setelah segmen 2 berstatus Complete
  And UI menampilkan status real-time per node

Given segmen 2 berstatus Failed (setelah 3 retry)
When pipeline mendeteksi kegagalan
Then pipeline otomatis di-pause
  And Owner dinotifikasi via toast notification
  And Owner dapat memilih: Retry, Skip, atau Cancel
```

### AC-CONT-006: Manual Override (FR-021 extension)

```gherkin
Given segmen N memiliki auto-extracted reference frame
When Owner klik "Override Reference" dan upload gambar custom
Then gambar custom menggantikan auto-extracted frame untuk segmen N+1
  And badge "Manual Override" ditampilkan pada node
  And auto-extracted frame tetap tersimpan (tidak dihapus)

When Owner klik "Revert to Auto" pada node dengan override
Then reference kembali ke auto-extracted frame
  And badge "Manual Override" dihapus
```

---

## 10. UI/UX Specifications

### 10.1 Generation Node — Enhanced States

Setiap Generation Node di canvas menampilkan informasi continuity engine:

#### Visual States

| State | Tampilan | Interaksi |
|---|---|---|
| **Default** (Idle) | Node dengan prompt preview, reference thumbnail (jika ada), model badge. Border: neutral gray. | Klik → buka config panel. Drag → reposition. |
| **Queued** | Border: blue dashed. Status label "Queued" dengan queue position. Prompt dan reference locked (read-only). | Klik → view config (read-only). Right-click → "Remove from queue". |
| **Generating** | Border: amber pulse animation. Status label "Generating..." dengan elapsed time counter. Spinner icon. | Klik → view progress. No edit allowed. |
| **Downloading** | Border: amber solid. Status label "Downloading..." dengan progress bar (bytes downloaded / total). | No interaction. |
| **Extracting Frame** | Border: amber solid. Status label "Extracting frame..." | No interaction. |
| **Complete** | Border: green solid. Video preview thumbnail. Frame reference thumbnail untuk segmen berikutnya. Duration label. | Klik → play preview. Right-click → "Open in system player", "Re-generate", "Export segment". |
| **Failed** | Border: red solid. Error message summary. Retry count badge (e.g., "3/3 retries exhausted"). | Klik → view error detail. Right-click → "Retry", "Skip", "Cancel pipeline". |

#### State Machine Diagram

```
                    ┌──────────────────┐
                    │     Default      │
                    │   (Configurable) │
                    └────────┬─────────┘
                             │ [Start Pipeline]
                             ▼
                    ┌──────────────────┐
                    │     Queued       │
                    │   (Read-only)    │
                    └────────┬─────────┘
                             │ [Previous segment complete / first segment]
                             ▼
                    ┌──────────────────┐
            ┌──────│   Generating     │──────┐
            │      │   (Polling API)  │      │
            │      └────────┬─────────┘      │
            │               │ [Success]      │ [Error × 3]
            │               ▼                ▼
            │      ┌──────────────────┐  ┌──────────┐
            │      │  Downloading     │  │  Failed  │
            │      └────────┬─────────┘  └────┬─────┘
            │               │ [Complete]      │
            │               ▼                 │ [Retry]
            │      ┌──────────────────┐       │
            │      │ Extracting Frame │───────┘
            │      └────────┬─────────┘
            │               │ [Success]
            │               ▼
            │      ┌──────────────────┐
            └─────►│    Complete      │
                   │ (Preview ready)  │
                   └──────────────────┘
```

### 10.2 Reference Frame Thumbnail

- **Posisi:** Di bawah prompt preview area dalam Generation Node, label "Reference Frame".
- **Ukuran:** 120×68px (16:9 aspect ratio) atau 120×120px (1:1) sesuai aspect ratio video.
- **Interaksi:** Klik thumbnail → modal full-resolution preview.
- **Badge:** Jika manual override aktif → orange badge "Manual Override" di pojok kanan atas thumbnail.
- **Empty state:** Untuk segmen pertama tanpa reference → placeholder gray dengan teks "No reference" dan ikon image placeholder.

### 10.3 Style Lock Panel

- **Lokasi:** Toolbar atas Node Editor atau panel sidebar "Pipeline Settings".
- **Komponen:**
  - Text input multiline untuk style lock descriptor (max 500 karakter).
  - Character counter.
  - Toggle on/off.
  - Preview: "This text will be prepended to every segment prompt."
- **Persistence:** Tersimpan dalam `.flowproj` file.

### 10.4 Pipeline Control Bar

- **Lokasi:** Bottom bar pada Node Editor canvas.
- **Komponen:**
  - **Start/Pause/Resume** button — primary action.
  - **Cancel** button — destructive, memerlukan konfirmasi dialog.
  - **Progress indicator:** "Segment 3/15 — Generating..." dengan progress bar overall.
  - **Elapsed time** counter.
  - **ETA** estimasi berdasarkan average segment generation time.

### 10.5 Keyboard Shortcuts

| Shortcut | Aksi |
|---|---|
| `Ctrl+Shift+Enter` | Start/Resume pipeline |
| `Ctrl+Shift+P` | Pause pipeline |
| `Escape` | Cancel pipeline (dengan konfirmasi) |

### 10.6 Mobile / Responsive Behavior

Tidak berlaku — Flow Studio adalah desktop application (Tauri). Minimum window size: 1280×720px. Layout tidak mengakomodasi mobile viewport.

---

## 11. API References

### 11.1 Tauri IPC Commands (Rust → Frontend)

| Command | Direction | Payload | Response | Deskripsi |
|---|---|---|---|---|
| `cmd_pipeline_start` | Frontend → Rust | `{ project_id: string, segment_ids: string[] }` | `{ status: "started", pipeline_run_id: string }` | Memulai pipeline execution untuk project yang dipilih |
| `cmd_pipeline_pause` | Frontend → Rust | `{ pipeline_run_id: string }` | `{ status: "paused", current_segment: number }` | Pause pipeline di segmen saat ini (selesaikan segmen aktif terlebih dahulu) |
| `cmd_pipeline_resume` | Frontend → Rust | `{ pipeline_run_id: string }` | `{ status: "resumed", next_segment: number }` | Lanjutkan pipeline dari segmen terakhir yang belum selesai |
| `cmd_pipeline_cancel` | Frontend → Rust | `{ pipeline_run_id: string }` | `{ status: "cancelled", completed_segments: number }` | Cancel pipeline; segmen yang sudah complete tetap tersimpan |
| `cmd_pipeline_status` | Frontend → Rust | `{ pipeline_run_id: string }` | `PipelineStatus` (lihat §11.3) | Query status pipeline dan semua segmen |
| `cmd_segment_retry` | Frontend → Rust | `{ pipeline_run_id: string, segment_id: string }` | `{ status: "retrying" }` | Retry segmen yang Failed |
| `cmd_segment_skip` | Frontend → Rust | `{ pipeline_run_id: string, segment_id: string }` | `{ status: "skipped" }` | Skip segmen Failed, lanjut ke segmen berikutnya |
| `cmd_override_reference` | Frontend → Rust | `{ segment_id: string, image_path: string }` | `{ status: "override_set", path: string }` | Set manual override reference frame |
| `cmd_revert_override` | Frontend → Rust | `{ segment_id: string }` | `{ status: "override_reverted" }` | Revert ke auto-extracted frame |

### 11.2 Tauri Events (Rust → Frontend, real-time)

| Event | Payload | Trigger |
|---|---|---|
| `pipeline:segment_status_changed` | `{ segment_id: string, old_status: string, new_status: string, timestamp: number }` | Setiap kali status node berubah |
| `pipeline:segment_progress` | `{ segment_id: string, phase: string, progress_pct: number, detail: string }` | Update progress download/generation |
| `pipeline:frame_extracted` | `{ segment_id: string, frame_path: string, resolution: { w: number, h: number } }` | Frame berhasil diekstrak |
| `pipeline:pipeline_complete` | `{ pipeline_run_id: string, total_segments: number, total_duration_sec: number }` | Pipeline selesai semua segmen |
| `pipeline:pipeline_error` | `{ pipeline_run_id: string, segment_id: string, error: string, retry_count: number }` | Error pada segmen (setelah semua retry) |
| `pipeline:account_rotated` | `{ from_account_id: string, to_account_id: string, reason: string }` | Akun di-rotate oleh Flow Router |

### 11.3 Data Structures

```typescript
// Pipeline Status Response
interface PipelineStatus {
  pipeline_run_id: string;
  project_id: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  total_segments: number;
  completed_segments: number;
  current_segment_index: number | null;
  segments: SegmentStatus[];
  started_at: number | null;   // Unix timestamp ms
  elapsed_ms: number;
  style_lock_text: string | null;
}

// Per-Segment Status
interface SegmentStatus {
  segment_id: string;
  segment_index: number;
  status: 'idle' | 'queued' | 'generating' | 'downloading'
        | 'extracting_frame' | 'complete' | 'failed' | 'skipped';
  prompt_composed: string | null;     // Full prompt yang dikirim (termasuk carry-over + style lock)
  reference_frame_path: string | null;
  reference_type: 'auto' | 'manual' | 'none';
  video_path: string | null;
  extracted_frame_path: string | null;
  error_message: string | null;
  retry_count: number;
  generation_time_ms: number | null;
}

// FFmpeg Extraction Config
interface FrameExtractionConfig {
  input_path: string;
  output_path: string;
  method: 'sseof';           // -sseof -1
  output_format: 'png';
  quality: number;           // -q:v value (1 = highest, 31 = lowest)
}

// Prompt Composition
interface ComposedPrompt {
  style_lock: string | null;
  user_prompt: string;
  context_carry_over: string | null;  // dari 3 segmen terakhir
  total_chars: number;
  truncated: boolean;
}
```

---

## 12. Data Model References

### 12.1 SQLite Tables

#### `pipeline_runs`

| Column | Type | Constraints | Deskripsi |
|---|---|---|---|
| `id` | TEXT | PK, UUID | Pipeline run identifier |
| `project_id` | TEXT | FK → projects.id, NOT NULL | Project yang dieksekusi |
| `status` | TEXT | NOT NULL, CHECK(status IN ('idle','running','paused','completed','cancelled','failed')) | Status pipeline |
| `total_segments` | INTEGER | NOT NULL | Total segmen dalam pipeline |
| `completed_segments` | INTEGER | DEFAULT 0 | Jumlah segmen yang berhasil |
| `style_lock_text` | TEXT | NULLABLE | Style lock descriptor |
| `started_at` | INTEGER | NULLABLE | Unix timestamp ms |
| `completed_at` | INTEGER | NULLABLE | Unix timestamp ms |
| `created_at` | INTEGER | NOT NULL | Unix timestamp ms |

#### `segments`

| Column | Type | Constraints | Deskripsi |
|---|---|---|---|
| `id` | TEXT | PK, UUID | Segment identifier |
| `pipeline_run_id` | TEXT | FK → pipeline_runs.id, NOT NULL | Parent pipeline run |
| `node_id` | TEXT | FK → nodes.id, NOT NULL | Node editor node yang terkait |
| `segment_index` | INTEGER | NOT NULL | Urutan segmen dalam pipeline (0-based) |
| `status` | TEXT | NOT NULL | Status segmen (lihat enum di §11.3) |
| `prompt_composed` | TEXT | NULLABLE | Full prompt yang dikirim ke Google Flow |
| `reference_frame_path` | TEXT | NULLABLE | Path relatif ke reference frame |
| `reference_type` | TEXT | DEFAULT 'none', CHECK(reference_type IN ('auto','manual','none')) | Sumber reference frame |
| `video_path` | TEXT | NULLABLE | Path relatif ke video segment yang di-download |
| `extracted_frame_path` | TEXT | NULLABLE | Path relatif ke extracted frame PNG |
| `error_message` | TEXT | NULLABLE | Pesan error terakhir |
| `retry_count` | INTEGER | DEFAULT 0 | Jumlah retry yang telah dilakukan |
| `generation_time_ms` | INTEGER | NULLABLE | Durasi generasi (ms) |
| `account_id` | TEXT | NULLABLE | Akun Google Flow yang digunakan |
| `created_at` | INTEGER | NOT NULL | Unix timestamp ms |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp ms |

### 12.2 File System Structure

```
{project_dir}/
├── project.flowproj          # Graph definition + pipeline config
├── segments/                 # Downloaded video segments
│   ├── segment_0.mp4
│   ├── segment_1.mp4
│   └── ...
├── frames/                   # Auto-extracted last frames
│   ├── segment_0_last.png
│   ├── segment_1_last.png
│   └── ...
├── overrides/                # Manual override reference images
│   ├── segment_2_override.png
│   └── ...
└── export/                   # Final exported video (FEAT-VIDEO_EXPORT)
    └── output.mp4
```

---

## 13. Notifications & Side Effects

### 13.1 User Notifications (UI)

| Event | Notification Type | Message | Durasi |
|---|---|---|---|
| Pipeline started | Toast (info) | "Pipeline dimulai. {N} segmen dalam antrian." | 3 detik, auto-dismiss |
| Segment complete | Toast (success) | "Segmen {N}/{total} selesai." | 2 detik, auto-dismiss |
| Segment failed (after retries) | Toast (error) + Node badge | "Segmen {N} gagal setelah 3 retry. Pipeline di-pause." | Persistent hingga dismissed |
| Account rotated | Toast (warning) | "Akun {name} kehabisan credit. Beralih ke {next_name}." | 5 detik, auto-dismiss |
| All accounts exhausted | Dialog (blocking) | "Semua akun kehabisan credit. Tambahkan akun baru atau tunggu reset." | Persistent, memerlukan aksi |
| Pipeline complete | Toast (success) + Sound (optional) | "Pipeline selesai! {N} segmen, durasi total {T} detik." | 5 detik, auto-dismiss |
| Frame extraction failed | Toast (warning) | "Frame extraction gagal untuk segmen {N}. Gunakan manual override." | Persistent hingga dismissed |

### 13.2 System Side Effects

| Trigger | Side Effect |
|---|---|
| Segment generation complete | File video disimpan ke `{project_dir}/segments/` |
| Frame extraction complete | File PNG disimpan ke `{project_dir}/frames/` |
| Manual override set | File gambar di-copy ke `{project_dir}/overrides/` |
| Pipeline state change | Update SQLite `pipeline_runs` dan `segments` tables |
| Pipeline complete | Emit Tauri event `pipeline:pipeline_complete` untuk FEAT-VIDEO_EXPORT readiness |

---

## 14. Error & Recovery Behavior

| Skenario | Error Code | Pesan untuk User | Recovery |
|---|---|---|---|
| FFmpeg tidak ditemukan di PATH | `ERR-CONT-001` | "FFmpeg tidak ditemukan. Pastikan FFmpeg ter-install dan tersedia di system PATH." | Pre-flight check sebelum pipeline start; link ke panduan instalasi FFmpeg |
| Frame extraction gagal (video corrupt) | `ERR-CONT-002` | "Tidak dapat mengekstrak frame dari segmen {N}. File video mungkin rusak." | Retry extraction dengan `-err_detect ignore_err`; jika tetap gagal → opsi: re-generate segmen atau manual override |
| Google Flow API timeout | `ERR-CONT-003` | "Koneksi ke Google Flow timeout untuk segmen {N}." | Auto-retry dengan exponential backoff (2s, 4s, 8s) per NFR-003; setelah 3 retry → pause pipeline |
| Google Flow API 4xx (non-retryable) | `ERR-CONT-004` | "Google Flow menolak request untuk segmen {N}: {detail}." | Immediate fail (no retry); pause pipeline; Owner harus memeriksa prompt/reference |
| Google Flow API 429 (rate limit) | `ERR-CONT-005` | "Akun {name} terkena rate limit." | Flow Router otomatis rotate ke akun lain; jika semua exhausted → pause pipeline |
| Disk space insufficient | `ERR-CONT-006` | "Disk space tidak cukup untuk melanjutkan pipeline." | Pre-flight check; jika terjadi mid-pipeline → pause, minta Owner free up space |
| Prompt melebihi batas karakter | `ERR-CONT-007` | "Total prompt melebihi 4000 karakter. Context carry-over di-truncate otomatis." | Auto-truncate carry-over context mulai dari segmen paling lama; log warning |
| Pipeline state corruption | `ERR-CONT-008` | "State pipeline tidak konsisten. Pipeline di-reset." | Fallback: re-read state dari SQLite; jika inconsistent → mark pipeline as failed, minta Owner restart |
| Network disconnection mid-generation | `ERR-CONT-009` | "Koneksi terputus saat menunggu hasil segmen {N}." | Auto-retry setelah koneksi kembali (polling setiap 10 detik, max 5 menit); timeout → pause pipeline |

---

## 15. Edge Cases

### 15.1 Input Ekstrem

| Skenario | Handling |
|---|---|
| Pipeline dengan 1 segmen saja | Engine bypass continuity logic (tidak ada carry-over atau frame extraction); langsung generate dan complete |
| Pipeline dengan 100+ segmen | Tidak ada hard limit; prompt context window tetap 3 segmen terakhir. Memory footprint konstan karena frame extraction sequential (satu frame di memori pada satu waktu) |
| Prompt user sangat panjang (> 3500 karakter) | Carry-over context di-truncate agresif; jika user prompt + style lock saja sudah > 4000 karakter → warning, carry-over sepenuhnya dibuang |
| Style lock text kosong | Engine beroperasi tanpa style prefix; hanya user prompt + carry-over context yang dikirim |
| Video segmen berdurasi < 1 detik | FFmpeg `-sseof -1` masih mampu mengekstrak frame; jika gagal (durasi 0 frame) → fallback ke frame pertama (`-ss 0`) |
| Reference image resolusi sangat tinggi (> 4K) | Tidak ada downscaling oleh engine; kirim as-is ke Google Flow. Jika Google Flow menolak → ERR-CONT-004 |

### 15.2 Race Conditions

| Skenario | Handling |
|---|---|
| Owner menekan "Pause" saat FFmpeg sedang extract | Engine menunggu FFmpeg selesai (proses < 2 detik), lalu pause sebelum segmen berikutnya dimulai |
| Owner menekan "Cancel" saat segmen sedang generating | Segmen saat ini di-abort jika memungkinkan (cancel polling); status: Cancelled. Segmen yang sudah Complete tetap tersimpan |
| Owner mengubah prompt pada node yang sudah Queued | Perubahan ditolak; node dalam status Queued adalah read-only. Owner harus pause pipeline terlebih dahulu |
| Owner set manual override pada segmen yang sedang Generating | Override ditolak untuk segmen aktif; override hanya berlaku untuk segmen yang belum dimulai |

### 15.3 Empty State

| Skenario | Handling |
|---|---|
| Segmen pertama tanpa reference image | Text-to-video request (tanpa reference image); valid use case |
| Pipeline tanpa style lock | Engine beroperasi tanpa style prefix; tidak ada error |
| Semua akun expired/invalid sebelum pipeline start | Pre-flight check gagal; pipeline tidak dimulai; redirect ke Account Manager |

### 15.4 Batas Kuota

| Skenario | Handling |
|---|---|
| Akun habis credit di tengah pipeline | Flow Router otomatis rotate; pipeline berlanjut tanpa interupsi |
| Semua akun habis credit di tengah pipeline | Pipeline di-pause; Owner dinotifikasi; pipeline resume saat credit tersedia |
| FFmpeg concurrent processes (edge case: stuck process) | Timeout 30 detik per extraction; jika FFmpeg hang → kill process, mark Failed |

---

## 16. Security & Privacy

### 16.1 Anti-Abuse Measures

| Measure | Detail |
|---|---|
| **Rate limit** | Pipeline execution menerapkan delay 3–5 detik (randomized) antar generation request untuk menghindari burst pattern yang terdeteksi oleh Google Flow. Delay configurable via project settings. |
| **Captcha** | Tidak ada captcha internal. Jika Google Flow mengembalikan captcha challenge → pipeline pause, Owner menyelesaikan captcha secara manual di browser, lalu resume. |
| **Temp-mail check** | Tidak berlaku — Continuity Engine tidak mengelola email/akun; tanggung jawab FEAT-ACCOUNT_POOL. |
| **Bot detection** | Request ke Google Flow menyertakan realistic browser headers (User-Agent, Accept-Language) yang dikelola oleh Flow Router. Continuity Engine tidak menambahkan metadata identifiable. |
| **Abuse scenario** | Automated mass generation dari banyak akun curian. **Mitigasi:** Engine hanya menggunakan akun yang Owner import sendiri; tidak ada fitur account harvesting. Rate limiting antar request meniru pola penggunaan manusia. |

### 16.2 Data Privacy

| Aspek | Handling |
|---|---|
| Prompt content | Disimpan dalam SQLite lokal, tidak di-transmit ke pihak ketiga selain Google Flow |
| Video segments | Disimpan di file system lokal; tidak ada cloud sync atau telemetry |
| Frame PNGs | Disimpan di project directory; tidak di-upload ke external service |
| Pipeline logs | Disimpan di SQLite lokal; berisi metadata eksekusi, tidak berisi credential |

### 16.3 FFmpeg Security

| Aspek | Handling |
|---|---|
| Command injection | Semua FFmpeg arguments di-construct secara programatik oleh Rust backend; tidak ada string interpolation dari user input ke command line. Path di-sanitize: reject path traversal (`../`), null bytes, dan shell metacharacters |
| Temporary files | Frame extraction output ke deterministic path di project directory; tidak menggunakan `/tmp` yang bisa diakses proses lain |
| Process isolation | FFmpeg dijalankan via Tauri sidecar dengan limited permissions; stdout/stderr di-capture untuk logging |

---

## 17. Analytics & Audit Events

Semua event disimpan di SQLite lokal. Tidak ada external analytics service (personal tool, fully local).

| Event ID | Event Name | Data Captured | Trigger |
|---|---|---|---|
| `EV-CONT-001` | `pipeline_started` | `{ pipeline_run_id, project_id, total_segments, style_lock_enabled, timestamp }` | Owner menekan Start Pipeline |
| `EV-CONT-002` | `segment_generated` | `{ segment_id, segment_index, generation_time_ms, account_id, model, retry_count, timestamp }` | Segmen berhasil di-generate |
| `EV-CONT-003` | `frame_extracted` | `{ segment_id, frame_path, resolution_w, resolution_h, extraction_time_ms, timestamp }` | Frame berhasil diekstrak |
| `EV-CONT-004` | `segment_failed` | `{ segment_id, error_code, error_message, retry_count, timestamp }` | Segmen gagal setelah semua retry |
| `EV-CONT-005` | `pipeline_completed` | `{ pipeline_run_id, total_segments, completed_segments, skipped_segments, total_duration_ms, timestamp }` | Pipeline selesai |
| `EV-CONT-006` | `pipeline_cancelled` | `{ pipeline_run_id, completed_segments, reason, timestamp }` | Owner cancel pipeline |
| `EV-CONT-007` | `account_rotated` | `{ pipeline_run_id, from_account_id, to_account_id, reason, timestamp }` | Akun dirotasi mid-pipeline |
| `EV-CONT-008` | `reference_overridden` | `{ segment_id, override_path, timestamp }` | Owner set manual override |
| `EV-CONT-009` | `context_truncated` | `{ segment_id, original_chars, truncated_chars, timestamp }` | Carry-over context di-truncate karena melebihi limit |

### 17.1 Aggregate Metrics (rolling 30 hari)

| Metric | Formula | Kegunaan |
|---|---|---|
| Average segment generation time | `AVG(generation_time_ms)` dari `EV-CONT-002` | Estimasi ETA pipeline |
| Failure rate | `COUNT(EV-CONT-004) / COUNT(EV-CONT-002)` | Monitoring reliability engine |
| Average retry count | `AVG(retry_count)` dari segmen yang berhasil | Deteksi degradasi API |
| Account rotation frequency | `COUNT(EV-CONT-007) / COUNT(EV-CONT-001)` | Evaluasi efisiensi credit pool |

---

## 18. Testing Scenarios

### 18.1 Unit Tests

| Test ID | Skenario | Input | Expected Output |
|---|---|---|---|
| TEST-CNT-001 | Prompt composer: style lock + user prompt + carry-over | Style: "anime", Prompt: "A warrior", Context: ["scene 1", "scene 2", "scene 3"] | Composed prompt = "anime\n\nA warrior\n\nContinuing from: scene 1\nscene 2\nscene 3" |
| TEST-CNT-002 | Prompt composer: truncation saat melebihi 4000 chars | Style (200 chars) + Prompt (3000 chars) + Context 3 segmen (masing-masing 500 chars) | Context di-truncate: segmen tertua dihapus dulu, total ≤ 4000 |
| TEST-CNT-003 | Reference resolver: auto frame | segment_2 has extracted_frame_path set | Resolver returns auto frame path |
| TEST-CNT-004 | Reference resolver: manual override | segment_2 has both auto frame dan override | Resolver returns override path |
| TEST-CNT-005 | Reference resolver: segmen pertama tanpa reference | segment_index = 0, no manual override | Resolver returns None |
| TEST-CNT-006 | Sliding context window: persis 3 segmen | 5 segmen complete | Window berisi context dari segmen 3, 4, 5 |
| TEST-CNT-007 | Sliding context window: kurang dari 3 segmen | 2 segmen complete | Window berisi context dari segmen 1, 2 |

### 18.2 Integration Tests

| Test ID | Skenario | Setup | Verifikasi |
|---|---|---|---|
| TEST-CNT-020 | Frame extraction end-to-end (FR-020) | Video 10 detik valid di project directory | FFmpeg menghasilkan PNG; resolusi sesuai source; file valid |
| TEST-CNT-021 | Reference injection (FR-021) | Frame PNG diekstrak dari segmen 1 | Request ke Google Flow API stub menyertakan image reference |
| TEST-CNT-022 | Prompt carry-over (FR-022) | Pipeline 5 segmen; segmen 1-4 complete | Prompt segmen 5 berisi context segmen 3 dan 4; segmen 1-2 di-truncate |
| TEST-CNT-023 | Style lock (FR-023) | Style lock = "cinematic, 4K"; pipeline 3 segmen | Setiap request API stub menyertakan "cinematic, 4K" di prompt |
| TEST-CNT-024 | Sequential execution (FR-024) | Pipeline 3 segmen | Segmen 2 tidak dimulai sebelum segmen 1 Complete; timestamp monoton |

### 18.3 Failure / Edge Case Tests

| Test ID | Skenario | Setup | Verifikasi |
|---|---|---|---|
| TEST-CNT-030 | Frame extraction dari video corrupt | Video file dengan corrupt trailer | Engine melaporkan ERR-CONT-002; retry dengan `-err_detect ignore_err`; jika tetap gagal → status Failed |
| TEST-CNT-031 | Google Flow API timeout (3x retry) | API stub returns timeout 3 kali | Engine retry 3x dengan backoff (2s, 4s, 8s); pipeline pause setelah retry 3; notification muncul |
| TEST-CNT-032 | All accounts exhausted mid-pipeline | 2 akun; segmen 3 exhausts akun 1; segmen 5 exhausts akun 2 | Rotasi berhasil di segmen 3; pipeline pause di segmen 5 dengan notifikasi |
| TEST-CNT-033 | Disk space habis mid-pipeline | Mock disk space check returns false | Pipeline pause; ERR-CONT-006 ditampilkan |
| TEST-CNT-034 | Pipeline cancel saat generating | Pipeline running; segmen 3 sedang Generating | Segmen 3 di-abort; segmen 1-2 tetap Complete; pipeline status Cancelled |
| TEST-CNT-035 | Manual override set dan revert | Set override pada segmen 3; revert sebelum execution | Setelah set: reference_type = 'manual'. Setelah revert: reference_type = 'auto' |
| TEST-CNT-036 | Single segment pipeline | Pipeline dengan 1 segmen saja | No carry-over, no frame extraction; segmen langsung Complete |
| TEST-CNT-037 | Network disconnection mid-generation | Simulasi network drop selama polling | Auto-retry polling setiap 10 detik; timeout 5 menit → pause pipeline |

### 18.4 Performance Tests

| Test ID | Skenario | Target |
|---|---|---|
| TEST-CNT-040 | Frame extraction latency | < 2 detik untuk video 10 detik 1080p |
| TEST-CNT-041 | Memory footprint selama pipeline 30 segmen | < 200 MB RSS (engine process, excluding FFmpeg) |
| TEST-CNT-042 | Pipeline orchestrator overhead per segment transition | < 500 ms antara segmen $N$ complete dan segmen $N+1$ queued → generating |

---

## 19. Dependencies & Rollout

### 19.1 Internal Dependencies

| Dependency | Feature ID | Tipe | Detail |
|---|---|---|---|
| Multi-Account Flow Router | FEAT-ACCOUNT_POOL | Hard dependency | Continuity Engine mengirim generation requests via Flow Router; rotation logic diperlukan untuk pipeline panjang |
| Node Editor Pipeline Graph | FEAT-NODE_EDITOR | Hard dependency | Graph definition (node sequence, prompts, references) adalah input utama Continuity Engine |
| Credential Vault | FEAT-CREDENTIAL_VAULT | Indirect dependency | Vault harus unlocked agar Flow Router dapat mengakses session tokens |

### 19.2 External Dependencies

| Dependency | Versi | Lisensi | Fungsi |
|---|---|---|---|
| FFmpeg | ≥ 6.0 | LGPL 2.1 / GPL 2 | Frame extraction, video processing |
| Google Flow API | N/A (reverse-engineered) | Proprietary | Video generation backend |
| Tauri | 2.x | MIT / Apache-2.0 | Desktop runtime, IPC, sidecar management |
| reqwest | Latest | MIT / Apache-2.0 | HTTP client untuk Google Flow API calls (via Flow Router) |

### 19.3 Rollout Plan

| Phase | Milestone | Deliverable | Kriteria Selesai |
|---|---|---|---|
| Phase 4a | Frame Extraction | FFmpeg integration; extract last frame dari video file | TEST-CNT-020 pass; frame PNG valid dan resolusi sesuai |
| Phase 4b | Reference Injection | Auto-inject extracted frame ke generation request | TEST-CNT-021 pass; API request menyertakan reference image |
| Phase 4c | Prompt Carry-Over | Sliding context window; prompt composition | TEST-CNT-022, TEST-CNT-023 pass; carry-over dan style lock berfungsi |
| Phase 4d | Pipeline Orchestrator | Sequential execution, state machine, retry logic | TEST-CNT-024, TEST-CNT-031 pass; pipeline 5 segmen berjalan end-to-end |
| Phase 4e | UI Integration | Node states, reference thumbnail, pipeline control bar | Semua visual states (§10.1) dapat diverifikasi di Storybook atau live app |

### 19.4 Feature Flag

```
CONTINUITY_ENGINE_ENABLED=true   # Default true; set false untuk disable engine (bypass mode — generate tanpa continuity)
CONTEXT_WINDOW_SIZE=3            # Jumlah segmen dalam carry-over window
INTER_REQUEST_DELAY_MS=3000-5000 # Randomized delay antar generation requests
MAX_RETRY_ATTEMPTS=3             # Retry count sebelum marking Failed
```

---

## 20. Open Questions

| ID | Question | Impact | Status | Resolution Target |
|---|---|---|---|---|
| OQ-CONT-001 | Apakah Google Flow image-to-video endpoint menerima arbitrary reference image (uploaded PNG), atau hanya gambar dari Google Flow gallery? | Jika hanya gallery images, seluruh mekanisme reference injection perlu didesain ulang (mungkin via prompt-only continuity). | Open | Phase 4a — harus dijawab sebelum implementasi dimulai. Ref: OQ-04 (PLANNING.md) |
| OQ-CONT-002 | Berapa token/character limit efektif untuk prompt Google Flow? | Menentukan batas carry-over context window dan apakah 4000 karakter adalah ceiling yang tepat. | Open | Phase 4c — eksperimen dengan prompt panjang |
| OQ-CONT-003 | Apakah reference image berpengaruh signifikan terhadap visual continuity, atau Google Flow mengabaikannya untuk text-to-video model tertentu? | Jika reference image tidak efektif, style lock via prompt-only menjadi satu-satunya mekanisme continuity. | Open | Phase 4b — A/B test: generate dengan dan tanpa reference image |
| OQ-CONT-004 | Apakah diperlukan mekanisme "similarity threshold" untuk otomatis re-generate segmen yang visual-nya terlalu berbeda dari segmen sebelumnya? | Jika ya, scope meluas ke P1-08 (Smart Retry). Untuk MVP, evaluasi manual oleh Owner. | Open | Post-MVP evaluation |
| OQ-CONT-005 | Bagaimana handling jika Owner ingin pipeline non-linear (branching — satu segmen menjadi reference untuk 2 segmen berbeda)? | Saat ini pipeline strictly sequential. Branching memerlukan DAG execution engine. | Deferred | Post-MVP; memerlukan re-architecture |

---

*Document generated: 2026-09-24. Dokumen ini mengikuti template PRD §11.4 dari PLANNING_v5.2.md.*
