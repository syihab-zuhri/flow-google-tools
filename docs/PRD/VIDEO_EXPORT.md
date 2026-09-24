# PRD: Video Export

> **Feature ID:** FEAT-VIDEO_EXPORT  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Priority:** P0  
> **Owner:** Backend Agent  
> **Dependencies:** FEAT-CONTINUITY_ENGINE  
> **Last Updated:** 2026-09-24

---

## 1. Overview

Video Export adalah tahap akhir dari pipeline Flow Studio — menggabungkan seluruh segmen video yang telah di-generate menjadi satu file video koheren menggunakan FFmpeg. Fitur ini mencakup:

- **Concatenation:** Menggabungkan semua segmen dalam pipeline secara sequential menggunakan FFmpeg concat demuxer. Audio track (jika ada) di-merge. Transition antar segmen: hard cut (default).
- **Preview:** Menampilkan hasil concatenation di embedded video player sebelum export final, dilengkapi segment marker overlay di seekbar.
- **Per-Segment Export:** Mengekspor segmen individual tanpa concatenation via context menu atau batch export dialog.
- **Format & Resolution Selection:** Owner memilih format output (MP4 H.264, WebM VP9) dan resolusi (Original, 1080p, 720p) saat export. Transcoding dilakukan oleh FFmpeg.

Fitur ini menjembatani output dari Continuity Engine (segmen-segmen video dengan visual continuity) ke deliverable akhir berupa file video yang siap distribusi. Tanpa Video Export, pipeline menghasilkan file-file terpisah yang tidak bisa langsung digunakan sebagai konten final.

---

## 2. Goals

| ID | Goal | Measurable Target |
|---|---|---|
| GOAL-EXP-001 | Menghasilkan file video final dari pipeline segments | Output video ≥3 menit (≥18 segments × ~10 detik) dalam satu export operation |
| GOAL-EXP-002 | Preview akurat sebelum export | Preview video identik secara frame-accurate dengan hasil export final |
| GOAL-EXP-003 | Fleksibilitas format output | Mendukung minimal 2 format (MP4, WebM) dan 3 resolusi (Original, 1080p, 720p) |
| GOAL-EXP-004 | Transparansi progress | Owner mengetahui estimasi waktu dan persentase penyelesaian export secara real-time |
| GOAL-EXP-005 | Integritas output | File output playable di VLC, Windows Media Player, dan browser tanpa artifact di junction point antar segmen |

---

## 3. Non-Goals (khusus fitur ini)

| Item | Alasan Exclusion |
|---|---|
| Transition effects (fade, dissolve, wipe) antar segmen | Scope P2; MVP menggunakan hard cut only |
| Audio mixing atau background music overlay | Diluar scope Video Export; audio hanya di-passthrough dari source segments |
| Cloud upload setelah export (YouTube, Google Drive) | Flow Studio sepenuhnya local; tidak ada cloud integration |
| Video editing (trim, crop, color grading) per segmen | Flow Studio bukan video editor; output dari Google Flow diambil as-is |
| Real-time rendering preview (streaming preview) | Preview dibuat via FFmpeg pre-render, bukan real-time compositing |
| Subtitle/caption embedding | Tidak ada text-to-speech atau subtitle pipeline dalam scope saat ini |

---

## 4. Actors & Permissions

| Actor | Tipe | Permission | Deskripsi |
|---|---|---|---|
| Owner | Human (Primary) | Full access | Satu-satunya user — memiliki akses penuh ke seluruh fitur export: preview, concatenate, per-segment export, format selection, output directory selection |
| FFmpeg | System (External Tool) | Execute-only | CLI binary yang dipanggil sebagai subprocess oleh Tauri backend. Tidak memiliki permission mandiri — seluruh invocation dikontrol oleh sistem |

> **Catatan:** Flow Studio adalah personal tool tanpa multi-user auth (BC-001). Tidak ada RBAC, role hierarchy, atau permission granularity. Owner = satu-satunya pengguna.

---

## 5. Preconditions

| ID | Precondition | Validation Method | Behavior jika Tidak Terpenuhi |
|---|---|---|---|
| PRE-EXP-001 | Minimal 2 segmen video telah berhasil di-generate (status: Complete) dalam pipeline aktif | Cek `segment.status === 'Complete'` pada project graph | Tombol Export dan Preview disabled. Tooltip: "Minimal 2 segmen harus selesai di-generate sebelum export." |
| PRE-EXP-002 | FFmpeg binary tersedia — ditemukan di PATH atau path custom yang dikonfigurasi di Settings | Cek keberadaan binary via `ffmpeg -version` subprocess call | Fitur export sepenuhnya disabled. Banner peringatan: "FFmpeg tidak ditemukan. Konfigurasi path FFmpeg di Settings → FFmpeg Path Config." Lihat BC-004. |
| PRE-EXP-003 | Project telah disimpan (`.flowproj` file exists) | Cek `project.savedPath !== null` | Prompt auto-save sebelum export dimulai |
| PRE-EXP-004 | Disk space cukup untuk output file | Estimasi ukuran output berdasarkan total durasi × bitrate → bandingkan dengan available disk space | Error dialog: "Insufficient disk space. Need approximately [X] GB. Available: [Y] GB." Export tidak dimulai. |

