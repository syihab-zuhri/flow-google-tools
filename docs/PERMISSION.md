# Permission & Access Control Specification: Flow Studio

> **Project:** Flow Studio  
> **Document ID:** DOC-PERM-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-SRS-001  
> **Supersedes:** None  

---

## 1. Ringkasan Eksekutif & Filosofi Desain Otorisasi

Flow Studio adalah aplikasi desktop personal (*single-user creative desktop tool*) yang dibangun menggunakan framework Tauri 2.x, antarmuka React 19, dan backend sistem Rust. Berbeda dengan aplikasi web multi-tenant atau sistem enterprise yang memerlukan *Role-Based Access Control* (RBAC) atau *Attribute-Based Access Control* (ABAC) hierarkis lintas berbagai level staf (seperti Admin, Editor, Viewer, Guest), Flow Studio didedikasikan secara eksklusif untuk satu aktor manusia: **Owner** (pemilik perangkat lokal).

Oleh karena itu, batasan keamanan dan model otorisasi dalam Flow Studio tidak berpusat pada pemisahan hak akses antar pengguna (*inter-user isolation*), melainkan berpusat pada **Vault-Based State Authorization (VBA)** dan **Process Privilege Boundaries**. Inti dari model keamanan ini adalah:

1. **Pemisahan Autentikasi dan Otorisasi Lokal:** Autentikasi dilakukan melalui pembuktian kepemilikan *Master Password* untuk membuka brankas kredensial (*credential vault*). Otorisasi adalah penentuan apakah operasi sistem atau pemanggilan *Tauri Inter-Process Communication* (IPC) diizinkan dieksekusi berdasarkan kondisi *state* brankas (`UNINITIALIZED`, `LOCKED`, atau `UNLOCKED`) dan konteks eksekusi saat runtime.
2. **Kriptografis sebagai Batas Otorisasi (*Cryptographic Access Control*):** Akses terhadap data sensitif pihak ketiga (Google Flow session cookies, bearer tokens) tidak dilindungi oleh sekadar *boolean flag* di database, melainkan diamankan secara kriptografis menggunakan algoritma AES-256-GCM. Derivasi kunci dilakukan menggunakan Argon2id langsung dari *Master Password* yang diinput oleh Owner. Tanpa kunci turunan yang valid di memori volatile, data tidak dapat diakses oleh siapapun, termasuk oleh proses aplikasi itu sendiri.
3. **Pembersihan Memori Efemeral (*In-Memory Zeroization*):** Kunci enkripsi dan plaintext cookie hanya ada di memori RAM selama brankas berada dalam kondisi `UNLOCKED`. Saat terjadi penguncian otomatis akibat inaktivitas (*auto-lock timeout*) atau penguncian manual, kunci didekonstruksi dan dibersihkan dari RAM secara aman menggunakan teknik *memory wiping* (`zeroize`).
4. **Prinsip Hak Akses Minimum (*Principle of Least Privilege*):** Komponen frontend yang berjalan di lingkungan WebView2, modul backend Rust, sidecar subproses FFmpeg, dan koneksi HTTP keluar dibatasi secara ketat hanya pada domain dan sumber daya file yang relevan.

Dokumen ini mendefinisikan seluruh aturan otorisasi lokal, siklus hidup kunci master, pemetaan perintah Tauri IPC, penanganan kegagalan autentikasi, serta audit logging kepatuhan sistem.

---

## 2. Definisi Aktor, Subsistem & Batas Kepercayaan (*Trust Boundaries*)

### 2.1 Definisi Aktor Manusia (Sole User)

Sistem Flow Studio hanya mengenal satu aktor manusia:

| Atribut Aktor | Spesifikasi |
|---|---|
| **Nama Aktor** | **Owner** |
| **Kategori** | Human — Sole Local Operator |
| **Deskripsi** | Pemilik perangkat PC desktop lokal (Windows 10/11 x64) yang menjalankan aplikasi Flow Studio. Owner memiliki akses fisik terhadap mesin dan sistem berkas lokal. |
| **Tingkat Kepercayaan** | Semi-trusted (secara fisik menguasai host, namun dilindungi dari kesalahan operasi destruktif, kecelakaan kebocoran kredensial, dan serangan malware pihak ketiga pada host). |
| **Cakupan Akses** | Kontrol penuh atas seluruh fitur aplikasi: inisialisasi brankas, impor/hapus akun Google Flow, pembuatan dan eksekusi graph pipeline, manipulasi node, pratinjau media, dan ekspor video akhir via FFmpeg. |
| **Batas Hak Istimewa** | Owner **tidak dapat** membaca plaintext cookie yang sudah tersimpan di brankas tanpa memasukkan master password yang valid; Owner **tidak dapat** mem-bypass enkripsi AES-256-GCM; Owner **tidak dapat** memulihkan master password yang hilang tanpa melakukan *vault factory reset* (pemusnahan seluruh kredensial tersimpan). |

### 2.2 Subsistem Internal & Peran Otorisasi (*Internal Subsystem Boundaries*)

Arsitektur aplikasi terbagi menjadi beberapa komponen logis dengan batas privilese yang berbeda:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             HOST MACHINE (WINDOWS 10/11)                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ FLOW STUDIO APPLICATION PROCESS (Tauri 2.x Runtime)                   │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────┐         Tauri IPC Bridge                 │  │
│  │  │   Frontend Renderer     │◄──────────────────────────────┐          │  │
│  │  │ (WebView2 / React 19)   │────────────────────────────┐  │          │  │
│  │  └─────────────────────────┘                            ▼  │          │  │
│  │                                           ┌────────────────────────┐  │  │
│  │                                           │  Rust Backend Core     │  │  │
│  │                                           │  (Supervisor & IPC)    │  │  │
│  │                                           └───────────┬────────────┘  │  │
│  │                                                       │               │  │
│  │                        ┌──────────────────────────────┼─────────────┐ │  │
│  │                        ▼                              ▼             ▼ │  │
│  │             ┌────────────────────┐          ┌────────────┐   ┌─────┐│ │  │
│  │             │  Credential Vault  │          │Flow Router │   │Video││ │  │
│  │             │(Argon2id + AES-GCM)│          │(Acct Pool) │   │Eng. ││ │  │
│  │             └──────────┬─────────┘          └─────┬──────┘   └──┬──┘│ │  │
│  │                        │                          │             │   │ │  │
│  └────────────────────────┼──────────────────────────┼─────────────┼───┘ │
│                           ▼                          ▼             ▼     │
│                    ┌─────────────┐             ┌───────────┐ ┌─────────┐ │
│                    │ Encrypted   │             │Google Flow│ │ FFmpeg  │ │
│                    │ SQLite DB   │             │Backend API│ │ Sidecar │ │
│                    └─────────────┘             └───────────┘ └─────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

Rincian subsistem internal dan hak aksesnya:

| Subsistem Internal | Jenis Entitas | Domain Otoritas | Kebijakan & Privilese |
|---|---|---|---|
| **Frontend Renderer (WebView2)** | Untrusted UI Environment | Antarmuka pengguna React 19, canvas `@xyflow/react`, Zustand stores. | **Terkungkung (Sandboxed):** Tidak memiliki akses langsung ke disk, soket jaringan eksternal, atau memori Rust. Seluruh permintaan harus melalui *Tauri Invoke IPC* tervalidasi. Plaintext master password atau plaintext cookies dilarang disimpan di Zustand store jangka panjang. |
| **Rust Backend Core** | Trusted Supervisor | Tauri runtime, command dispatcher, event emitter, lifecycle manager. | **Penuh (Native):** Memverifikasi integritas parameter input IPC, memeriksa state brankas sebelum meneruskan eksekusi ke subsistem terkait, dan mencatat security audit log. |
| **Credential Vault Engine** | Cryptographic Boundary | Modul Rust (`vault_engine`) pembungkus pustaka kriptografi `argon2` dan `aes-gcm` / `ring`. | **Eksklusif (Secure Enclave):** Mengelola master salt, derivasi Master Key (256-bit), enkripsi/dekripsi ciphertext credential, serta eksekusi *zeroization* memori saat perintah lock diterima. Tidak pernah mengekspos Master Key ke IPC bridge. |
| **Flow Router (Account Pool)** | Ephemeral Session Consumer | Modul Rust pengatur rotasi akun, pengawasan kuota kredit, dan dispatcher generasi video. | **Bersyarat:** Berhak meminta credential terdekripsi dari brankas hanya ketika brankas berstatus `UNLOCKED`. Berhak menginisiasi koneksi HTTPS keluar ke endpoint resmi Google Flow. |
| **Pipeline Executor & Continuity Engine** | Orchestration Subsystem | Modul pemrosesan antrean node, chaining frame referensi, dan context carry-over. | **Operasional:** Meminta alokasi akun aktif dari Flow Router untuk dispatch task generasi. Tidak bersentuhan langsung dengan cryptographic keys. |
| **Video Export Engine & FFmpeg Sidecar** | Constrained Subprocess | Binary FFmpeg 6.0+ yang dipanggil via abstraksi Tauri Command sidecar. | **Terbatas (Filesystem Only):** Dijalankan secara headless tanpa shell (`sh -c` / `cmd.exe`). Hanya berhak membaca segmen video pada folder project lokal dan menulis hasil stitching/transcoding ke direktori output yang diizinkan. Tidak memiliki hak akses jaringan. |

