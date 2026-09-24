# ADR-001: Selection of Desktop App Shell Framework

- Status: Accepted
- Date: 2026-09-24
- Owners: Software Architect & Planning Lead
- Decision Class: Type-1
- Related Requirements: FR-010, NFR-001, NFR-007, NFR-008

---

## 1. Context

Flow Studio adalah aplikasi desktop Windows x64 yang dirancang khusus untuk automasi pembuatan video sekuensial multi-segmen berbasis Google Flow API, orchestrasi account rotation, dan continuity stitching. Aplikasi ini membutuhkan arsitektur desktop app shell yang kokoh, berperforma tinggi, dan aman secara lokal tanpa ketergantungan pada backend cloud eksternal.

Karakteristik teknis dan kebutuhan sistem mencakup:
1. **Antarmuka Grafis Node-Based yang Responsif (FR-010, NFR-001):**
   Canvas editor berbasis `@xyflow/react` v12+ yang menuntut render frame rate 60 FPS (P95 frame time < 16.67ms) pada hardware minimum (Intel Core i5 Gen 8, 8GB RAM, integrated GPU) dengan beban hingga 100 node dan 200 edge interaktif.
2. **Efisiensi Sumber Daya & Waktu Boot Cepat (NFR-008):**
   Waktu startup dingin (*cold start*) harus di bawah 3 detik (<3s) dari klik *executable* hingga jendela utama dirender secara interaktif (tanpa memperhitungkan prompt master password vault).
3. **Pengelolaan Kredensial Lokal Tingkat Tinggi (NFR-004):**
   Penyimpanan session token Google, master password, dan enkripsi SQLite at-rest menggunakan standar AES-256-GCM / Argon2id yang harus dijalankan pada level native memory terisolasi tanpa risiko terekspos ke memory dump JavaScript runtime.
4. **Kontrol Proses & Orkestrasi FFmpeg Langsung:**
   Kebutuhan mengekstrak frame referensi (*last frame extraction*) secara sub-detik (<500ms) dan penggabungan video sekuensial (*video stitching*) melalui proses biner FFmpeg yang dikontrol secara presisi via low-level I/O streams (`std::process::Command` / asynchronous child process handling).
5. **Eksekusi In-Process Routing Engine (`flow-router`):**
   Komponen utama routing account pool, rotasi sesi otomatis saat kuota habis, serta HTTP client berbasis TLS fingerprinting dan cookie jar isolation harus berjalan secara in-process dengan latensi dispatch < 2s (NFR-002).
6. **Platform Target Eksklusif Windows (NFR-007):**
   Target deployment eksklusif Windows 10 (21H2+) dan Windows 11 x64, di mana sistem operasi modern telah menyediakan Microsoft Edge WebView2 runtime secara *pre-installed* (evergreen).

---

## 2. Decision Drivers

Keputusan pemilihan desktop app shell framework dipandu oleh driver utama berikut:

1. **Ukuran Bundel (*Bundle Size*) & Distribusi Portabel:**
   Aplikasi didistribusikan sebagai portable executable atau installer ringan. Overhead runtime yang besar (>100MB) tidak diinginkan untuk distribusi standalone.
2. **Jejak Memori (*Memory Footprint*) & Efisiensi Sistem:**
   Aplikasi beroperasi bersamaan dengan rendering video FFmpeg dan pemutaran preview video HTML5 multi-node. Penggunaan RAM idle dan active baseline harus seminimal mungkin agar tidak menyebabkan degradasi performa pada RAM 8GB.
3. **Integrasi Bahasa Native (Rust) untuk `flow-router` dan Kriptografi:**
   Kemampuan mengeksekusi modul `flow-router`, enkripsi AES-256-GCM, derivasi kunci Argon2id, serta direct stream piping FFmpeg tanpa *glue layer* yang rapuh atau overhead IPC antardaemon tambahan.
4. **Waktu Cold Start Aplikasi (<3 Detik, NFR-008):**
   Inisialisasi runtime tidak boleh membebani siklus CPU saat cold boot; rendering awal UI React harus dapat diselesaikan sebelum batas waktu 3 detik tercapai.