---

## 6. User Stories

| ID | Story | Priority | Acceptance Summary |
|---|---|---|---|
| US-EXP-001 | Sebagai Owner, saya ingin semua segmen digabungkan menjadi satu file video sehingga saya memiliki video long-form yang lengkap. | P0 | 5 segmen × 10 detik → output 50 detik, playable tanpa artifact di junction point, audio continuous |
| US-EXP-002 | Sebagai Owner, saya ingin preview video gabungan sebelum export sehingga saya bisa memastikan hasilnya sesuai ekspektasi. | P1 | Preview menampilkan video gabungan dengan segment markers di seekbar. Seek ke marker melompat ke awal segmen. |
| US-EXP-003 | Sebagai Owner, saya ingin mengekspor segmen individual secara terpisah jika diperlukan. | P1 | Context menu "Export Segment" pada node → file tersimpan. Batch export → naming `[project]_seg_[001].[ext]` |
| US-EXP-004 | Sebagai Owner, saya ingin memilih format output (MP4, WebM) dan resolusi (Original, 1080p, 720p) saat export. | P1 | Export MP4 1080p → file sesuai format/resolusi. Export WebM → codec VP9 terverifikasi |
| US-EXP-005 | Sebagai Owner, saya ingin melihat progress indicator selama export sehingga saya tahu estimasi waktu penyelesaian. | P1 | Progress bar menampilkan persentase, elapsed time, dan estimated remaining time. Progress di-update setiap detik. |

---

## 7. Functional Flow (happy, alternate, failure)

### 7.1 Happy Path — Full Export

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Owner klik "Preview Full Video" di toolbar                   │
│    └─► Sistem validasi: semua segmen Complete? ✓                │
│                                                                 │
│ 2. Sistem menjalankan FFmpeg concat demuxer                     │
│    └─► Input: file list segmen berurutan                        │
│    └─► Output: temporary preview file (.mp4) di temp directory  │
│                                                                 │
│ 3. Embedded video player menampilkan preview                    │
│    └─► Segment markers visible di seekbar                       │
│    └─► Play/pause, seek, volume control tersedia                │
│                                                                 │
│ 4. Owner puas → klik "Export"                                   │
│    └─► Export Settings dialog muncul                            │
│                                                                 │
│ 5. Owner memilih:                                               │
│    ├─► Format: MP4 (H.264) [default]                            │
│    ├─► Resolution: 1080p [default]                              │
│    └─► Output location: Browse dialog → pilih folder            │
│                                                                 │
│ 6. Sistem validasi disk space → cukup ✓                         │
│                                                                 │
│ 7. FFmpeg transcode + export dimulai                            │
│    └─► Progress bar: percentage, elapsed, ETA                   │
│                                                                 │
│ 8. Export selesai                                                │
│    └─► Notifikasi: "Export complete"                             │
│    └─► Action link: "Open in Explorer"                          │
│    └─► File: ProjectName_YYYYMMDD_HHMMSS.mp4                   │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Alternate Paths

| ID | Scenario | Flow |
|---|---|---|
| ALT-EXP-001 | Export per-segmen individual | Owner klik kanan node → "Export Segment" → file dialog → segmen di-export ke lokasi pilihan tanpa concatenation. Naming: `[project]_seg_[N].[ext]` |
| ALT-EXP-002 | Batch export segmen | Owner buka Export dialog → pilih "Export segments individually" → semua segmen Complete di-export ke satu folder dengan naming convention `[project]_seg_[001].[ext]`, `[project]_seg_[002].[ext]`, dst. |
| ALT-EXP-003 | Re-export format berbeda | Owner sudah export MP4, ingin WebM → buka Export dialog → pilih WebM VP9 → export kedua dijalankan. Source segments tetap utuh (BR-EXP-004). |
| ALT-EXP-004 | Export tanpa preview | Owner langsung klik "Export" tanpa preview terlebih dahulu → dialog export settings muncul → proses export berjalan normal. Preview bukan mandatory step. |
| ALT-EXP-005 | Ubah output directory | Owner klik Browse di Export dialog → navigate ke folder berbeda → folder baru digunakan sebagai output. Default tetap project folder (BR-EXP-003). |

### 7.3 Failure Paths