### 2.3 Entitas Eksternal (*External Systems*)

| Entitas Eksternal | Protokol | Hak Akses & Perlakuan Otorisasi |
|---|---|---|
| **Google Flow Backend API** | HTTPS (TLS 1.3) via Port 443 | Sistem eksternal target yang menerima *generation request* dan mengembalikan status task serta binary video stream. Komunikasi hanya dilakukan secara *outbound* satu arah oleh Rust backend. Google Flow backend sama sekali tidak memiliki akses ke sistem lokal Flow Studio. |
| **Host Operating System (Windows OS)** | Win32 API / NT Subsystem | Menyediakan penyimpanan file lokal, alokasi memori terlindungi, dan eksekusi proses Tauri. OS mengontrol hak akses baca-tulis file SQLite database berdasarkan izin akun pengguna Windows yang sedang aktif login. |

---

## 3. Model Otorisasi: Vault-Based State Authorization (VBA)

### 3.1 Mengapa RBAC Tradisional Tidak Relevan

Dalam arsitektur *software engineering* modern, memaksakan implementasi RBAC multi-tabel (`users`, `roles`, `user_roles`, `permissions`, `role_permissions`) pada aplikasi desktop personal single-user adalah bentuk *architectural bloat* yang memperkenalkan kerumitan tidak beralasan dan overhead komputasi tanpa memberikan nilai keamanan tambahan.

Pada Flow Studio:
- Tidak ada konsep pendaftaran multi-user atau login kolaboratif.
- Tidak ada hierarki administratif bertingkat (misal: Supervisor vs Operator).
- Seluruh tindakan fisik di depan komputer dilakukan oleh individu yang sama (Owner).

Sebagai gantinya, Flow Studio mengadopsi model **Vault-Based State Authorization (VBA)** yang dipadukan dengan **Attribute/State Guards** pada setiap *Tauri IPC Command*. Akses terhadap fungsionalitas aplikasi diatur berdasarkan **State Mesin Keamanan (Security State Machine)** saat perintah dieksekusi.

### 3.2 State Machine Keamanan Aplikasi

Brankas kredensial Flow Studio memiliki 4 (empat) kondisi status operasional (*security states*):

```
                        ┌────────────────────────┐
                        │     UNINITIALIZED      │
                        │  (Belum Ada Password)  │
                        └───────────┬────────────┘
                                    │ cmd_vault_init(new_password)
                                    ▼
       ┌────────────────────────► LOCKED ◄───────────────────────────┐
       │                       │(Kunci Terhapus)│                    │
       │                       └───────┬────────┘                    │
       │                               │                             │
       │        cmd_vault_unlock()     │ 3x Gagal                    │
       │        (Password Benar)       │                             │
       │                               ▼                             │
       │                       ┌────────────────┐                    │
       │                       │    COOLDOWN    │                    │
       │                       │(Beku 30 Detik) │                    │
       │                       └───────┬────────┘                    │
       │                               │ Waktu Habis (Cooldown Expired)
       │                               ▼                             │
       │                         LOCKED State                        │
       │                               │                             │
       │                               ▼                             │
Auto-lock (15 min inaktif)     ┌────────────────┐                    │
atau Manual Lock               │    UNLOCKED    │────────────────────┘
       └───────────────────────┤ (Key Aktif RAM)│ Manual Lock
                               └────────────────┘
```

1. **State 1: `UNINITIALIZED`**
   - **Kondisi:** Aplikasi baru pertama kali dipasang, atau sistem baru saja mengalami *Vault Factory Reset*. Belum ada Master Password atau Master Salt yang tersimpan di tabel `vault_meta`.
   - **Otorisasi:** Seluruh fitur yang membutuhkan akun Google Flow diblokir. Aplikasi hanya mengizinkan eksekusi antarmuka editor node kosong dan perintah `cmd_vault_init`.
2. **State 2: `LOCKED` (Default saat Startup)**
   - **Kondisi:** Brankas dalam keadaan terkunci. Master Password belum diverifikasi. Master Key **tidak ada di memori RAM**. Seluruh record akun dan session cookies di database SQLite berstatus ciphertext murni.
   - **Otorisasi:** 
     - **Diizinkan:** Membuka project lokal (`.flowproj`), mengedit canvas node, mengatur prompt, mengimpor asset lokal (gambar/video), menjalankan FFmpeg concatenate/preview terhadap segmen video yang sudah selesai di-render sebelumnya, memeriksa konfigurasi umum aplikasi.
     - **Ditolak:** Mengimpor akun baru, melihat detail akun, memicu health check, mengambil sisa kredit langsung dari Google Flow, memulai pipeline generasi baru.
3. **State 3: `UNLOCKED`**
   - **Kondisi:** Owner telah berhasil memasukkan Master Password yang valid. Master Key (256-bit) hasil derivasi Argon2id tersimpan di memori aman (*protected RAM buffer*) Rust backend. Kunci verifikasi terkonfirmasi cocok.
   - **Otorisasi:** Seluruh fungsionalitas sistem terbuka penuh. Rust backend dapat mendekripsi session cookies untuk mengeksekusi HTTP request ke Google Flow backend, mengelola rotasi akun, dan menjalankan pipeline automasi penuh.
4. **State 4: `COOLDOWN` (Brute-Force Throttle State)**
   - **Kondisi:** Terdeteksi 3 (tiga) kali kegagalan berturut-turut dalam memasukkan Master Password pada saat status `LOCKED`.
   - **Otorisasi:** Sistem menolak seluruh upaya unlock selama 30 detik. Setiap percobaan baru selama masa cooldown akan ditolak seketika (*instant rejection*) dan mereset timer jeda kembali ke 30 detik penuh.

### 3.3 Matriks Otorisasi Berdasarkan State Brankas (VBA Matrix)

Tabel berikut mendefinisikan operasi apa saja yang diizinkan untuk dieksekusi berdasarkan kondisi state sistem:

| Kategori Operasi | Deskripsi Operasi Konkret | `UNINITIALIZED` | `LOCKED` | `UNLOCKED` | `COOLDOWN` |
|---|---|:---:|:---:|:---:|:---:|
| **Vault Lifecycle** | Inisialisasi Master Password awal | ✅ ALLOW | ❌ DENY | ❌ DENY | ❌ DENY |
| | Buka Brankas (Unlock via Master Password) | ❌ DENY | ✅ ALLOW | ⚠️ NOOP (Sudah Aktif) | ❌ DENY |
| | Kunci Brankas (Lock / Memory Scrubbing) | ❌ DENY | ⚠️ NOOP | ✅ ALLOW | ❌ DENY |
| | Ubah Master Password | ❌ DENY | ❌ DENY | ✅ ALLOW (Re-auth) | ❌ DENY |
| | Reset Brankas (Wipe All Credentials) | ✅ ALLOW | ✅ ALLOW (Konfirmasi) | ✅ ALLOW (Konfirmasi) | ❌ DENY |
| | Konfigurasi Auto-Lock Timeout | ❌ DENY | ❌ DENY | ✅ ALLOW | ❌ DENY |
| **Account Management** | Lihat Daftar Akun & Cached Credits | ❌ DENY | ✅ ALLOW (Metadata Only)| ✅ ALLOW (Lengkap) | ❌ DENY |
| | Impor Akun Baru via Cookie JSON | ❌ DENY | ❌ DENY | ✅ ALLOW | ❌ DENY |
| | Hapus Akun dari Brankas | ❌ DENY | ❌ DENY | ✅ ALLOW | ❌ DENY |
| | Health Check & Refresh Kredit Akun | ❌ DENY | ❌ DENY | ✅ ALLOW | ❌ DENY |
| | Re-autentikasi Akun via Webview | ❌ DENY | ❌ DENY | ✅ ALLOW | ❌ DENY |
| | Edit Label Akun | ❌ DENY | ❌ DENY | ✅ ALLOW | ❌ DENY |
| **Node Graph Project** | Buka / Simpan File Project (`.flowproj`) | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| | Manipulasi Node Canvas (Add/Move/Connect) | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| | Validasi Berkas Media Lokal (Format/Codec) | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| | Ekstraksi Frame Pertama (FFmpeg lokal) | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| **Pipeline Generation** | Inisiasi Pipeline Generasi Baru | ❌ DENY | ❌ DENY | ✅ ALLOW | ❌ DENY |
| | Segmen Sedang Berjalan (Active Generation) | ❌ N/A | ⚠️ GRACE PERMIT* | ✅ ALLOW | ⚠️ GRACE PERMIT* |
| | Pause / Cancel Pipeline | ❌ DENY | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| | Retry Segmen Gagal | ❌ DENY | ❌ DENY | ✅ ALLOW | ❌ DENY |
| | Override Reference Frame (File Lokal) | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| **Video Concatenation**| Pratinjau Stitching Segmen Selesai | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| | Ekspor Video Final via FFmpeg (Transcode) | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| | Estimasi Ukuran Berkas Ekspor | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| | Batalkan Proses Ekspor | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |

*\*Catatan Khusus GRACE PERMIT:* Apabila brankas beralih menjadi `LOCKED` akibat inaktivitas Owner pada saat pipeline video sedang berjalan di latar belakang, segmen video yang saat itu **sedang aktif memegang handle HTTP session** diizinkan menyelesaikan proses hingga selesai (*grace completion*). Namun, sebelum sistem melangkah ke segmen berikutnya yang membutuhkan dekripsi akun baru atau alokasi akun baru dari pool, pipeline akan otomatis ditangguhkan (*paused*) dengan pesan otorisasi: `"Vault terkunci: masukkan Master Password untuk melanjutkan eksekusi pipeline."`

### 3.4 Aturan Akses Berbasis Kondisi Tambahan (ABAC Guards)

Selain status brankas, otorisasi tertentu bergantung pada kondisi sistem:

1. **Guard `RULE-GUARD-DISKSPACE`:** Operasi generasi video dan ekspor FFmpeg ditolak jika kapasitas sisa penyimpanan lokal (*available disk space*) pada partisi project bernilai kurang dari 500 MB.
2. **Guard `RULE-GUARD-NETWORK`:** Operasi yang memerlukan komunikasi ke Google Flow (import akun, health check, dispatch prompt video) ditolak seketika jika konektivitas jaringan terputus, mengembalikan status `NETWORK_UNREACHABLE` tanpa memicu decrement kuota atau invalidasi kredensial.
3. **Guard `RULE-GUARD-PATH-TRAVERSAL`:** Operasi I/O berkas (save/load project, export video, load image reference) divalidasi secara ketat terhadap *canonical path*. Akses ke folder sensitif sistem operasi (seperti `C:\Windows`, `C:\Program Files`, root direktori tanpa izin) otomatis ditolak.

---

## 4. Aturan Kepemilikan Sumber Daya & Akses Baris Data (*Row-Level Rules*)

### 4.1 Inventaris Sumber Daya Sistem

Seluruh entitas dalam ekosistem Flow Studio diklasifikasikan ke dalam tipe sumber daya berikut:

| Tipe Sumber Daya | Lokasi Penyimpanan | Format Data | Sensitivitas Keamanan |
|---|---|---|---|
| **Master Vault Meta** | SQLite (`vault_meta`) | Salt (16B), Canary Ciphertext (32B), Nonce (12B), Iteration Params | **Kritis (Tingkat 1)** |
| **Account Credentials** | SQLite (`accounts`) | AES-256-GCM Encrypted Blob, Unique Salt, Unique Nonce | **Kritis (Tingkat 1)** |
| **Health Check & Audit Log** | SQLite (`health_check_log`, `audit_log`) | Relational Rows, ISO8601 Timestamps, Error Codes, Status | **Internal (Tingkat 2)** |
| **Project Graph File** | Filesystem Lokal | Dokumen JSON `.flowproj` (Nodes, Edges, Parameters) | **Pribadi (Tingkat 3)** |
| **Media Assets & Temp Files** | Filesystem Lokal | Berkas MP4, WebM, PNG, JPEG (Frames & Segments) | **Pribadi (Tingkat 3)** |
| **Application Settings** | Filesystem Lokal (`settings.json`) | Key-Value JSON (Theme, Auto-lock duration, Default Model) | **Publik/Lokal (Tingkat 4)**|

### 4.2 Kebijakan Kepemilikan Tunggal (*Single-Owner Ownership Policy*)

Prinsip dasar kepemilikan dalam Flow Studio:
- **Hak Cipta & Kontrol Penuh:** Seluruh sumber daya (project file, aset media yang dihasilkan, konfigurasi, riwayat generasi) secara mutlak dan otomatis dimiliki oleh **Owner**.
- **Ketiadaan Konsep Multi-Tenant ID:** Kolom seperti `owner_id`, `organization_id`, atau `tenant_id` sengaja **ditiadakan** dari skema basis data lokal untuk menghindari beban relasional yang semu. Kepemilikan ditegakkan secara fisik oleh izin berkas sistem operasi (*OS filesystem permissions*) pada direktori kerja aplikasi.
- **Pencegahan Akses Tak Terotorisasi Antar Aplikasi:** Database SQLite disimpan di folder aplikasi lokal pengguna (`%APPDATA%\FlowStudio\data.db`). Kunci otorisasi untuk membaca data kredensial tidak pernah ditulis ke disk; kunci tersebut hanya didefinisikan oleh Master Password dalam ingatan Owner.

### 4.3 Aturan Akses Tingkat Baris (*Row-Level Access Rules* pada SQLite)

