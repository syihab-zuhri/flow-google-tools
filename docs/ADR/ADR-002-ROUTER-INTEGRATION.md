# ADR-002: Flow-Router Integration Strategy (Embedded Rust Module vs Standalone Daemon)

- Status: Accepted
- Date: 2026-09-24
- Owners: Software Architect & Planning Lead
- Decision Class: Type-1
- Related Requirements: FR-001, FR-004, NFR-002, NFR-004

---

## 1. Context

Flow Studio adalah aplikasi desktop *creative automation* yang mengorkestrasikan pembuatan video multi-segmen berbasis Google Flow (Veo 3.1). Komponen inti yang menggerakkan interaksi jaringan dan distribusi beban ke upstream adalah modul **`flow-router`**. Modul ini memikul tanggung jawab krusial:
1. **Reverse-Engineered HTTP Client:** Bertindak sebagai *reverse proxy client* untuk mengabstraksi komunikasi API tidak resmi dengan Google Flow backend (payload generation, status polling, video asset download, dan header impersonation).
2. **Account Pooling & Credit Rotation (FR-001, FR-004):** Mengelola pool multi-akun Google Flow, melacak sisa kuota (50 kredit gratis harian per akun serta kuota bulanan), dan mengeksekusi rotasi akun otomatis tanpa interupsi saat kredit akun aktif habis atau terkena pembatasan kuota (*HTTP 429 Too Many Requests*).
3. **Session Lifecycle & Credential Access:** Mengakses data sesi (cookie dan bearer token) secara aman dari brankas terenkripsi (`credential_vault`) saat berstatus `UNLOCKED`.

Pada implementasi perkakas komunitas yang sejenis (seperti arsitektur `9router`), *flow routing* umumnya diimplementasikan sebagai *standalone proxy daemon* yang berjalan di latar belakang dan mendengarkan koneksi pada port lokal `127.0.0.1:PORT` (misalnya port 8080 atau 8787). Klien lokal kemudian mengarahkan permintaan HTTP ke port tersebut, lalu daemon melakukan injeksi *credential* dan meneruskannya ke hulu.

### Masalah Arsitektur
Arsitektur Flow Studio harus menentukan model integrasi untuk subsistem `flow-router`:
- Apakah `flow-router` harus diintegrasikan langsung sebagai **Embedded Rust Module** di dalam proses inti Tauri Core (*in-process invocation* via Tauri IPC and Rust traits)?
- Ataukah dijalankan sebagai **Standalone Sidecar Daemon** (proses terpisah berbasis biner Rust/Node.js/Go yang membuka antarmuka REST API pada *loopback TCP port*)?
- Ataukah dideploy sebagai **Background OS Service / Containerized Service** (Docker / Windows Service)?

Keputusan ini diklasifikasikan sebagai **Type-1 Decision** (arsitektur berisiko tinggi dan sangat mahal untuk dibalik) karena menentukan batas proses (*process boundary*), manajemen siklus hidup aplikasi (*process lifecycle*), postur keamanan jaringan lokal (*local network attack surface*), protokol komunikasi antarmodul, serta jejak konsumsi memori (*memory footprint*) pada mesin pengguna.

---

## 2. Decision Drivers

Keputusan ini dievaluasi berdasarkan kriteria penggerak utama (*decision drivers*):

1. **Keamanan & Postur Attack Surface (NFR-004, Zero Open Local Ports):**
   Mencegah pembukaan *listening TCP port* lokal pada antarmuka *loopback* (`127.0.0.1`). Port lokal yang terbuka tanpa enkripsi TLS timbal-balik (*mTLS*) rentan terhadap inspeksi proses lain, *cross-site port scanning* dari browser web publik, serangan *Cross-Site WebSocket/Request Hijacking*, atau pembacaan token sesi oleh skrip malware lokal yang tidak berpriveleged.
2. **Keandalan Siklus Hidup Proses (Zero Zombie Processes):**
   Aplikasi desktop yang mengorkestrasikan *child process* terpisah sering meninggalkan proses yatim (*zombie/orphan daemon*) saat antarmuka utama mengalami *abnormal termination*, crash, atau force quit melalui Task Manager. Arsitektur harus menjamin pembersihan proses 100% deterministik.