| ID | Scenario | System Behavior |
|---|---|---|
| FAIL-EXP-001 | Segmen missing saat concat (beberapa berstatus Failed/Skipped) | Warning dialog: "[N] segments missing. Export will skip these segments. Continue?" Daftar segmen yang di-skip ditampilkan. Jika Owner proceed, export dilanjutkan tanpa segmen tersebut. Jika Cancel, kembali ke canvas. |
| FAIL-EXP-002 | Disk space insufficient | Error dialog sebelum export dimulai: "Insufficient disk space. Need approximately [X] GB. Available: [Y] GB." Export tidak dimulai. Owner harus free up space atau pilih output directory di drive lain. |
| FAIL-EXP-003 | FFmpeg crash selama export | Sistem mendeteksi FFmpeg process exit with non-zero code → menampilkan error dialog dengan FFmpeg stderr log. Partial output file dibersihkan (deleted). Owner dapat retry atau export dengan settings berbeda (e.g., resolusi lebih rendah). |
| FAIL-EXP-004 | Corrupted segment file | FFmpeg gagal membaca segment file → error log mencantumkan segment mana yang corrupt. Sistem menawarkan: "Skip corrupted segment and continue?" atau "Abort export." |
| FAIL-EXP-005 | Export dibatalkan oleh Owner (Cancel) | Owner klik Cancel pada progress dialog → FFmpeg process di-kill (SIGTERM) → partial output file dibersihkan → kembali ke canvas. State pipeline tidak berubah. |

---

## 8. Business Rules

| ID | Rule | Rationale |
|---|---|---|
| BR-EXP-001 | Segmen harus memiliki resolusi dan codec yang matching untuk seamless concat. Jika mismatch terdeteksi, sistem otomatis transcode semua segmen ke common format (H.264, resolusi tertinggi yang diminta) sebelum concat. | FFmpeg concat demuxer memerlukan stream parameters identik. Pre-transcode menghindari artifact dan playback issues di output final. |
| BR-EXP-002 | Default output format: MP4 (H.264), resolusi 1080p (1920×1080), video bitrate 8 Mbps, audio AAC 192 kbps (jika ada audio track). | MP4 H.264 adalah format paling kompatibel untuk distribusi. 1080p adalah resolusi standar untuk content platform. |
| BR-EXP-003 | Export directory default: subfolder `exports/` di dalam project folder. Owner dapat mengubah ke lokasi lain via Browse dialog. Pilihan terakhir di-persist ke project settings. | Meminimalkan friction — output langsung ada di project folder. Persist pilihan agar Owner tidak perlu browse ulang setiap export. |
| BR-EXP-004 | Export tidak menghapus source segments. File segmen original tetap ada di project directory setelah export selesai. | Source segments diperlukan untuk re-export, format berbeda, atau debugging. Penghapusan harus eksplisit oleh Owner (diluar scope fitur ini). |
| BR-EXP-005 | File naming convention: `{ProjectName}_{YYYYMMDD}_{HHMMSS}.{ext}`. Karakter non-alphanumeric di ProjectName di-replace dengan underscore. Jika file sudah ada, append suffix `_1`, `_2`, dst. | Naming yang predictable dan unique mencegah overwrite tidak disengaja. Timestamp memudahkan versioning manual. |

---

## 9. Acceptance Criteria

### AC-EXP-001: Concatenation (FR-030)

```gherkin
Given pipeline memiliki 5 segmen video, masing-masing 10 detik, semua berstatus Complete
When Owner klik "Export" dan memilih default settings (MP4, 1080p)
Then sistem menghasilkan file MP4 berdurasi 50 detik
  And video playable di VLC tanpa artifact di junction point antar segmen
  And audio track (jika ada) continuous tanpa gap atau pop
  And file tersimpan dengan naming convention BR-EXP-005
```

### AC-EXP-002: Preview (FR-031)

```gherkin
Given pipeline memiliki minimal 2 segmen Complete
When Owner klik "Preview Full Video"
Then embedded video player menampilkan video gabungan
  And seekbar menampilkan segment markers yang menunjukkan batas antar segmen
  And klik pada segment marker melompat ke frame pertama segmen tersebut
  And player mendukung play/pause, seek, dan volume control
```

### AC-EXP-003: Per-Segment Export (FR-032)

```gherkin
Given segmen Video/Clip Node berstatus Complete
When Owner klik kanan node dan pilih "Export Segment"
Then file dialog muncul untuk memilih lokasi penyimpanan
  And segmen tersimpan sebagai file individual di lokasi pilihan
  And file playable dan resolusi sesuai source

Given Owner membuka Export dialog dan pilih "Export segments individually"
When Owner konfirmasi batch export
Then semua segmen Complete di-export ke folder yang dipilih
  And naming convention: {ProjectName}_seg_{NNN}.{ext} (NNN = zero-padded 3 digit)
```

### AC-EXP-004: Format & Resolution Selection (FR-033)

```gherkin
Given Owner membuka Export dialog
When Owner memilih format MP4 dan resolusi 1080p
Then output file berformat MP4 dengan codec H.264
  And resolusi output 1920×1080
  And bitrate video ~8 Mbps

When Owner memilih format WebM dan resolusi 720p
Then output file berformat WebM dengan codec VP9
  And resolusi output 1280×720
```

### AC-EXP-005: Progress Indicator

```gherkin
Given export sedang berjalan
When FFmpeg memproses segmen
Then progress bar menampilkan persentase penyelesaian (0-100%)
  And elapsed time ditampilkan dalam format HH:MM:SS
  And estimated remaining time ditampilkan
  And progress di-update minimal setiap 1 detik
  And tombol Cancel tersedia dan fungsional
```

### AC-EXP-006: Mismatch Resolution Handling