Meskipun sistem beroperasi secara single-user, aturan akses tingkat baris (*Row-Level Rules*) diterapkan secara logis di lapisan data access layer Rust backend:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA ACCESS LAYER (RUST)                        │
├───────────────────────┬────────────────────────────────────────────────┤
│ Tabel                 │ Aturan Akses Baris (Row-Level Security Logic)  │
├───────────────────────┼────────────────────────────────────────────────┤
│ `vault_meta`          │ Singleton row (`id = 1`). Hanya dapat di-read  │
│                       │ oleh proses vault. Write hanya pada saat init, │
│                       │ change password, atau reset.                   │
├───────────────────────┼────────────────────────────────────────────────┤
│ `accounts`            │ Row dapat dibaca metadata-nya (status, kredit) │
│                       │ saat locked. Kolom `encrypted_cookie` HANYA    │
│                       │ boleh di-query dan didekripsi saat state       │
│                       │ brankas adalah `UNLOCKED`.                     │
├───────────────────────┼────────────────────────────────────────────────┤
│ `health_check_log`    │ Append-only untuk semua akun. Read diizinkan   │
│                       │ untuk visualisasi performa akun di UI.         │
├───────────────────────┼────────────────────────────────────────────────┤
│ `audit_log`           │ Append-only mutlak. Dilarang melakukan update  │
│                       │ atau delete kecuali oleh rotasi log otomatis   │
│                       │ (retensi 90 hari).                             │
└───────────────────────┴────────────────────────────────────────────────┘
```

1. **Isolasi Nilai Kredensial:** Kolom `encrypted_cookie`, `encryption_salt`, dan `encryption_nonce` pada tabel `accounts` tidak boleh disertakan dalam payload IPC umum yang dikirimkan ke frontend WebView2. Frontend hanya berhak menerima `AccountSummary` (UUID, label akun, status, sisa kredit harian/bulanan, dan waktu reset kuota).
2. **Pembersihan Bersih (Clean Eradication):** Ketika sebuah akun dihapus oleh Owner melalui perintah `cmd_account_delete`, baris terkait pada tabel `accounts` dihapus secara permanen (`DELETE FROM accounts WHERE id = ?`), dan baris pada `health_check_log` dihapus melalui aturan `ON DELETE CASCADE`. Backend Rust memastikan tidak ada sisa plaintext cookie akun tersebut di cache memori.

---

## 5. Pemetaan Endpoint & Operasi IPC Tauri (*Endpoint Permission Mapping*)

Setiap interaksi antara antarmuka React 19 dan backend Rust diimplementasikan menggunakan arsitektur *Tauri Command Invoke*. Setiap perintah IPC wajib mematuhi pengecekan otorisasi internal sebelum logika bisnis dijalankan.

### 5.1 Standar Protokol Keamanan Tauri IPC

Sebelum mengeksekusi handler perintah, Rust backend menjalankan verifikasi lapis ganda (*Double-Gate Enforcement*):
1. **Gate 1 — Argument Validation & Sanitization:** Memeriksa tipe data, panjang string, path traversal, dan keabsahan format JSON (mencegah malformed payload atau injection).
2. **Gate 2 — Vault State Authorization Check:** Memastikan *current state* brankas memenuhi kualifikasi izin eksekusi perintah tersebut. Jika tidak terpenuhi, perintah digagalkan seketika dengan pesan kesalahan terstandar `VAULT_LOCKED` atau `VAULT_UNINITIALIZED`.

### 5.2 Matriks Pemetaan Perintah Tauri IPC

| Modul | Nama Perintah Tauri IPC | Parameter Input | State Vault yang Diwajibkan | Otorisasi Khusus & Validasi Input |
|---|---|---|---|---|
| **Vault** | `cmd_vault_status` | `{}` | `ANY` | Mengembalikan status inisialisasi, status penguncian, konfigurasi timeout, dan sisa waktu sebelum auto-lock. |
| **Vault** | `cmd_vault_init` | `{ master_password: String }` | `UNINITIALIZED` | Validasi kekuatan password: minimum 8 karakter, maksimum 128 karakter. Ditolak jika vault sudah terinisialisasi. |
| **Vault** | `cmd_vault_unlock` | `{ master_password: String }` | `LOCKED` | Verifikasi hash Argon2id & validasi decrypt canary tag. Menolak jika dalam kondisi `COOLDOWN`. |
| **Vault** | `cmd_vault_lock` | `{}` | `UNLOCKED` | Memanggil pembersihan memori (*zeroization*), mengubah status menjadi `LOCKED`, memancarkan event `vault:locked`. |
| **Vault** | `cmd_vault_change_password` | `{ old_password: String, new_password: String }` | `UNLOCKED` | Memeriksa password lama, menurunkan master key baru, mendekripsi seluruh akun dengan kunci lama lalu mengenkripsinya kembali dengan kunci baru dalam satu transaksi database SQLite atomik. |
| **Vault** | `cmd_vault_reset` | `{ confirmation_token: String }` | `ANY` (kecuali `COOLDOWN`) | Meminta konfirmasi eksplisit bernilai `"WIPE_ALL_CREDENTIALS"`. Menghapus seluruh record brankas dan mengembalikan status ke `UNINITIALIZED`. |
| **Vault** | `cmd_vault_configure_autolock` | `{ timeout_minutes: u32 }` | `UNLOCKED` | Konfigurasi timeout inaktivitas: minimum 1 menit, maksimum 1440 menit (24 jam). Default: 15 menit. |
| **Account**| `cmd_account_list` | `{}` | `ANY` | Mengembalikan ringkasan akun (metadata dan sisa kredit terakhir). Field kredensial disaring keluar (tidak dikirim ke UI). |
| **Account**| `cmd_account_import` | `{ cookie_json: String, label: Option<String> }` | `UNLOCKED` | Parsing JSON cookie, sanitasi domain (harus memuat domain `.google.com`), uji session request ke Google Flow, enkripsi AES-256-GCM, simpan ke database. |
| **Account**| `cmd_account_delete` | `{ account_id: Uuid }` | `UNLOCKED` | Menghapus record akun dari SQLite. Menghapus instance sesi aktif dari cache router. |
| **Account**| `cmd_account_health_check` | `{ account_id: Uuid }` | `UNLOCKED` | Mendekripsi session cookie akun di RAM, mengirim HTTP GET validasi ke Google Flow, memperbarui status kredit dan health check log. |
| **Account**| `cmd_account_refresh_all` | `{}` | `UNLOCKED` | Mengeksekusi health check terhadap seluruh akun terdaftar secara sequential/batched dengan rate-limiting internal. |
| **Account**| `cmd_account_update_label` | `{ account_id: Uuid, new_label: String }` | `UNLOCKED` | Sanitasi input label (maks 50 karakter, strip HTML/XSS). |
| **Node** | `cmd_project_save` | `{ file_path: String, graph: GraphState }` | `ANY` | Validasi path penyimpanan (ekstensi `.flowproj`), serialisasi JSON, penulisan aman via file temp atomic rename. |
| **Node** | `cmd_project_load` | `{ file_path: String }` | `ANY` | Validasi path berkas, parsing JSON `.flowproj`, deserialisasi skema node graph. |
| **Node** | `cmd_asset_import` | `{ file_path: String, expected_type: String }` | `ANY` | Pemeriksaan format berkas (PNG, JPG, MP4, WebM), verifikasi magic bytes (bukan sekadar ekstensi nama file). |
| **Node** | `cmd_extract_first_frame` | `{ video_path: String }` | `ANY` | Sanitasi path berkas video lokal, eksekusi FFmpeg subprocess untuk mengekstrak 1 frame ke format PNG. |
| **Node** | `cmd_get_available_models` | `{}` | `ANY` | Mengembalikan daftar model Google Flow statis/terkonfigurasi (misal: Veo 3.1). |
| **Pipeline**| `cmd_pipeline_start` | `{ project_id: String, run_config: RunConfig }` | `UNLOCKED` | Memeriksa ketersediaan minimal 1 akun aktif dengan sisa kredit > 0. Menginisiasi sequential worker thread. |
| **Pipeline**| `cmd_pipeline_pause` | `{ pipeline_run_id: String }` | `ANY` | Memberikan sinyal interupsi aman (*graceful pause*) ke worker pipeline. Segmen yang sedang render tetap diselesaikan. |
| **Pipeline**| `cmd_pipeline_resume` | `{ pipeline_run_id: String }` | `UNLOCKED` | Memverifikasi ketersediaan kredensial, melanjutkan antrean segmen berikutnya yang belum selesai. |
| **Pipeline**| `cmd_pipeline_cancel` | `{ pipeline_run_id: String }` | `ANY` | Menghentikan paksa antrean eksekusi dan membatalkan task HTTP/FFmpeg yang sedang berlangsung. |
| **Pipeline**| `cmd_pipeline_status` | `{ pipeline_run_id: String }` | `ANY` | Mengembalikan status progres pipeline, segmen aktif, log riwayat kegagalan segmen. |
| **Pipeline**| `cmd_segment_retry` | `{ pipeline_run_id: String, segment_id: String }` | `UNLOCKED` | Mereset status segmen tertentu menjadi pending dan memicu dispatch ulang ke akun dengan kuota tersedia. |
| **Pipeline**| `cmd_override_reference` | `{ segment_id: String, frame_path: String }` | `ANY` | Mengganti gambar referensi visual segmen dengan gambar custom dari disk lokal. |
| **Pipeline**| `cmd_revert_override` | `{ segment_id: String }` | `ANY` | Menghapus override manual dan mengembalikan referensi ke frame hasil auto-extract continuity engine. |
| **Export** | `cmd_export_concat` | `{ project_id: String, options: ConcatOptions }` | `ANY` | Membaca segmen video pada direktori lokal, menyusun concat manifest, menjalankan FFmpeg process tanpa akses internet. |
| **Export** | `cmd_export_preview` | `{ project_id: String }` | `ANY` | Menghasilkan render preview stitching beresolusi rendah/cepat untuk verifikasi visual Owner di canvas. |
| **Export** | `cmd_export_cancel` | `{ export_job_id: String }` | `ANY` | Mengirim sinyal `SIGKILL` / `TerminateProcess` ke subproses FFmpeg yang sedang berjalan. |

### 5.3 Skema Respons Kesalahan Otorisasi IPC

Ketika sebuah perintah IPC ditolak oleh sistem keamanan, backend Rust mengembalikan struktur kesalahan standar JSON:

```json
{
  "success": false,
  "error": {
    "code": "VAULT_LOCKED",
    "message": "Operasi memerlukan brankas dalam kondisi UNLOCKED. Silakan masukkan Master Password terlebih dahulu.",
    "required_state": "UNLOCKED",
    "current_state": "LOCKED",
    "cooldown_remaining_secs": null,
    "timestamp": "2026-09-24T12:00:00Z"
  }
}
```

Daftar Kode Kesalahan Otorisasi Terstandar:
- `ERR_VAULT_UNINITIALIZED`: Brankas belum diinisialisasi dengan master password.
- `ERR_VAULT_LOCKED`: Operasi ditolak karena brankas terkunci.
- `ERR_VAULT_COOLDOWN_ACTIVE`: Upaya unlock ditolak karena sistem dalam masa tunggu throttle brute-force.
- `ERR_VAULT_INVALID_PASSWORD`: Kata sandi master salah (menambah counter gagal).
- `ERR_PERMISSION_DENIED`: Pelanggaran boundary sistem berkas atau perintah tidak diizinkan.
- `ERR_ACCOUNT_SESSION_EXPIRED`: Kredensial akun Google Flow telah kedaluwarsa atau tidak valid.

---

## 6. Kontrol Hak Istimewa Administratif & Batasan Akses Owner

Dalam sistem yang aman, prinsip *Administrative Privilege Controls* menyatakan bahwa sekalipun seorang aktor bertindak sebagai "Administrator" atau "Owner", kuasanya **wajib memiliki batas eksplisit** untuk mencegah maloperation, eksfiltrasi data, atau eskalasi ancaman (*threat escalation*).

### 6.1 Batasan Hak Istimewa Owner (*The Bounded Owner Principle*)

Meskipun Owner adalah pengelola tunggal aplikasi, sistem menerapkan batasan-batasan teknis berikut secara kaku:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        OWNER PRIVILEGE BOUNDARIES                      │
├───────────────────────────────────┬────────────────────────────────────┤
│ APA YANG DIKUASAI OWNER           │ APA YANG MUTLAK DILARANG / DIBATASI│
├───────────────────────────────────┼────────────────────────────────────┤
│ ✔ Menentukan Master Password      │ ✖ Membaca Master Key di memori RAM │
│ ✔ Mengimpor/menghapus cookie akun │ ✖ Membaca plaintext cookie via UI/ │
│ ✔ Memilih direktori simpan project│   log setelah tersimpan di vault   │
│ ✔ Mengatur durasi auto-lock       │ ✖ Mem-bypass enkripsi AES-256-GCM  │
│ ✔ Menentukan urutan node pipeline │ ✖ Mengeksekusi arbitrary shell CLI │
│ ✔ Menjalankan & membatalkan export│ ✖ Menulis berkas di luar whitelist │
│ ✔ Melakukan reset brankas         │ ✖ Memulihkan brankas tanpa password│
└───────────────────────────────────┴────────────────────────────────────┘
```