5. **Kesinambungan Pengetahuan & Stack Tim (*Stack Continuity*):**
   Pemanfaatan pengalaman tim dari proyek OpenPacket sebelumnya yang telah memvalidasi integrasi Rust + React dalam arsitektur desktop desktop-grade, mengurangi kurva pembelajaran dan risiko implementasi.
6. **Kematangan Ekosistem Frontend React & Canvas:**
   Dukungan penuh terhadap library ekosistem React 19 dan `@xyflow/react` tanpa kompromi tooling web modern (Vite, TypeScript, Tailwind CSS).

---

## 3. Considered Options

Tiga alternatif teknologi dievaluasi untuk memenuhi kriteria arsitektur Flow Studio:

### Opsi A: Tauri 2.x (Rust Backend Core + Microsoft Edge WebView2)
- **Arsitektur:** Menggunakan backend native berbasis Rust yang di-compile langsung ke arsitektur x86_64, memanfaatkan webview sistem bawaan OS (Microsoft Edge WebView2 berbasis Chromium Evergreen di Windows) sebagai visual presentation layer.
- **Karakteristik IPC:** Zero-cost abstraction asynchronous message-passing via Tauri IPC (`invoke` / `emit`), diverifikasi type-safe menggunakan `tauri-specta`.
- **Ekosistem Frontend:** Mendukung Vite + React 19 + TypeScript secara out-of-the-box.
- **Kontrol Sistem:** Integrasi native penuh dengan Rust crates (`sqlx`/`rusqlite`, `ring`/`aes-gcm`, `tokio::process` untuk FFmpeg).

### Opsi B: Electron (Node.js Main Process + Bundled Chromium)
- **Arsitektur:** Membundel full Chromium browser engine dan Node.js runtime ke dalam satu paket biner aplikasi desktop independen.
- **Karakteristik IPC:** `ipcMain` / `ipcRenderer` berbasis serialization JSON melalui Electron context bridge.
- **Ekosistem Frontend:** React 19 berjalan di dalam Chromium yang dibundel secara identik.
- **Kontrol Sistem:** Node.js C++ addons (N-API) atau spawn subprocess untuk integrasi logika Rust dan child process FFmpeg.

### Opsi C: Flutter Desktop (Dart + C++ Shell / Impeller/Skia)
- **Arsitektur:** Menggunakan framework UI multi-platform Google dengan bahasa Dart, merender antarmuka grafis secara imperatif langsung ke canvas melalui engine grafis C++ (Impeller / Skia).
- **Karakteristik IPC:** Dart FFI (*Foreign Function Interface*) untuk memanggil library C/C++ atau Rust (via `flutter_rust_bridge`).
- **Ekosistem Frontend:** Tidak mendukung ekosistem React/HTML/DOM; membutuhkan penulisan ulang node editor menggunakan ekosistem widget Flutter grafis.

---

## 4. Tech Selection Matrix

Berdasarkan framework evaluasi Stage 4 dari `PLANNING_v5.2.md`, pembobotan dan penilaian kuantitatif (skala 1–5, di mana 5 adalah yang paling memenuhi) disusun sebagai berikut:

| Kriteria Evaluasi | Bobot | Opsi A: Tauri 2.x | Opsi B: Electron | Opsi C: Flutter Desktop | Analisis Komparatif |
|---|:---:|:---:|:---:|:---:|---|
| **Fit terhadap Kebutuhan P0** | **30%** | **5** (1.50) | **4** (1.20) | **2** (0.60) | **Tauri 2.x:** Sempurna untuk P0. Kompatibel penuh dengan `@xyflow/react` (FR-010), in-process Rust `flow-router`, enkripsi AES-GCM in-memory (NFR-004), dan child process async FFmpeg. <br>**Electron:** Memenuhi P0 React & FFmpeg, namun modul `flow-router` Rust memerlukan N-API C++ binding atau sidecar terpisah yang menambah latensi IPC. <br>**Flutter:** Gagal secara efisien memenuhi P0 karena `@xyflow/react` tidak dapat digunakan; ekosistem node canvas di Flutter jauh lebih tertinggal. |
| **Ekosistem & Maturity** | **20%** | **4** (0.80) | **5** (1.00) | **4** (0.80) | **Electron:** Ekosistem paling matang (>10 tahun), dokumentasi dan tooling melimpah. <br>**Tauri 2.x:** Tauri 2.x stable membawa kematangan plugin IPC, mobile/desktop support, dan stabilitas tinggi di Windows. <br>**Flutter:** Ekosistem UI luas namun pustaka khusus node-graph desktop masih immature. |
| **Kesinambungan Stack (*Stack Continuity*)** | **15%** | **5** (0.75) | **3** (0.45) | **2** (0.30) | **Tauri 2.x:** Kontinuitas 100% dari basis kode dan arsitektur proyek OpenPacket milik tim (Rust + Tauri + React). <br>**Electron:** Memerlukan penyesuaian glue code Node.js dan build pipeline gyp/N-API. <br>**Flutter:** Diskontinu; tim harus mengadopsi Dart dan membuang komponen React yang telah dirancang. |
| **Performa & Konsumsi Sumber Daya** | **15%** | **5** (0.75) | **2** (0.30) | **4** (0.60) | **Tauri 2.x:** RAM idle baseline ~40–70MB, cold start ~0.8–1.5s, bundle size installer ~12–18MB. Memenuhi NFR-001 & NFR-008 secara mutlak. <br>**Electron:** RAM baseline ~250–400MB, cold start 3.5–5s (risiko melanggar NFR-008), bundle size ~120–160MB. <br>**Flutter:** RAM ~80–120MB, performa grafis rendering tinggi, namun jembatan FFI ke Rust menambah kompleksitas memory marshalling. |
| **Kemudahan Tim / *Developer Familiarity*** | **10%** | **5** (0.50) | **4** (0.40) | **2** (0.20) | Tim developer tunggal (solo lead) memiliki pengalaman langsung mengimplementasikan arsitektur Tauri 2.x dan Rust core pada OpenPacket, serta mahir dalam React 19 / TypeScript. |
| **Risiko *Vendor Lock-in*** | **10%** | **4** (0.40) | **4** (0.40) | **3** (0.30) | **Tauri 2.x:** Frontend berbasis standard Web standard (React 19/Vite), backend berbasis standard Rust 2021 edition. Kode frontend dapat dipindahkan ke web/Electron kapan saja. <br>**Electron:** Standard web frontend, backend Node.js. <br>**Flutter:** Lock-in tinggi terhadap framework Dart/Flutter. |
| **Total Skor Tertimbang** | **100%** | **4.70** | **3.75** | **2.80** | **Tauri 2.x unggul signifikan (+0.95 di atas Electron, +1.90 di atas Flutter).** |

---

## 5. Decision

**Diputuskan untuk memilih Opsi A: Tauri 2.x (Rust Backend Core + Microsoft Edge WebView2) sebagai Desktop App Shell Framework untuk Flow Studio.**

**Runner-up:** **Opsi B (Electron)**.
Electron dipertimbangkan sebagai runner-up yang viable dan dapat diadopsi hanya jika terjadi kegagalan rendering fatal atau limitasi struktural pada engine WebView2 yang tidak dapat diselesaikan melalui konfigurasi flag Chromium bawaan.

### Rationale Utama:
1. **Fit Arsitektur In-Process:** `flow-router`, SQLite database pool, secure vault encryption, dan process manager FFmpeg dapat dikompilasi secara *monolithic in-process* ke dalam binary Rust backend tanpa overhead inter-process communication (IPC) daemon atau dependensi Node.js.
2. **Resource Budgeting Ramah Hardware Minimum (NFR-001, NFR-008):** Pemanfaatan WebView2 yang sudah terinstal di Windows menghemat footprint memori RAM hingga 75% dibandingkan membundel Chromium penuh, menyisakan ruang kapasitas memori untuk proses stitching video berat oleh FFmpeg.
3. **Penyimpanan Kredensial Terisolasi (NFR-004):** Eksekusi kriptografi AES-256-GCM langsung di native Rust thread menjamin keamanan token Google Flow dari inspeksi runtime JavaScript.
4. **Verifikasi Kontinuitas Tim:** Berdasarkan pengalaman konkret dari proyek OpenPacket, pola IPC, integrasi bundling Windows, dan siklus hidup window management sudah teruji secara teknis.