```gherkin
Given pipeline memiliki segmen dengan resolusi berbeda (mix 720p dan 1080p)
When Owner memilih export dengan resolusi 1080p
Then sistem otomatis transcode segmen 720p ke 1080p sebelum concat
  And output final memiliki resolusi konsisten 1920×1080
  And Owner menerima notifikasi: "N segments were transcoded to match target resolution."
```

---

## 10. UI/UX Specifications

### 10.1 Export Dialog

Komponen dialog modal yang muncul saat Owner klik "Export" di toolbar atau Pipeline Execution Panel.

| Element | Spesifikasi |
|---|---|
| Title | "Export Video" |
| Format selector | Dropdown: MP4 (H.264) [default], WebM (VP9) |
| Resolution selector | Dropdown: Original, 1080p (1920×1080) [default], 720p (1280×720) |
| Export mode | Radio: "Full video (concatenated)" [default], "Segments individually" |
| Output directory | Text field (read-only) + Browse button. Default: `{project_dir}/exports/` |
| File name preview | Read-only text menampilkan nama file yang akan dihasilkan |
| Estimated size | Label: "Estimated output size: ~[X] MB" |
| Disk space | Label: "Available disk space: [Y] GB" |
| Export button | Primary button, disabled jika preconditions tidak terpenuhi |
| Cancel button | Secondary button |

### 10.2 Progress Dialog

Komponen dialog non-modal (atau panel) yang menampilkan progress export.

| Element | Spesifikasi |
|---|---|
| Progress bar | Horizontal bar, 0-100%, animated |
| Percentage label | "XX%" di atas atau di dalam progress bar |
| Current operation | "Transcoding segment 3/10..." atau "Concatenating..." |
| Elapsed time | "Elapsed: 00:02:34" |
| Estimated remaining | "Remaining: ~00:05:12" |
| Cancel button | "Cancel Export" — dengan konfirmasi dialog |

### 10.3 Preview Player

Embedded video player yang muncul di panel terpisah atau overlay.

| Element | Spesifikasi |
|---|---|
| Video viewport | Area utama menampilkan video preview |
| Play/Pause | Toggle button di control bar |
| Seekbar | Horizontal slider dengan segment markers (vertikal line berwarna di posisi junction antar segmen) |
| Segment markers | Clickable — klik melompat ke awal segmen tersebut. Tooltip: "Segment N" |
| Volume | Slider control |
| Timestamp | "MM:SS / MM:SS" (current / total) |
| Export button | "Export This" — shortcut langsung ke Export Dialog |

### 10.4 Visual States

| State | Deskripsi | Trigger |
|---|---|---|
| **Default** | Export Dialog menampilkan semua field terisi default values. Preview player siap digunakan. Semua control aktif. | Semua preconditions terpenuhi |
| **Disabled** | Tombol "Export" dan "Preview" di-grey-out. Tooltip menjelaskan alasan (e.g., "Minimal 2 segmen harus selesai"). | Preconditions tidak terpenuhi: <2 segmen Complete, atau FFmpeg tidak ditemukan |
| **Loading** | Skeleton loader pada Preview Player saat FFmpeg sedang membuat preview file. Progress spinner di Export Dialog saat estimasi ukuran dihitung. | Saat concat untuk preview berjalan, atau saat estimasi file size dihitung |
| **Error** | Error banner merah di Export Dialog jika disk space kurang. Error dialog dengan FFmpeg log jika export gagal. | Disk space insufficient, FFmpeg error, corrupted segment |
| **Empty** | Tidak ada segmen Complete — Export section menampilkan empty state: ilustrasi + teks "Belum ada segmen video yang selesai. Jalankan pipeline untuk mulai generate." | Project baru atau semua segmen belum di-generate |
| **Mobile** | Tidak applicable — Flow Studio adalah desktop-only application (Windows). Tidak ada responsive/mobile behavior. | — |

---

## 11. API References

Video Export tidak mengekspos REST API eksternal. Semua operasi dilakukan via Tauri Commands (IPC antara React frontend dan Rust backend).

### 11.1 Tauri Commands

| Command | Input | Output | Deskripsi |
|---|---|---|---|
| `export_concatenate` | `{ project_id: string, format: "mp4" \| "webm", resolution: "original" \| "1080p" \| "720p", output_dir: string }` | `{ success: bool, output_path: string, duration_seconds: f64, file_size_bytes: u64 }` | Menjalankan FFmpeg concat + transcode. Mengembalikan path file output dan metadata. |
| `export_preview` | `{ project_id: string }` | `{ success: bool, preview_path: string, segment_markers: Vec<f64> }` | Membuat temporary preview file. Mengembalikan path dan array timestamp (detik) untuk segment markers di seekbar. |
| `export_segment` | `{ project_id: string, segment_index: u32, format: "mp4" \| "webm", resolution: "original" \| "1080p" \| "720p", output_path: string }` | `{ success: bool, output_path: string }` | Export satu segmen individual. |
| `export_batch_segments` | `{ project_id: string, format: "mp4" \| "webm", resolution: "original" \| "1080p" \| "720p", output_dir: string }` | `{ success: bool, exported: Vec<string>, failed: Vec<{ index: u32, error: string }> }` | Batch export semua segmen Complete ke folder. |
| `export_estimate_size` | `{ project_id: string, format: "mp4" \| "webm", resolution: "original" \| "1080p" \| "720p" }` | `{ estimated_bytes: u64, available_bytes: u64, sufficient: bool }` | Estimasi ukuran output dan cek disk space tanpa menjalankan export. |
| `export_cancel` | `{ project_id: string }` | `{ success: bool }` | Membatalkan export yang sedang berjalan. Kill FFmpeg process. |
| `export_validate_segments` | `{ project_id: string }` | `{ total: u32, complete: u32, failed: u32, skipped: u32, missing: Vec<u32>, mismatched_resolution: bool }` | Validasi semua segmen sebelum export. Deteksi missing, failed, dan resolution mismatch. |