1. **Larangan Pembacaan Ulang Plaintext Kredensial:** Setelah Owner mengimpor cookie JSON, sistem mengenkripsi data tersebut dan membersihkan string input mentah dari memori. Antarmuka UI **tidak menyediakan fitur untuk melihat/menyalin kembali** string cookie plaintext ke clipboard. Jika Owner membutuhkan cookie tersebut untuk keperluan lain di luar Flow Studio, Owner harus mengekspornya kembali dari browser asli. Hal ini mencegah malware clipboard stealer membaca kredensial via Flow Studio.
2. **Ketiadaan Fitur Arbitrary Shell Execution:** Backend Rust memanggil subproses FFmpeg secara strictly programmatic menggunakan `std::process::Command` dengan argumen yang di-pass sebagai array string terisolasi (`&[&str]`). Owner atau input node tidak diizinkan memasukkan arbitrary flags atau menyuntikkan karakter shell terminator (seperti `;`, `&&`, `|`, `>` atau backticks).
3. **Sandbox Direktori File Lokal:** Sistem membatasi operasi penulisan file hanya pada:
   - Direktori data aplikasi (`%LOCALAPPDATA%\FlowStudio` atau direktori terisolasi profil Tauri).
   - Direktori kerja project (`.flowproj`) yang secara eksplisit dipilih oleh Owner via sistem dialog native OS (`Tauri File Dialog API`).

### 6.2 Mekanisme Konfirmasi Ulang (*Re-Authentication Prompts*)

Operasi dengan tingkat destruktif tinggi memerlukan konfirmasi eksplisit atau autentikasi ulang (*step-up re-authentication*):

| Operasi Berisiko Tinggi | Mekanisme Pengamanan Otorisasi |
|---|---|
| **Ubah Master Password** | Mewajibkan Owner memasukkan Master Password lama yang benar sebelum password baru dapat diterima dan diderivasi. |
| **Reset Brankas (Pemusnahan Data)** | Menampilkan modal konfirmasi dengan peringatan keras warna merah (High-Risk Confirmation) dan mewajibkan Owner mengetik frasa teks konfirmasi: `"WIPE_ALL_CREDENTIALS"`. |
| **Hapus Akun Google Flow** | Menampilkan dialog konfirmasi spesifik yang memuat nama label akun dan jumlah sisa kredit yang akan hangus dari aplikasi. |

---

## 7. Izin & Batasan Komponen Internal (*Service Permissions*)

### 7.1 Pembatasan Lingkungan WebView2 (Frontend)

Antarmuka frontend yang berjalan di lingkungan Microsoft WebView2 memiliki batasan keamanan:
- **Content Security Policy (CSP) Terkunci:**
  ```text
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: asset: https://*.googleusercontent.com;
  media-src 'self' blob: asset:;
  connect-src 'self' ipc: tauri:;
  object-src 'none';
  base-uri 'self';
  ```
- **Larangan Node.js API di Frontend:** Integrasi langsung Node.js dinonaktifkan (`nodeIntegration = false`, `contextIsolation = true`). Frontend tidak memiliki akses ke fungsi sistem operasi tingkat rendah selain yang disediakan oleh Tauri IPC command yang terdaftar.

### 7.2 Pembatasan Jaringan Keluar (*Outbound Network Allowlist*)

Rust backend dilengkapi dengan firewall domain internal (*Domain Allowlist Guard*) pada modul HTTP client (`reqwest`). Setiap request keluar diperiksa terhadap daftar host resmi:

| Pola Domain Diizinkan | Protokol | Port | Tujuan Fungsional |
|---|---|:---:|---|
| `*.google.com` | HTTPS | 443 | Autentikasi sesi, verifikasi dashboard, dan credit fetching. |
| `*.googleusercontent.com`| HTTPS | 443 | Pengunduhan aset video hasil render dan avatar akun. |
| `accounts.google.com` | HTTPS | 443 | Layanan alur login webview untuk re-autentikasi sesi. |

**Aturan Penolakan Akses Jaringan:**
- Seluruh koneksi HTTP (port 80 plaintext) diblokir mutlak.
- Seluruh koneksi ke alamat IP lokal/loopback (`127.0.0.1`, `localhost`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`) dari modul router **ditolak** untuk mencegah kerentanan *Server-Side Request Forgery* (SSRF).

### 7.3 Isolasi Subproses FFmpeg

Subproses FFmpeg dijalankan dengan hak akses minimal:
- Standalone execution tanpa interaksi terminal shell (`cmd.exe`).
- Jalur pencarian binary diisolasi ke binary yang dibundel di dalam instalasi aplikasi atau path eksplisit yang tervalidasi saat startup.
- `stdout` dan `stderr` dialihkan ke pipa capture internal (*piped stream*) untuk pemantauan progres translasi dan parsing error tanpa menulis berkas log sementara ke disk yang tidak terenkripsi.

---

## 8. Siklus Hidup Sesi & Kredensial (*Session & Token Lifecycle*)

### 8.1 Siklus Hidup Master Password & In-Memory Key

Siklus hidup kredensial utama aplikasi diatur oleh proses kriptografis:

```
[Owner Input Master Password]
             │
             ▼
[Argon2id Key Derivation] (Salt 16B, m=64MB, t=3, p=1)
             │
             ▼
[Derived Master Key (256-bit)] ──► [Disimpan di Memory-Locked Buffer]
             │                                   │
             ├───────────────────────────────────┤
             ▼                                   ▼
[Verifikasi Canary Token]               [Akses Brankas Aktif]
  - Jika Sukses ──► State = UNLOCKED      - Dekripsi Cookie saat Request
  - Jika Gagal  ──► Increment Counter     - Enkripsi Akun Baru
                    Scrub Key Buffer             │
                                                 │
      ┌──────────────────────────────────────────┘
      │
      ▼
[Pemicu Penguncian: Timeout Inaktivitas 15 Min / Tombol Lock]
      │
      ▼
[Memory Zeroization: zeroize::ZeroizeOnDrop]
      │
      ▼
[Master Key Terhapus dari RAM] ──► State = LOCKED
```

#### A. Inisialisasi Pertama Kali (*First Launch Setup*)
1. Saat aplikasi dijalankan pertama kali, sistem mendeteksi ketiadaan baris konfigurasi pada tabel `vault_meta`.
2. Owner diminta memasukkan Master Password baru.
3. Rust backend menghasilkan **Master Salt** acak berukuran 16 byte menggunakan generator nomor acak kriptografis OS (*Cryptographically Secure Pseudo-Random Number Generator* / CSPRNG via `ring::rand::SystemRandom` atau `rand::rngs::OsRng`).
4. Kunci diturunkan menggunakan algoritma **Argon2id** dengan parameter aman:
   - **Tipe KDF:** Argon2id (RFC 9106 rekomendasi resisten serangan GPU dan side-channel).
   - **Memory Cost (`m_cost`):** 65536 KiB (64 MiB RAM).
   - **Time Cost (`t_cost` / Iterations):** 3 iterasi.
   - **Parallelism (`p_cost`):** 1 thread.
   - **Output Length:** 32 byte (256 bit Master Encryption Key).
5. Sistem membuat **Canary Token Verifier**:
   - Teks acak deterministik: `"FLOW_STUDIO_VAULT_CANARY_V1"`.
   - Menghasilkan Nonce acak 12 byte.
   - Mengenkripsi teks acak dengan Master Key menggunakan **AES-256-GCM**.
   - Menyimpan `salt`, `canary_ciphertext`, `canary_nonce`, dan parameter KDF ke tabel `vault_meta`.
6. State brankas berubah menjadi `UNLOCKED`.

#### B. Prosedur Pembukaan Brankas (*Unlock Procedure*)
1. Owner menginput Master Password pada dialog unlock UI.
2. Rust backend membaca `salt` dan parameter Argon2id dari database `vault_meta`.
3. Kunci kandidat (256-bit) diturunkan melalui perhitungan Argon2id.
4. Kunci kandidat digunakan untuk mendekripsi `canary_ciphertext` menggunakan AES-256-GCM:
   - **Jika Dekripsi Berhasil & Plaintext Cocok:** Kunci terverifikasi sah. Kunci kandidat disimpan dalam wrapper memori aman (*secure wrapper* yang mengimplementasikan trait `ZeroizeOnDrop`). Counter kegagalan login di-reset menjadi 0. State brankas bertransisi menjadi `UNLOCKED`. Timer inaktivitas diinisialisasi.
   - **Jika Dekripsi Gagal (*Authentication Tag Mismatch*):** Kunci kandidat langsung dibersihkan dari RAM (*zeroized*). Counter kegagalan login bertambah (+1). Jika counter mencapai 3, sistem memasuki state `COOLDOWN` (30 detik).

#### C. Penguncian & Pembersihan Memori (*Zeroization*)
Saat brankas beralih ke state `LOCKED` (baik karena manual lock, auto-lock timeout, atau penutupan aplikasi):
1. Instance Master Key di Rust backend didrop dari memori. Trait `Zeroize` dan `ZeroizeOnDrop` memastikan seluruh byte array 256-bit ditimpa dengan nilai nol (`0x00`) sebelum memori dikembalikan ke sistem operasi.
2. Cache session cookie terdekripsi yang tersisa di memory pool segera dihapus dan di-zeroize.
3. Event Tauri `vault:locked` dipancarkan ke frontend untuk segera mereset tampilan UI ke status terkunci.

### 8.2 Kebijakan Auto-Lock & Manajemen Inaktivitas

Sistem dilengkapi modul pengawas inaktivitas (*Inactivity Watchdog*):

| Parameter | Pengaturan Default | Opsi Pengaturan |
|---|---|---|
| **Default Timeout** | **15 Menit** | 5 menit, 15 menit, 30 menit, 60 menit, atau Nonaktif (Tidak Disarankan) |
| **Pemicu Reset Timer** | Interaksi Input Pengguna | Setiap panggilan perintah IPC yang dipicu oleh aktivitas mouse/keyboard Owner pada UI mereset timer inaktivitas kembali ke durasi penuh (*sliding expiration*). |
| **Mekanisme Heartbeat** | UI Heartbeat Event | Frontend React mengirimkan sinyal heartbeat ringan (`cmd_activity_ping`) setiap 60 detik selama ada aktivitas interaksi di canvas atau window. |
| **Kondisi Khusus: Background Pipeline** | Pengecualian Task Aktif | Jika waktu inaktivitas 15 menit habis saat pipeline sedang merender segmen video di Google Flow:
1. Status brankas **tetap beralih** ke `LOCKED` di level UI.
2. Segmen video yang sedang diproses oleh worker saat itu diizinkan menyelesaikan penerimaan hasil (*in-flight request grace period*).
3. Ketika worker hendak melangkah ke segmen berikutnya, worker mendeteksi brankas `LOCKED`, menunda eksekusi (*paused*), dan memancarkan notifikasi: *"Pipeline ditunda: brankas terkunci karena inaktivitas. Silakan buka kembali brankas untuk melanjutkan generasi."* |

### 8.3 Siklus Hidup Kredensial Akun Google Flow

Setiap akun Google Flow yang dikelola oleh aplikasi tunduk pada siklus hidup kredensial berikut:

```
[Ekspor Cookie dari Browser]
             │
             ▼
[Import ke Flow Studio via UI] ──► [Format & Domain Validation]
             │                                   │
             ▼ Valid                             ▼ Invalid
[Uji Request ke Google Flow] ──────────► [Tolak & Hapus Input]
             │
             ├───────────────────────────────────┐
             ▼ Sukses (HTTP 200)                 ▼ Gagal (HTTP 401/403)
[AES-256-GCM Encrypt with Master Key]   [Tampilkan: "Session Expired"]
             │
             ▼
[Simpan Ciphertext ke SQLite `accounts`]
             │
             ▼
[State Akun: ACTIVE] ◄───────────────────────────────────┐
             │                                           │
             ├───────────────────┬───────────────────┐   │
             ▼ Kuota Habis       ▼ Session Invalid   ▼   │
       [State: EXHAUSTED]  [State: EXPIRED]      [State: ERROR]
             │                   │
             ▼ Rotasi Otomatis   ▼ Re-autentikasi Webview
      [Pindah ke Akun Lain] [Login Ulang di Webview]
                                 │
                                 └─ Ekstrak Cookie Baru ─┘
```

#### A. Ingesti & Enkripsi Data Sesi
1. Owner mem-paste data cookie dalam format JSON (format standar Cookie-Editor / EditThisCookie) atau Netscape format ke dialog aplikasi.
2. Parser backend mengekstrak cookie esensial yang diperlukan untuk autentikasi Google Flow (antara lain: `SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, `__Secure-*`).
3. Sistem mengirimkan permintaan HTTP GET validasi ke endpoint dashboard Google Flow menggunakan cookie kandidat.
4. Jika server mengembalikan respons HTTP 200 beserta informasi profil pengguna:
   - Sistem membangkitkan **Salt Unik Per-Akun** (16 byte) dan **Nonce Unik AES-GCM** (12 byte).
   - Derivasi sub-kunci kredensial spesifik akun dilakukan untuk mencegah ketergantungan enkripsi langsung satu kunci pada banyak ciphertext.
   - Cookie JSON dienkripsi menggunakan **AES-256-GCM** dengan *authentication tag* 16 byte.
   - Ciphertext, salt, dan nonce disimpan ke tabel `accounts`. Input mentah string cookie di-zeroize dari memori.