3. **Performa & Latensi Dispatch Permintaan (NFR-002):**
   Persyaratan non-fungsional NFR-002 mewajibkan latensi *dispatch* generasi video kurang dari 2 detik (< 2000 ms). Pengiriman perintah internal harus memiliki overhead seminimal mungkin tanpa latensi *handshake* TCP soket, context switching antar-proses OS, atau overhead serialisasi HTTP ganda.
4. **Efisiensi Sumber Daya & Konsumsi Memori (RAM / CPU Footprint):**
   Flow Studio berjalan di komputer desktop kreator bersamaan dengan proses komputasi berat lainnya (seperti *rendering* timeline, pemutaran video, dan proses transkoding FFmpeg). Menghindari *runtime duplication* (misal: dua Tokio runtime atau runtime Node.js tambahan) adalah prioritas tinggi.
5. **Kesederhanaan Distribusi & Packaging (Single-Binary Delivery):**
   Meminimalkan friksi instalasi dan portabilitas bagi pengguna akhir. Distribusi berkas tunggal (*unified executable*) atau installer standar tanpa dependensi eksternal, konfigurasi port manual, atau deteksi konflik port lokal (`EADDRINUSE`).
6. **Ekstensibilitas & Pemisahan Domain Bersih (Future Extensibility):**
   Meskipun diintegrasikan secara *in-process*, struktur kode harus mempertahankan batasan modularitas yang bersih (*clean domain boundary*), sehingga logika *routing* dapat diekstraksi menjadi perkakas baris perintah (CLI) atau daemon pada fase masa depan (P2) tanpa penulisan ulang logika inti.

---

## 3. Considered Options

Tiga opsi arsitektur realistis dipertimbangkan secara mendalam:

### Opsi A: Embedded Rust Module inside Tauri Core (In-Process Module)

Modul `flow-router` dikompilasi secara *statically-linked* ke dalam biner backend Tauri Core. Komunikasi dari frontend dilayani melalui mekanisme Tauri IPC Commands (`tauri::command`) dan Events (`tauri::Emitter`). Di lapisan internal Rust, orkestrator pipeline berinteraksi langsung dengan modul router melalui Rust trait `FlowRouterService` yang dilindungi oleh konkurensi aman (`Arc<RwLock<T>>` dan channel `tokio::sync::mpsc`).

- **Mekanisme Komunikasi:** In-process function invocation via trait abstraksi, channel async Tokio, dan IPC berbasis memori lokal.
- **Manajemen Sesi:** Kredensial akun didekripsi langsung di memori volatile aplikasi menggunakan *enclave pattern*, dibersihkan secara aman menggunakan `zeroize` segera setelah *request* selesai dikirim.
- **Kelebihan:**
  - **Zero Exposed Network Ports:** Tidak ada soket TCP/UDP yang dibuka pada sistem operasi host. Mengeliminasi 100% risiko *port hijacking*, scanning, atau konflik port.
  - **Zero Zombie Processes:** Router hidup dan mati persis bersamaan dengan proses utama Tauri. Tidak mungkin ada proses tertinggal di background.
  - **Ultra-Low Latency:** Latensi panggilan in-memory < 0.1 ms, jauh mengungguli batas NFR-002 (< 2 detik).
  - **Distribusi Biner Tunggal:** Hasil kompilasi berupa biner eksekusi tunggal (.exe / portable build).
  - **Hygiene Memori Maksimal:** Sesuai NFR-004, token otentikasi tidak pernah transit melalui soket jaringan lokal yang tidak terenkripsi.
- **Kekurangan:**
  - **Shared Fault Domain:** Unhandled panic di dalam thread modul router secara teoretis dapat mematikan seluruh aplikasi jika tidak ditangkap dengan `catch_unwind` atau isolasi task Tokio.
  - **Coupled Build:** Setiap perubahan pada logika router memerlukan kompilasi ulang proyek Tauri secara keseluruhan.
  - **Inaccessible to External Local Tools:** Tidak dapat langsung dihubungi oleh skrip eksternal (misal skrip Python luar atau extension ComfyUI) tanpa mengekspos endpoint baru.

---

### Opsi B: Standalone Sidecar Daemon (9router Style Local HTTP Reverse Proxy)

