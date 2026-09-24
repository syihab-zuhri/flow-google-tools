# ANALYTICS.md: Flow Studio — Measurement & Event Plan Specification

> **Project:** Flow Studio  
> **Document ID:** DOC-ANA-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-PLAN-001  
> **Supersedes:** None  

---

## 1. Executive Summary & Filosofi Pengukuran

### 1.1 Visi Telemetri Lokal (Local-First Measurement Philosophy)
Flow Studio adalah instrumen kreatif desktop personal (*single-user desktop workstation*) yang dibangun di atas kerangka kerja **Tauri 2.x** (Rust native core + React 19 UI). Berbeda fundamental dengan produk SaaS (*Software-as-a-Service*) berbasis cloud yang mengekspor telemetri ke platform pihak ketiga (seperti PostHog, Mixpanel, Google Analytics, atau Datadog), arsitektur analitik Flow Studio didesain dengan prinsip **Local-Only Diagnostic Telemetry**:

1. **Zero External Network Dispatch:** Tidak ada satu pun paket analitik, pelacakan pengguna, atau event diagnostik yang dikirim keluar workstation lokal melalui jaringan internet. Satu-satunya aktivitas jaringan luar aplikasi adalah komunikasi HTTPS terenkripsi langsung (port 443) ke upstream Google Flow backend untuk inferensi video.
2. **Data Sovereignty & Absolute Privacy:** Seluruh metadata pembuatan, durasi generasi, statistik performa pipeline, dan konsumsi kredit tersimpan secara lokal di dalam database SQLite pengguna (`%APPDATA%/FlowStudio/flow_studio.db` pada Windows).
3. **No Prompt & No PII Plaintext Storage:** Sesuai mandat `DOC-SEC-001` dan `DOC-ERD-001`, konten kreatif (teks prompt mentah pengguna) dan data identitas sensitif (session cookies, access token, email lengkap) **dilarang mutlak** dicatat dalam tabel telemetri analitik. Integritas request dilacak secara anonim menggunakan hash kriptografis SHA-256 (`request_payload_hash`).
4. **Actionable Diagnostics for Video Pipeline:** Pengukuran diarahkan sepenuhnya untuk mengoptimalkan efisiensi pipeline sekuensial: mendeteksi titik bottleneck latensi, memantau *health pool* akun Google Flow, mengaudit utilisasi kredit, dan mengukur pencapaian durasi video panjang yang koheren.

---

## 2. North Star Metric

### 2.1 Definisi North Star Metric
North Star Metric untuk Flow Studio mengukur proposisi nilai inti produk secara langsung: kemampuan menghasilkan rangkaian klip video pendek (~10 detik) menjadi satu video panjang yang utuh, koheren, dan siap pakai tanpa intervensi manual yang melelahkan.

```
North Star Metric = Average Coherent Video Duration Produced Per Session
(Rata-rata Durasi Video Koheren yang Dihasilkan per Sesi Ekspor)
```

### 2.2 Formula Matematis & Definisi Variabel
Formula formal dihitung secara otomatis oleh SQLite engine secara rolling 30 hari terakhir:

$$\text{North Star} = \frac{\sum_{i=1}^{N} \text{output\_duration\_seconds}_i}{N}$$

Di mana:
- $\text{output\_duration\_seconds}_i$: Total durasi audio-visual (dalam satuan detik) dari berkas video final berstatus *complete* yang berhasil di-export via FFmpeg concat demuxer pada sesi ekspor ke-$i$. Nilai ini dicatat secara presisi melalui ekstraksi metadata container berkas (`ffprobe` duration).
- $N$: Total sesi ekspor video (`export_completed` / `EV-011`) yang sukses menghasilkan berkas video utuh dalam jendela waktu evaluasi (rolling 30 hari).
- **Target Kinerja:** **180 – 300 detik** (3 hingga 5 menit) video utuh yang tersusun dari **18 – 30 chained segments** sekuensial (asumsi segmen dasar berdurasi ~10 detik per inferensi Google Flow).

### 2.3 Mekanisme Pengukuran & Kueri Komputasi Lokal
Metrik ini dihitung secara transparan di dalam local database SQLite melalui agregasi tabel log audit dan metadata segmen.

```sql
-- Kueri North Star Metric: Rolling 30 Hari
SELECT 
    COUNT(id) AS total_export_sessions,
    COALESCE(SUM(output_duration_seconds), 0) AS total_duration_seconds,
    CASE 
        WHEN COUNT(id) = 0 THEN 0.0
        ELSE ROUND(AVG(output_duration_seconds), 2)
    END AS north_star_avg_duration_seconds,
    CASE 
        WHEN COUNT(id) = 0 THEN 0.0
        ELSE ROUND(AVG(segment_count), 2)
    END AS avg_chained_segments_per_session
FROM (
    SELECT 
        id,
        CAST(json_extract(generation_metadata_json, '$.export_duration_seconds') AS REAL) AS output_duration_seconds,
        CAST(json_extract(generation_metadata_json, '$.segment_count') AS INTEGER) AS segment_count
    FROM generation_log
    WHERE response_status = 'success'
      AND started_at >= datetime('now', '-30 days')
      AND json_extract(generation_metadata_json, '$.event_type') = 'video_exported'
);
```