#### B. Penggunaan Kredensial Saat Runtime (*Ephemeral In-Memory Decryption*)
1. Ketika Pipeline Engine atau Health Check membutuhkan akses ke akun tertentu:
   - Backend memeriksa apakah brankas berstatus `UNLOCKED`.
   - Mengambil baris record dari tabel `accounts`.
   - Mendekripsi payload cookie ke dalam struktur memory `reqwest::cookie::Jar`.
   - Menjalankan HTTP request terotentikasi ke Google Flow backend melalui TLS 1.3 terenkripsi.
   - Segera setelah request selesai dan respons diterima, referensi cookie tidak disimpan di memori permanen, melainkan dibiarkan dibersihkan oleh garbage collector internal Rust / RAII scope drop.

#### C. Status Siklus Hidup Akun (*Account State Lifecycle*)
Tiap akun memiliki indikator status yang diperbarui melalui health check berkala (setiap 30 menit atau saat startup):
- **`ACTIVE`:** Sesi valid dan memiliki sisa kredit generasi harian (> 0) atau bulanan (> 0).
- **`EXHAUSTED`:** Sesi masih valid, namun kredit harian (50 kredit free) dan kredit bulanan telah mencapai 0. Akun tidak akan dipilih oleh router generasi hingga waktu reset kuota berikutnya tercapai.
- **`EXPIRED`:** Server Google Flow merespons dengan HTTP 401 Unauthorized atau 403 Forbidden. Sesi telah kedaluwarsa atau di-revoke oleh Google. Sistem menampilkan opsi re-autentikasi.
- **`ERROR`:** Terjadi kesalahan konektivitas jaringan, timeout, atau format respons tidak dikenal dari Google.

#### D. Alur Re-Autentikasi Sesi Kedaluwarsa
Untuk memulihkan akun berstatus `EXPIRED`:
1. Owner memilih opsi *"Re-authenticate"* pada akun yang bermasalah.
2. Flow Studio membuka jendela embedded WebView2 terisolasi yang mengarah ke halaman login Google Flow (`https://accounts.google.com`).
3. Owner melakukan login secara manual (termasuk verifikasi 2FA jika diaktifkan di akun Google terkait).
4. Setelah login berhasil dan WebView2 diarahkan kembali ke domain Google Flow, backend Tauri mengekstrak session cookies baru dari instance WebView2 tersebut secara otomatis.
5. Sesi dienkripsi ulang dengan Master Key dan disimpan ke baris akun di database, mengembalikan statusnya menjadi `ACTIVE`. Instance WebView2 ditutup dan cache webview dibersihkan.

---

## 9. Kebijakan Lockout, Pemulihan, Invitasi & Pencabutan

### 9.1 Kebijakan Invitasi Pengguna (*Invitations*)
- **Eksplisit Dinyatakan Tidak Berlaku (*Not Applicable*):** Flow Studio adalah aplikasi workstation desktop lokal untuk satu pengguna mandiri. Sistem tidak memiliki fitur registrasi online, undangan tim (*user invitations*), pembagian workspace via email, atau multi-tenant account pairing.

### 9.2 Kebijakan Anti-Brute-Force & Lockout

Untuk melindungi brankas dari serangan pencurian file database lokal (`data.db`) yang dicoba di-crack secara lokal atau melalui UI:

```
Percobaan 1 Gagal ──► Counter = 1 (Pesan: "Password salah")
Percobaan 2 Gagal ──► Counter = 2 (Pesan: "Password salah, 1 kesempatan tersisa")
Percobaan 3 Gagal ──► Counter = 3 ──► Masuk State COOLDOWN (30 Detik)
                                           │
                                           ▼
                               UI Disabled + Timer Countdown
                                           │
                                           ▼ Cooldown Selesai
Percobaan 4 Gagal ──► COOLDOWN Bertingkat (60 Detik)
Percobaan 5 Gagal ──► COOLDOWN Bertingkat (120 Detik)
Percobaan 6+ Gagal ──► COOLDOWN Maksimum (300 Detik / 5 Menit per upaya)
```

1. **Jeda Cooldown Bertingkat (*Exponential Step Backoff*):**
   - 1–2 kali gagal berturut-turut: Pengguna diizinkan mencoba kembali tanpa jeda waktu.
   - 3 kali gagal: Sistem membekukan input unlock selama **30 detik**.
   - 4 kali gagal: Cooldown dinaikkan menjadi **60 detik**.
   - 5 kali gagal: Cooldown dinaikkan menjadi **120 detik**.
   - ≥ 6 kali gagal: Cooldown maksimum **300 detik (5 menit)** untuk setiap percobaan berikutnya.
2. **Pencegahan Penguncian Permanen Mesin (*No Permanent Bricking*):** Sistem **tidak melakukan penghapusan otomatis data secara permanen** setelah N kegagalan. Karena aplikasi berjalan di perangkat pribadi, penghapusan permanen tanpa instruksi eksplisit berisiko tinggi menyebabkan *Data Loss* yang tidak dapat diperbaiki bagi pengguna yang sah jika terjadi kesalahan ketik atau keyboard layout bermasalah. Pertahanan kriptografis utama diserahkan pada algoritma Argon2id (kebutuhan 64 MB memori per derivasi membuat brute-force offline skala jutaan percobaan per detik menjadi tidak fisibel secara ekonomis).

### 9.3 Kebijakan Pemulihan Kata Sandi (*Zero-Knowledge Recovery*)