Router dibangun sebagai biner terpisah (aplikasi daemon berbasis Rust/Axum atau Node.js) yang dijalankan sebagai *child process* (sidecar) oleh Tauri atau berjalan independen di latar belakang sistem operasi. Daemon ini membuka web server HTTP pada `http://127.0.0.1:<PORT>` dan mengekspos REST API.

- **Mekanisme Komunikasi:** Loopback HTTP/1.1 atau HTTP/2 via TCP socket lokal. Frontend dan Pipeline Executor mengirimkan HTTP request ke `localhost:PORT`, yang kemudian memodifikasi header dan meneruskannya ke Google Flow.
- **Manajemen Sesi:** Daemon menyimpan atau meminta credential dari proses utama melalui IPC terpisah, lalu memproses token di memorinya sendiri.
- **Kelebihan:**
  - **Isolasi Proses Penuh:** Kegagalan fatal atau crash pada daemon tidak menyebabkan antarmuka grafis (GUI) crash seketika, dan sebaliknya.
  - **Akses Multiklien Eksternal:** Memungkinkan perkakas pihak ketiga (CLI script, ComfyUI node, Premiere extension) untuk memanfaatkan pool akun dan rotasi kredit secara bersamaan.
  - **Independensi Bahasa & Pengujian:** Modul daemon dapat diuji secara terpisah menggunakan perkakas HTTP standar seperti `curl` atau Postman.
- **Kekurangan:**
  - **Risiko Keamanan Loopback:** Port lokal terbuka dapat diakses oleh proses lain atau skrip browser yang berjalan pada mesin lokal jika otentikasi lokal (*bearer shared secret*) tidak diterapkan secara sangat ketat.
  - **Port Collision & Dynamic Binding:** Membutuhkan logika pendeteksian port kosong jika port default telah digunakan oleh aplikasi lain, serta mekanisme sinkronisasi port dinamis ke frontend Tauri.
  - **Masalah Zombie Process:** Risiko tinggi proses daemon tetap berjalan (*orphan*) ketika aplikasi desktop ditutup paksa (*force kill* melalui task manager atau OS reboot).
  - **Duplikasi Konsumsi Memori:** Memerlukan alokasi memori untuk dua proses terpisah, dua runtime asinkron, dan duplikasi koneksi SQLite.

---

### Opsi C: Separate Containerized / Background OS Service (Docker / Windows Service)

Router dikemas sebagai kontainer Docker (`docker-compose.yml`) atau didaftarkan sebagai sistem *service* persisten tingkat OS (*Windows Service* melalui Service Control Manager).

- **Mekanisme Komunikasi:** REST API melalui *container bridge network* atau *named pipes* Windows Service.
- **Manajemen Sesi:** File konfigurasi persisten yang dipasang (*volume mount*) atau komunikasi IPC layanan Windows.
- **Kelebihan:**
  - **Supervisi OS:** Sistem operasi secara otomatis me-restart daemon jika terjadi kegagalan.
  - **Headless Execution:** Dapat terus memproses antrean tugas generasi bahkan saat aplikasi GUI Flow Studio ditutup.
- **Kekurangan:**
  - **Overkill untuk Solopreneur Tool:** Mengharuskan instalasi Docker Desktop (berat dan berlisensi komersial tertentu) atau hak akses administrator untuk mendaftarkan Windows Service.
  - **Kompleksitas Distribusi & Update:** Memperumit proses *packaging*, migrasi skema database SQLite, dan alur pembaruan aplikasi otomatis (*auto-update*).
  - **Beban Sumber Daya Ekstrem:** Penggunaan memori dan CPU yang sangat tinggi, tidak realistis untuk spesifikasi minimum hardware (Intel Core i5 Gen 8, 8GB RAM).

---

## 4. Tech Selection Matrix

Berdasarkan metodologi evaluasi arsitektur **PLANNING_v5.2.md Stage 4**, berikut adalah matriks perbandingan berbobot antar opsi yang dipertimbangkan:

| Kriteria Evaluasi | Bobot | Opsi A: Embedded Rust Module | Opsi B: Standalone Sidecar Daemon | Opsi C: Container / OS Service |
|---|---|:---:|:---:|:---:|
| **1. Fit terhadap Kebutuhan P0 & Scope Single-User**<br>*(Kesesuaian dengan arsitektur personal desktop tool, kesederhanaan operasional)* | 25% | **5** (1.25) | **4** (1.00) | **2** (0.50) |
| **2. Keamanan & Proteksi Kredensial (NFR-004)**<br>*(Zero open ports, in-memory zeroization, ketiadaan intercept point di loopback)* | 20% | **5** (1.00) | **3** (0.60) | **3** (0.60) |
| **3. Keandalan Lifecycle & Manajemen Proses**<br>*(Pencegahan zombie/orphan process, deterministic startup/teardown)* | 15% | **5** (0.75) | **3** (0.45) | **3** (0.45) |
| **4. Performa & Latensi Dispatch (NFR-002)**<br>*(Panggilan in-memory vs TCP socket overhead, pemenuhan batas < 2s)* | 15% | **5** (0.75) | **4** (0.60) | **3** (0.45) |
| **5. Efisiensi Resource & Memory Footprint**<br>*(Satu runtime Tokio bersama, konsumsi RAM < 150MB di baseline)* | 15% | **5** (0.75) | **3** (0.45) | **1** (0.15) |
| **6. Kemudahan Distribusi & Packaging**<br>*(Biner mandiri, zero external setup, portable Windows build)* | 10% | **5** (0.50) | **3** (0.30) | **1** (0.10) |
| **Total Skor Tertimbang** | **100%** | **5.00** | **3.40** | **2.25** |

### Analisis Skor
- **Opsi A (Embedded Rust Module)** memperoleh skor sempurna (**5.00**). Opsi ini unggul mutlak pada seluruh parameter kritis: keamanan (tidak membuka port TCP lokal), konsumsi resource yang sangat ramping, lifecycle yang menyatu dengan Tauri, dan distribusi biner tunggal.
- **Opsi B (Standalone Sidecar Daemon)** menjadi runner-up (**3.40**). Opsi ini memiliki fleksibilitas tinggi untuk skenario multiklien, namun membawa beban kompleksitas signifikan pada manajemen port, pencegahan zombie process, dan proteksi loopback HTTP.
- **Opsi C (Container / OS Service)** tidak direkomendasikan (**2.25**) karena introduce friksi setup yang masif dan konsumsi memori berlebihan untuk kebutuhan personal creative tool.

---

## 5. Decision

### Keputusan Utama
Diputuskan untuk memilih **Opsi A: Embedded Rust Module inside Tauri Core** sebagai arsitektur integrasi resmi untuk modul `flow-router`.

### Runner-Up & Batasan Skenario
**Opsi B (Standalone Sidecar Daemon)** ditetapkan sebagai *runner-up resmi*. Opsi B hanya akan dipertimbangkan kembali jika pada rilis masa depan (Phase 2) Flow Studio diwajibkan berfungsi sebagai *headless backend engine* yang melayani antarmuka baris perintah independen (*CLI tools*) atau integrasi antarmuka kreatif eksternal (*third-party DCC integrations*).

### Pola Implementasi: Modular Monolith inside Cargo Workspace
Untuk mencegah *architectural lock-in* (kelemahan Opsi A di mana kode terikat mati pada Tauri runtime), struktur kode diisolasi secara ketat menggunakan prinsip *Clean Architecture* dan *Cargo Workspace*:

```
flow-studio/
├── src-tauri/
│   ├── Cargo.toml
│   ├── crates/
│   │   └── flow-router-core/         # Pustaka murni Rust (Headless Domain Logic)
│   │       ├── Cargo.toml            # Tanpa dependensi tauri! Hanya reqwest, tokio, serde, secrecy
│   │       └── src/
│   │           ├── client.rs         # Reverse-engineered Google Flow HTTP engine
│   │           ├── pool.rs           # Account pooling & rotation algorithm
│   │           ├── quota.rs          # Daily & monthly credit tracker
│   │           ├── traits.rs         # FlowRouterService definition
│   │           └── error.rs          # Upstream & Router error domain
│   └── src/
│       ├── adapters/
│       │   └── router_ipc.rs         # Tauri Command glue code & Specta bindings
│       ├── state.rs                  # AppState wrapping Arc<dyn FlowRouterService>
│       └── main.rs
```