### 11.2 Event Emitter (Tauri → Frontend)

| Event | Payload | Deskripsi |
|---|---|---|
| `export:progress` | `{ percentage: f32, current_segment: u32, total_segments: u32, elapsed_seconds: f64, eta_seconds: f64, phase: "transcoding" \| "concatenating" \| "finalizing" }` | Di-emit setiap ~1 detik selama export berjalan |
| `export:complete` | `{ output_path: string, duration_seconds: f64, file_size_bytes: u64 }` | Di-emit saat export berhasil selesai |
| `export:error` | `{ error_code: string, message: string, ffmpeg_log: string }` | Di-emit saat export gagal |

---

## 12. Data Model References

### 12.1 ExportConfig

Bagian dari Project Graph (`.flowproj` JSON).

```typescript
interface ExportConfig {
  format: 'mp4' | 'webm';           // Default: 'mp4'
  resolution: 'original' | '1080p' | '720p'; // Default: '1080p'
  output_dir: string;                // Default: '{project_dir}/exports/'
  video_bitrate_kbps: number;        // Default: 8000 (8 Mbps)
  audio_bitrate_kbps: number;        // Default: 192
  last_export_path: string | null;   // Path file export terakhir
  last_export_timestamp: string | null; // ISO 8601
}
```

### 12.2 ExportJob (Runtime — Zustand State)

```typescript
interface ExportJob {
  id: string;                        // UUID
  project_id: string;
  status: 'idle' | 'validating' | 'transcoding' | 'concatenating' | 'finalizing' | 'complete' | 'failed' | 'cancelled';
  progress_percentage: number;       // 0-100
  current_segment: number;
  total_segments: number;
  elapsed_seconds: number;
  eta_seconds: number;
  output_path: string | null;
  error: string | null;
  ffmpeg_log: string[];              // Rolling buffer, last 100 lines
  started_at: string | null;         // ISO 8601
  completed_at: string | null;       // ISO 8601
}
```

### 12.3 SegmentFile (Referensi dari Pipeline)

```typescript
interface SegmentFile {
  index: number;                     // Urutan dalam pipeline (0-based)
  file_path: string;                 // Relative path dari project directory
  duration_seconds: number;          // Durasi segmen
  resolution: { width: number; height: number };
  codec: string;                     // e.g., 'h264', 'vp9'
  file_size_bytes: number;
  status: 'complete' | 'failed' | 'skipped' | 'pending';
}
```

---

## 13. Notifications & Side Effects

### 13.1 Notifications

| Trigger | Notifikasi | Channel |
|---|---|---|
| Export berhasil selesai | "Export complete — {filename}" dengan action link "Open in Explorer" | In-app toast notification + Windows system notification (jika app di-minimize) |
| Export gagal | "Export failed — {error_summary}" dengan action "View Log" | In-app error dialog |
| Preview siap | "Preview ready" (jika proses concat preview memakan waktu >5 detik) | In-app toast |
| Resolution mismatch terdeteksi | "Resolution mismatch detected. {N} segments will be transcoded to match target." | In-app warning banner di Export Dialog |
| Disk space warning | "Low disk space — only {X} GB remaining after export." (jika <1 GB sisa setelah export) | In-app warning di Export Dialog |

### 13.2 Side Effects

| Action | Side Effect |
|---|---|
| Preview | Temporary file dibuat di OS temp directory. File dihapus saat preview player ditutup atau project di-close. |
| Export | File output dibuat di output directory. `ExportConfig.last_export_path` dan `last_export_timestamp` di-update di project settings. |
| Cancel export | Partial output file dihapus. FFmpeg process di-terminate. Tidak ada perubahan pada project state atau source segments. |
| Batch export | Multiple file dibuat. Project settings tidak menyimpan batch export history (hanya last single export). |

---

## 14. Error & Recovery Behavior