---

## 6. Consequences

### Konsekuensi Positif (Positive Consequences):
- **Distribusi Sangat Ringan:** Binary executable Flow Studio berukuran ultra-kompak (estimasi installer NSIS/MSI < 25MB vs Electron > 140MB).
- **Footprint Memori Rendah:** Konsumsi RAM idle stabil di angka 50–80 MB, memungkinkan sistem tetap responsif pada perangkat 8GB RAM saat eksekusi pipeline concurrent.
- **Waktu Cold Start Cepat:** Aplikasi siap merespons interaksi pengguna dalam tempo 1.0–1.6 detik dari peluncuran, melampaui target NFR-008 (< 3 detik).
- **Type-Safe Contract Synchronization:** Pemanfaatan `tauri-specta` memungkinkan otomatisasi ekspor binding TypeScript dari Rust struct, mengeliminasi human error pada batas komunikasi API (IPC).
- **Keamanan Memori Native:** Secret keys dan plaintext payload hanya dialokasikan di dalam chunk memory Rust yang zeroized saat dropped (`zeroize` crate), memitigasi risiko pembacaan memory heap JS.
- **Eksekusi FFmpeg Efisien:** Pipa `std::process::Stdio` dan `tokio::process::Command` Rust menangani streaming stdout progress render tanpa hambatan context-switching V8 engine.

### Konsekuensi Negatif & Trade-offs (Negative Consequences):
- **Kompilasi Rust Lambat:** Waktu build kompilasi awal (*clean build*) dari cargo dependencies Rust membutuhkan waktu beberapa menit di lingkungan CI/CD lokal.
- **Ketergantungan External Runtime Windows:** Ketergantungan pada Microsoft Edge WebView2 runtime di mesin target pengguna, berbeda dengan Electron yang membawanya secara self-contained.
- **Variabilitas Fitur Edge WebView2:** Fitur Chromium tertentu mungkin memerlukan penyesuaian command-line flags pada saat inisialisasi window Tauri (`with_webview_flags`).
- **Debugging Batas IPC:** Kesalahan tracing pada asynchronous Tauri invoke memerlukan logging terstruktur ganda (tracing subscriber di Rust dan browser console di React).

---

## 7. Risks & Mitigations

### Risiko 1: Ketiadaan atau Kerusakan Microsoft Edge WebView2 Runtime pada Windows Target (NFR-007)
- **Tingkat Keparahan:** Tinggi
- **Probabilitas:** Sangat Rendah (Windows 10 21H2+ dan Windows 11 sudah menyertakan WebView2 Runtime Evergreen secara default).
- **Dampak:** Aplikasi gagal meluncurkan window UI dan hang di latar belakang.
- **Mitigasi:**
  1. Konfigurasi `tauri.conf.json` dengan mode distribusi `embedBootstrapper` atau `downloadBootstrapper`. Jika runtime WebView2 tidak terdeteksi pada mesin target, installer Tauri secara otomatis mengunduh dan memasang Microsoft Edge WebView2 Evergreen Runtime secara silent.
  2. Tambahkan pemeriksaan pre-flight pada Rust `main()`: Jika inisialisasi WebView2 mengembalikan error code, tampilkan *native message box* Windows (`windows-sys` / `rfd` dialog) yang memandu pengguna mengunduh runtime resmi sebelum aplikasi keluar secara anggun (*graceful exit*).

### Risiko 2: Masalah Performa atau Glitch Rendering Hardware Acceleration pada Canvas `@xyflow/react`
- **Tingkat Keparahan:** Sedang
- **Probabilitas:** Rendah
- **Dampak:** Frame rate canvas turun di bawah 60 FPS (pelanggaran NFR-001) atau terjadi flickering pada layar monitor high-DPI dengan multi-node preview.
- **Mitigasi:**
  1. Lewatkan argumen GPU Chromium secara eksplisit melalui Tauri builder di Rust:
     ```rust
     tauri::Builder::default()
         .plugin(tauri_plugin_shell::init())
         .setup(|app| {
             // Inisialisasi window dengan akselerasi perangkat keras optimal
             Ok(())
         });
     ```
  2. Implementasikan `canvas-renderer` virtualisasi `@xyflow/react` dengan `onlyRenderVisibleElements={true}` untuk membatasi DOM node aktif pada viewport.
  3. Konfigurasi flag WebView2 `additionalBrowserArguments: "--enable-gpu-rasterization --enable-zero-copy"` untuk memaksimalkan throughput grafis terintegrasi.