> 💡 **Reasoning:** Jika nilai North Star Metric meningkat mendekati atau melampaui target 300 detik, hal tersebut membuktikan bahwa *Deterministic Continuity Engine* (ekstraksi last-frame + prompt context carry-over), *Multi-Account Flow Router* (rotasi kredit akun otomatis tanpa putus), dan *FFmpeg Concat Pipeline* bekerja secara sinergis dan bebas friksi.

---

## 3. KPI Tree & Input Metrics Hierarchy

North Star Metric digerakkan oleh 4 (empat) pilar metrik masukan (*Input Metrics*). Kegagalan pada salah satu pilar ini akan langsung menurunkan durasi video yang berhasil diproduksi pengguna.

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │                   NORTH STAR METRIC                    │
                                  │      Average Coherent Video Duration Per Session       │
                                  │               (Target: 180s - 300s)                    │
                                  └───────────────────────────┬────────────────────────────┘
                                                              │
         ┌──────────────────────────────┬─────────────────────┴──────────────┬──────────────────────────────┐
         ▼                              ▼                                    ▼                              ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│ INPUT METRIC 1:  │           │ INPUT METRIC 2:  │           │ INPUT METRIC 3:  │           │ INPUT METRIC 4:  │
│ Generation       │           │ Average Segment  │           │ Account Pool     │           │ Credit           │
│ Success Rate     │           │ Latency          │           │ Health           │           │ Utilization Rate │
│ (Target: ≥ 92%)  │           │ (Target: < 45s)  │           │ (Target: ≥ 90%)  │           │ (Target: ≥ 95%)  │
└────────┬─────────┘           └────────┬─────────┘           └────────┬─────────┘           └────────┬─────────┘
         │                              │                              │                              │
         ├─ Success vs Error Ratio      ├─ Google API Inference Time   ├─ Active Valid Sessions       ├─ Daily Depleted Ratio
         ├─ Retry Exhaustion Rate       ├─ Last-Frame Extraction (FF)  ├─ Expired Token Frequency     ├─ Multi-Account Rotation
         └─ Concat Pipeline Pass %      └─ Download & IO Ingestion     └─ Failover Switching Time     └─ Waste / Expired Credits