| Error | Detection | User-Facing Message | Recovery |
|---|---|---|---|
| FFmpeg not found | `ffmpeg -version` subprocess gagal | "FFmpeg tidak ditemukan. Buka Settings → FFmpeg Path Config untuk mengatur lokasi FFmpeg." | Owner install FFmpeg atau configure path. Fitur export disabled sampai FFmpeg tersedia. |
| FFmpeg crash (non-zero exit) | Process exit code ≠ 0 | "Export gagal. FFmpeg encountered an error." + expandable stderr log | Partial file dihapus. Owner retry atau ubah settings (resolusi lebih rendah, format berbeda). |
| Corrupted segment | FFmpeg error saat membaca segment file | "Segment {N} tidak dapat dibaca (file corrupt). Skip segmen ini?" | Owner pilih Skip → export lanjut tanpa segmen tersebut. Atau Abort → kembali ke canvas, re-generate segmen. |
| Disk full mid-export | Write error dari FFmpeg atau OS | "Disk penuh selama export. Partial file telah dihapus. Bebaskan disk space dan coba lagi." | Partial file dihapus. Owner free up space, ubah output directory, atau pilih resolusi lebih rendah. |
| Segment resolution mismatch | Pre-export validation membandingkan resolusi semua segmen | "Resolusi segmen tidak seragam. Sistem akan transcode ke resolusi target." | Otomatis — sistem transcode semua segmen ke resolusi target sebelum concat. Informational notification. |
| Export cancelled by user | Owner klik Cancel | "Export dibatalkan. Partial file telah dihapus." | Partial file dihapus. State kembali ke idle. Owner dapat restart export kapan saja. |
| Permission denied pada output directory | OS write permission error | "Tidak dapat menulis ke {path}. Periksa permission folder atau pilih lokasi lain." | Owner pilih output directory berbeda yang memiliki write permission. |
| Timeout — FFmpeg hang | Watchdog timer: jika progress tidak berubah selama 120 detik | "Export timed out — FFmpeg tidak merespons. Process dihentikan." | FFmpeg di-kill. Partial file dihapus. Owner retry. Jika persist, cek FFmpeg version compatibility. |

---

## 15. Edge Cases

### 15.1 Input Ekstrem

| Case | Behavior |
|---|---|
| Pipeline dengan 100+ segmen (~17 menit video) | Sistem harus handle tanpa OOM. FFmpeg concat demuxer menggunakan file list (bukan piping semua file), sehingga memory usage minimal. Progress bar menampilkan per-segment progress. |
| Segmen dengan durasi sangat pendek (<1 detik) | Concat tetap dilakukan. Warning jika segmen <1 detik terdeteksi: "Segment {N} sangat pendek ({X}s). Hasil mungkin terlihat glitchy." |
| Single segment (hanya 1 segmen Complete, padahal precondition ≥2) | Export button disabled. Tombol "Export Segment" per-node tetap available (ALT-EXP-001). |
| Output file size >4 GB | MP4 otomatis menggunakan `mov_flags +faststart` dan 64-bit mdat. Warning: "Output melebihi 4 GB — beberapa player lama mungkin tidak mendukung." |

### 15.2 Race Condition

| Case | Behavior |
|---|---|
| Owner memulai export lalu menutup project | Export di-cancel otomatis. Partial file dihapus. Konfirmasi dialog: "Export sedang berjalan. Batalkan dan tutup project?" |
| Double-click Export button | Debounce — klik kedua diabaikan jika export sudah berjalan. Export button disabled saat `ExportJob.status !== 'idle'`. |
| Pipeline masih berjalan saat Owner klik Export | Export button disabled selama pipeline execution aktif. Tooltip: "Tunggu pipeline selesai sebelum export." |

### 15.3 Empty State

| Case | Behavior |
|---|---|
| Tidak ada segmen Complete | Export section menampilkan empty state illustration + teks instruksi |
| Semua segmen Failed | Export disabled. Message: "Semua segmen gagal di-generate. Re-run pipeline atau perbaiki segmen yang bermasalah." |

### 15.4 Batas Kuota

| Case | Behavior |
|---|---|
| Disk space <500 MB setelah estimasi | Hard block — export tidak dimulai. Error dialog dengan estimasi ukuran output vs available space. |
| Disk space 500 MB – 1 GB setelah estimasi | Soft warning — export diizinkan, tapi warning ditampilkan: "Disk space rendah. Pertimbangkan untuk memilih resolusi lebih rendah." |

### 15.5 Sequence Integrity

| Case | Behavior |
|---|---|
| Missing segments in sequence (e.g., segment 3 dari 5 missing) | Warning dialog menampilkan daftar segmen missing. Owner pilih: (a) Skip — concat tanpa segmen missing (output akan ada jump), (b) Abort. |
| Segment ordering berbeda dari pipeline graph | Sistem selalu menggunakan urutan dari pipeline graph (topological order), bukan filesystem order. Jika graph order ambigu, gunakan node index ascending. |

---

## 16. Security & Privacy

### 16.1 Data Security

| Aspek | Implementasi |
|---|---|
| File output | Disimpan di local filesystem tanpa encryption. Owner bertanggung jawab atas security file output. |
| Temporary files | Preview file dibuat di OS temp directory dengan random filename. Dihapus saat preview ditutup. Tidak mengandung credential atau metadata sensitif. |
| FFmpeg invocation | Subprocess call dengan argument sanitization. Path dan filename di-escape untuk mencegah command injection. Tidak ada user-controlled string yang langsung masuk ke shell command. |
| Metadata stripping | Output video tidak menyertakan metadata yang mengidentifikasi source accounts atau Google Flow generation IDs. FFmpeg flag: `-map_metadata -1`. |