Flow Studio memegang prinsip arsitektur **Zero-Knowledge Encryption**:

1. **Ketiadaan Backdoor atau Master Key Cadangan:** Pengembang Flow Studio tidak menyimpan salinan kunci, tidak memiliki server pusat penyimpanan kredensial, dan tidak menyediakan mekanisme pemulihan kata sandi via email, nomor telepon, atau pertanyaan keamanan (*security questions*).
2. **Skenario Lupa Master Password:** Jika Owner lupa Master Password:
   - Kredensial yang tersimpan di brankas **secara matematis tidak dapat didekripsi**.
   - Tidak ada prosedur *password recovery*.
   - Satu-satunya solusi pemulihan operasional aplikasi adalah melakukan **Vault Factory Reset**.
3. **Prosedur Vault Factory Reset:**
   - Owner memicu perintah `cmd_vault_reset` dari layar login/unlock.
   - Owner wajib mengonfirmasi konsekuensi penghapusan dengan mengetikkan frasa verifikasi.
   - Sistem mengeksekusi operasi sanitasi:
     - Mengosongkan tabel `accounts` (`DELETE FROM accounts`).
     - Mengosongkan tabel `vault_meta` (`DELETE FROM vault_meta`).
     - Membersihkan seluruh log riwayat health check.
     - Mengembalikan state brankas ke `UNINITIALIZED`.
   - **Status Berkas Project:** File graph project (`.flowproj`) dan file video yang telah diekspor di disk lokal **tidak dihapus** karena tidak memuat plaintext credentials. Owner dapat membuat Master Password baru, mengimpor kembali cookie akun Google Flow dari browser, dan langsung melanjutkan pengerjaan project yang sudah ada.

### 9.4 Pencabutan Kredensial Eksternal (*External Credential Revocation*)
Apabila Owner mencurigai bahwa salah satu akun Google Flow telah disusupi atau ingin mencabut hak akses Flow Studio terhadap akun tertentu:
1. **Pencabutan Lokal:** Owner menghapus akun melalui tombol *Delete* di antarmuka akun (`cmd_account_delete`). Sistem menghapus baris database seketika dan meng-overwrite slot memori.
2. **Pencabutan Sisi Google (Remote Revocation):** Owner melakukan sign-out dari perangkat atau mengganti password akun Google di browser resmi. Token sesi yang tersimpan di Flow Studio otomatis menjadi tidak valid (akan terdeteksi status `EXPIRED` pada health check berikutnya).

---

## 10. Persyaratan Log Audit Keamanan (*Security Audit Requirements*)

Untuk memantau aktivitas penting, mendiagnosis kegagalan otentikasi, dan mendeteksi anomali pada lingkungan lokal tanpa mengorbankan privasi pengguna, sistem wajib mengimplementasikan logging audit terstruktur.

### 10.1 Format & Lokasi Penyimpanan Log Audit

Log audit keamanan disimpan di dalam database SQLite lokal pada tabel khusus `security_audit_log`:

```sql
CREATE TABLE IF NOT EXISTS security_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,          -- UUID v4
    timestamp_utc TEXT NOT NULL,            -- ISO 8601 UTC
    event_type TEXT NOT NULL,               -- Kategori event terstandar
    severity TEXT NOT NULL,                 -- INFO, WARN, SECURITY_ALERT
    actor TEXT NOT NULL DEFAULT 'OWNER',    -- OWNER, SYSTEM, WATCHDOG
    vault_state TEXT NOT NULL,              -- UNINITIALIZED, LOCKED, UNLOCKED, COOLDOWN
    target_resource TEXT,                   -- Identifier akun/project terkait (opsional)
    status TEXT NOT NULL,                   -- SUCCESS, FAILED, BLOCKED
    details_json TEXT NOT NULL              -- Metadata non-sensitif terstruktur
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON security_audit_log(timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON security_audit_log(event_type);
```

### 10.2 Taksonomi & Daftar Event Audit

Seluruh kejadian keamanan berikut wajib dicatat ke dalam log audit:

| Event Type Code | Kategori Keparahan | Pemicu Kejadian | Data Tambahan dalam `details_json` |
|---|---|---|---|
| `VAULT_INITIALIZED` | `INFO` | Master Password pertama kali dikonfigurasi. | `{ "kdf": "Argon2id", "m_cost_kib": 65536, "t_cost": 3 }` |
| `VAULT_UNLOCK_SUCCESS` | `INFO` | Master Password berhasil diverifikasi. | `{ "failed_attempts_reset": 0 }` |
| `VAULT_UNLOCK_FAILED` | `WARN` | Percobaan Master Password salah. | `{ "failed_attempts_count": 2, "source": "IPC_INVOKE" }` |
| `VAULT_COOLDOWN_TRIGGERED`| `SECURITY_ALERT`| Batas salah 3x tercapai, cooldown aktif. | `{ "cooldown_duration_secs": 30 }` |
| `VAULT_MANUAL_LOCK` | `INFO` | Owner mengklik tombol penguncian manual. | `{ "reason": "USER_ACTION" }` |
| `VAULT_AUTO_LOCKED` | `INFO` | Watchdog mengunci brankas karena inaktivitas. | `{ "inactivity_minutes": 15 }` |
| `VAULT_PASSWORD_CHANGED` | `INFO` | Master Password berhasil diperbarui. | `{ "accounts_reencrypted_count": 5 }` |
| `VAULT_FACTORY_RESET` | `SECURITY_ALERT`| Seluruh isi brankas dimusnahkan. | `{ "action": "WIPE_ALL", "accounts_purged": 3 }` |
| `ACCOUNT_IMPORTED` | `INFO` | Akun Google Flow baru ditambahkan. | `{ "account_id": "...", "label": "Account #1", "status": "ACTIVE" }` |
| `ACCOUNT_DELETED` | `INFO` | Akun dihapus dari brankas. | `{ "account_id": "...", "label": "Account #1" }` |
| `ACCOUNT_HEALTH_CHANGED`| `WARN` | Status akun berubah (aktif ke expired/error).| `{ "account_id": "...", "old_status": "ACTIVE", "new_status": "EXPIRED", "http_code": 401 }` |
| `ACCOUNT_ROTATED` | `INFO` | Pipeline merotasi akun karena kredit habis. | `{ "from_account": "...", "to_account": "...", "reason": "CREDIT_DEPLETED" }` |
| `IPC_PERMISSION_DENIED` | `WARN` | Perintah IPC ditolak karena brankas terkunci.| `{ "command": "cmd_pipeline_start", "required_state": "UNLOCKED", "current_state": "LOCKED" }` |
| `PATH_TRAVERSAL_BLOCKED`| `SECURITY_ALERT`| Upaya akses berkas di luar whitelist path. | `{ "requested_path": "...", "sanitized_target": null }` |

### 10.3 Larangan Mutlak Data Sensitif dalam Log (*Zero-PII & Zero-Credential Rule*)

Sistem audit **wajib mematuhi aturan sanitasi ketat**:
1. **Dilarang Keras:** Menuliskan Master Password (baik plaintext maupun hash), plaintext session cookies, header `Cookie` mentah, token otorisasi Bearer, email pribadi lengkap milik Owner, atau encryption key di baris log audit manapun.
2. **Masking Identifier Akun:** Jika identifier profil Google terekam, hanya tampilkan bentuk terpotong (misal: `user_id: "1098***342"` atau label akun `Account #1`).
3. **Penyaringan Crash Dump:** Konfigurasi penanganan panic di Rust (`std::panic::set_hook`) dikonfigurasi untuk menyaring dan membersihkan isi buffer memori brankas agar tidak terbawa ke file crash dump Windows.

### 10.4 Retensi & Integritas Log
- **Retensi Bergulir (90 Hari):** Record audit log yang berumur lebih dari 90 hari akan dibersihkan secara otomatis saat aplikasi startup melalui query: `DELETE FROM security_audit_log WHERE timestamp_utc < datetime('now', '-90 days')`.
- **Append-Only Principle:** Tidak ada fungsi IPC yang mengekspos modifikasi (`UPDATE`) terhadap entri log yang sudah tertulis.

---

## 11. Tinjauan Hak Istimewa Minimum (*Least Privilege Review*)

