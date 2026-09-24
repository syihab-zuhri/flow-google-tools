# SECURITY.md: Flow Studio — Security Architecture, Threat Model & Anti-Abuse Specification

> **Project:** Flow Studio  
> **Document ID:** DOC-SEC-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-ARCH-001, DOC-ERD-001, DOC-PERM-001  
> **Supersedes:** None  

---

## 1. Pendahuluan, Prinsip Keamanan & Ringkasan Eksekutif

Dokumen ini mendefinisikan arsitektur keamanan, model ancaman (*threat model*), kontrol kriptografi, mitigasi penyalahgunaan (*anti-abuse*), pemetaan kepatuhan privasi, serta evaluasi komprehensif OWASP Top 10:2021 untuk **Flow Studio**.

Flow Studio adalah aplikasi desktop personal (*single-user creative workstation*) yang dibangun di atas kerangka kerja **Tauri 2.x** (backend sistem Rust) dan antarmuka web modern (React 19, `@xyflow/react`). Aplikasi ini dirancang untuk mengorkestrasi pembuatan video koheren berdurasi panjang melalui automasi reverse-engineered upstream backend Google Flow.

### 1.1 Klasifikasi Tingkat Keamanan (High Security Tier)
Flow Studio diklasifikasikan ke dalam **High Security Tier** karena menyimpan, mengelola, dan mendekripsi kredensial otentikasi akun Google pihak ketiga (*session cookies*, *authorization bearer tokens*). Kehilangan atau kompromi terhadap data ini dapat mengakibatkan pengambilalihan akun Google milik Owner (*account takeover*), kebocoran data privasi pribadi, atau penyalahgunaan kuota kredit video berbayar.

### 1.2 Prinsip Dasar Keamanan Sistem
1. **Local-First & Zero-Cloud Leakage:** Seluruh data operasional, kredensial terenkripsi, file proyek, dan log keamanan disimpan secara lokal di mesin pengguna (`%APPDATA%/FlowStudio/flow_studio.db` pada Windows 10/11 x64). Tidak ada telemetri, analitik, atau kredensial yang dikirimkan ke server perantara pihak ketiga milik pengembang Flow Studio.
2. **Cryptographic Access Control:** Otorisasi akses ke data sensitif tidak bergantung pada proteksi level aplikasi berbasis bendera logika (*boolean flag*), melainkan ditegakkan secara mutlak oleh enkripsi simetris AES-256-GCM yang kuncinya diturunkan dari *Master Password* menggunakan algoritma Argon2id.
3. **In-Memory Zeroization:** Kunci master 256-bit dan plaintext cookie hanya berada di RAM saat brankas (*credential vault*) berstatus `UNLOCKED`. Saat terjadi penguncian otomatis (inaktivitas 15 menit), penguncian manual, atau terminasi aplikasi, seluruh buffer sensitif dibersihkan seketika menggunakan crate `zeroize`.
4. **Defense-in-Depth & Process Isolation:** Pemisahan ketat antara antarmuka WebView2 (untrusted context), backend supervisor Rust (trusted context), dan subproses FFmpeg sidecar (confined filesystem-only execution).
5. **No 100% Security Illusion:** Dokumen ini mengakui batasan lingkungan desktop lokal. Malware berprivilese kernel atau *physical host compromise* berada di luar kendali software aplikasi, sehingga mitigasi difokuskan pada perlindungan data at-rest, proteksi memori saat runtime, dan auditabilitas anomali.

> ⚖️ **Pernyataan Penafian Hukum (Legal Disclaimer):**  
> Konten dalam dokumen ini mencakup pemetaan kepatuhan terhadap regulasi pelindungan data pribadi (termasuk UU PDP No. 27 Tahun 2022 Republik Indonesia) semata-mata sebagai panduan rekayasa perangkat lunak (*software engineering baseline*) dan tata kelola teknis. Dokumen ini **bukan merupakan nasihat hukum formal**. Untuk kepatuhan hukum yang mengikat, konsultasikan dengan profesional hukum yang berwenang.

---

## 2. Klasifikasi Data (Data Classification)

Flow Studio menerapkan taksonomi klasifikasi data 4 (empat) tingkat untuk menentukan kontrol penanganan, penyimpanan, enkripsi, dan logging:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      DATA CLASSIFICATION HIERARCHY                     │
├────────────────────────────────────────────────────────────────────────┤
│ [RESTRICTED]   Google Session Cookies, Plaintext Master Password,      │
│                Argon2id Master Derived Key (256-bit Key Buffer)        │
├────────────────────────────────────────────────────────────────────────┤
│ [CONFIDENTIAL] Master Password Hash (PHC), Master Salt, Google Email,  │
│                Prompt Chaining Context, Reference Frame Hashes         │
├────────────────────────────────────────────────────────────────────────┤
│ [INTERNAL]     Display Name, Subscription Tier, Credit Quotas,         │
│                Project Graph JSON, Generation Audit Log, Security Logs │
├────────────────────────────────────────────────────────────────────────┤
│ [PUBLIC]       Application Version, Build Metadata, Open Source        │
│                License Texts, Static UI Icons & Assets                 │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Matriks Penanganan Data

| Tingkat Klasifikasi | Item Data Spesifik | Lokasi Penyimpanan | Proteksi At-Rest | Proteksi In-Transit | Proteksi In-Memory | Aturan Audit & Logging |
|---|---|---|---|---|---|---|
| **Restricted** | `encrypted_cookies`<br>Plaintext Cookies<br>Master Derived Key (RAM)<br>Master Password (Input) | SQLite (`accounts`), Ephemeral RAM Buffer | AES-256-GCM (Ciphertext + 12B IV + 16B Tag) | TLS 1.3 Outbound (Reqwest to Google) | `zeroize::ZeroizeOnDrop`<br>Pinned memory buffer<br>Scrubbed saat Lock | **DILARANG MUTLAK MASUK LOG** (Zero-Log Rule). Masking penuh pada console dan crash dumps. |
| **Confidential** | `master_password_hash`<br>`salt`<br>`email` (Google account)<br>Prompt Chaining Data | SQLite (`credential_vault`, `accounts`, `segments`) | Argon2id PHC string<br>OS Filesystem ACL | IPC Payload internal (Tauri typed IPC) | Plaintext Rust String / Struct (lifetime terbatas) | Email di-mask pada log: `u***r@gmail.com`. Hash dan salt dilarang masuk ke log. |
| **Internal** | `display_name`<br>`subscription_tier`<br>`daily_credits_remaining`<br>`graph_json`<br>`generation_log`<br>`security_audit_log` | SQLite (`projects`, `accounts`, `generation_log`, `security_audit_log`), File `.flowproj` | Plaintext SQLite / JSON File di bawah Windows User Directory | IPC Message Struct (Tauri-Specta) | Standar heap allocation Rust / React state | Boleh dicatat ke dalam structured log lokal (`INFO` / `WARN`). |
| **Public** | App Version<br>UI SVG Icons<br>Theme Settings<br>Third-party Licenses | App Binary Bundle, Frontend Asset Bundle | Plaintext (Static assets) | N/A (Embedded binary) | Standar Webview V8 heap | Bebas diakses dan di-log. |

---

## 3. Trust Boundaries & Threat Model per Critical Flow