### 16.2 Anti-Abuse Measures

| Measure | Implementasi |
|---|---|
| Rate limit | Tidak applicable — semua operasi lokal, tidak ada network endpoint. Satu export job per waktu (queue, bukan concurrent). |
| Captcha | Tidak applicable — personal desktop tool tanpa login atau network-facing interface. |
| Temp-mail check | Tidak applicable — tidak ada registration atau invitation flow. |
| Bot detection | Tidak applicable — tidak ada server-side component. |
| Abuse scenario | **Path traversal via output directory:** Owner memilih output directory via OS native dialog (bukan free-text input). Sistem memvalidasi path adalah directory yang writable dan bukan system directory. **Command injection via project name:** Project name di-sanitize (alphanumeric + underscore only) sebelum digunakan dalam filename dan FFmpeg arguments. |

---

## 17. Analytics & Audit Events

Semua analytics bersifat local-only — disimpan di SQLite database lokal. Tidak ada telemetry ke server eksternal.

| Event | Data Captured | Purpose |
|---|---|---|
| `export.started` | `{ project_id, format, resolution, segment_count, estimated_duration, timestamp }` | Tracking usage pattern — format/resolution mana yang paling sering dipilih |
| `export.completed` | `{ project_id, format, resolution, segment_count, output_duration_seconds, file_size_bytes, elapsed_seconds, timestamp }` | Mengukur North Star metric (average video duration per session). Performance benchmarking. |
| `export.failed` | `{ project_id, error_code, error_message, segment_at_failure, elapsed_seconds, timestamp }` | Debugging recurring failures. Identifying problematic segment patterns. |
| `export.cancelled` | `{ project_id, progress_at_cancel, elapsed_seconds, timestamp }` | Memahami di titik mana Owner biasanya membatalkan — apakah terlalu lama? |
| `export.preview_viewed` | `{ project_id, preview_duration_watched_seconds, timestamp }` | Mengukur apakah preview digunakan dan seberapa lama Owner menonton sebelum memutuskan export. |
| `export.segment_exported` | `{ project_id, segment_index, format, resolution, timestamp }` | Tracking per-segment export usage vs full concatenation. |

---

## 18. Testing Scenarios

### 18.1 Unit Tests

| Test ID | Scenario | Expected Result |
|---|---|---|
| TEST-EXP-U001 | `export_validate_segments` dengan semua segmen Complete | Return `{ complete: N, failed: 0, missing: [], mismatched_resolution: false }` |
| TEST-EXP-U002 | `export_validate_segments` dengan mix Complete/Failed | Return correct counts dan list missing segment indices |
| TEST-EXP-U003 | `export_estimate_size` untuk 10 segmen × 10 detik, MP4 1080p | Return estimated size ~100 MB (8 Mbps × 100 detik) ± 20% |
| TEST-EXP-U004 | Filename generation dengan special characters di project name | `"My Project! (v2)"` → `My_Project___v2__20260924_153000.mp4` |
| TEST-EXP-U005 | Filename collision detection | File sudah ada → suffix `_1` ditambahkan. Dua file ada → suffix `_2`. |
| TEST-EXP-U006 | Resolution mismatch detection | Mix 720p dan 1080p segments → `mismatched_resolution: true` |

### 18.2 Integration Tests

| Test ID | Scenario | Expected Result |
|---|---|---|
| TEST-EXP-I001 | Concat 5 segmen × 10 detik → MP4 1080p | Output 50 detik, playable, no artifact di junction, file size reasonable |
| TEST-EXP-I002 | Concat 5 segmen → WebM VP9 720p | Output berformat WebM, codec VP9, resolusi 1280×720 |
| TEST-EXP-I003 | Export per-segment individual | File tersimpan dengan nama dan format yang benar |
| TEST-EXP-I004 | Batch export 10 segmen | 10 file tersimpan dengan naming convention `_seg_001` s/d `_seg_010` |
| TEST-EXP-I005 | Preview generation + segment markers | Preview file terbuat, marker timestamps sesuai durasi kumulatif segmen |
| TEST-EXP-I006 | Cancel mid-export | FFmpeg process terminated, partial file deleted, state kembali ke idle |
| TEST-EXP-I007 | Resolution mismatch auto-transcode | Mix 720p/1080p → output 1080p konsisten, semua segmen di-upscale/maintain |

### 18.3 End-to-End Tests

| Test ID | Scenario | Expected Result |
|---|---|---|
| TEST-EXP-E001 | Full pipeline: generate 5 segmen → preview → export MP4 1080p | File output playable 50 detik, preview markers akurat, export complete notification muncul |
| TEST-EXP-E002 | Export dengan disk space rendah | Error dialog muncul sebelum export dimulai, tidak ada partial file |
| TEST-EXP-E003 | Export 30 segmen (stress test NFR-005) | Pipeline berjalan unattended, export selesai tanpa intervensi manual |
| TEST-EXP-E004 | Re-export format berbeda | Kedua file (MP4 dan WebM) valid, source segments tidak terhapus |