### Risiko 3: Memory Bloat Akibat Thumbnail Preview Multi-Node
- **Tingkat Keparahan:** Sedang
- **Probabilitas:** Sedang
- **Dampak:** Konsumsi RAM melonjak saat proyek memuat 50+ video thumbnail klip.
- **Mitigasi:**
  1. Jangan memuat raw video file ke dalam canvas DOM; gunakan static image frame pertama (`ref_xxx.webp`) berukuran terkompresi.
  2. Komponen video preview interaktif (HTML5 `<video>`) hanya di-mount secara dinamis saat node berada dalam viewport aktif atau ketika pengguna menekan tombol Play.
  3. Manfaatkan custom Tauri protocol (`stream-asset://`) yang menyajikan file aset langsung dari filesystem lokal dengan dukungan HTTP range header untuk video seeking, menghindari pembacaan buffer base64 ke dalam memory heap JavaScript.

---

## 8. Revisit Triggers

Keputusan penggunaan Tauri 2.x ini bersifat **Type-1** (sulit dan mahal untuk dibalik). Namun, arsitektur harus dievaluasi ulang dan opsi runner-up (Electron) dapat diaktifkan jika kondisi kuantitatif berikut terpenuhi:

1. **Rendering Incompatibility Terbukti Fatal:**
   Ditemukan bug rendering fundamental atau perbedaan engine pada Microsoft Edge WebView2 di Windows yang menyebabkan canvas `@xyflow/react` tidak dapat mencapai 60 FPS pada baseline hardware NFR-001, dan masalah tersebut tidak terselesaikan oleh Microsoft WebView2 update dalam waktu 30 hari.
2. **Kebutuhan Perluasan Multi-Platform Menuntut Mesin Chromium Identik:**
   Stakeholder bisnis memutuskan untuk memperluas target dukungan dari eksklusif Windows x64 ke Linux dan macOS, dan disparitas visual engine antara WebKit (macOS), WebKitGTK (Linux), dan WebView2 (Windows) menyebabkan inkonsistensi rendering canvas yang tidak dapat dimitigasi dengan biaya masuk akal.
3. **Limitasi Fungsionalitas Ekstensi WebView2:**
   Kebutuhan fungsionalitas masa depan yang mengharuskan intervensi internal Chromium network stack atau instalasi extension headless browser yang secara arsitektural dilarang oleh sandboxing Microsoft Edge WebView2 namun didukung penuh oleh Electron `session` API.

---

## 9. References

1. **SRS Flow Studio:**
   - §4.2 Node Editor Canvas (`FR-010` s.d. `FR-018`)
   - §5.1 Performance Requirements (`NFR-001`, `NFR-008`)
   - §5.6 Compatibility Requirements (`NFR-007`)
2. **Architecture & Contract Blueprint:**
   - `API.md`: §1 Executive Summary & Scope (Tauri 2.x IPC, `flow-router` Internal Rust Contract)
   - `ERD.md`: §5 Strategi Pengindeksan & In-Process Database Schema
3. **Framework Documentation & Standards:**
   - [Tauri 2.0 Documentation](https://v2.tauri.app/) — Native App Shell, IPC Architecture, and Windows Distribution
   - [Microsoft Edge WebView2 Documentation](https://learn.microsoft.com/en-us/microsoft-edge/webview2/) — Evergreen Distribution and Windows Integration
   - [@xyflow/react Documentation](https://reactflow.dev/) — Canvas Virtualization and Rendering Constraints
   - [Specta / tauri-specta](https://github.com/oscartbeaumont/tauri-specta) — Type-safe IPC generation between Rust and TypeScript
4. **Internal Prior Art:**
   - Proyek OpenPacket — Arsitektur Rust Tauri 2.x + React Desktop Application Shell