Arsitektur Flow Studio mendefinisikan 5 (lima) batas kepercayaan (*trust boundaries*) antar komponen sistem:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ HOST ENVIRONMENT: Windows 10/11 x64 (User Workstation)                          │
│                                                                                 │
│   [TRUST BOUNDARY 2: Inter-Process Communication]                               │
│   ┌───────────────────────────┐         Tauri IPC Bridge                        │
│   │ Untrusted UI Environment  │◄─────────────────────────────┐                  │
│   │ (WebView2 / React 19)     │───────────────────────────┐  │                  │
│   └───────────────────────────┘                           │  │                  │
│                                                           ▼  │                  │
│   [TRUST BOUNDARY 3: Cryptographic Vault Enclave]     ┌───────────────────────┐ │
│   ┌──────────────────────────────────────────────┐    │ Rust Backend Core     │ │
│   │ Vault Engine (Argon2id + AES-256-GCM)        │◄───┤ (Trusted Supervisor)  │ │
│   │ Ephemeral Master Key Buffer (Zeroize)        │    └──────────┬────────────┘ │
│   └──────────────────────┬───────────────────────┘               │              │
│                          │                                       │              │
│   [TRUST BOUNDARY 1]     │ [TRUST BOUNDARY 1]                    │              │
│   ▼                      ▼                                       ▼              │
│ ┌──────────────────────────────┐                     ┌────────────────────────┐ │
│ │ Local SQLite Database        │                     │ FFmpeg 6.0+ Sidecar    │ │
│ │ (%APPDATA%/FlowStudio/*.db)  │                     │ (Sandboxed Subprocess) │ │
│ └──────────────────────────────┘                     └────────────────────────┘ │
│                                                      [TRUST BOUNDARY 4]         │
└───────────────────────────────────┬─────────────────────────────────────────────┘
                                    │ [TRUST BOUNDARY 0: Outbound HTTPS Network]
                                    ▼
                         ┌────────────────────┐
                         │ Google Flow API    │
                         │ (Upstream AI Cloud)│
                         └────────────────────┘
```

- **Trust Boundary 0 (Rust Backend Core ↔ External Internet):**  
  Hanya lalu lintas HTTPS keluar (*outbound*) menuju domain resmi Google (`flow.google.com` dan endpoint terkait) yang diizinkan melalui TLS 1.3. Tidak ada soket jaringan masuk (*zero inbound listening ports*).
- **Trust Boundary 1 (Rust Backend Core ↔ Local Storage):**  
  File SQLite dan project disk diisolasi oleh izin berkas sistem operasi (NTFS ACL). Database diverifikasi integritasnya saat startup.
- **Trust Boundary 2 (WebView2 Frontend ↔ Rust Backend Supervisor):**  
  Renderer Webview diperlakukan sebagai konteks *untrusted*. Seluruh masukan dari UI divalidasi skema dan tipe datanya di Rust sebelum diproses.
- **Trust Boundary 3 (Rust Supervisor ↔ Credential Vault Engine):**  
  Modul brankas mengisolasi Master Key dalam buffer terproteksi. Modul lain tidak memiliki visibilitas ke Master Key.
- **Trust Boundary 4 (Rust Backend Core ↔ FFmpeg Sidecar Subprocess):**  
  Subproses FFmpeg dipanggil tanpa command shell, hanya menerima path absolut kanonikal lokal untuk operasi transcode/stitching.

---

### 3.1 Threat Model: Critical Flow 1 — Vault Unlock

```
User Input             Rust IPC Handler              Vault Engine               SQLite DB
    │                         │                           │                         │
    │── 1. cmd_vault_unlock ─►│                           │                         │
    │   (master_password)     │── 2. Check Cooldown ─────►│                         │
    │                         │      (Reject if active)   │                         │
    │                         │                           │── 3. Read Salt & Hash ─►│
    │                         │                           │◄─ 4. Return Vault Meta ─│
    │                         │── 5. Argon2id KDF ───────►│                         │
    │                         │      (Derive Master Key)  │                         │
    │                         │── 6. Verify Hash ────────►│                         │
    │                         │      (PHC verification)   │                         │
    │                         │                           │── 7. Decrypt Canary ───►│
    │                         │                           │      (AES-256-GCM)      │
    │◄── 8. Success / Error ──│◄─ 9. Key Held in Zeroize ─│                         │
```

#### Analisis STRIDE Flow 1:
- **Spoofing:** Penyerang mencoba menebak Master Password melalui script lokal.  
  *Mitigasi:* Mekanisme Anti-Brute-Force membatasi maksimal 3 kegagalan berturut-turut, memicu status `COOLDOWN` 30 detik (meningkat secara eksponensial pada kegagalan berulang).
- **Tampering:** Penyerang memodifikasi nilai `master_password_hash` atau `salt` di database SQLite secara manual.  
  *Mitigasi:* Verifikasi ciphertext canary menggunakan AES-256-GCM. Jika hash diubah tanpa mengetahui kunci, dekripsi canary gagal dan vault menolak terbuka.
- **Repudiation:** Tindakan pembukaan brankas tidak tercatat.  
  *Mitigasi:* Pencatatan terstruktur pada `security_audit_log` (`VAULT_UNLOCK_SUCCESS` atau `VAULT_UNLOCK_FAILED` beserta hitungan percobaan).
- **Information Disclosure:** Master password terekspos dalam crash dump atau heap memory.  
  *Mitigasi:* Penggunaan `zeroize::ZeroizeOnDrop` pada buffer password dan key derivasi. Hook panic Rust (`std::panic::set_hook`) membersihkan buffer sebelum aplikasi terminate.
- **Denial of Service:** Penyerang sengaja memicu status `COOLDOWN` berulang kali.  
  *Mitigasi:* Cooldown hanya berlaku pada IPC unlock, proses aplikasi lain tetap dapat mengakses fitur non-kredensial (node editor, offline stitching).
- **Elevation of Privilege:** Renderer frontend mencoba memanggil perintah internal brankas tanpa status `UNLOCKED`.  
  *Mitigasi:* State guard pada layer supervisor Rust menolak pemanggilan IPC jika status belum `UNLOCKED`.

---

### 3.2 Threat Model: Critical Flow 2 — Cookie Import

```
User Input               WebView2 Frontend          Rust IPC Handler         Vault Engine & DB
    │                           │                          │                         │
    │── 1. Paste Cookie JSON ──►│                          │                         │
    │                           │── 2. cmd_import_account ─►│                         │
    │                           │   (cookies payload)      │── 3. Validate VBA State►│
    │                           │                          │      (Must be UNLOCKED) │
    │                           │                          │── 4. Parse & Sanitize ──│
    │                           │                          │      (Filter Google UA) │
    │                           │                          │── 5. AES-256-GCM Enc ──►│
    │                           │                          │      (Unique 12B IV)    │
    │                           │                          │── 6. Write to SQLite ──►│
    │                           │                          │      (encrypted_cookies)│
    │                           │                          │── 7. Zeroize Plaintext ─│
    │◄── 8. Return Success ─────│◄─ 9. Return Sanitized ───│                         │
```

#### Analisis STRIDE Flow 2:
- **Spoofing:** Pengguna mengimpor cookie yang berasal dari situs tiruan (phishing).  
  *Mitigasi:* Backend melakukan health check awal ke endpoint otentikasi Google Flow sebelum menyimpan akun ke pool.
- **Tampering:** Cookie payload disusupi payload XSS atau format biner korup.  
  *Mitigasi:* Sanitasi parser JSON ketat menggunakan `serde_json` di Rust. Hanya field cookie yang diizinkan (`SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, `__Secure-*`) yang diekstrak.
- **Information Disclosure:** Cookie tersimpan dalam log saat terjadi kesalahan import.  
  *Mitigasi:* Sanitasi error message. Driver database dan tracing Rust dilarang mencetak variabel payload.
- **Elevation of Privilege:** Cookie impor dieksekusi saat status brankas masih `LOCKED`.  
  *Mitigasi:* Rust backend memeriksa *Security State Machine*; jika tidak berstatus `UNLOCKED`, operasi langsung menghasilkan error `VAULT_LOCKED`.

---

### 3.3 Threat Model: Critical Flow 3 — Video Generation Dispatch

```
Node Pipeline           Flow Router              Vault Engine          Reqwest TLS Client      Google Flow API
    │                        │                        │                        │                     │
    │── 1. Dispatch Task ───►│                        │                        │                     │
    │                        │── 2. Acquire Account ─►│                        │                     │
    │                        │   (Next in Pool)       │                        │                     │
    │                        │                        │── 3. Decrypt Cookie ──►│                     │
    │                        │                        │◄─ 4. Ephemeral Decrypt─│                     │
    │                        │── 5. Build Request ────────────────────────────►│                     │
    │                        │      (Chrome UA + Headers + Prompt Payload)     │── 6. HTTPS POST ───►│
    │                        │                                                 │      (TLS 1.3)      │
    │                        │── 7. Scrub Decrypted Cookie from RAM ──────────►│                     │
    │                        │                                                 │◄─ 8. 200 OK (Job) ──│
    │◄── 9. Task Polling ────│◄── 10. Return Job Receipt ──────────────────────│                     │
```

#### Analisis STRIDE Flow 3:
- **Spoofing:** Man-in-the-Middle (MitM) memalsukan respons dari Google Flow.  
  *Mitigasi:* Penegakan TLS 1.3 dengan verifikasi sertifikat root X.509 dari trust store sistem Windows (`webpki-roots` / Windows CryptoAPI). Dilarang mengabaikan verifikasi TLS (`danger_accept_invalid_certs = false`).
- **Information Disclosure:** Cookie sesi bocor melalui header HTTP atau tersimpan pada file temporary hasil unduhan.  
  *Mitigasi:* Objek HTTP request dibuat dan didekonstruksi secara lokal dalam lingkup fungsi efemeral; buffer cookie langsung di-zeroize setelah request dikirim.
- **Tampering (Account Ban):** Google mendeteksi automasi agresif dan membekukan akun.  
  *Mitigasi:* Flow Router menyematkan penundaan acak (*human-like jitter* 2-5 detik) dan User-Agent yang identik dengan Google Chrome Windows resmi.
- **Denial of Service:** Kredit Google Flow terkuras habis secara tidak terkendali.  
  *Mitigasi:* Pelacakan kuota lokal di SQLite (`daily_credits_remaining`) sebelum setiap dispatch; penghentian pipeline otomatis jika seluruh akun di pool mencapai batas kuota.

---

## 4. Analisis Skenario Penyalahgunaan (Abuse Cases & Misuse Cases)

| ID Abuse Case | Skenario Penyalahgunaan | Vektor Serangan | Dampak Potensial | Kontrol Mitigasi Spesifik |
|---|---|---|---|---|
| **ABU-001** | **Pencurian Database Kredensial Lokal (*Local Credential Theft*)** | Malware non-elevated atau pengguna OS lain mencoba membaca file `%APPDATA%/FlowStudio/flow_studio.db` untuk mencuri cookie Google. | **Kritis:** Pembajakan seluruh akun Google di dalam pool. | 1. Kolom `encrypted_cookies` dienkripsi dengan AES-256-GCM.<br>2. Kunci enkripsi tidak disimpan di disk.<br>3. NTFS ACL membatasi file hanya untuk profil pengguna Windows aktif. |
| **ABU-002** | **Session Hijacking via Memory Dump** | Attacker mengeksekusi tools pengambil memori (seperti `procdump` atau `mimikatz`) terhadap proses `flow-studio.exe` saat berjalan. | **Tinggi:** Ekstraksi plaintext cookie dari RAM proses. | 1. Implementasi trait `ZeroizeOnDrop` pada struct kunci dan cookie.<br>2. Masa hidup (*lifetime*) plaintext cookie dibatasi hanya saat pembentukan HTTP header.<br>3. Fitur Auto-Lock mengosongkan Master Key setelah 15 menit inaktivitas. |
| **ABU-003** | **Penyusupan File Proyek Berbahaya (*Malicious Project Poisoning*)** | Pengguna membuka file proyek `.flowproj` yang diunduh dari internet, berisi path traversal atau payload injeksi pada prompt/node metadata. | **Tinggi:** Akses file lokal di luar proyek (*Arbitrary File Read/Write*) atau eksploitasi subproses FFmpeg. | 1. Validasi ketat format JSON menggunakan skema formal serde.<br>2. Verifikasi canonical path pada seluruh asset media referensi.<br>3. Argument escaping penuh pada invocation FFmpeg sidecar (tanpa shell execution). |
| **ABU-004** | **Penyalahgunaan Akun Berlebih (*Aggressive Account Farming*)** | Pengguna menjalankan automasi loop puluhan akun secara paralel dalam kecepatan tinggi, memicu flag bot Google. | **Sedang:** Pembatasan IP atau penangguhan permanen (*ban*) pada pool akun Google Owner. | 1. Rate limiter desktop internal dengan random jitter (2–5 detik).<br>2. Batasan maksimal 1 concurrent dispatch per akun.<br>3. Fail-safe circuit breaker: pause pipeline jika akun menerima error HTTP 429 atau 403 berturut-turut. |
| **ABU-005** | **Serangan Kehabisan Disk (*Storage Exhaustion DoS*)** | Pipeline loop tak terbatas menghasilkan ribuan frame sementara atau segmen video hingga partisi OS kehabisan kapasitas. | **Sedang:** Sistem operasi crash, kerusakan file database SQLite. | 1. Guard `RULE-GUARD-DISKSPACE`: menolak dispatch jika sisa disk < 500 MB.<br>2. Auto-cleanup file sementara setelah proses render segmen selesai.<br>3. Batasan panjang segmen per proyek. |

---

## 5. Kontrol Autentikasi dan Otorisasi (Authentication & Authorization Controls)

Sistem mengadopsi model **Vault-Based State Authorization (VBA)** yang dipadukan dengan derivasi kunci kriptografis berbasis Master Password.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   VAULT STATE AUTHORIZATION LIFECYCLE                  │
└────────────────────────────────────────────────────────────────────────┘
                                 ┌───────────────┐
                                 │ UNINITIALIZED │
                                 └───────┬───────┘
                                         │ cmd_vault_init(password)
                                         ▼
            ┌────────────────────────► LOCKED ◄──────────────────────────┐
            │                         └────┬────┘                        │
            │                              │                             │
            │         cmd_vault_unlock()   │ 3x Gagal                    │
            │         (Password Benar)     │ (Lockout 30s)               │
            │                              ▼                             │
            │                         ┌──────────┐                       │
            │                         │ COOLDOWN │                       │
            │                         └────┬─────┘                       │
            │                              │ 30 detik berakhir           │
            │                              ▼                             │
            │                         LOCKED State                       │
            │                              │                             │
            │                              ▼                             │
  Auto-Lock (15m inaktif)             ┌──────────┐                       │
  atau cmd_vault_lock()               │ UNLOCKED │───────────────────────┘
            └─────────────────────────┤ (Key RAM)│ Manual Lock
                                      └──────────┘
```

### 5.1 Parameter Kriptografi KDF & Enkripsi

#### 1. Key Derivation Function (Argon2id)
- **Varian:** Argon2id (standar tahan terhadap serangan GPU dan side-channel cache-timing).
- **Memory Cost (`m_cost`):** 65,536 KiB (64 MiB).
- **Time Cost (`t_cost` / Iterations):** 3 iterasi.
- **Parallelism (`p_cost`):** 1 thread (dioptimalkan untuk konsistensi pada CPU desktop).
- **Salt:** 16 byte cryptographic random dari CSPRNG OS (`rand::rngs::OsRng`).
- **Output Key:** 256-bit (32 bytes) Master Key.
- **Verifikasi Kredensial:** Hash disimpan dalam format PHC string standar di tabel `credential_vault`.

#### 2. Enkripsi Simetris Kredensial (AES-256-GCM)
- **Algoritma:** AES-256 dalam mode Galois/Counter Mode (GCM) terotentikasi (*Authenticated Encryption with Associated Data* - AEAD).
- **Ukuran Kunci:** 256 bit (32 bytes).
- **Inisialisasi Nonce/IV:** 96 bit (12 bytes) *cryptographically random nonce* unik untuk setiap operasi enkripsi (dilarang menggunakan ulang nonce).
- **Authentication Tag:** 128 bit (16 bytes) Poly1305 GCM tag untuk memvalidasi integritas ciphertext.
- **Payload Struktur:** Disimpan dalam kolom `encrypted_cookies` (BLOB):  
  `Format: [12-byte Nonce] || [Ciphertext Biner] || [16-byte Tag]`  
  Total panjang minimum = 29 bytes (`CHECK (length(encrypted_cookies) > 28)`).

### 5.2 Pembersihan Memori Sensitif (*In-Memory Zeroization*)
- Implementasi pustaka Rust `zeroize` dengan trait `Zeroize` dan `ZeroizeOnDrop`.
- Tipe data sensitif dibungkus dalam struct pelindung:
  ```rust
  use zeroize::{Zeroize, ZeroizeOnDrop};

  #[derive(Zeroize, ZeroizeOnDrop)]
  pub struct MasterKey([u8; 32]);

  #[derive(Zeroize, ZeroizeOnDrop)]
  pub struct DecryptedSessionCookie {
      pub cookie_header: String,
      pub bearer_token: Option<String>,
  }
  ```
- Begitu struct keluar dari cakupan fungsinya (*out of scope*) atau perintah lock dijalankan, area memori yang ditempati ditimpa dengan nilai nol (`0x00`) menggunakan instruksi yang tidak dapat dieliminasi oleh optimasi compiler (*compiler optimization barrier*).

### 5.3 Mekanisme Auto-Lock Watchdog
- Thread latar belakang Rust memantau aktivitas pengguna (input mouse/keyboard pada antarmuka WebView2 dan pemanggilan IPC).
- **Default Timeout:** 15 menit tanpa aktivitas.
- **Tindakan Timeout:** Memanggil fungsi internal pembersihan brankas, menjatuhkan struct `MasterKey`, mengubah state sistem menjadi `LOCKED`, dan memancarkan event `vaultLocked` ke frontend.
- **Aturan Grace Completion:** Segmen video yang sedang aktif memegang handle koneksi HTTP ke Google Flow diizinkan menyelesaikan generasi klipnya hingga tuntas. Namun, proses segmen berikutnya yang memerlukan alokasi akun baru akan ditangguhkan (*paused*) hingga Owner memasukkan kembali Master Password.

### 5.4 Proteksi Anti-Brute-Force (Lockout)
- Percobaan unlock dipantau di memori Rust backend.
- Jika pengguna gagal memasukkan Master Password sebanyak **3 (tiga) kali berturut-turut**, state vault otomatis beralih ke `COOLDOWN`.
- Pada status `COOLDOWN`, backend menolak seketika setiap upaya verifikasi baru selama **30 detik**.
- Setiap percobaan yang masuk saat masa cooldown sedang berjalan akan mereset timer jeda kembali ke 30 detik penuh (*penalty extension*).

---

## 6. Validasi Masukan dan Keluaran (Input/Output Validation & Sanitization)

### 6.1 Sanitasi Prompt Video
Prompt yang dimasukkan pengguna atau dihasilkan melalui node template disanitasi sebelum dikirim ke Google Flow:
1. **Panjang Maksimum:** Dibatasi maksimal 4.000 karakter UTF-8.
2. **Karakter Terlarang:**
   - Menghapus karakter kontrol ANSI (`\x1b[...]`), kontrol terminal ASCII (0x00–0x1F, kecuali newline 0x0A dan tab 0x09).
   - Menolak *Unicode Bidirectional Override Characters* (`U+202E`, `U+202D`, dll.) yang dapat memanipulasi interpretasi teks.
3. **Pencegahan Injeksi Prompt AI:** Prompt chaining menggabungkan *Style Lock Prefix* dengan prompt segmen menggunakan pemisah eksplisit yang tidak dapat diexploitasi untuk membajak sistem instruksi dasar model video.

### 6.2 Pencegahan Path Traversal (*Directory Traversal Prevention*)
Untuk seluruh operasi penyimpanan dan pembacaan berkas (proyek, asset gambar referensi, ekspor video):
1. **Kanonikalisasi Path Mutlak:** Menggunakan fungsi `std::fs::canonicalize` di Rust sebelum mengakses file.
2. **Whitelist Direktori:**
   - Database dan cache aplikasi: `%APPDATA%\FlowStudio\`
   - Direktori kerja proyek: Ditentukan secara eksplisit oleh dialog file native OS yang dipilih Owner.
3. **Pemeriksaan Direktori Terlarang:** Menolak akses jika target berada di dalam:
   - Root sistem: `C:\Windows`, `C:\Program Files`, `C:\Program Files (x86)`, `C:\Users\*\AppData\Local\Microsoft`
4. **Pencegahan Urutan Relatif:** Menolak path yang mengandung urutan traversal `../` atau `..\` setelah divalidasi.
5. **Penolakan Symlink:** Symlink dan Junction Point Windows ditolak jika mengarah ke luar batas direktori proyek.

### 6.3 Validasi Skema File Proyek (`.flowproj`)
1. **Format File:** File proyek adalah dokumen JSON terstruktur.
2. **Batas Ukuran:** Maksimal 10 MB per file `.flowproj` (aset media disimpan secara terpisah di subdirektori proyek).
3. **Pemeriksaan Kedalaman Objek JSON:** Parsing dibatasi maksimal kedalaman rekursi 32 level untuk mencegah *stack overflow attack*.
4. **Validasi Skema Integritas:** Menggunakan `serde` dengan atribut `deny_unknown_fields` pada entitas penting. Jika terdapat node graph ilegal atau struktur rusak, sistem menolak memuat proyek dan mengembalikan error `INVALID_PROJECT_SCHEMA`.

### 6.4 Sanitasi Subproses FFmpeg Sidecar
1. Pemanggilan binary FFmpeg dilakukan langsung via `std::process::Command` / Tauri Command abstraction tanpa melalui shell interpreter (`cmd.exe` atau `powershell.exe`).
2. Argumen dikirim sebagai array string individual (*argv array*), mencegah injeksi perintah shell (*command injection*).
3. Format output video dibatasi pada codec standar: Video H.264 / H.265 (`libx264`, `libx265`), Audio AAC, Container `.mp4` / `.webm`.

---

## 7. Kriptografi, Enkripsi Transit & Rest (Cryptography & Encryption Scheme)

### 7.1 Enkripsi In-Transit (Network Egress)
- Seluruh komunikasi keluar ke Google Flow diarahkan ke protokol **HTTPS** melalui **TLS 1.3** (didukung oleh pustaka `rustls` atau `native-tls` yang terikat ke Windows SChannel).
- **Cipher Suites yang Didukung:**
  - `TLS_AES_256_GCM_SHA384`
  - `TLS_CHACHA20_POLY1305_SHA256`
  - `TLS_AES_128_GCM_SHA256`
- **Verifikasi Sertifikat:** Menegakkan validasi rantai sertifikat X.509 penuh terhadap CA Store bawaan Windows. Menonaktifkan pemeriksaan sertifikat dilarang keras di kode produksi.
- **Zero Inbound Connections:** Aplikasi tidak mengekspos port HTTP server lokal atau websocket server publik. Seluruh pertukaran antara frontend dan backend berjalan melalui IPC memory bridge Tauri.

### 7.2 Enkripsi At-Rest (Database Storage)
- **Database Engine:** SQLite 3 lokal dengan SQLite WAL Mode (`PRAGMA journal_mode = WAL;`) dan foreign keys aktif (`PRAGMA foreign_keys = ON;`).
- **Enkripsi Kolom Kredensial:** Data otentikasi akun pada kolom `encrypted_cookies` dienkripsi penuh menggunakan AES-256-GCM.
- **Struktur Penyimpanan Ciphertext:**
  ```
  Offset   Ukuran     Deskripsi
  0..11    12 bytes   Initialization Vector / Nonce (Random OsRng)
  12..N-16 N bytes    Ciphertext biner JSON Cookies
  N-15..N  16 bytes   Poly1305 Authentication Tag
  ```
- **Proteksi Tingkat Berkas Sistem Operasi:** Direktori `%APPDATA%\FlowStudio` dikonfigurasi dengan NTFS ACL agar hanya dapat diakses oleh SID akun pengguna Windows yang menginstal dan menjalankan aplikasi.

---

## 8. Manajemen Rahasia (Secret Management)

### 8.1 Zero Plaintext Secrets on Disk
1. Aplikasi tidak pernah membuat file `.env`, file konfigurasi sementara, atau berkas *scratchpad* yang memuat password atau cookie dalam format plaintext.
2. Tidak ada master password yang disimpan di disk, baik dalam bentuk obfuscated, terenkripsi dua arah, maupun reversibel. Validasi hanya menggunakan hash satu arah Argon2id.

### 8.2 Zero Secrets in Logs
1. Framework logging Rust (`tracing-subscriber`) dikonfigurasi secara ketat. Seluruh field yang memuat token, password, atau cookie disaring sebelum serialisasi log.
2. Filter penanganan panic (`std::panic::set_hook`) mengaburkan state variabel lokal agar kredensial di stack/heap tidak tercatat ke file crash dump Windows (`minidump`).
3. Payload biner API yang dicatat pada tabel `generation_log` hanya disimpan dalam bentuk representasi hash SHA-256 (`request_payload_hash`), bukan payload JSON mentah.

---

## 9. Kontrol Ketergantungan & Rantai Pasok (Dependency & Supply-Chain Controls)

Untuk memitigasi risiko kompromi rantai pasok (*supply chain attacks*):

### 9.1 Ekosistem Rust (Cargo)
1. **Audit Rutin Vulnerability:** Integrasi tool `cargo-audit` dalam pipeline build untuk memindai basis data *RustSec Advisory Database*.
2. **Pinned Versions:** Seluruh ketergantungan didefinisikan secara eksplisit dan dikunci versinya pada `Cargo.lock`.
3. **Pustaka Kriptografi Terkurasi:** Hanya menggunakan implementasi kriptografi standar industri yang telah diaudit:
   - `argon2` (RustCrypto)
   - `aes-gcm` (RustCrypto)
   - `zeroize` (RustCrypto)
   - `rand` (rust-random)

### 9.2 Ekosistem Frontend (Node.js & npm)
1. **Audit Keamanan Paket:** Menjalankan `npm audit --audit-level=high` sebelum rilis produksi; build digagalkan jika ditemukan kerentanan dengan tingkat keparahan tinggi atau kritis.
2. **Lockfile Enforcement:** Menegakkan `package-lock.json` dengan perintah instalasi deterministik (`npm ci`).
3. **Penyertaan Aset Lokal Penuh:** Seluruh pustaka antarmuka pengguna (`react`, `@xyflow/react`, `lucide-react`, `tailwindcss`) dibundel langsung ke dalam binary aplikasi melalui Vite/Tauri. Tidak ada script yang dimuat secara runtime dari *Content Delivery Network* (CDN) eksternal.

---

## 10. Rate Limiting, Anti-Automation & Human-Like Delays

Meskipun Flow Studio adalah alat desktop personal (bukan API publik multi-tenant), mitigasi automasi dievaluasi dalam dua konteks berbeda:

### 10.1 Konteks Lokal Desktop: Anti-Brute-Force Master Password
- **Ambang Batas Gagal:** Maksimal 3 (tiga) kali kesalahan berurutan.
- **Jeda Hukuman (*Cooldown*):** Pembekuan fungsi unlock selama 30 detik.
- **Penalti Tambahan:** Jika upaya unlock tetap dikirimkan selama periode cooldown, timer 30 detik dihitung ulang dari awal.

### 10.2 Konteks Egress Upstream: Pencegahan Deteksi Bot & Pemblokiran Akun Google
Karena Google Flow menerapkan sistem deteksi anomali perilaku (*behavioral bot detection*), Flow Studio menerapkan kontrol berikut pada Flow Router:
1. **Human-like Request Cadence:** Menambahkan penundaan acak (*random jitter*) antara **2 hingga 5 detik** antar request pembuatan video atau polling status segmen.
2. **Serial Execution per Account:** Tidak ada akun yang mengirimkan lebih dari 1 permintaan generasi pada saat yang bersamaan.
3. **Rotasi Cerdas Akun Pool:** Jika sebuah akun mencapai batas kuota harian (50 kredit) atau menerima header throttling (HTTP 429), sistem otomatis merotasi akun ke akun cadangan berikutnya yang valid, disertai jeda pendinginan akun lama selama minimal 15 menit.

---

## 11. Log Audit Keamanan (Security Audit Logging)

Sistem mencatat seluruh aktivitas keamanan penting ke dalam tabel lokal `security_audit_log` di SQLite.

### 11.1 Skema Tabel `security_audit_log`

```sql
CREATE TABLE IF NOT EXISTS security_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,          -- UUID v4
    timestamp_utc TEXT NOT NULL,            -- ISO 8601 UTC
    event_type TEXT NOT NULL,               -- Kategori event terstandar
    severity TEXT NOT NULL,                 -- INFO, WARN, SECURITY_ALERT
    actor TEXT NOT NULL DEFAULT 'OWNER',    -- OWNER, SYSTEM, WATCHDOG
    vault_state TEXT NOT NULL,              -- UNINITIALIZED, LOCKED, UNLOCKED, COOLDOWN
    target_resource TEXT,                   -- Identifier akun/project (non-sensitif)
    status TEXT NOT NULL,                   -- SUCCESS, FAILED, BLOCKED
    details_json TEXT NOT NULL              -- Metadata terstruktur non-sensitif
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON security_audit_log(timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON security_audit_log(event_type);
```

### 11.2 Taksonomi Event Audit

| Event Type Code | Severity | Deskripsi Kejadian | Contoh `details_json` |
|---|---|---|---|
| `VAULT_INITIALIZED` | `INFO` | Konfigurasi awal master password berhasil. | `{"kdf":"Argon2id","m_cost_kib":65536,"t_cost":3}` |
| `VAULT_UNLOCK_SUCCESS` | `INFO` | Brankas berhasil dibuka. | `{"failed_attempts_reset":0,"session_duration_min":15}` |
| `VAULT_UNLOCK_FAILED` | `WARN` | Upaya unlock gagal (password salah). | `{"failed_attempts_count":2,"source":"IPC_INVOKE"}` |
| `VAULT_COOLDOWN_TRIGGERED`| `SECURITY_ALERT`| Batas salah 3x tercapai, cooldown aktif. | `{"cooldown_duration_secs":30}` |
| `VAULT_MANUAL_LOCK` | `INFO` | Penguncian manual oleh Owner. | `{"reason":"USER_ACTION"}` |
| `VAULT_AUTO_LOCKED` | `INFO` | Watchdog mengunci brankas karena inaktivitas.| `{"inactivity_minutes":15}` |
| `VAULT_PASSWORD_CHANGED` | `INFO` | Master Password diganti, akun dienkripsi ulang.| `{"accounts_reencrypted_count":4}` |
| `VAULT_FACTORY_RESET` | `SECURITY_ALERT`| Seluruh isi brankas dan akun dimusnahkan. | `{"action":"WIPE_ALL","accounts_purged":3}` |
| `ACCOUNT_IMPORTED` | `INFO` | Akun Google Flow baru ditambahkan ke pool. | `{"account_id":"acc-01","masked_email":"u***@gmail.com"}` |
| `ACCOUNT_DELETED` | `INFO` | Akun dihapus secara permanen dari pool. | `{"account_id":"acc-01"}` |
| `ACCOUNT_HEALTH_CHANGED`| `WARN` | Status sesi akun berubah (misal: expired/401). | `{"account_id":"acc-01","http_code":401,"status":"EXPIRED"}` |
| `ACCOUNT_ROTATED` | `INFO` | Pool merotasi akun karena kredit habis. | `{"from_account":"acc-01","to_account":"acc-02","reason":"EXHAUSTED"}` |
| `IPC_PERMISSION_DENIED` | `WARN` | Pemanggilan IPC ditolak karena state brankas. | `{"command":"cmd_generate_video","required":"UNLOCKED","current":"LOCKED"}` |
| `PATH_TRAVERSAL_BLOCKED`| `SECURITY_ALERT`| Upaya akses file di luar whitelist digagalkan. | `{"requested_path":"../../Windows/System32"}` |
| `SUSPICIOUS_EXTENSION_BLOCKED`| `SECURITY_ALERT`| File dengan ekstensi ransomware ditolak. | `{"filename":"payload.mp4.locked","extension":".locked"}` |

### 11.3 Kebijakan Retensi & Integritas Log
- **Prinsip Append-Only:** Backend Rust tidak menyediakan perintah IPC untuk mengubah (`UPDATE`) record log yang sudah tersimpan.
- **Retensi Bergulir (Rolling 90 Days):** Saat aplikasi startup, riwayat log audit yang berumur lebih dari 90 hari akan dibersihkan secara otomatis melalui kueri SQL:  
  `DELETE FROM security_audit_log WHERE timestamp_utc < datetime('now', '-90 days');`

---

## 12. Privasi, Consent, Retensi & Minimalisasi Data

### 12.1 Minimalisasi Data (Data Minimization)
Flow Studio hanya meminta dan menyimpan komponen data yang mutlak diperlukan untuk mengoperasikan automasi API Google Flow:
1. **Cookie Sesi Otentikasi Esensial:** Hanya cookie otentikasi Google akun yang relevan (`SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, `__Secure-*`) yang diekstrak dan disimpan. Cookie pelacak iklan, histori browsing, atau analitik pihak ketiga dibuang saat proses import.
2. **Metadata Akun Minimum:** Hanya menyimpan alamat email (sebagai ID unik pool), display name, dan sisa kredit.

### 12.2 Zero Telemetry & Privacy by Design
1. **Tidak Ada Pelacak Pihak Ketiga:** Aplikasi tidak mengintegrasikan Google Analytics, Sentry, Mixpanel, PostHog, atau layanan telemetri eksternal lainnya.
2. **Tidak Ada Validasi Lisensi Online:** Flow Studio tidak melakukan ping ke server lisensi eksternal. Aplikasi dapat beroperasi secara fungsional dalam lingkungan jaringan tertutup (*isolated environment*) untuk fitur-fitur lokal (node editor, offline stitching).

### 12.3 Kebijakan Penghapusan Data (Right to Erasure / Deletion)
- **Penghapusan Akun Mandiri:** Owner dapat menghapus akun individual kapan saja. Operasi ini mengeksekusi *hard delete* terhadap record akun dan ciphertext cookie di SQLite (`DELETE FROM accounts WHERE id = ?`).
- **Vault Factory Reset:** Fitur darurat di UI untuk menghapus seluruh konfigurasi master password, pool akun, dan audit log secara seketika, mengembalikan aplikasi ke status `UNINITIALIZED`.

---

## 13. Inventaris Data Pribadi (PII Inventory & Data Flow)

Berdasarkan penandaan taksonomi pada `ERD.md` (DOC-ERD-001):

### 13.1 Inventaris Data Pribadi

| Nama Entitas & Kolom | Klasifikasi PII | Deskripsi & Tujuan Penggunaan | Dasar Hukum Pemrosesan | Tindakan Pengamanan Teknis |
|---|---|---|---|---|
| `accounts.email` | **PII-MEDIUM** | Alamat email Google milik Owner. Digunakan untuk identifikasi unik dan pemilihan akun pada antarmuka pool. | Persetujuan eksplisit Owner (*Data Subject Consent*) saat impor akun. | Tersimpan lokal di SQLite. Di-mask pada log diagnostik (`u***r@domain.com`). |
| `accounts.display_name` | **NON-PII** | Label/alias akun (misal: "Akun Kerja", "Pool #1"). Digunakan untuk kenyamanan navigasi UI. | Kepentingan operasional Owner. | Tersimpan lokal di SQLite. |
| `accounts.encrypted_cookies` | **PII-HIGH (Restricted)** | Data sesi dan token otentikasi Google Flow. Digunakan untuk autentikasi request pembuatan video. | Persetujuan eksplisit Owner untuk automasi sesi. | Wajib dienkripsi AES-256-GCM. Kunci turunan Argon2id hanya di RAM. Zeroization saat drop. Dilarang masuk log. |

### 13.2 Aliran Data Pribadi (PII Data Flow)

```
[Owner Input: Cookie JSON]
       │
       ▼ (Tauri IPC Bridge - In-memory transfer)
[Rust IPC Handler]
       │ ──► Parse & Filter (Discard tracking cookies)
       ▼
[Vault Engine] ──► Encrypt with AES-256-GCM (Argon2id Derived Key)
       │
       ▼ (Write Encrypted Blob)
[Local SQLite DB: accounts table] ◄── [At-Rest Storage]
       │
       ▼ (When Pipeline Triggers & Vault is UNLOCKED)
[Ephemeral Decryption in RAM]
       │ ──► Inject into HTTP Authorization Header (reqwest Client)
       ▼ (TLS 1.3 Outbound HTTPS)
[Google Flow API: flow.google.com]
       │
       ▼ (Request Dispatched)
[Memory Zeroized: zeroize crate] ──► [Zero Residual Plaintext in RAM]
```

---

## 14. Pemetaan Kepatuhan Regulasi (Compliance Mapping: UU PDP No. 27/2022)

Sebagai aplikasi desktop yang memproses dan menyimpan data pribadi (alamat email dan session token) di wilayah hukum Republik Indonesia, Flow Studio menyelaraskan desain teknisnya dengan prinsip-prinsip **Undang-Undang Pelindungan Data Pribadi (UU PDP) No. 27 Tahun 2022**:

| Prinsip / Pasal UU PDP No. 27/2022 | Relevansi pada Flow Studio (Desktop Tool Context) | Kontrol Rekayasa Teknis Konkret yang Diterapkan |
|---|---|---|
| **Pasal 20: Persetujuan Subjek Data (*Consent*)** | Pemrosesan data kredensial dan email akun Google milik Owner. | Owner secara sadar dan eksplisit melakukan tindakan penambahan akun (*opt-in manual cookie import*). Aplikasi menampilkan notifikasi peringatan izin keamanan sebelum data sesi disimpan. |
| **Pasal 27: Pembatasan Tujuan (*Purpose Limitation*)** | Kredensial akun Google hanya boleh digunakan untuk automasi pembuatan video pada platform Google Flow. | Backend Rust mengisolasi penggunaan cookie secara eksklusif ke domain resmi Google Flow. Dilarang keras meneruskan cookie ke domain atau endpoint lain. |
| **Pasal 28: Minimalisasi Data (*Data Minimization*)** | Pengumpulan data dibatasi hanya pada data yang relevan dan dibutuhkan. | Hanya cookie autentikasi primer yang disimpan. Seluruh cookie analitik/iklan pihak ketiga dibuang saat pemrosesan impor. |
| **Pasal 30: Akurasi Data (*Data Accuracy*)** | Memastikan kelayakan dan validitas data sesi yang tersimpan. | Modul *Health Check* berkala memverifikasi keaktifan sesi ke endpoint Google Flow dan memperbarui flag `session_valid` secara otomatis. |
| **Pasal 31: Pembatasan Retensi (*Storage Limitation*)** | Data tidak boleh disimpan lebih lama dari yang diperlukan. | 1. Owner memiliki kendali mutlak untuk menghapus data kapan saja.<br>2. Log audit keamanan dibersihkan otomatis setelah 90 hari.<br>3. Fitur *Vault Factory Reset* memusnahkan seluruh kredensial dalam satu langkah. |
| **Pasal 35: Keamanan Pemrosesan Data Pribadi** | Kewajiban melindungi data dari akses tidak sah, pengubahan, atau kebocoran. | 1. Enkripsi AES-256-GCM at-rest.<br>2. Derivasi Argon2id dengan memory cost 64 MB.<br>3. Pembersihan memori volatile (`zeroize`).<br>4. Auto-lock timeout 15 menit. |
| **Pasal 46: Pemberitahuan Kegagalan Perlindungan Data** | Prosedur penanganan saat terjadi kebocoran data pribadi (*Data Breach Notification*). | Karena Flow Studio beroperasi secara offline/lokal tanpa server pusat, tanggung jawab kebocoran diarahkan pada panduan mandiri (*Owner Incident Response Protocol*) jika perangkat host terkompromi. |

> ⚖️ *Peringatan Kepatuhan: Konsultasikan implementasi final dengan profesional hukum berwenang untuk kepatuhan formal terhadap yurisdiksi Indonesia atau regulasi internasional lainnya.*

---

## 15. Prosedur Respons Insiden Keamanan (Incident / Breach Response Trigger)

Karena Flow Studio adalah aplikasi desktop lokal tanpa infrastruktur server backend terpusat, alur respons insiden difokuskan pada mitigasi mandiri oleh Owner:

### 15.1 Klasifikasi Pemicu Insiden (Incident Triggers)
1. **Trigger T-1: Kompromi Perangkat Host (*Host Compromise*):**  
   Perangkat PC terinfeksi malware pencuri informasi (*infostealer*), atau file `flow_studio.db` terekspos ke pihak ketiga.
2. **Trigger T-2: Anomali Akun Google (*Account Anomaly / Suspension*):**  
   Google mengirimkan email peringatan aktivitas mencurigakan, penolakan login massal (HTTP 401/403 berulang), atau penangguhan akun.
3. **Trigger T-3: Kegagalan Integritas Kriptografi (*Tamper Alert*):**  
   Aplikasi mendeteksi ciphertext canary tidak dapat didekripsi menggunakan master key yang valid, mengindikasikan modifikasi basis data oleh entitas asing.

### 15.2 Prosedur Darurat Pemulihan Insiden (*Containment & Remediation Protocol*)

```
[INSIDEN TERDETEKSI: T-1 / T-2 / T-3]
                 │
                 ▼
     ┌───────────────────────┐
     │ 1. REVOKASI SESI      │ ──► Akses myaccount.google.com/security
     │    GOOGLE SEKETIKA    │     Klik "Sign out of all sessions"
     └───────────┬───────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │ 2. FACTORY RESET      │ ──► Buka Flow Studio Settings -> Reset Vault
     │    FLOW STUDIO        │     Seluruh ciphertext & salt dimusnahkan
     └───────────┬───────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │ 3. ROTASI KATA SANDI  │ ──► Ganti password Google & aktifkan 2FA
     │    & PASSKEY GOOGLE   │
     └───────────┬───────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │ 4. AUDIT FORENSIK     │ ──► Periksa security_audit_log lokal &
     │    HOST WORKSTATION   │     jalankan full anti-malware scan
     └───────────────────────┘
```

---

## 16. Daftar Uji Keamanan (Security Testing Checklist)

| Kategori Pengujian | ID Uji | Skenario Uji Keamanan | Kriteria Penerimaan (*Acceptance Criteria*) | Metode Verifikasi |
|---|---|---|---|---|
| **Cryptographic Unit Tests** | `TEST-SEC-001` | Validasi derivasi Argon2id | Parameter KDF tepat (64MB RAM, 3 iterasi, 1 lane). Hash cocok dengan format PHC standar. | Rust `cargo test test_argon2id_derivation` |
| | `TEST-SEC-002` | Validasi enkripsi/dekripsi AES-256-GCM | Data berhasil didekripsi hanya dengan kunci yang tepat. Modifikasi 1 bit ciphertext memicu error tag mismatch. | Rust `cargo test test_aes_gcm_tamper_detection` |
| | `TEST-SEC-003` | Verifikasi Pembersihan Memori (*Zeroize*) | Buffer Master Key dan Plaintext Cookie terisi nilai `0x00` setelah di-drop dari memori. | Rust memory inspect test using `valgrind` / sanitizers |
| **Authentication & VBA Tests** | `TEST-SEC-010` | Brute-force lockout & cooldown | Memasukkan password salah 3 kali memicu status `COOLDOWN` selama tepat 30 detik. Upaya baru ditolak instan. | Integration test `test_vault_cooldown_flow` |
| | `TEST-SEC-011` | Auto-lock watchdog inactivity | Brankas otomatis beralih ke state `LOCKED` dan Master Key dibersihkan setelah 15 menit idle. | Integration test dengan mocked timer clock |
| | `TEST-SEC-012` | Otorisasi Command IPC saat Locked | Seluruh pemanggilan IPC yang memerlukan kredensial ditolak dengan error `VAULT_LOCKED`. | Tauri command integration tests |
| **Input Validation Tests** | `TEST-SEC-020` | Pencegahan Path Traversal | Upaya memuat berkas dengan path `../../Windows/System32` ditolak dan dicatat ke audit log. | Unit test `test_path_traversal_canonicalize` |
| | `TEST-SEC-021` | Sanitasi Ekstensi Ransomware | Berkas dengan ekstensi `.locked`, `.crypto`, dll. ditolak seketika pada file picker handler. | Unit test `test_ransomware_extension_filter` |
| | `TEST-SEC-022` | Validasi Skema JSON Project | File `.flowproj` dengan JSON korup atau field asing ditolak tanpa memicu memory crash. | Fuzz test `test_project_json_fuzzing` |
| **Network & Outbound Tests** | `TEST-SEC-030` | Penegakan TLS 1.3 | Seluruh koneksi HTTP outbound menggunakan TLS 1.3 dan menolak self-signed certificate. | Mock server TLS test via `reqwest` |
| | `TEST-SEC-031` | User-Agent Egress Mimicry | Header User-Agent yang dikirim ke Google Flow identik dengan browser Chrome resmi Windows 10/11. | Egress HTTP packet inspection |
| | `TEST-SEC-032` | Zero Inbound Port Verification | Tidak ada listening socket TCP/UDP yang dibuka oleh aplikasi pada host interface. | Network socket audit: `netstat -ano` / `ss -tulpn` |

---

## 17. Register Risiko Keamanan Tersisa (Residual Risks: RSK-001 s/d RSK-005)

| ID Risiko | Deskripsi Risiko Bawaan (*Inherent Risk*) | Tingkat Risiko Bawaan | Kontrol Mitigasi yang Diterapkan | Risiko Tersisa (*Residual Risk*) | Rencana Kontinjensi & Monitoring |
|---|---|:---:|---|:---:|---|
| **RSK-001** | **Google Flow API Reverse-Engineering Fragility**<br>Perubahan struktur endpoint, payload protobuf/JSON, atau skema otentikasi Google Flow menyebabkan pipeline gagal total. | **Tinggi** (Prob: High, Imp: Critical) | Abstraksi modular pada adapter API Google Flow (`flow_router`). Isolasi logika upstream dalam satu modul terpisah untuk kemudahan patching. | **Sedang**<br>Aplikasi tetap berisiko terganggu jika Google merilis perubahan arsitektur besar. | Startup health check memvalidasi endpoint sebelum menjalankan pipeline panjang. Notifikasi update aplikasi kepada pengguna. |
| **RSK-002** | **ToS Violation & Google Account Ban Risk**<br>Google mendeteksi aktivitas otomatisasi pembuatan video dan membekukan akun atau mencabut akses kuota kredit. | **Tinggi** (Prob: High, Imp: High) | 1. Human-like randomized delay (2–5 detik).<br>2. User-Agent browser modern konsisten.<br>3. Penggunaan akun personal milik Owner sendiri (tanpa multi-user sharing). | **Sedang**<br>Perilaku reverse engineering memiliki risiko bawaan pelanggaran ToS pihak ketiga. | Owner disarankan menggunakan akun pengujian cadangan (*secondary account*). Circuit breaker menghentikan batch jika terdeteksi 429. |
| **RSK-003** | **Visual Continuity Across Segments**<br>Output video menunjukkan transisi visual yang patah atau jarring antar segmen klip 10 detik. | **Tinggi** (Prob: High, Imp: High) | 1. Ekstraksi frame terakhir segmen via FFmpeg sebagai referensi segmen berikutnya.<br>2. Style locking prompt prefix.<br>3. Fitur manual regenerasi segmen individual. | **Rendah**<br>Kualitas visual bergantung pada model AI Google Flow, bukan pada keamanan teknis. | Review manual visual di UI sebelum final stitching ekspor video. |
| **RSK-004** | **Credential Security on Compromised Host**<br>Ekstraksi kredensial dari host yang telah terinfeksi malware tingkat kernel atau keylogger fisik. | **Tinggi** (Prob: Med, Imp: Critical) | 1. Enkripsi AES-256-GCM at-rest.<br>2. Derivasi Argon2id (64MB RAM).<br>3. Pembersihan RAM efemeral (`zeroize`).<br>4. Auto-lock timeout 15 menit.<br>5. Zero plaintext secrets on disk/logs. | **Rendah**<br>Aplikasi tidak dapat menahan serangan keylogger fisik pada level OS atau kernel-level memory hook. | Rekomendasi hardening OS host pada dokumentasi: isolasi workstation dan antivirus aktif. |
| **RSK-005** | **Google Flow UI/API Breaking Changes**<br>Google memigrasi antarmuka web ke arsitektur WebSocket tertutup atau menambahkan tantangan Captcha/PoW yang tidak dapat dilewati secara headless. | **Sedang** (Prob: Med, Imp: Med) | Thin adapter layer, pemantauan error HTTP terstruktur, arsitektur fallback modular. | **Sedang**<br>Jika Captcha wajib muncul pada setiap prompt, automasi headless dapat terhenti sementara. | Fallback ke WebView interaktif bawaan Tauri untuk penyelesaian tantangan manual oleh Owner jika diperlukan. |

---

## 18. Pemetaan OWASP Top 10:2021 (A01 - A10 Mapping)

Setiap kategori dievaluasi secara ketat berdasarkan arsitektur aplikasi desktop personal Flow Studio sesuai spesifikasi `PLANNING_v5.2.md` §11.10.B:

---

### A01 — Broken Access Control

**Status:** ✅ Controlled

**Kontrol yang diterapkan:**
1. **Vault-Based State Authorization (VBA):** Setiap pemanggilan perintah Tauri IPC diverifikasi oleh *State Guard* backend Rust (`src-tauri/src/commands/`). Akses terhadap operasi kredensial ditolak secara *deny-by-default* kecuali brankas berada dalam kondisi `UNLOCKED`.
2. **Peniadaan IDOR / Single-User Ownership:** Seluruh data lokal diasosiasikan secara implisit dengan Owner. Tidak ada parameter `user_id` atau `tenant_id` dari frontend yang dapat dimanipulasi untuk mengakses data pengguna lain.
3. **Restriksi IPC Path Traversal:** Validasi kanonikalisasi berkas pada operasi import dan export mencegah akses ke luar direktori proyek atau berkas sistem Windows.

**Residual risk:** None identified dalam cakupan single-user workstation lokal.

**Verification:**  
- Automated integration test `test_unlocked_state_guard_rejection` (memastikan IPC mengembalikan `ERR_VAULT_LOCKED` saat dipanggil dalam status `LOCKED`).
- Automated test `test_path_traversal_prevention`.

---

### A02 — Cryptographic Failures

**Status:** ✅ Controlled

**Kontrol yang diterapkan:**
1. **Argon2id Key Derivation:** Menggunakan parameter standar industri (m_cost: 65,536 KiB, t_cost: 3, p_cost: 1) dengan salt acak 16 byte dari OS CSPRNG (`src-tauri/src/crypto/kdf.rs`).
2. **Enkripsi At-Rest AES-256-GCM:** Kolom `encrypted_cookies` pada basis data SQLite dilindungi oleh ciphertext terotentikasi AEAD dengan nonce 12-byte unik per baris (`src-tauri/src/crypto/cipher.rs`).
3. **Pembersihan Memori Volatile:** Penerapan trait `ZeroizeOnDrop` dari crate `zeroize` pada struct `MasterKey` dan plaintext cookies segera setelah penggunaan.
4. **Enkripsi In-Transit TLS 1.3:** Seluruh komunikasi jaringan keluar ke Google Flow menegakkan TLS 1.3 dengan verifikasi sertifikat root X.509 Windows yang ketat.
5. **Zero Hardcoded Secrets:** Tidak ada kunci enkripsi, password, atau credential yang ditulis langsung (*hardcoded*) di source code maupun file konfigurasi.

**Residual risk:** Pembuangan memori proses oleh malware berprivilese Administrator lokal pada saat brankas dalam kondisi `UNLOCKED` (dimitigasi oleh auto-lock 15 menit).

**Verification:**  
- Unit tests: `test_argon2id_derivation_vectors` dan `test_aes_gcm_roundtrip_and_tamper`.
- Codebase grep audit untuk pola hardcoded secret/keys.

---

### A03 — Injection

**Status:** ✅ Controlled

**Kontrol yang diterapkan:**
1. **Parameterized Queries SQLite:** Seluruh interaksi basis data menggunakan query berparameter via driver `rusqlite` / `sqlx`. Tidak ada konkatenasi string SQL mentah di seluruh kode Rust (`src-tauri/src/db/`).
2. **Sidecar Process Argument Escaping:** Subproses FFmpeg dipanggil menggunakan `std::process::Command` dengan argumen yang diisolasi sebagai elemen array terpisah (`.arg()`), meniadakan eksekusi melalui shell (`cmd.exe` atau `sh`).
3. **Pencegahan XSS di WebView2:** Frontend React 19 meng-escape seluruh konten dinamis secara default. Tidak ada penggunaan `dangerouslySetInnerHTML` pada data yang berasal dari prompt atau file proyek.
4. **Content Security Policy (CSP):** Header CSP ketat diterapkan pada jendela Tauri:  
   `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset:; connect-src 'self';`

**Residual risk:** None identified.

**Verification:**  
- Codebase audit: pemeriksaan nihil konkatenasi SQL (`format!("SELECT ... {}")`).
- AST scan untuk penggunaan `dangerouslySetInnerHTML` dan pemanggilan `Command::new("cmd")`.

---

### A04 — Insecure Design

**Status:** ✅ Controlled

**Kontrol yang diterapkan:**
1. **Anti-Brute-Force Master Password:** Kegagalan unlock sebanyak 3 kali berturut-turut memicu status `COOLDOWN` 30 detik (reset timer pada percobaan baru) (`src-tauri/src/crypto/vault.rs`).
2. **Re-Authentication untuk Operasi Sensitif:** Penggantian Master Password atau penghapusan seluruh brankas (*Factory Reset*) mewajibkan konfirmasi ulang Master Password aktif.
3. **Automasi Berkesadaran Batas (*Circuit Breaker*):** Eksekusi pipeline generasi berhenti secara otomatis jika terdeteksi kuota akun habis atau menerima error berulang dari Google Flow.
4. **Auto-Lock Watchdog:** Timer inaktivitas mengunci brankas setelah 15 menit tanpa interaksi.

**Residual risk:** Pengguna memilih Master Password yang lemah (dimitigasi oleh validasi kompleksitas minimal 8 karakter di UI).

**Verification:**  
- Integration test: `test_vault_brute_force_lockout_trigger`.
- Verifikasi skenario timeout watchdog auto-lock.

---

### A05 — Security Misconfiguration

**Status:** ✅ Controlled

**Kontrol yang diterapkan:**
1. **Pengerasan Konfigurasi Tauri 2.x (`tauri.conf.json`):**
   - Menghapus seluruh endpoint API Tauri yang tidak digunakan (`core:default` scoped strictly).
   - Menonaktifkan fitur WebView DevTools pada build rilis produksi (`devtools: false`).
   - Izin IPC dikonfigurasi secara eksplisit pada ACL manifest Tauri (`src-tauri/capabilities/`).
2. **Penanganan Error Produksi:** Error teknis internal Rust disanitasi menjadi kode error terstruktur (`IpcError { code, message }`) sebelum dikirim ke antarmuka pengguna; stack trace internal tidak pernah diekspos ke UI.
3. **Penonaktifan Inbound Ports:** Konfigurasi jaringan lokal tidak membuka port HTTP/TCP listening apapun.

**Residual risk:** Konfigurasi permission file host yang salah diatur oleh pengguna Windows sendiri.

**Verification:**  
- Review file konfigurasi `tauri.conf.json` dan manifest kemampuan (`capabilities/main.json`).
- Verifikasi build produksi: memastikan shortcut F12 / DevTools tidak aktif.

---

### A06 — Vulnerable and Outdated Components

**Status:** ✅ Controlled

**Kontrol yang diterapkan:**
1. **Pemindaian Kerentanan Otomatis:**
   - Ekosistem Rust: `cargo audit` dijalankan pada setiap pipeline CI/CD untuk memvalidasi dependency terhadap basis data CVE RustSec.
   - Ekosistem Frontend: `npm audit` dijalankan untuk memverifikasi dependensi JavaScript.
2. **Kunci Versi Eksplisit (*Pinned Lockfiles*):** Seluruh rilis produksi diwajibkan menggunakan versi eksak yang terkunci pada `Cargo.lock` dan `package-lock.json`.
3. **Penyertaan Binary Terverifikasi:** Binary FFmpeg 6.0+ yang disertakan sebagai sidecar diverifikasi checksum SHA-256 resminya saat proses build packaging.

**Residual risk:** Zero-day vulnerability pada runtime WebView2 Windows bawaan OS.

**Verification:**  
- Eksekusi `cargo audit` menghasilkan 0 vulnerability ditemukan.
- Eksekusi `npm audit` menghasilkan 0 high/critical vulnerability.

---

### A07 — Identification and Authentication Failures

**Status:** ✅ Controlled

**Kontrol yang diterapkan:**
1. **Argon2id Hash Format:** Menggunakan string PHC standar untuk verifikasi kata sandi master tanpa membocorkan informasi panjang atau karakter asli.
2. **Timing-Safe Comparison:** Verifikasi hash kata sandi dan token menggunakan pembandingan waktu konstan (*constant-time comparison* via crate `subtle` atau bawaan `argon2::verify_password_hash`) untuk menggagalkan *timing attack*.
3. **Kebijakan Kompleksitas Master Password:** Panjang minimal 8 karakter tanpa batas atas artifisial selain batas buffer aman (128 karakter).
4. **Peniadaan Fitur Password Recovery:** Tidak ada celah *backdoor* pemulihan kata sandi (seperti pertanyaan keamanan yang rentan rekayasa sosial). Jika Master Password hilang, vault wajib di-reset total.

**Residual risk:** Kehilangan Master Password oleh Owner mengakibatkan data akun Google yang tersimpan tidak dapat dipulihkan (*design trade-off* untuk keamanan absolut).

**Verification:**  
- Unit test timing attack resistance pada verifikasi password.
- Test UI password complexity validator.

---

### A08 — Software and Data Integrity Failures

**Status:** ✅ Controlled

**Kontrol yang diterapkan:**
1. **Validasi Skema Masukan IPC & File:** Penggunaan `serde` dengan penegakan tipe data ketat pada deserialisasi file proyek `.flowproj` dan argumen IPC. Menolak auto-deserialization terhadap data arbitrary tak dikenal.
2. **Integritas Ciphertext Terotentikasi (AEAD):** AES-256-GCM memverifikasi authentication tag 128-bit pada setiap proses dekripsi. Setiap manipulasi bit pada file database lokal langsung terdeteksi dan ditolak.
3. **Pemberian Tanda Tangan Binary (*Code Signing*):** Binary installer rilis produksi untuk Windows ditandatangani menggunakan sertifikat Authenticode resmi guna menjamin integritas paket instalasi dari modifikasi perantara.

**Residual risk:** Kerusakan berkas basis data SQLite akibat crash daya perangkat keras tiba-tiba (dimitigasi oleh SQLite WAL mode).

**Verification:**  
- Test modifikasi ciphertext biner memicu kegagalan integritas otentikasi tag GCM (`AEAD_TAG_MISMATCH`).
- Uji verifikasi tanda tangan digital executable via `signtool.exe verify`.

---

### A09 — Security Logging and Monitoring Failures

**Status:** ✅ Controlled

**Kontrol yang diterapkan:**
1. **Logging Audit Terstruktur Lokal:** Seluruh kejadian keamanan krusial dicatat dalam format relasional terstruktur pada tabel `security_audit_log` di SQLite lokal (`src-tauri/src/db/audit.rs`).
2. **Penyaringan Data Sensitif Mutlak (Zero-PII Logging):** Master password, plaintext cookie, bearer token, dan detail kunci kriptografis diblokir secara mutlak dari pencatatan log. Email akun Google disamarkan (*masked*).
3. **Retensi Log Otomatis:** Pembersihan berkala otomatis (90 hari) menjaga integritas media penyimpanan dari penumpukan data log.

**Residual risk:** Log audit lokal dapat dihapus jika pengguna secara sengaja menghapus file database SQLite dari disk.

**Verification:**  
- Automated test `test_audit_log_emission` untuk setiap event jenis keamanan.
- Regex scanner terhadap isi log untuk membuktikan tidak ada pola cookie/token/password yang bocor.

---

### A10 — Server-Side Request Forgery (SSRF)

**Status:** ✅ Controlled

**Kontrol yang diterapkan:**
1. **Whitelist Domain Egress Mutlak:** Rust HTTP client (`reqwest`) hanya diizinkan menginisiasi koneksi HTTPS keluar ke domain resmi Google Flow:
   - `flow.google.com`
   - `accounts.google.com`
   - Subdomain API resmi Google yang telah didaftarkan dalam modul adapter network (`src-tauri/src/network/client.rs`).
2. **Pemblokiran Alamat IP Privat & Loopback Lokal:** Menolak request yang mengarah ke:
   - `127.0.0.0/8`, `::1` (Localhost)
   - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (Private Network)
   - `169.254.0.0/16` (Link-Local / APIPA)
3. **Pencegahan Open Redirect:** Klien HTTP Rust dikonfigurasi untuk tidak mengikuti pengalihan (*disable automatic redirect following*) atau memvalidasi ulang domain tujuan jika terjadi pengalihan HTTP 3xx.

**Residual risk:** None identified.

**Verification:**  
- Unit test `test_network_client_rejects_private_ips` dan `test_domain_whitelist_enforcement`.

---

## 19. Mitigasi Penyalahgunaan & Farming (Anti-Abuse & Anti-Farming Controls)

Evaluasi 8 (delapan) kontrol anti-abuse sesuai spesifikasi `PLANNING_v5.2.md` §11.10.C yang disesuaikan untuk konteks aplikasi desktop personal:

| Kontrol Anti-Abuse | Status Evaluasi | Justifikasi Teknis & Adaptasi untuk Flow Studio (Desktop Tool) |
|---|:---:|---|
| **1. Temp-Mail Domain Blocking** | **Tidak Relevan** | Flow Studio adalah aplikasi desktop personal tanpa fitur registrasi akun multi-tenant publik. Akun yang digunakan diimpor langsung oleh Owner menggunakan akun Google resmi yang telah ada. |
| **2. Registration Rate Limiting** | **Tidak Relevan** *(Diadaptasi)* | Tidak ada pendaftaran pengguna ke sistem Flow Studio. Namun, kontrol laju diterapkan pada level lokal berupa **Anti-Brute-Force Master Password** (maksimal 3 percobaan gagal memicu cooldown 30 detik). |
| **3. Captcha Mandate** | **Tidak Relevan** | Aplikasi desktop tidak menyediakan formulir publik berbasis web. Interaksi otentikasi dilindungi oleh verifikasi Master Password lokal dengan Argon2id. |
| **4. API Key Farming Prevention** | **Tidak Relevan** | Flow Studio tidak menerbitkan atau mengelola API Key publik untuk pihak ketiga. Akses ke upstream Google Flow menggunakan session cookie akun milik Owner sendiri. |
| **5. Bot Detection Evasion & Mitigation** | **Diterapkan** | Flow Router mengimplementasikan mitigasi pada lalu lintas keluar (*egress*) ke Google Flow: menambahkan penundaan acak (*human-like jitter* 2–5 detik antar request), menyematkan header browser modern yang konsisten, dan membatasi konkurensi (1 generasi aktif per akun). |
| **6. Concurrent Abuse Detection** | **Diterapkan** | Orkestrator eksekusi membatasi maksimal 1 task aktif per akun Google secara serial guna mencegah deteksi login simultan abnormal dari Google yang dapat memicu penangguhan akun. |
| **7. Proxy / VPN / TOR IP Handling** | **Diterapkan** | Menolak penggunaan exit-node TOR publik untuk menghindari blokir reputasi IP instan oleh WAF Google. Menyediakan konfigurasi proxy HTTP/SOCKS5 lokal opsional bagi Owner yang membutuhkan per-account network route terpisah secara higienis. |
| **8. Device Fingerprint Consistency** | **Diterapkan** | Header peramban yang dikirim oleh backend Rust (`User-Agent`, `Sec-Ch-Ua`, `Sec-Ch-Ua-Platform`, `Accept-Language`) disinkronkan agar selalu konsisten dan identik dengan peramban Google Chrome standar pada Windows 10/11 x64. |

---

## 20. Kesadaran Indikator Kompromi (IOC Awareness)

Untuk mendeteksi potensi intrusi atau anomali pada lingkungan eksekusi host, Flow Studio menyelaraskan kontrol deteksi dengan katalog intelijen ancaman (*threat intelligence catalog*) berbasis **[mthcht/awesome-lists](https://github.com/mthcht/awesome-lists)**:

### 20.1 Pemantauan Port Mencurigakan (*Suspicious Port Awareness*)
- **Kebijakan Port Aplikasi:** Flow Studio menganut arsitektur **Zero Inbound Listening Ports**. Aplikasi sama sekali tidak membuka port jaringan TCP/UDP lokal pada sistem operasi.
- **Deteksi Port Malware / C2:** Modul audit jaringan backend Rust memverifikasi bahwa konfigurasi proxy atau koneksi keluar tidak diarahkan ke port yang diidentifikasi sebagai port default malware/C2 (merujuk pada `suspicious_ports_list.csv`):
  
  | Port Mencurigakan | Asosiasi Ancaman / Malware Signature | Status Kebijakan di Flow Studio |
  |---|---|---|
  | `1080` | SOCKS proxy / Ligolo C2 | Dilarang tanpa justifikasi konfigurasi proxy manual eksplisit. |
  | `1337` | Empire C2, CrackMapExec, KittyStager | Diblokir secara default pada input konfigurasi proxy. |
  | `4444` / `4445` | Metasploit default C2 listener | Diblokir secara default. |
  | `5555` | Android ADB Remote Exploit / RAT backdoor | Diblokir secara default. |
  | `9001` / `9050` | TOR default ORPort / TOR SOCKS proxy | Diblokir pada koneksi otomatis untuk mencegah IP flagging. |
  | `31337` | Back Orifice / Elite hacker backdoor | Diblokir secara default. |
  | `65535` | Max port backdoor listener | Diblokir secara default. |

### 20.2 Pengawasan User-Agent (*User-Agent Hygiene & Monitoring*)
- **Outbound Egress Mimicry:** Setiap permintaan HTTP keluar yang diinisiasi oleh klien Rust wajib menyematkan string User-Agent browser Chrome Windows resmi terkini:  
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36`
- **Pencegahan Header Terlarang:** Sistem memblokir penggunaan string User-Agent default pustaka atau tool ofensif (merujuk pada `suspicious_http_user_agents_list.csv`):
  - Dilarang menggunakan default UA: `reqwest/*`, `python-requests/*`, `curl/*`, `Go-http-client/*`, `undici/*`.
  - Dilarang menggunakan signature scanner: `sqlmap*`, `nikto*`, `dirbuster*`, `TruffleHog*`, `*katz*`.

### 20.3 Pemblokiran Ekstensi File Ransomware (*Ransomware Extension Blocklist*)
Pada seluruh penangan input berkas (dialog import cookie, pembukaan file `.flowproj`, pemuatan gambar referensi, dan folder output video), sistem memvalidasi nama file terhadap blocklist ekstensi ransomware (merujuk pada `ransomware_extensions_list.csv`):

```rust
// src-tauri/src/security/file_guard.rs
pub const BLOCKED_RANSOMWARE_EXTENSIONS: &[&str] = &[
    ".encrypted", ".locked", ".crypto", ".crypt", ".enc",
    ".locky", ".zepto", ".cerber", ".dharma", ".ryuk",
    ".maze", ".phobos", ".revil", ".conti", ".lockbit",
    ".GoldenEye", ".Lazarus", ".DIABLO6", ".jackpot", ".0day",
    ".BitCryptor", ".wnry", ".wcry"
];
```

- **Validasi Ganda (Magic Bytes):** Selain pengecekan ekstensi nama berkas, backend memvalidasi *file signature* (magic bytes) berkas media:
  - Berkas MP4: Wajib memiliki magic bytes header ISO Base Media (`ftyp` pada offset 4).
  - Berkas PNG: Wajib diawali `\x89PNG\r\n\x1a\n` (`89 50 4E 47 0D 0A 1A 0A`).
  - Berkas JPEG: Wajib diawali `\xFF\xD8\xFF`.

---

## 21. Matriks Ketertelusuran Persyaratan Keamanan (Security Traceability Matrix)

| Kode Kontrol Keamanan | Deskripsi Kontrol | Sumber Persyaratan | File / Modul Implementasi | Uji Verifikasi |
|---|---|---|---|---|
| `SEC-VBA-001` | State Machine Vault & Lockout Cooldown | SRS FR-040, DOC-PERM-001 | `src-tauri/src/crypto/vault.rs` | `TEST-SEC-010`, `TEST-SEC-040` |
| `SEC-KDF-001` | Derivasi Kunci Argon2id (64MB, t=3) | SRS FR-041, DOC-ERD-001 | `src-tauri/src/crypto/kdf.rs` | `TEST-SEC-001`, `TEST-SEC-041` |
| `SEC-ENC-001` | Enkripsi AEAD AES-256-GCM At-Rest | SRS FR-041, DOC-ERD-001 | `src-tauri/src/crypto/cipher.rs` | `TEST-SEC-002`, `TEST-SEC-041` |
| `SEC-MEM-001` | Pembersihan Memori Volatile (`zeroize`) | SRS NFR-004, DOC-PERM-001 | `src-tauri/src/crypto/types.rs` | `TEST-SEC-003`, `TEST-SEC-042` |
| `SEC-TIM-001` | Auto-Lock Watchdog Inaktivitas 15m | SRS FR-042, DOC-PERM-001 | `src-tauri/src/services/watchdog.rs` | `TEST-SEC-011`, `TEST-SEC-042` |
| `SEC-INP-001` | Kanonikalisasi Path & Anti-Traversal | SRS NFR-007, DOC-PERM-001 | `src-tauri/src/utils/path_guard.rs` | `TEST-SEC-020` |
| `SEC-NET-001` | Enforce TLS 1.3 & Egress Domain Allowlist | SRS NFR-004, API.md §9.2 | `src-tauri/src/network/client.rs` | `TEST-SEC-030` |
| `SEC-IOC-001` | Blocklist Ekstensi Ransomware & Magic Bytes | DOC-SEC-001 §20.3 | `src-tauri/src/security/file_guard.rs` | `TEST-SEC-021` |
| `SEC-AUD-001` | Audit Logging Keamanan Relasional Lokal | DOC-PERM-001 §10, ERD.md | `src-tauri/src/db/audit.rs` | `TEST-SEC-009` |

---

*— Dokumen ini merupakan spesifikasi keamanan otoritatif untuk Flow Studio (DOC-SEC-001). Setiap modifikasi pada skema enkripsi, otorisasi IPC, atau arsitektur penyimpanan kredensial wajib memperbarui dokumen ini terlebih dahulu.*