Dengan isolasi ini:
1. `flow-router-core` adalah pustaka Rust agnostik murni yang tidak mengetahui keberadaan Tauri atau WebView. Logika ini dapat dikompilasi ke biner CLI atau HTTP daemon terpisah dalam hitungan jam jika Opsi B dibutuhkan di kemudian hari.
2. Lapisan `adapters/router_ipc.rs` bertindak murni sebagai adapter yang menerjemahkan Tauri IPC command ke panggilan trait internal Rust.

---

## 6. Consequences

### Konsekuensi Positif (Benefits)
1. **Zero Open Ports (Enhanced Local Security):** Tidak ada port TCP/UDP lokal yang mendengarkan koneksi. Sistem operasi tidak akan memicu prompt peringatan *Windows Defender Firewall*, dan malware lokal tidak dapat melakukan *spoofing* atau intersepsi lalu lintas HTTP lokal.
2. **Eliminasi Total Zombie Processes:** Modul berjalan di dalam *thread pool* proses utama Tauri. Ketika aplikasi ditutup oleh pengguna atau diterminasi sistem, seluruh resource jaringan dan memori otomatis dibersihkan oleh kernel OS.
3. **Kepatuhan Mutlak NFR-004 (In-Memory Zeroization):** Cookie sesi dan token autentikasi Google didekripsi langsung di memori proses, dimuat ke header `reqwest::header::HeaderMap`, dan segera dibersihkan menggunakan *zeroization* (`secrecy::SecretString`). Tidak ada transmisi token melintasi batas proses (*inter-process boundary*) dalam bentuk plaintext.
4. **Kecepatan Eksekusi & Pemenuhan NFR-002:** Panggilan dispatch eksekusi generasi video berlangsung *in-process* dengan latensi < 0.1 ms (eliminasi overhead TCP connection setup, HTTP parsing di localhost, dan context switching OS). Waktu dispatch ke Google Flow sepenuhnya didominasi oleh latensi jaringan internet aktual.
5. **Kemudahan Distribusi & Update:** Pengguna menerima satu biner eksekusi portabel atau installer MSI tunggal. Tidak ada risiko bentrokan port sistem (`EADDRINUSE`) atau dependensi runtime eksternal.

### Konsekuensi Negatif (Trade-offs & Liabilities)
1. **Batas Kegagalan Bersama (*Shared Fault Domain*):** Karena berjalan di dalam proses yang sama, kepanikan fatal (*panic*) pada thread worker router berpotensi menghentikan proses aplikasi utama bila tidak diisolasi.
2. **Keterikatan Waktu Kompilasi (*Coupled Compilation*):** Siklus build development Rust backend mencakup keseluruhan modul router, yang membutuhkan waktu kompilasi biner awal yang sedikit lebih lama dibanding proyek sidecar terpisah.
3. **Ketiadaan Akses Eksternal Langsung:** Skrip eksternal pengguna (misalnya script shell automasi) tidak dapat langsung mengirim cURL ke router lokal untuk memanfaatkan kuota akun tanpa membuka antarmuka Flow Studio.

---

## 7. Risks & Mitigations

| Risk ID | Deskripsi Risiko | Dampak | Probabilitas | Strategi Mitigasi Terencana |
|---|---|:---:|:---:|---|
| **RSK-ROUTER-001** | *Unhandled Rust panic* pada modul router menjatuhkan (*crash*) window GUI desktop. | High | Low | Seluruh operasi HTTP client dan parsing response dibungkus dalam blok penanganan `Result<T, RouterError>` yang ketat. Worker loop dijalankan dalam `tokio::spawn` terisolasi, di mana kegagalan task tidak membatalkan runtime induk. Larangan penggunaan `.unwrap()` sesuai standar kualitas `CODE_QUALITY.md`. |
| **RSK-ROUTER-002** | *Network I/O saturation* atau polling status video yang intensif memblokir *UI event loop*. | Medium | Low | Seluruh operasi I/O jaringan dijalankan secara non-blocking di atas multi-threaded Tokio runtime pool. Thread antarmuka grafis Tauri (Webview GUI thread) terpisah penuh dari thread pool eksekutor I/O backend. |
| **RSK-ROUTER-003** | *Architectural Lock-In* yang menyulitkan transisi jika di masa depan dibutuhkan integrasi eksternal (CLI / ComfyUI). | Medium | Medium | Mematuhi pemisahan Cargo Workspace: modul bisnis inti ditempatkan pada biner independen `crates/flow-router-core` dengan kontrak trait `FlowRouterService`. Mengabstraksi adapter komunikasi sehingga mudah dipasangi web server Axum di kemudian hari. |
| **RSK-ROUTER-004** | Kebocoran memori (*memory leak*) selama sesi generasi video berdurasi panjang (*long-running sequential generation*). | Medium | Low | Penerapan *streaming response body* langsung ke file temporary di disk saat mendownload segmen video MP4, menghindari *buffering* muatan biner besar di dalam memori RAM. Pembersihan koneksi HTTP client mengandalkan pool idle timeout standar `reqwest`. |