```

### 3.1 Rincian Input Metrics

| Metric ID | Nama Metrik | Formula Matematis | Target Baseline | Indikator Keberhasilan & Intervensi |
|---|---|---|---|---|
| **KPI-01** | **Generation Success Rate (GSR)** | $$\frac{\sum \text{EV-006}}{\sum \text{EV-005}} \times 100\%$$ | **$\ge 92.0\%$** | Mengukur keandalan upstream API Google Flow dan stabilitas prompt chaining. Jika $< 85\%$, sistem memicu investigasi terhadap perubahan antarmuka reverse-engineered Google. |
| **KPI-02** | **Average Segment Latency (ASL)** | $$\frac{\sum (T_{\text{completed}} - T_{\text{started}})}{\text{Total Segmen Berhasil}}$$ | **$< 45.0 \text{ detik}$** | Total waktu komputasi end-to-end per segmen (inferensi cloud Google + unduh berkas MP4 + ekstraksi *last-frame* PNG via FFmpeg sidecar). |
| **KPI-03** | **Account Pool Health (APH)** | $$\frac{\text{Akun Sesi Valid}}{\text{Total Akun di Pool}} \times 100\%$$ | **$\ge 90.0\%$** | Rasio ketersediaan akun Google yang siap pakai (*authenticated & unexpired*). Jika $< 70\%$, UI menampilkan notifikasi peringatan agar Owner melakukan re-otentikasi sesi via embedded webview. |
| **KPI-04** | **Credit Utilization Rate (CUR)** | $$\frac{\sum \text{Kredit Terpakai Efektif}}{\sum \text{Total Batas Kredit Harian}} \times 100\%$$ | **$\ge 95.0\%$** | Mengukur efisiensi auto-rotation Flow Router. Menjamin tidak ada kredit harian yang hangus sia-sia (*free quota expiration*) karena salah routing atau pool macet. |

---

## 4. Event Taxonomy & Structural Schema

### 4.1 Prinsip Penamaan & Standar Properti
Seluruh event diagnostik Flow Studio mematuhi standar penamaan kanonikal:
- **Format Penamaan:** `object_action` dalam huruf kecil (*lower_snake_case*), contoh: `pipeline_started`, `frame_extracted`.
- **Konteks Objek:** Objek merepresentasikan entitas arsitektur domain (e.g., `project`, `node`, `edge`, `pipeline`, `segment`, `frame`, `account`, `video`, `vault`, `session`, `retry`).

### 4.2 Common Properties (Envelope Wajib)
Setiap event yang ditransmisikan dalam sistem dan disimpan ke SQLite wajib menyertakan atribut dasar berikut:

```json
{
  "event_id": "EV-000-00000000-0000-0000-0000-000000000000",
  "event_name": "object_action",
  "timestamp": "2026-09-24T14:32:00.123Z",
  "session_id": "ses_9f83a210c4d5",
  "project_id": "proj_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "app_version": "1.0.0",
  "platform": "windows-x86_64",
  "payload": {}
}
```

- `event_id`: UUIDv4 unik untuk setiap instans rekaman event.
- `event_name`: Nama event terdaftar dalam registri (`lower_snake_case`).
- `timestamp`: Stempel waktu presisi milidetik berstandar ISO-8601 UTC.
- `session_id`: Pengenal acak per sesi peluncuran aplikasi (*app launch instance*), di-generate saat proses Tauri boot dan di-reset saat restart.
- `project_id`: ID proyek `.flowproj` yang sedang aktif (atau `null` jika event terjadi di level global vault/account pool).
- `app_version`: Versi rilis biner aplikasi Flow Studio (e.g., `1.0.0`).
- `platform`: Target arsitektur lingkungan eksekusi host (`windows-x86_64`).

---

## 5. Event Registry (EV-001 hingga EV-015)

Katalog registri lengkap ini mencakup seluruh siklus hidup interaksi grafis, orkestrasi inferensi AI, manipulasi media FFmpeg, dan keamanan brankas.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                FLOW STUDIO EVENT REGISTRY MAP                                    │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PROJECT & GRAPH:        [EV-001] project_created        [EV-002] node_added                      │
│                         [EV-003] edge_connected                                                  │
│ PIPELINE ORCHESTRATION: [EV-004] pipeline_started       [EV-015] retry_triggered                 │
│ INFERENCE & CONTINUITY: [EV-005] segment_generation_started                                      │
│                         [EV-006] segment_generation_completed                                    │
│                         [EV-007] segment_generation_failed                                       │
│                         [EV-008] frame_extracted                                                 │
│ ROUTER & ACCOUNTS:      [EV-009] account_rotated        [EV-014] session_expired                 │
│ ASSEMBLY & EXPORT:      [EV-010] video_concatenated     [EV-011] video_exported                  │
│ CRYPTOGRAPHIC VAULT:    [EV-012] vault_unlocked         [EV-013] vault_locked                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Spesifikasi Rinci Event Registri

#### EV-001: `project_created`
- **Trigger:** Pengguna menekan tombol "New Project" atau membuat file `.flowproj` baru melalui dialog visual.
- **Tujuan:** Melacak inisiasi ruang kerja dan konfigurasi dasar kanvas.
- **Specific Properties:**
  ```json
  {
    "project_name_hashed": "a3f5b7...", // SHA-256 dari nama project guna mencegah kebocoran judul
    "initial_resolution": "1080p",
    "aspect_ratio": "16:9",
    "template_used": "blank"
  }
  ```

#### EV-002: `node_added`
- **Trigger:** Node baru ditarik (*drag-and-drop*) atau ditambahkan ke kanvas Node Editor (@xyflow/react).
- **Tujuan:** Menganalisis komposisi dan kompleksitas topologi pipeline yang dirancang pengguna.
- **Specific Properties:**
  ```json
  {
    "node_id": "node_prompt_01",
    "node_type": "PromptNode", // Enum: PromptNode, ImageNode, VideoNode
    "total_nodes_in_canvas": 12,
    "position_x": 420.5,
    "position_y": 180.0
  }
  ```

#### EV-003: `edge_connected`
- **Trigger:** Pengguna menghubungkan port keluaran (*output handle*) suatu node ke port masukan (*input handle*) node lain yang valid.
- **Tujuan:** Mengukur keberhasilan validasi DAG (*Directed Acyclic Graph*) dan relasi dependency segmen.
- **Specific Properties:**
  ```json
  {
    "edge_id": "edge_p1_v1",
    "source_node_type": "PromptNode",
    "target_node_type": "VideoNode",
    "connection_type": "context_carry_over",
    "is_valid_dag": true
  }
  ```

#### EV-004: `pipeline_started`
- **Trigger:** Pengguna mengklik tombol "Start Pipeline" / "Execute All" pada bilah kontrol navigasi.
- **Tujuan:** Menandai dimulainya sekuens eksekusi batch klip video secara otomatis.
- **Specific Properties:**
  ```json
  {
    "pipeline_run_id": "run_8812c3e1",
    "total_segments_scheduled": 24,
    "estimated_duration_seconds": 240,
    "style_lock_active": true,
    "concurrency_mode": "sequential_chain"
  }
  ```

#### EV-005: `segment_generation_started`
- **Trigger:** Worker task Rust memulai eksekusi transmisi inferensi HTTP untuk suatu segmen sekuensial ke upstream Google Flow.
- **Tujuan:** Titik awal kalkulasi latensi inferensi dan audit konsumsi kuota kredit.
- **Specific Properties:**
  ```json
  {
    "segment_id": "seg_001",
    "sequence_order": 0,
    "account_id": "acc_gflow_01",
    "request_payload_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "has_reference_frame": false,
    "context_window_size": 0
  }
  ```

#### EV-006: `segment_generation_completed`
- **Trigger:** Polling status Google Flow menghasilkan video berstatus siap, biner MP4 berhasil diunduh ke disk lokal, dan SHA-256 berkas valid.
- **Tujuan:** Mengukur keberhasilan generasi, durasi komputasi bersih, dan pemotongan kredit riil.
- **Specific Properties:**
  ```json
  {
    "segment_id": "seg_001",
    "sequence_order": 0,
    "account_id": "acc_gflow_01",
    "inference_time_ms": 34120,
    "download_time_ms": 2840,
    "total_latency_ms": 36960,
    "file_size_bytes": 15420310,
    "credits_consumed": 1,
    "remaining_daily_credits": 49
  }
  ```

#### EV-007: `segment_generation_failed`
- **Trigger:** Inferensi video Google Flow mengembalikan respon error, timeout jaringan, atau kuota habis yang tidak dapat diselesaikan pada level segmen.
- **Tujuan:** Analisis akar masalah kegagalan pipeline, penegakan isolasi kegagalan, dan trigger fallback rotasi.
- **Specific Properties:**
  ```json
  {
    "segment_id": "seg_002",
    "sequence_order": 1,
    "account_id": "acc_gflow_01",
    "error_code": "E_FLOW_RATE_LIMIT",
    "http_status": 429,
    "error_category": "rate_limited", // Enum: rate_limited, unauthorized, server_error, client_error, timeout
    "elapsed_time_ms": 12400
  }
  ```

#### EV-008: `frame_extracted`
- **Trigger:** FFmpeg sidecar berhasil mengekstrak frame terakhir dari segmen $N-1$ (`-sseof -1`) menjadi berkas PNG resolusi penuh untuk kontinuitas visual segmen $N$.
- **Tujuan:** Mengukur latensi FFmpeg sidecar subprocess dan keandalan deterministik continuity engine.
- **Specific Properties:**
  ```json
  {
    "segment_id": "seg_001",
    "frame_width": 1920,
    "frame_height": 1080,
    "extraction_latency_ms": 420,
    "frame_size_bytes": 2450110,
    "frame_hash_sha256": "8f4a12..."
  }
  ```

#### EV-009: `account_rotated`
- **Trigger:** Flow Router mendeteksi akun aktif kehabisan kuota kredit harian atau menerima HTTP 429, lalu secara mulus memindahkan antrean ke akun berikutnya yang valid.
- **Tujuan:** Evaluasi efektivitas credit pooling multi-akun dan transparansi rotasi tanpa interupsi UI.
- **Specific Properties:**
  ```json
  {
    "pipeline_run_id": "run_8812c3e1",
    "from_account_id": "acc_gflow_01",
    "to_account_id": "acc_gflow_02",
    "rotation_reason": "daily_credits_exhausted", // Enum: daily_credits_exhausted, monthly_credits_exhausted, rate_limited, session_expired
    "remaining_accounts_in_pool": 4,
    "switch_latency_ms": 45
  }
  ```

#### EV-010: `video_concatenated`
- **Trigger:** Subproses FFmpeg concat demuxer selesai menggabungkan seluruh file segmen `.mp4` parsial menjadi satu berkas master video koheren.
- **Tujuan:** Mengukur performa stitching video lossless lokal dan memverifikasi ketiadaan junction glitch.
- **Specific Properties:**
  ```json
  {
    "pipeline_run_id": "run_8812c3e1",
    "segment_count": 20,
    "stitched_duration_seconds": 200.0,
    "concat_latency_ms": 4850,
    "output_file_size_bytes": 308401920,
    "audio_normalized": true
  }
  ```

#### EV-011: `video_exported`
- **Trigger:** File video final telah selesai di-transcode/ditulis ke direktori penyimpanan tujuan yang dipilih oleh Owner di filesystem Windows.
- **Tujuan:** **Primary Trigger untuk North Star Metric.** Mengesahkan penyelesaian satu sesi produksi video lengkap.
- **Specific Properties:**
  ```json
  {
    "project_id": "proj_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "export_format": "mp4", // Enum: mp4, webm
    "video_codec": "h264",
    "output_resolution": "1080p",
    "segment_count": 20,
    "output_duration_seconds": 200.0,
    "export_latency_ms": 14200,
    "total_session_elapsed_seconds": 890
  }
  ```

#### EV-012: `vault_unlocked`
- **Trigger:** Owner berhasil memasukkan Master Password yang benar, menghasilkan derivasi kunci Argon2id, dan membuka brankas kredensial.
- **Tujuan:** Audit akses keamanan dan pelacakan frekuensi sesi kerja pengguna.
- **Specific Properties:**
  ```json
  {
    "kdf_duration_ms": 680,
    "argon2_memory_kb": 65536,
    "failed_attempts_prior": 0,
    "accounts_loaded_count": 5
  }
  ```

#### EV-013: `vault_locked`
- **Trigger:** Brankas terkunci secara otomatis akibat batas inaktivitas (timeout 15 menit), penutupan aplikasi, atau penguncian manual oleh Owner.
- **Tujuan:** Memverifikasi penegakan zeroization memori dan durasi rentang brankas aktif.
- **Specific Properties:**
  ```json
  {
    "lock_reason": "inactivity_timeout", // Enum: manual, inactivity_timeout, app_shutdown, app_blur
    "active_session_duration_seconds": 900,
    "memory_zeroized": true
  }
  ```

#### EV-014: `session_expired`
- **Trigger:** Background health check (interval 30 menit) atau interceptor HTTP mendeteksi token/cookie akun Google Flow telah kadaluarsa (HTTP 401/403).
- **Tujuan:** Mengukur metrik Account Pool Health (APH) dan memicu pembaruan status visual pada UI.
- **Specific Properties:**
  ```json
  {
    "account_id": "acc_gflow_03",
    "time_since_last_active_seconds": 86400,
    "http_status_code": 401,
    "requires_webview_reauth": true
  }
  ```

#### EV-015: `retry_triggered`
- **Trigger:** Upstream HTTP request gagal dengan error yang bersifat sementara (*transient error*, e.g., HTTP 500, 502, atau network timeout) sehingga subsistem Rust mengeksekusi retry otomatis.
- **Tujuan:** Mengukur stabilitas inferensi jaringan dan memantau efektivitas strategi exponential backoff.
- **Specific Properties:**
  ```json
  {
    "segment_id": "seg_003",
    "attempt_number": 2, // Range: 1..3
    "max_attempts": 3,
    "backoff_delay_ms": 4000, // Exponential: 2s, 4s, 8s
    "prior_error_code": "E_FLOW_TIMEOUT"
  }
  ```

---

## 6. Event to Metric Mapping Matrix

Tabel berikut menetapkan pemetaan formal antara setiap event registri dengan metrik yang dihitung di dalam dashboard lokal:

| Event ID | Event Name | Target Metric Terkait | Kontribusi Agregasi & Formula Operasional |
|---|---|---|---|
| **EV-001** | `project_created` | Project Velocity | Menghitung total proyek aktif yang diinisiasi per bulan. |
| **EV-002** | `node_added` | Pipeline Complexity Index | Rasio rata-rata node per proyek: $\frac{\sum \text{Node}}{\sum \text{Proyek}}$. |
| **EV-003** | `edge_connected` | Context Depth Index | Frekuensi penggunaan *context carry-over* vs *isolated prompt*. |
| **EV-004** | `pipeline_started` | Pipeline Completion Rate (Denom) | Pembagi (*denominator*) untuk menghitung rasio pipeline selesai utuh. |
| **EV-005** | `segment_generation_started` | Generation Success Rate (Denom) | Pembagi (*denominator*) perhitungan rasio sukses inferensi segmen. |
| **EV-006** | `segment_generation_completed` | **KPI-01 (GSR), KPI-02 (ASL), KPI-04 (CUR)** | Pembilang (*numerator*) GSR; data primer latensi durasi segmen; penambahan konsumsi kredit riil. |
| **EV-007** | `segment_generation_failed` | Failure Rate & Error Distribution | Pembilang kalkulasi tingkat kegagalan: $\frac{\sum \text{EV-007}}{\sum \text{EV-005}}$ dikelompokkan per error category. |
| **EV-008** | `frame_extracted` | Continuity Overhead Latency | Rata-rata waktu pemrosesan FFmpeg per klip: $\text{AVG}(\text{extraction\_latency\_ms})$. |
| **EV-009** | `account_rotated` | Rotation Frequency & Pool Efficiency | Frekuensi rotasi per jam operasional pipeline run: $\frac{\sum \text{EV-009}}{\text{Jam Eksekusi}}$. |
| **EV-010** | `video_concatenated` | Assembly Success Rate | Rasio keberhasilan stitching FFmpeg concat demuxer tanpa artefak. |
| **EV-011** | `video_exported` | **NORTH STAR METRIC** | Agregasi durasi video final per sesi: $\text{AVG}(\text{output\_duration\_seconds})$. |
| **EV-012** | `vault_unlocked` | Session Frequency & Security Audit | Menghitung durasi aktif pengguna dan deteksi brute-force lokal. |
| **EV-013** | `vault_locked` | Vault Exposure Time | Total waktu brankas terbuka di memori RAM host workstation. |
| **EV-014** | `session_expired` | **KPI-03 (APH)** | Pengurang rasio kesehatan pool akun: $\frac{\text{Akun Valid} - \sum \text{EV-014}}{\text{Total Akun}}$. |
| **EV-015** | `retry_triggered` | API Transient Instability Rate | Rata-rata percobaan ulang per segmen: $\frac{\sum \text{EV-015}}{\sum \text{EV-006}}$. |

---

## 7. Funnel Definitions & Conversion Rules

Pipeline Flow Studio bekerja melalui alur produksi sekuensial multi-tahap. Funnel analitik dirancang untuk memantau titik friksi di mana pembuatan video panjang mengalami kendala.

### 7.1 Long-Form Video Production Funnel

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Project Inception                                        │
│    [EV-001] project_created                                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Sequence Design (Min. 18 Segments Configured)            │
│    [EV-002, EV-003] node_added & edge_connected            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Pipeline Dispatch                                        │
│    [EV-004] pipeline_started                                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Chained Execution (Iterative Segments 1..N)              │
│    [EV-005, EV-006, EV-008] gen_started -> comp -> frame   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Lossless Concatenation                                   │
│    [EV-010] video_concatenated                              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Master Video Export (North Star Accomplished)            │
│    [EV-011] video_exported                                  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Aturan Atribusi & Jendela Waktu Funnel (Timeframe Rules)
1. **Sesi Atribusi (Session Attribution Window):** Satu funnel video production diikat oleh kombinasi `project_id` dan `session_id`. Jendela waktu maksimal penyelesaian pipeline normal adalah **120 menit** (2 jam). Jika rentang waktu antara `pipeline_started` dan `video_exported` melebihi 120 menit, eksekusi dianggap sebagai *paused/stalled execution*.
2. **Kriteria Konversi Sempurna (Full Funnel Conversion):**
   - Langkah 1 ke Langkah 2: Berhasil jika kanvas memiliki minimal 2 segmen terhubung (standar MVP) atau $\ge 18$ segmen (standar produksi long-form).
   - Langkah 3 ke Langkah 4: Rasio kelulusan segmen $\ge 90\%$ tanpa intervensi kegagalan total.
   - Langkah 4 ke Langkah 5: Seluruh segmen sekuensial memiliki status database `'completed'`.
   - Langkah 5 ke Langkah 6: Berkas video hasil concat berhasil di-transcode ke path destinasi lokal.

---

## 8. Local Storage Engine: SQLite `generation_log`

Seluruh data telemetri, metrik performa, dan jejak audit inferensi disimpan secara eksklusif ke dalam tabel SQLite `generation_log` pada basis data lokal `%APPDATA%/FlowStudio/flow_studio.db`.

### 8.1 Skema DDL Database Terverifikasi
Struktur tabel telah disinkronkan sepenuhnya dengan kontrak data di `DOC-ERD-001`:

```sql
-- Skema Tabel Log Generasi & Telemetri Analitik
CREATE TABLE IF NOT EXISTS generation_log (
    id TEXT PRIMARY KEY,                                      -- UUIDv4 String (36 karakter)
    account_id TEXT,                                          -- FK ke accounts(id) ON DELETE SET NULL
    segment_id TEXT,                                          -- FK ke segments(id) ON DELETE SET NULL
    request_payload_hash TEXT NOT NULL CHECK (length(request_payload_hash) = 64),
    response_status TEXT NOT NULL CHECK (response_status IN (
        'success', 'rate_limited', 'unauthorized', 'server_error', 'client_error', 'timeout'
    )),
    credits_consumed INTEGER NOT NULL DEFAULT 0 CHECK (credits_consumed >= 0),
    started_at TEXT NOT NULL,                                 -- Format ISO-8601 UTC presisi milidetik
    completed_at TEXT,                                        -- Format ISO-8601 UTC presisi milidetik
    error_message TEXT,                                       -- Pesan error yang telah disanitasi dari token
    generation_metadata_json TEXT,                            -- Payload JSON telemetri terstruktur
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indeks Performa Kueri Telemetri & Dashboard
CREATE INDEX IF NOT EXISTS idx_genlog_account 
ON generation_log (account_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_genlog_started_at 
ON generation_log (started_at);

CREATE INDEX IF NOT EXISTS idx_genlog_segment 
ON generation_log (segment_id);

CREATE INDEX IF NOT EXISTS idx_genlog_status_started 
ON generation_log (response_status, started_at);
```

### 8.2 Struktur Payload `generation_metadata_json`
Untuk mendukung penyimpanan event non-inferensi (seperti `EV-010 video_concatenated` atau `EV-011 video_exported`) tanpa menambah kompleksitas skema relasional, kolom `generation_metadata_json` menampung atribut event yang fleksibel:

```json
{
  "event_id": "EV-011-8a9d1234-bcde-5678-9012-3456789abcde",
  "event_type": "video_exported",
  "session_id": "ses_9f83a210c4d5",
  "project_id": "proj_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "app_version": "1.0.0",
  "export_duration_seconds": 210.5,
  "segment_count": 21,
  "export_format": "mp4",
  "export_resolution": "1080p",
  "inference_latency_avg_ms": 33200,
  "concat_latency_ms": 5120
}
```

### 8.3 Kebijakan Retensi & Pembersihan Otomatis (Pruning Policy)
Data log analitik dikelola dengan prinsip efisiensi ruang disk lokal:
- **Jendela Retensi Bergulir:** Data disimpan selama **90 hari**.
- **Mekanisme Pruning:** Dijalankan secara otomatis di latar belakang oleh Rust background supervisor saat aplikasi pertama kali melakukan booting (startup routine):

```sql
-- Pembersihan berkala otomatis (90 hari)
DELETE FROM generation_log 
WHERE started_at < datetime('now', '-90 days');
```

---

## 9. Privacy, Data Minimization & Compliance

Kebijakan pelindungan data pada modul analitik Flow Studio mengadopsi standar kepatuhan ketat sesuai spesifikasi `DOC-SEC-001` dan prinsip pelindungan data pribadi (UU PDP No. 27 Tahun 2022 Republik Indonesia).

### 9.1 Zero-PII & Zero-Prompt Plaintext Rule

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA PRIVACY SANITIZATION                       │
├────────────────────────────────────────────────────────────────────────┤
│ INPUT MENTAH:                                                          │
│ - Prompt: "Cinematic shot of cyberpunk warrior in rainy neo-tokyo..."  │
│ - Account: "john.creator.video@gmail.com"                              │
│ - Session: "__Secure-1PSID=AbCdEf123456..."                            │
│                                   │                                    │
│                                   ▼                                    │
│ PROSES SANITASI ANALITIK:                                              │
│ - Prompt  ──► SHA-256 Hash ──► "e3b0c44298fc1c149afbf4c8996fb92..."   │
│ - Account ──► Masked Email ──► "j***r@gmail.com"                       │
│ - Cookie  ──► DIBLOCK MUTLAK ──► [RESTRICTED: MEMORY WIPED]            │
│                                   │                                    │
│                                   ▼                                    │
│ TERSIMPAN DI generation_log:                                           │
│ Hanya request_payload_hash, metadata durasi, dan metrik performa       │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Prompt Sanitization:** Prompt teks mentah pengguna merepresentasikan kekayaan intelektual (*intellectual property*) dan data kontekstual yang berpotensi sensitif. Oleh karena itu, prompt teks **TIDAK PERNAH** disimpan dalam bentuk plaintext di tabel log analitik mana pun. Setiap permintaan inferensi diidentifikasi secara anonim via hash SHA-256 (`request_payload_hash`).
2. **Credential Isolation:** Cookie sesi, OAuth tokens, dan master password masuk dalam klasifikasi `RESTRICTED`. Data ini dilarang mutlak dicatat dalam tabel log, console stdout/stderr, maupun crash stack traces.
3. **Email Masking:** Jika identitas akun perlu ditampilkan untuk kemudahan audit lokal Owner di antarmuka dashboard, alamat surel di-mask secara sepihak (contoh: `j***e@gmail.com`).
4. **Local Sovereignty:** Tidak ada integrasi SDK analitik pihak ketiga (seperti Sentry, Datadog, Mixpanel). Segala bentuk telemetri hanya hidup dan mati di dalam perangkat keras lokal milik pengguna.

---

## 10. Instrumentation Architecture & Event QA Checklist

### 10.1 Pipeline Instrumentasi Rust & Tauri Event Bus
Instrumentasi event diimplementasikan pada level native di backend Rust (`src-tauri/src/telemetry/`) menggunakan modul logging terpadu:

```rust
// Ilustrasi Kontrak Abstraksi Rust Telemetry Recorder
pub struct TelemetryService {
    db_pool: sqlx::SqlitePool,
}

impl TelemetryService {
    pub async fn record_event(&self, event: AnalyticsEvent) -> Result<(), AppError> {
        // 1. Sanitasi payload (pastikan tidak ada PII / plaintext prompt)
        let sanitized_hash = event.compute_payload_hash();
        
        // 2. Persistensi lokal ke SQLite generation_log
        sqlx::query!(
            r#"
            INSERT INTO generation_log (
                id, account_id, segment_id, request_payload_hash, 
                response_status, credits_consumed, started_at, 
                completed_at, error_message, generation_metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            event.id,
            event.account_id,
            event.segment_id,
            sanitized_hash,
            event.status,
            event.credits_consumed,
            event.started_at,
            event.completed_at,
            event.sanitized_error,
            event.metadata_json
        )
        .execute(&self.db_pool)
        .await?;

        // 3. Pancarkan ke frontend React melalui Tauri Event emitter (jika dashboard aktif)
        app_handle.emit("telemetry:event_recorded", &event)?;
        
        Ok(())
    }
}
```

### 10.2 Event QA Checklist (Kriteria Verifikasi Rilis)
Sebelum rilis binary produksi (CI/CD pipeline), tim QA wajib memastikan verifikasi seluruh checklist berikut lulus tanpa deviasi:

- [ ] **QA-ANA-01 (Zero External Packets):** Sniffing paket jaringan lokal menggunakan Wireshark selama eksekusi pipeline 10 segmen membuktikan tidak ada koneksi HTTP/DNS ke server analitik pihak ketiga.
- [ ] **QA-ANA-02 (Zero Plaintext Prompts):** Kueri inspeksi basis data `SELECT * FROM generation_log WHERE error_message LIKE '%prompt%' OR generation_metadata_json LIKE '%prompt%';` menghasilkan 0 record.
- [ ] **QA-ANA-03 (Registry Completeness):** Seluruh event dari `EV-001` hingga `EV-015` memiliki unit test verifikasi yang membuktikan event terpancar saat skenario trigger dipicu.
- [ ] **QA-ANA-04 (Foreign Key Safety):** Penghapusan proyek atau akun Google tidak menghapus riwayat log generasi (relasi `ON DELETE SET NULL` terverifikasi aman).
- [ ] **QA-ANA-05 (Pruning Execution):** Memasukkan data uji dengan timestamp `now - 91 days` terbukti terhapus secara otomatis saat aplikasi startup.
- [ ] **QA-ANA-06 (Format Consistency):** Nilai `started_at` dan `completed_at` selalu valid sesuai standar ISO-8601 UTC.

---

## 11. Local Dashboard Specification

Flow Studio menyediakan antarmuka diagnostik lokal (*Local Dashboard Screen*) yang terintegrasi di dalam aplikasi React 19 (`/dashboard` route) untuk memberikan visibilitas penuh kepada Owner mengenai performa sistem, sisa kuota kredit, dan efisiensi generasi.

### 11.1 Mockup Tata Letak Antarmuka (ASCII Layout)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  FLOW STUDIO — LOCAL DIAGNOSTICS & GENERATION METRICS DASHBOARD                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  [ NORTH STAR: AVG VIDEO DURATION ]   [ GENERATION SUCCESS RATE ]    [ ACCOUNT POOL HEALTH ]     │
│  ┌──────────────────────────────┐     ┌────────────────────────┐     ┌────────────────────────┐  │
│  │  245.8 detik / sesi          │     │  96.4 %                │     │  5 / 5 Akun Siap       │  │
│  │  ▲ +12% dari target (180s)   │     │  ▲ 422 Sukses | 16 Fail│     │  100% Sesi Valid       │  │
│  └──────────────────────────────┘     └────────────────────────┘     └────────────────────────┘  │
│                                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  DAILY CREDIT BURN CHART (Rolling 7 Hari)                                                        │
│                                                                                                  │
│   Credits                                                                                        │
│     250 ┤                                        ╭───╮                                           │
│     200 ┤                            ╭───╮       │   │                                           │
│     150 ┤                ╭───╮       │   │       │   │       ╭───╮                               │
│     100 ┤    ╭───╮       │   │       │   │       │   │       │   │       ╭───╮                   │
│      50 ┤    │   │       │   │       │   │       │   │       │   │       │   │                   │
│       0 ┴────┴───┴───────┴───┴───────┴───┴───────┴───┴───────┴───┴───────┴───┴──────► Waktu       │
│             18 Sep      19 Sep      20 Sep      21 Sep      22 Sep      23 Sep      24 Sep       │
│             (95 krd)   (140 krd)   (190 krd)   (240 krd)   (160 krd)   (110 krd)                 │
│                                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ACCOUNT POOL STATUS & ALLOCATION                                                                │
│  ┌──────────────┬───────────────┬────────────────────┬──────────────────┬──────────────────────┐ │
│  │ Account ID   │ Sesi Status   │ Sisa Kredit Harian │ Kredit Terpakai  │ Health Status        │ │
│  ├──────────────┼───────────────┼────────────────────┼──────────────────┼──────────────────────┤ │
│  │ acc_gflow_01 │ VALID (200)   │ 12 / 50            │ 38 kredit        │ [ Optimal ]          │ │
│  │ acc_gflow_02 │ VALID (200)   │ 45 / 50            │ 5 kredit         │ [ Idle / Standby ]   │ │
│  │ acc_gflow_03 │ VALID (200)   │ 0 / 50             │ 50 kredit        │ [ Depleted - Rotated]│ │
│  │ acc_gflow_04 │ VALID (200)   │ 50 / 50            │ 0 kredit         │ [ Standby ]          │ │
│  │ acc_gflow_05 │ EXPIRED (401) │ 0 / 50             │ 0 kredit         │ [ Perlu Re-Auth ]    │ │
│  └──────────────┴───────────────┴────────────────────┴──────────────────┴──────────────────────┘ │
│                                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  RECENT EXECUTION LOGS (Live Local Feed)                                                         │
│  [14:30:12] [EV-011] Video master berhasil diekspor (Durasi: 240s, 24 segmen)                   │
│  [14:28:45] [EV-010] FFmpeg concat selesai dalam 4.2 detik                                       │
│  [14:26:10] [EV-009] Auto-rotation: beralih dari acc_gflow_03 ke acc_gflow_01 (Kredit habis)    │
│  [14:25:30] [EV-008] Last-frame extracted (1920x1080 PNG, latency: 410ms)                       │
│  [14:25:01] [EV-006] Segment #23 berhasil dibuat via acc_gflow_03 (Latency: 34.2s)               │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Komponen Widget Utama Dashboard

1. **North Star Summary Card:**
   - Menampilkan rata-rata durasi video koheren per sesi ekspor dalam 30 hari terakhir.
   - Dilengkapi *progress bar* perbandingan terhadap target minimum (180 detik) dan target optimal (300 detik).
2. **Generation Success Rate Widget:**
   - Mengkalkulasikan rasio sukses vs gagal dari pemanggilan API Google Flow (`EV-006` vs `EV-007`).
   - Memberikan rincian klasifikasi error (misal: *Rate Limited*, *Timeout*, *Auth Failure*).
3. **Credit Burn Rate Bar Chart:**
   - Visualisasi konsumsi kredit harian kumulatif lintas seluruh akun dalam pool selama 7 hingga 30 hari terakhir.
   - Membantu Owner merencanakan jadwal batch produksi tanpa melampaui kuota harian.
4. **Account Pool Matrix:**
   - Tabel realtime yang menampilkan status keabsahan cookie akun, sisa kredit per akun, waktu *health check* terakhir, dan status rotasi terkini.
5. **Diagnostic Live Stream Console:**
   - Tampilan *virtualized scrolling list* yang menampilkan 50 event diagnostik terbaru yang tersimpan di `generation_log` untuk mempermudah pemecahan masalah (*troubleshooting*) secara lokal.

---

## 12. Dokumentasi Terkait & Keterikatan Sistem

- **`PLANNING.md` / `PLANNING_v5.2.md`:** Menentukan formulasi dasar North Star Metric dan arsitektur produk Flow Studio.
- **`DOC-ARCH-001` (ARCHITECTURE.md):** Spesifikasi arsitektur Modular Monolith, batas proses Tauri IPC, dan subproses FFmpeg.
- **`DOC-ERD-001` (ERD.md):** Definisi skema tabel database lokal `generation_log`, constraint referensial, dan indeks query.
- **`DOC-SEC-001` (SECURITY.md):** Kebijakan pelindungan privasi data tingkat tinggi, zero-PII logging, sanitasi prompt, dan zeroization memori brankas.
- **`DOC-API-001` (API.md):** Kontrak Tauri Commands dan Tauri Events yang menghubungkan antarmuka React dengan subsistem telemetri native Rust.