### 18.4 Edge Case Tests

| Test ID | Scenario | Expected Result |
|---|---|---|
| TEST-EXP-EC001 | Segment file hilang dari filesystem (deleted externally) | Error dialog menampilkan segment mana yang missing, opsi skip atau abort |
| TEST-EXP-EC002 | Segment file corrupt (0 bytes atau invalid header) | FFmpeg error ditangkap, opsi skip segment atau abort |
| TEST-EXP-EC003 | Export dibatalkan di 50% progress | Partial file dihapus, state reset, re-export bisa dilakukan |
| TEST-EXP-EC004 | Output directory permission denied | Error dialog dengan pesan yang jelas, Owner pilih directory lain |
| TEST-EXP-EC005 | 100+ segmen concat (extreme input) | Export berhasil tanpa OOM, progress bar akurat |

---

## 19. Dependencies & Rollout

### 19.1 Dependencies

| Dependency | Tipe | Detail | Fallback |
|---|---|---|---|
| FEAT-CONTINUITY_ENGINE | Internal feature | Video Export bergantung pada output Continuity Engine — segmen-segmen video yang sudah di-generate dengan visual continuity. Tanpa segmen, tidak ada yang di-export. | Tidak ada fallback — FEAT-CONTINUITY_ENGINE adalah hard dependency. |
| FFmpeg (CLI binary) | External system tool | FFmpeg digunakan untuk semua operasi: frame extraction, concat, transcode, format conversion. Minimum version: FFmpeg 4.4+. | Jika FFmpeg tidak ditemukan: fitur export sepenuhnya disabled. Setup instruction ditampilkan. FFmpeg harus tersedia di PATH atau path dikonfigurasi manual di Settings. Lihat BC-004. |
| Tauri 2.x | Framework | IPC layer antara React frontend dan Rust backend. Subprocess management untuk FFmpeg invocation. | Tidak ada fallback — Tauri adalah core framework. |
| @xyflow/react v12+ | Frontend library | Node editor menyediakan pipeline graph yang menentukan segment ordering untuk concat. | Tidak ada fallback — graph ordering adalah input wajib untuk concatenation. |

### 19.2 Rollout Plan

| Phase | Milestone | Deliverable | Exit Criteria |
|---|---|---|---|
| Phase 1 | MS-05 (Pipeline Execution) | Basic concatenation: FFmpeg concat demuxer, hard cut, MP4 H.264 1080p only | Export video 60 detik (6 segments) berhasil. File playable. |
| Phase 2 | MS-05 + 1 sprint | Preview player + segment markers | Preview video gabungan ditampilkan di embedded player. Markers clickable. |
| Phase 3 | MS-05 + 2 sprint | Format/resolution selection + per-segment export | Export WebM VP9 berhasil. Per-segment export via context menu. Batch export fungsional. |
| Phase 4 | MS-05 + 3 sprint | Progress indicator + error handling + edge cases | Progress bar real-time. Semua failure paths handled. Cancel mid-export berfungsi. |

### 19.3 Feature Flag

Tidak menggunakan feature flag — Video Export adalah P0 feature yang selalu enabled (dengan graceful degradation jika FFmpeg tidak tersedia).

---

## 20. Open Questions

| ID | Question | Impact | Proposed Answer | Status |
|---|---|---|---|---|
| OQ-EXP-001 | Apakah perlu mendukung custom transition antar segmen (fade, dissolve) di MVP? | Scope — menambah complexity pada FFmpeg pipeline | Tidak untuk MVP. Hard cut only. Custom transitions masuk P2 roadmap. | Resolved |
| OQ-EXP-002 | Apakah FFmpeg harus di-bundle bersama installer atau cukup detect dari PATH? | Deployment UX — bundling menambah ~80 MB installer size | Detect dari PATH terlebih dahulu. Jika tidak ditemukan, tampilkan setup instruction dengan download link. Bundling dipertimbangkan untuk v1.0 distribution. | Open |
| OQ-EXP-003 | Apakah preview file harus menggunakan resolusi penuh atau resolusi rendah (untuk speed)? | UX vs performance — preview 1080p bisa lambat untuk pipeline panjang | Preview menggunakan resolusi 720p untuk speed, dengan opsi "Preview in full quality" jika Owner membutuhkan. | Open |
| OQ-EXP-004 | Bagaimana handling audio track jika sebagian segmen memiliki audio dan sebagian tidak (mixed Veo 2 / Veo 3.1)? | Audio continuity — silent gaps bisa jarring | Segmen tanpa audio di-fill dengan silent audio track agar output memiliki continuous audio stream. FFmpeg `-shortest` flag digunakan. | Proposed |
| OQ-EXP-005 | Apakah perlu menyimpan export history (daftar semua export yang pernah dilakukan per project)? | UX convenience vs storage | Simpan last 10 exports di project settings. Setiap entry: timestamp, format, resolusi, output path, file size. | Proposed |