---

## 8. Revisit Triggers

Keputusan ini akan ditinjau kembali secara formal melalui revisi ADR atau pembuatan ADR baru apabila salah satu kondisi terukur berikut terpenuhi:

1. **Trigger P2-CLI / Automation (Kebutuhan Headless CLI):**
   Terdapat kebutuhan pengguna atau inisiatif roadmap P2 untuk menjalankan eksekusi pipeline Flow Studio secara *fully headless* (misalnya dieksekusi melalui scheduler Windows Task Scheduler atau script PowerShell tanpa menampilkan jendela GUI).
2. **Trigger DCC / Third-Party Ecosystem (Integrasi Alat Kreatif Eksternal):**
   Adanya kebutuhan mendesak untuk mengintegrasikan Flow Studio ke alat eksternal seperti *Custom Node* ComfyUI, plugin Blender 3D, atau ekstensi Adobe After Effects yang membutuhkan endpoint HTTP proxy lokal `http://127.0.0.1:<PORT>` untuk memanfaatkan fitur *account pooling*.
3. **Trigger Multi-Instance Concurrency:**
   Kebutuhan arsitektur berubah menjadi multiklien lokal (misal: beberapa jendela aplikasi atau worker proses rendering terpisah yang berjalan simultan di mesin yang sama dan perlu berbagi satu *account pool state* secara terpusat).
4. **Trigger Upstream Protocol Instability (Full Headless Browser Requirement):**
   Perubahan drastis pada sistem proteksi otentikasi Google Flow yang mewajibkan eksekusi mesin browser penuh (*full Chromium context via Playwright/Puppeteer*) secara terus-menerus selama request dispatch, yang menuntut proses sandbox terisolasi di luar memori utama Tauri Core.

---

## 9. References

- **`SRS.md`**:
  - §4.1 Functional Requirements: Account Management (`FR-001`, `FR-002`, `FR-003`, `FR-004`, `FR-005`).
  - §5.2 Non-Functional Requirements: Performance & Latency (`NFR-002` Video Generation Request Dispatch Latency < 2s).
  - §5.3 Non-Functional Requirements: Security (`NFR-004` Credential Protection at Rest & In-Memory Hygiene).
- **`PRD/ACCOUNT_POOL.md`**:
  - §1 Overview & Positioning sebagai 9router-style in-app module.
  - §3.3 Automatic Account Rotation Rules.
  - §5 Technical Architecture & Internal Subsystem Flow.
  - §8.2 Security, Data Privacy & Zero-Plaintext Logging.
- **`API.md`**:
  - §2 Canonical Error Handling Model.
  - §4 Account Pool Management APIs (`API-ACCT-001` s/d `API-ACCT-005`).
  - §9 Internal Rust API Specification (`flow-router` Module & `FlowRouterService` Trait).
- **`PERMISSION.md`**:
  - §2 Trust Boundary Definition (Tauri Core vs Subprocesses).
  - §3 Master Password & Enclave Key Lifecycle.
  - §7 Network Permission & Egress Rules (Direct HTTPS to Google Flow).
  - §10 Security Audit & Memory Hardening Matrix.
- **`PLANNING.md`**:
  - §5.1.1 FEAT-FLOW_ROUTER Multi-Account Flow Router.
  - §10 Tech Stack Summary & Embedded Router Architectural Rationale.
- **`PLANNING_v5.2.md`**:
  - §4 Stage 4 Tech Selection Matrix Specification.
  - §11.18 Architecture Decision Records (`ADR/`) Template & Rules.