Tinjauan ini mengevaluasi kepatuhan arsitektur Flow Studio terhadap prinsip *Principle of Least Privilege* (PoLP) di setiap lapisan teknis:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LEAST PRIVILEGE AUDIT LAYERS                    │
├───────────────────┬────────────────────────────────────────────────────┤
│ LAPISAN           │ KONTROL MINIMALISASI HAK AKSES                     │
├───────────────────┼────────────────────────────────────────────────────┤
│ OS Execution      │ Berjalan pada standard user privileges (No Admin)  │
│ IPC Channel       │ Schema tervalidasi, typed Tauri Specta commands    │
│ Filesystem        │ Sandboxed ke AppData dan direktori project user    │
│ Cryptographic Key │ Hanya ada di RAM terlindungi; zeroize saat lock    │
│ Subproses FFmpeg  │ Programmatic array args, no shell, no network      │
│ Database SQLite   │ Enkripsi tingkat baris untuk field kredensial      │
│ Network Egress    │ Terbatas pada domain *.google.com via HTTPS port 443│
└───────────────────┴────────────────────────────────────────────────────┘
```

### 11.1 Matriks Evaluasi PoLP Lintas Subsistem

| Lapisan Sistem | Hak Istimewa Maksimum yang Diperlukan | Pembatasan / Mitigasi yang Diterapkan |
|---|---|---|
| **OS User Account** | Hak pengguna standar Windows (*Standard User Privilege*). | **Tidak memerlukan Run as Administrator.** Flow Studio tidak membutuhkan modifikasi registry sistem atau instalasi device driver level kernel. |
| **WebView2 Renderer** | Render DOM HTML, eksekusi skrip React, dispatch event IPC. | **Tanpa Node.js runtime.** Tidak memiliki akses filesystem langsung. Terkungkung dalam sandbox proses browser Chromium WebView2. |
| **Tauri Core Process** | Supervisor proses, I/O database lokal, dispatch network HTTP. | **Type-Safe Command Binding.** Setiap parameter input dari frontend divalidasi dengan deserializer `serde` yang ketat. Nilai yang tidak sesuai skema ditolak pada pintu gerbang IPC. |
| **FFmpeg Subprocess** | Ekstraksi frame gambar dan penggabungan video lokal. | **Networkless Subprocess.** Subproses dijalankan tanpa izin akses soket jaringan. Path input dan output dipetakan secara absolut tanpa melibatkan interpreter shell sistem. |
| **Kredensial Sesi** | Pengiriman HTTP header `Cookie` ke Google Flow backend. | **Efemeral di Memori.** Plaintext cookie tidak disimpan di global variable permanen; cookie didekripsi hanya sesaat sebelum koneksi HTTPS dibangun dan dilepas setelah stream payload selesai. |

### 11.2 Analisis Ancaman Memori & Dump RAM

Untuk mengantisipasi ancaman perangkat lunak jahat pada host yang mencoba membaca memori proses (*process scraping*):
- Kunci utama (Master Key) dibungkus menggunakan tipe data `zeroize::Zeroizing<[u8; 32]>`.
- Pada platform Windows, implementasi masa depan memanfaatkan API penguncian memori `VirtualLock` guna mencegah OS memindahkan halaman RAM yang memuat kunci enkripsi ke berkas swap/pagefile (`pagefile.sys`) di disk.
- Ketika brankas berstatus `LOCKED`, seluruh kunci telah menjadi nol di RAM, sehingga memori dump dari proses Flow Studio hanya akan menghasilkan data acak tanpa kunci dekripsi.

---

## 12. Matriks Keterlacakan Persyaratan (*Requirements Traceability Matrix*)

Tabel berikut menunjukkan keselarasan dokumen spesifikasi otorisasi ini terhadap *Functional Requirements* (FR) dan *Non-Functional Requirements* (NFR) dari dokumen induk `SRS.md` serta kontrak arsitektur `PLANNING_v5.2.md`:

| Requirement ID | Deskripsi Persyaratan | Pemenuhan dalam `PERMISSION.md` | Status Verifikasi |
|---|---|---|:---:|
| **FR-040** | Master password untuk akses credential vault; tidak ada password recovery; reset jika lupa; lockout cooldown 30 detik setelah 3x gagal. | Didefinisikan secara lengkap pada **§3.2** (State Machine), **§8.1** (KDF Argon2id), **§9.2** (Anti-Brute Force Cooldown), dan **§9.3** (Zero-Knowledge Recovery). | ✅ COMPLETE |
| **FR-041** | Enkripsi kredensial (cookie, session token) menggunakan AES-256-GCM; key derivasi Argon2id (m: 64MB, t: 3, p: 1); unique salt per entry. | Didefinisikan pada **§8.1.A** (Parameter KDF), **§8.3.A** (AES-256-GCM Unique Salt & Nonce per Akun), dan **§4.3** (Isolasi Kolom SQLite). | ✅ COMPLETE |
| **FR-042** | Auto-lock vault setelah periode inaktivitas configurable (default 15 menit); in-memory key scrubbing (`zeroize`); background pipeline tidak terinterupsi jika sedang memproses task aktif. | Didefinisikan pada **§3.3** (Matriks Otorisasi State), **§8.1.C** (Pembersihan Memori), dan **§8.2** (Manajemen Inaktivitas & Grace Exception). | ✅ COMPLETE |
| **FR-001** | Penambahan akun Google Flow via import cookie JSON; validasi sesi dan simpan terenkripsi ke vault. | Didefinisikan pada **§5.2** (`cmd_account_import`) dan **§8.3.A** (Alur Ingesti Kredensial). | ✅ COMPLETE |
| **FR-002** | Penghapusan akun Google Flow dari vault secara permanen dan konfirmasi dialog. | Didefinisikan pada **§4.3** (Row Deletion Cascade) dan **§6.2** (Re-Authentication & Confirmation Prompts). | ✅ COMPLETE |
| **FR-003** | Menampilkan sisa kredit per akun (data cached) saat locked maupun unlocked. | Didefinisikan pada **§3.3** (VBA Matrix) dan **§5.2** (`cmd_account_list` metadata only). | ✅ COMPLETE |
| **FR-004** | Rotasi otomatis antar akun saat kredit habis. | Didefinisikan pada **§8.3.C** (Status Lifecycle Akun) dan **§10.2** (Audit Log `ACCOUNT_ROTATED`). | ✅ COMPLETE |
| **FR-005** | Health check status sesi akun (startup, pre-pipeline, on-demand). | Didefinisikan pada **§5.2** (`cmd_account_health_check`) dan **§8.3.C** (Status Lifecycle). | ✅ COMPLETE |
| **FR-006** | Embedded webview untuk re-autentikasi sesi yang expired. | Didefinisikan pada **§8.3.D** (Alur Re-Autentikasi Sesi via Webview). | ✅ COMPLETE |
| **NFR-001** | Keamanan penyimpanan kredensial & zero plaintext in logs. | Didefinisikan pada **§10.3** (Strict Zero-PII & Zero-Credential Logging Rule). | ✅ COMPLETE |
| **NFR-003** | Reliabilitas data store & integritas SQLite. | Didefinisikan pada **§4.3** (Row-Level Security) dan **§5.2** (Atomic Transaction Re-encryption). | ✅ COMPLETE |
| **NFR-004** | Performa dekripsi & latensi rendah. | Penggunaan Argon2id hanya saat unlock/init; AES-256-GCM terakselerasi hardware (AES-NI) untuk operasi per request (< 5 ms). | ✅ COMPLETE |
| **NFR-006** | Kemudahan pemeliharaan & modularitas arsitektur. | Pemisahan tegas antara supervisor Rust, webview frontend, dan cryptographic enclave. | ✅ COMPLETE |
| **NFR-007** | Kompatibilitas Windows 10/11 x64 dan WebView2 runtime. | Didefinisikan pada batasan trust boundary **§2.1** dan **§7.1**. | ✅ COMPLETE |

---

## 13. Daftar Istilah (*Glossary*)

| Istilah | Definisi Teknis |
|---|---|
| **Argon2id** | Algoritma *Key Derivation Function* (KDF) modern pemenang *Password Hashing Competition*, mengombinasikan ketahanan terhadap serangan GPU (*Argon2d*) dan serangan *side-channel cache-timing* (*Argon2i*). |
| **AES-256-GCM** | *Advanced Encryption Standard* dengan panjang kunci 256-bit dalam mode *Galois/Counter Mode*, menyediakan enkripsi data sekaligus verifikasi integritas (*Authenticated Encryption with Associated Data* / AEAD). |
| **Canary Token Verifier** | Blok ciphertext khusus yang digunakan untuk memverifikasi kebenaran kunci yang didekripsi tanpa perlu menyimpan plaintext kata sandi di penyimpanan persistent. |
| **CSPRNG** | *Cryptographically Secure Pseudo-Random Number Generator* — pembangkit nomor acak tingkat sistem operasi yang tidak dapat diprediksi secara matematis. |
| **Graceful Pipeline Interruption** | Mekanisme penundaan eksekusi antrean pipeline yang mengizinkan proses jaringan yang sedang aktif menyelesaikan tugasnya sebelum sistem masuk ke mode jeda (*paused*). |
| **In-Memory Zeroization** | Praktik keamanan memprogram untuk menimpa area RAM yang pernah memuat data sensitif dengan byte nol sebelum alokasi memori tersebut dilepaskan (*dropped*). |
| **Sliding Expiration** | Kebijakan penghitungan batas waktu inaktivitas di mana waktu hitung mundur diperbarui kembali ke nilai awal setiap kali aktivitas pengguna terdeteksi. |
| **Tauri IPC** | Mekanisme *Inter-Process Communication* berbasis pesan asinkron antara antarmuka web (WebView2) dan proses sistem Rust. |
| **Vault Factory Reset** | Prosedur penghapusan darurat yang memusnahkan seluruh kredensial terenkripsi untuk mengembalikan aplikasi ke kondisi awal saat kata sandi master terlupakan. |
| **VBA (Vault-Based Authorization)** | Model otorisasi yang menentukan hak akses fitur sistem berdasarkan kondisi brankas kriptografis lokal, bukan berdasarkan tingkatan peran pengguna multi-tenant. |
