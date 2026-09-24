# ENVIRONMENT.md: Flow Studio — Configuration, Environment & Service Setup

> **Project:** Flow Studio  
> **Document ID:** DOC-ENV-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-ARCH-001  
> **Supersedes:** None  

---

## 1. Pendahuluan & Lingkup Dokumen

Dokumen ini mendefinisikan seluruh spesifikasi konfigurasi lingkungan pengembang (*development environment*), dependensi sistem operasi tingkat rendah (*host system prerequisites*), variabel lingkungan (*environment variables*), integrasi layanan eksternal, tata letak penyimpanan data lokal, strategi distribusi biner pihak ketiga (*FFmpeg bundling*), hingga tata kelola pengujian dan keamanan kredensial untuk **Flow Studio**.

Flow Studio adalah aplikasi desktop personal (*single-user creative workstation*) berkinerja tinggi yang dibangun di atas fondasi **Tauri 2.x** (backend Rust native) dan **React 19** (frontend WebView2). Aplikasi ini dirancang untuk berjalan pada sistem operasi **Windows 10/11 x64** guna mengorkestrasi pembuatan video koheren berdurasi panjang melalui platform generatif Google Flow (`flow.google.com`).

### 1.1 Prinsip Desain Konfigurasi Lingkungan
1. **Zero Secret Persistence on Environment Files:** Berkas konfigurasi (`.env`, `.env.example`, konfigurasi runtime) dilarang keras menyimpan kredensial otentikasi rahasia (*zero plaintext secrets*), seperti token akses, cookie sesi, atau master password. Seluruh rahasia dikelola secara eksklusif oleh brankas kriptografi lokal (*local cryptographic vault*).
2. **Fail-Fast Configuration Validation:** Aplikasi menerapkan validasi konfigurasi ketat saat proses *cold start*. Jika variabel lingkungan kritis tidak valid, direktori basis data tidak memiliki izin tulis, atau biner pendukung tidak terdeteksi, aplikasi wajib menghentikan eksekusi seketika (*fail-fast*) dengan pesan kesalahan terstruktur yang dapat ditindaklanjuti.
3. **Local-First & Zero Inbound Ports:** Konfigurasi lingkungan aplikasi beroperasi dalam paradigma *zero listening ports*. Tidak ada server HTTP lokal, socket daemon, atau port inbound yang dibuka pada workstation pengguna. Seluruh koneksi eksternal adalah *outbound HTTPS* murni ke endpoint resmi Google.
4. **Reproducible Development Setup:** Seluruh prasyarat dan tahapan penyiapan dari mesin bersih (*clean machine*) didokumentasikan secara deterministik menggunakan manajer paket standar Windows (winget/choco), Rustup, dan pnpm.

---

## 2. Prasyarat Sistem & Dependensi Host (System Prerequisites)

Untuk mengompilasi biner native Rust, menjalankan engine WebView2, memproses rendering antarmuka React, serta mengeksekusi manipulasi video frame-akurat, mesin host pengembang maupun pengguna akhir wajib memenuhi spesifikasi prasyarat berikut.

### 2.1 Spesifikasi Sistem Operasi & Perangkat Keras
- **Sistem Operasi:** Microsoft Windows 10 x64 (Versi 2004 / Build 19041 atau lebih baru) atau Windows 11 x64 (Build 22000+). Arsitektur ARM64 didukung hanya melalui emulasi x64, namun target rilis resmi Tier-1 adalah `x86_64-pc-windows-msvc`.
- **Prosesor (CPU):** Minimum Intel Core i5 Generasi ke-8 / AMD Ryzen 5 2000 series (4 core, 8 thread, kecepatan clock $\ge 2.5\text{ GHz}$). Direkomendasikan 8 core atau lebih untuk mempercepat siklus kompilasi Rust dan eksekusi encoding FFmpeg.
- **Memori Akses Acak (RAM):** Minimum 8 GB RAM fisik (alokasi memori untuk WebView2, kompilasi Rust, dan komputasi KDF Argon2id). Direkomendasikan 16 GB atau 32 GB untuk pengembang.
- **Penyimpanan Bebas (Disk Space):** Minimum 15 GB ruang disk kosong pada partisi sistem (C:) untuk instalasi Visual Studio Build Tools, LLVM, Rust toolchain, dan WebView2; serta minimum 5 GB ruang disk bebas pada partisi kerja untuk caching video dan basis data.

### 2.2 Rincian Dependensi Toolchain & Runtime

| Komponen Toolchain | Versi Minimum | Versi Disarankan | Tujuan & Justifikasi Teknis |
|---|---|---|---|
| **Rust Toolchain** | `1.80.0` | `1.81.0+` (stable) | Kompilasi backend native Tauri 2.x, modul kriptografi (Argon2id, AES-256-GCM), dan abstraction layer SQLite (`rusqlite`). Wajib menggunakan target `x86_64-pc-windows-msvc`. |
| **Node.js Runtime** | `22.0.0 LTS` | `22.12.0 LTS` | Runtime JavaScript untuk menjalankan bundler Vite, tooling TypeScript, dan instalasi dependensi antarmuka pengguna. |
| **pnpm** | `9.0.0` | `9.15.0+` | Package manager modern berbasis hard-link/symlink dengan efisiensi disk tinggi dan resolusi dependensi deterministik (`pnpm-lock.yaml`). |
| **Visual Studio Build Tools** | `2022 (v17.x)` | `2022 Latest` | Menyediakan C++ MSVC compiler (`cl.exe`), Windows 10/11 SDK, dan linker native Windows yang mutlak dibutuhkan oleh rustc untuk target MSVC. |
| **Microsoft Edge WebView2** | `120.0.0+` | Evergreen Latest | Mesin perender antarmuka pengguna berbasis Chromium yang terisolasi (*app shell*). Terpasang secara default pada Windows 10/11 mutakhir. |
| **FFmpeg Suite** | `6.0` | `6.1.1` / `7.0+` | Subproses terisolasi untuk ekstraksi *last-frame* resolusi tinggi (`-sseof -1 -frames:v 1`) dan *lossless concatenation* klip video via concat demuxer. Biner mencakup `ffmpeg.exe` dan `ffprobe.exe`. |

### 2.3 Matriks Audit Perintah Verifikasi Prerequisites

Pengembang dapat memverifikasi kesiapan seluruh dependensi host melalui PowerShell (Administrator) menggunakan perintah di bawah:

```powershell
# 1. Verifikasi Versi Windows
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, OSArchitecture

# 2. Verifikasi Rust Toolchain (wajib target x86_64-pc-windows-msvc)
rustc --version
cargo --version
rustup target list --installed | Select-String "x86_64-pc-windows-msvc"

# 3. Verifikasi Node.js dan pnpm
node --version
pnpm --version

# 4. Verifikasi Keberadaan MSVC Linker dan C++ Compiler
where.exe cl.exe
where.exe link.exe

# 5. Verifikasi Instalasi WebView2 Runtime
Get-ItemProperty -Path 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-9E47-4475-B0A1-6876AC3E34C4}' -ErrorAction SilentlyContinue | Select-Object pv

# 6. Verifikasi FFmpeg Binary
ffmpeg -version
ffprobe -version
```

---

## 3. Konfigurasi Lokal & Spesifikasi Environment Variables

Konfigurasi aplikasi Flow Studio dibagi menjadi dua kategori: konfigurasi waktu kompilasi (*build-time flags*) dan konfigurasi waktu jalan (*runtime configuration flags*). Konfigurasi ini dimuat melalui berkas `.env` pada lingkungan pengembangan lokal dan di-fallback ke nilai *hardened default* pada lingkungan produksi.

### 3.1 Berkas `.env.example`

Berkas `.env.example` berikut adalah referensi baku yang harus disalin menjadi `.env` pada direktori root repositori sebelum menjalankan aplikasi. **Dilarang memasukkan rahasia, cookie, atau password ke dalam berkas ini.**

```ini
# ==============================================================================
# FLOW STUDIO ENVIRONMENT CONFIGURATION TEMPLATE (.env.example)
# Document ID: DOC-ENV-001 | Version: 1.0.0
# Peringatan: JANGAN MENYIMPAN KREDENSIAL ATAU RAHASIH DALAM BERKAS INI!
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Application Runtime Flags
# ------------------------------------------------------------------------------
# Menentukan mode eksekusi aplikasi (true = Development, false = Production)
FLOW_STUDIO_DEV_MODE=true

# Tingkat verbositas logging sistem (TRACE | DEBUG | INFO | WARN | ERROR)
FLOW_STUDIO_LOG_LEVEL=DEBUG

# ------------------------------------------------------------------------------
# 2. Storage & Filesystem Overrides (Opsional - Kosongkan untuk lokasi default)
# ------------------------------------------------------------------------------
# Override lokasi basis data SQLite. Default: %APPDATA%\FlowStudio\flow_studio.db
FLOW_STUDIO_DB_PATH=

# Override direktori penyimpanan berkas log. Default: %APPDATA%\FlowStudio\logs
FLOW_STUDIO_LOG_DIR=

# Override direktori buffer staging sementara. Default: %APPDATA%\FlowStudio\temp
FLOW_STUDIO_TEMP_DIR=

# ------------------------------------------------------------------------------
# 3. Subprocess Binary Resolution Overrides (Opsional)
# ------------------------------------------------------------------------------
# Override lokasi absolut biner ffmpeg.exe (jika tidak menggunakan sidecar bundled)
FLOW_STUDIO_FFMPEG_PATH=

# Override lokasi absolut biner ffprobe.exe
FLOW_STUDIO_FFPROBE_PATH=

# ------------------------------------------------------------------------------
# 4. Networking & Telemetry Restraints
# ------------------------------------------------------------------------------
# Batas waktu timeout request HTTP ke Google Flow dalam detik (Default: 60)
FLOW_STUDIO_HTTP_TIMEOUT_SECS=60

# Maksimum pengulangan otomatis request inferensi yang gagal (Default: 3)
FLOW_STUDIO_HTTP_MAX_RETRIES=3

# User-Agent header khusus untuk penyamaran peramban Chromium desktop
FLOW_STUDIO_USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

# ------------------------------------------------------------------------------
# 5. Frontend & Bundler Build Configuration (Vite)
# ------------------------------------------------------------------------------
# Host interface untuk dev server Vite (Wajib 127.0.0.1 untuk mencegah eksposur LAN)
VITE_DEV_SERVER_HOST=127.0.0.1

# Port internal untuk dev server Vite
VITE_DEV_SERVER_PORT=1420

# Flag pengaktifan React Strict Mode dan Redux/Zustand devtools inspection
VITE_ENABLE_DEVTOOLS=true
```

### 3.2 Kamus Variabel Lingkungan (Environment Variables Dictionary)

Tabel berikut menyajikan spesifikasi semantik, tipe data, nilai default, dan status keharusan setiap variabel:

| Nama Variabel | Tipe Data | Status | Nilai Default | Lingkungan | Deskripsi Fungsional & Batasan |
|---|---|---|---|---|---|
| `FLOW_STUDIO_DEV_MODE` | Boolean | Opsional | `false` | Dev, Staging | Mengaktifkan menu Developer Tools pada WebView2, logging payload IPC lokal, dan bypass mock router bila diperlukan. Wajib `false` pada Production rilis. |
| `FLOW_STUDIO_LOG_LEVEL` | String Enum | Opsional | `INFO` (Prod) / `DEBUG` (Dev) | All | Mengatur ambang batas minimum pencatatan log pada crate `tracing-subscriber`. Nilai yang valid: `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`. |
| `FLOW_STUDIO_DB_PATH` | File Path | Opsional | `%APPDATA%\FlowStudio\flow_studio.db` | Dev, Test | Menimpa lokasi berkas basis data SQLite. Berguna pada pengujian integrasi paralel agar tidak memodifikasi data riil pengembang. |
| `FLOW_STUDIO_LOG_DIR` | Directory Path | Opsional | `%APPDATA%\FlowStudio\logs` | Dev, Test | Menimpa folder tujuan penulisan rolling log harian. |
| `FLOW_STUDIO_TEMP_DIR` | Directory Path | Opsional | `%APPDATA%\FlowStudio\temp` | All | Menimpa folder staging pembuatan frame gambar dan berkas demuxer sementara. |
| `FLOW_STUDIO_FFMPEG_PATH` | File Path | Opsional | Resolusi Sidecar | Dev, Test | Menentukan path absolut menuju executable `ffmpeg.exe` pihak ketiga untuk pengujian versi FFmpeg spesifik di luar paket bawaan. |
| `FLOW_STUDIO_FFPROBE_PATH` | File Path | Opsional | Resolusi Sidecar | Dev, Test | Menentukan path absolut menuju executable `ffprobe.exe` untuk pengujian ekstraksi metadata video. |
| `FLOW_STUDIO_HTTP_TIMEOUT_SECS` | Integer | Opsional | `60` | All | Ambang batas maksimal koneksi dan pembacaan stream chunk HTTP sebelum koneksi dianggap timeout (satuan detik). Minimum `15`, maksimum `300`. |
| `FLOW_STUDIO_HTTP_MAX_RETRIES` | Integer | Opsional | `3` | All | Jumlah batas percobaan ulang otomatis dengan mekanisme *exponential backoff* jika Google Flow mengembalikan kode error 429 atau 503. |
| `FLOW_STUDIO_USER_AGENT` | String | Opsional | Chromium 130 Win64 | All | String header `User-Agent` yang dikirimkan oleh `reqwest` HTTP client saat memanggil endpoint reverse-engineered Google Flow. |
| `VITE_DEV_SERVER_HOST` | IPv4 Address | Opsional | `127.0.0.1` | Dev | Antarmuka jaringan untuk server Vite. Terikat ketat pada loopback IP untuk mematuhi aturan *Zero Inbound Ports*. |
| `VITE_DEV_SERVER_PORT` | Integer | Opsional | `1420` | Dev | Port TCP lokal yang digunakan Vite dev server saat mode pengembangan aktif. |
| `VITE_ENABLE_DEVTOOLS` | Boolean | Opsional | `false` | Dev | Mengaktifkan inspektur state visual pada kanvas node React dan debugging inspector. |

### 3.3 Validasi Konfigurasi & Mekanisme Fail-Fast

Aplikasi Flow Studio menerapkan prinsip **Fail-Fast** murni pada tahap inisialisasi awal (*cold start boot sequence*). Pengecekan ini dienkapsulasi dalam Rust sebelum jendela antarmuka WebView2 dirender ke layar.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                FLOW STUDIO COLD-START FAIL-FAST PIPELINE                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                        [1. Load Environment & .env]
                                      │
                                      ▼
             [2. Validate FLOW_STUDIO_LOG_LEVEL & Enums]
                                      │
                         (Invalid enum? Exit code 101)
                                      ▼
             [3. Resolve & Verify %APPDATA% Permissions]
                                      │
                     (Cannot write folder? Exit code 102)
                                      ▼
             [4. Pre-Flight Storage Check (Free Space >= 2GB)]
                                      │
                        (Disk < 2GB? Exit code 103)
                                      ▼
             [5. Probe FFmpeg Binary & Parse Semantic Version]
                                      │
                     (FFmpeg < 6.0 / Missing? Exit code 104)
                                      ▼
             [6. Verify WebView2 Runtime Evergreen Installation]
                                      │
                      (WebView2 missing? Exit code 105)
                                      ▼
             [7. Initialize SQLite Connection & Run Pragmas]
                                      │
                     (Corrupt / Locked DB? Exit code 106)
                                      ▼
                 [Boot Sequence Passed: Launch Tauri Window]
```

### 3.4 Implementasi Skema Validasi Rust (Production-Grade)

Kode Rust di bawah mengilustrasikan modul validasi konfigurasi startup tanpa stub dan tanpa bypass kesalahan:

```rust
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn from_env(val: &str) -> Result<Self, String> {
        match val.to_uppercase().as_str() {
            "TRACE" => Ok(Self::Trace),
            "DEBUG" => Ok(Self::Debug),
            "INFO" => Ok(Self::Info),
            "WARN" => Ok(Self::Warn),
            "ERROR" => Ok(Self::Error),
            other => Err(format!(
                "Invalid FLOW_STUDIO_LOG_LEVEL: '{}'. Allowed: TRACE, DEBUG, INFO, WARN, ERROR",
                other
            )),
        }
    }
}

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub is_dev_mode: bool,
    pub log_level: LogLevel,
    pub db_path: PathBuf,
    pub log_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub ffmpeg_path: PathBuf,
    pub http_timeout_secs: u64,
    pub http_max_retries: u32,
    pub user_agent: String,
}

impl AppConfig {
    pub fn load_and_validate() -> Result<Self, String> {
        let is_dev_mode = std::env::var("FLOW_STUDIO_DEV_MODE")
            .unwrap_or_else(|_| "false".to_string())
            .parse::<bool>()
            .map_err(|_| "FLOW_STUDIO_DEV_MODE must be a valid boolean (true/false)".to_string())?;

        let log_level_str = std::env::var("FLOW_STUDIO_LOG_LEVEL")
            .unwrap_or_else(|_| if is_dev_mode { "DEBUG" } else { "INFO" }.to_string());
        let log_level = LogLevel::from_env(&log_level_str)?;

        let app_data_base = dirs::data_dir()
            .ok_or_else(|| "Failed to resolve Windows %APPDATA% directory".to_string())?
            .join("FlowStudio");

        let db_path = std::env::var("FLOW_STUDIO_DB_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| app_data_base.join("flow_studio.db"));

        let log_dir = std::env::var("FLOW_STUDIO_LOG_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| app_data_base.join("logs"));

        let temp_dir = std::env::var("FLOW_STUDIO_TEMP_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| app_data_base.join("temp"));

        Self::ensure_writable_directory(&app_data_base)?;
        Self::ensure_writable_directory(&log_dir)?;
        Self::ensure_writable_directory(&temp_dir)?;

        let ffmpeg_path = Self::resolve_and_validate_ffmpeg()?;

        let http_timeout_secs = std::env::var("FLOW_STUDIO_HTTP_TIMEOUT_SECS")
            .unwrap_or_else(|_| "60".to_string())
            .parse::<u64>()
            .map_err(|_| "FLOW_STUDIO_HTTP_TIMEOUT_SECS must be an unsigned integer".to_string())?;

        if !(15..=300).contains(&http_timeout_secs) {
            return Err("FLOW_STUDIO_HTTP_TIMEOUT_SECS must be between 15 and 300 seconds".to_string());
        }

        let http_max_retries = std::env::var("FLOW_STUDIO_HTTP_MAX_RETRIES")
            .unwrap_or_else(|_| "3".to_string())
            .parse::<u32>()
            .map_err(|_| "FLOW_STUDIO_HTTP_MAX_RETRIES must be an unsigned integer".to_string())?;

        let user_agent = std::env::var("FLOW_STUDIO_USER_AGENT").unwrap_or_else(|_| {
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36".to_string()
        });

        Ok(Self {
            is_dev_mode,
            log_level,
            db_path,
            log_dir,
            temp_dir,
            ffmpeg_path,
            http_timeout_secs,
            http_max_retries,
            user_agent,
        })
    }

    fn ensure_writable_directory(dir: &Path) -> Result<(), String> {
        std::fs::create_dir_all(dir).map_err(|err| {
            format!("Cannot create application directory '{:?}': {}", dir, err)
        })?;

        let test_file = dir.join(".write_test");
        std::fs::write(&test_file, b"ok").map_err(|err| {
            format!("Directory '{:?}' is not writable: {}", dir, err)
        })?;
        let _ = std::fs::remove_file(&test_file);
        Ok(())
    }

    fn resolve_and_validate_ffmpeg() -> Result<PathBuf, String> {
        let binary_path = if let Ok(custom_path) = std::env::var("FLOW_STUDIO_FFMPEG_PATH") {
            PathBuf::from(custom_path)
        } else {
            let current_exe = std::env::current_exe()
                .map_err(|e| format!("Failed to get current executable path: {}", e))?;
            let exe_dir = current_exe
                .parent()
                .ok_or_else(|| "Failed to resolve executable directory".to_string())?;
            
            let sidecar_path = exe_dir.join("ffmpeg.exe");
            if sidecar_path.is_file() {
                sidecar_path
            } else {
                PathBuf::from("ffmpeg.exe")
            }
        };

        let output = Command::new(&binary_path)
            .arg("-version")
            .output()
            .map_err(|err| {
                format!(
                    "FFmpeg binary verification failed for '{:?}': {}. Ensure FFmpeg 6.0+ is installed.",
                    binary_path, err
                )
            })?;

        if !output.status.success() {
            return Err(format!(
                "FFmpeg binary at '{:?}' returned exit code {:?}",
                binary_path,
                output.status.code()
            ));
        }

        let version_str = String::from_utf8_lossy(&output.stdout);
        if !version_str.contains("ffmpeg version") {
            return Err("Binary at resolved path is not a valid FFmpeg executable".to_string());
        }

        Ok(binary_path)
    }
}
```

---

## 4. Dependensi Layanan Pihak Ketiga (Third-Party Service Dependencies)

Flow Studio dirancang secara spesifik untuk memangkas ketergantungan pada SaaS pihak ketiga milik pengembang (*zero intermediary infrastructure*). Layanan komputasi eksternal tunggal yang digunakan adalah **Google Flow**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      THIRD-PARTY SERVICE TOPOLOGY                           │
└─────────────────────────────────────────────────────────────────────────────┘

 [Flow Studio Desktop Workstation]
       │
       │ Direct Outbound HTTPS (TLS 1.3 / Port 443)
       │ Authentication: Session Cookie Injection (AES-256-GCM Decrypted in RAM)
       ▼
 [Google Flow Remote Infrastructure]
       ├── flow.google.com                 (Web Platform Frontend)
       ├── aisandbox-pa.googleapis.com     (Video Generation API)
       └── storage.googleapis.com          (Rendered MP4 Artifact Distribution)
```

### 4.1 Rincian Layanan Eksternal

| Atribut Layanan | Deskripsi Spesifikasi |
|---|---|
| **Nama Layanan** | Google Flow (Veo / VideoFX Platform) |
| **Domain Resmi** | `flow.google.com`, `aisandbox-pa.googleapis.com` |
| **Tujuan & Kegunaan** | Menjalankan inferensi generative AI video dari prompt teks dan frame gambar referensi berdurasi ~10 detik per klip segmen. |
| **Skema Autentikasi** | **Cookie Sesi Terimpor (Imported Session Cookies)** — Tanpa API Key berbayar eksternal. |
| **Penyedia Kredensial** | Pengguna (*Owner*) mengimpor sesi akun Google aktif mereka sendiri melalui browser login bawaan WebView2 atau impor file JSON sesi. |
| **Biaya & Kuota** | Memanfaatkan kuota kredit bawaan masing-masing akun Google (Free Tier atau Google One / AI Premium Tier). |
| **Protokol Egress** | HTTPS / TLS 1.3 via port standar 443 outbound murni. |
| **Batas Serangan Jaringan** | **Zero Inbound Ports.** Tidak ada webhook penerima data balik; status inferensi didapatkan secara deterministik melalui *polling* HTTPS berkala. |

### 4.2 Struktur & Karakteristik Cookie Otentikasi Google

Otentikasi terhadap upstream Google Flow tidak menggunakan Bearer Token statis melainkan memerlukan kumpulan cookie sesi terenkripsi berikut:

1. `__Secure-1PSID` & `__Secure-3PSID`: Identifier sesi otentikasi akun Google utama (kategori *Restricted*).
2. `SAPISID` & `APISID`: Digunakan oleh client Rust untuk menghitung signature header otorisasi SHA-1 `SAPISIDHASH` secara deterministik pada setiap request RPC Google.
3. `HSID`, `SSID`, `SID`: Cookie pendukung validasi handshake sesi internal Google.
4. `__Secure-1PSIDTS` / `__Secure-3PSIDTS`: Token stempel waktu keamanan sesi yang dirotasi secara otomatis oleh Google.

> 🔒 **Peraturan Keamanan Mutlak (Non-Negotiable):**  
> Seluruh nilai string cookie di atas **dilarang keras** ditulis dalam bentuk plaintext pada file disk, file konfigurasi `.env`, atau tabel SQLite terbuka. Sesuai mandat `DOC-SEC-001`, seluruh cookie dienkripsi menggunakan AES-256-GCM saat disimpan ke dalam tabel `accounts` dan hanya didekripsi ke RAM sementara saat request HTTP sedang dirakit.

---

## 5. Panduan Instalasi Lokal Langkah demi Langkah (Local Setup Checklist)

Panduan ini mendokumentasikan prosedur penyiapan dari komputer Windows yang benar-benar bersih (*clean machine*) hingga aplikasi Flow Studio berhasil berjalan dalam mode pengembangan lokal (*hot-reload development environment*).

### 5.1 Fase A: Penyiapan Host Windows & Build Tooling (Clean Machine)

Jalankan terminal **PowerShell** dengan hak akses **Administrator**:

```powershell
# 1. Instalasi Visual Studio 2022 C++ Build Tools dan Windows 10/11 SDK via winget
winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--passive --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.22621"

# 2. Instalasi Node.js 22 LTS via winget
winget install --id OpenJS.NodeJS.LTS

# 3. Instalasi Rustup (Rust Toolchain Installer) via winget
winget install --id Rustlang.Rustup

# 4. Instalasi Git for Windows
winget install --id Git.Git

# 5. Instalasi FFmpeg 6.0+ Static Release via winget
winget install --id Gyan.FFmpeg

# 6. Muat ulang Environment Variables pada sesi terminal aktif
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

Konfigurasikan toolchain Rust melalui terminal standar (Non-Administrator):

```bash
# Set default toolchain ke stable target MSVC x86_64
rustup default stable-x86_64-pc-windows-msvc
rustup target add x86_64-pc-windows-msvc

# Aktifkan Corepack dan pasang pnpm versi 9
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

### 5.2 Fase B: Kloning Repositori & Instalasi Dependensi Frontend

```bash
# 1. Klon repositori proyek Flow Studio
git clone https://github.com/your-org/flow-studio.git
cd flow-studio

# 2. Salin template environment ke berkas .env lokal
cp .env.example .env

# 3. Instal dependensi frontend React 19 dan Vite menggunakan pnpm
pnpm install --frozen-lockfile
```

### 5.3 Fase C: Penyiapan FFmpeg Development Binary & Placement

Tauri 2.x memerlukan biner eksternal (*sidecar*) dengan format nama target arsitektur khusus pada folder `src-tauri/binaries/` untuk proses packaging otomatis, atau ketersediaan biner pada direktori eksekusi pengembang.

```powershell
# Buat direktori target binaries di dalam src-tauri
New-Item -ItemType Directory -Force -Path "src-tauri\binaries"

# Salin ffmpeg.exe dan ffprobe.exe dari instalasi host ke folder sidecar Tauri
# Format penamaan sidecar Tauri 2.x untuk target x86_64-pc-windows-msvc:
$TARGET_TRIPLE = "x86_64-pc-windows-msvc"
Copy-Item (Get-Command ffmpeg.exe).Source "src-tauri\binaries\ffmpeg-$TARGET_TRIPLE.exe"
Copy-Item (Get-Command ffprobe.exe).Source "src-tauri\binaries\ffprobe-$TARGET_TRIPLE.exe"

# Verifikasi keberadaan berkas sidecar
Get-ChildItem "src-tauri\binaries"
```

### 5.4 Fase D: Kompilasi Backend & Validasi Rust Toolchain

Uji kompilasi kode native Rust backend secara independen sebelum menjalankan UI:

```bash
# Masuk ke direktori backend Tauri
cd src-tauri

# Validasi linting dan aturan tipe data Rust
cargo clippy --all-targets -- -D warnings

# Jalankan pengujian unit lokal untuk modul vault KDF dan state router
cargo test

# Kembali ke root direktori
cd ..
```

### 5.5 Fase E: Menjalankan Aplikasi dalam Mode Pengembang (`tauri dev`)

Jalankan perintah pengembang utama dari root repositori:

```bash
pnpm tauri dev
```

Saat perintah ini dieksekusi:
1. Server Vite lokal dimulai pada `http://127.0.0.1:1420`.
2. Cargo mengompilasi biner Rust dalam mode debug (`target/debug/flow-studio.exe`).
3. Jendela desktop WebView2 terbuka otomatis menampilkan antarmuka Flow Studio.
4. Hot Module Replacement (HMR) aktif untuk modifikasi kode React / Tailwind CSS.

### 5.6 Fase F: Checklist Verifikasi Kesiapan Operasional (Health Check)

Setelah jendela aplikasi terbuka, lakukan verifikasi mandiri berikut:

- [ ] Jendela antarmuka Flow Studio tampil dengan tema gelap (Dark Theme) tanpa distorsi rendering.
- [ ] Console Developer Tools (F12) tidak menampilkan error JavaScript fatal atau unhandled promise rejections.
- [ ] Berkas database lokal terbuat secara otomatis di `%APPDATA%\FlowStudio\flow_studio.db` beserta berkas `-wal` dan `-shm`.
- [ ] Berkas log harian muncul di direktori `%APPDATA%\FlowStudio\logs\flow_studio-YYYY-MM-DD.log`.
- [ ] Eksekusi verifikasi FFmpeg pada health-check baris status backend berstatus `READY (FFmpeg 6.x Detected)`.
- [ ] Brankas menampilkan form inisialisasi Master Password awal (`UNINITIALIZED` state).

---

## 6. Topologi Direktori & Manajemen Penyimpanan Data (%APPDATA%/FlowStudio/)

Flow Studio mematuhi standar arsitektur Windows Desktop Application dengan memisahkan penyimpanan konfigurasi global aplikasi (*application state*) dari direktori berkas kerja proyek pengguna (*creative project workspace*).

```
%APPDATA%/FlowStudio/                             <-- Application Data Root (User Isolation)
├── flow_studio.db                                <-- SQLite Database Utama (User Accounts, Telemetry, Cache)
├── flow_studio.db-wal                            <-- SQLite Write-Ahead Log (High Concurrency)
├── flow_studio.db-shm                            <-- SQLite Shared Memory Index
├── logs/                                         <-- Rolling Structured Logs (Tracing Output)
│   ├── flow_studio-2026-09-24.log
│   └── flow_studio-2026-09-25.log
└── temp/                                         <-- Ephemeral Buffer (Auto-cleaned on shutdown)
    └── staging/                                  <-- Concat demuxer txt lists & extraction scratchpad
```

### 6.1 Rincian Sub-Direktori `%APPDATA%\FlowStudio\`

| Jalur Relatif | Kegunaan & Isi Berkas | Kebijakan Retensi & Pembersihan |
|---|---|---|
| `flow_studio.db` | Basis data SQLite lokal yang menyimpan metadata akun Google Flow, payload cookie terenkripsi, riwayat audit generasi, dan registry proyek. | Permanen. Hanya dihapus jika pengguna melakukan *Vault Factory Reset*. |
| `flow_studio.db-wal` & `-shm` | Berkas operasional SQLite Write-Ahead Logging untuk menjamin transaksi atomik dan kinerja tinggi tanpa database locking. | Dikelola otomatis oleh SQLite engine (`PRAGMA wal_autocheckpoint = 1000`). |
| `logs/` | Berkas log aplikasi harian berformat teks terstruktur (`.log`). Maksimum rotasi 7 hari. | Otomatis dipangkas (*pruned*) saat startup jika usia berkas log $> 7\text{ hari}$. |
| `temp/staging/` | Berkas manifes demuxer FFmpeg (`concat_list.txt`), frame sementara ekstraksi, dan buffer transcode chunk. | Otomatis dikosongkan (*purged*) saat aplikasi ditutup normal (*graceful shutdown*). |

### 6.2 Struktur Direktori Proyek Pengguna (`<ProjectDirectory>/`)

Setiap proyek video yang dibuat oleh pengguna disimpan pada direktori mandiri pilihan pengguna (misalnya pada partisi `D:\Projects\CyberpunkVideo\`):

```
<ProjectDirectory>/                               <-- Direktori Kerja Proyek Pengguna
├── project.flowproj                              <-- File Proyek JSON (Graph Canvas State & Nodes)
├── assets/                                       <-- Aset Media Generasi
│   ├── segments/                                 <-- Klip Video Hasil Unduh dari Google Flow (MP4)
│   │   ├── seg_01_a8f9c2d1.mp4
│   │   └── seg_02_e3b4a5f6.mp4
│   ├── frames/                                   <-- Reference Frames Hasil Ekstraksi FFmpeg (PNG)
│   │   ├── frame_01_a8f9c2d1.png
│   │   └── frame_02_e3b4a5f6.png
│   └── references/                               <-- Gambar / Video Input Pengguna
│       └── initial_character.png
└── exports/                                      <-- Berkas Video Final yang Digabung (Lossless Stitch)
    └── final_movie_20260924_1080p.mp4
```

### 6.3 Aturan Hak Akses Berkas & Kontrol Izin Sistem (NTFS ACL)
- Direktori `%APPDATA%\FlowStudio\` mewarisi izin keamanan standar Windows Access Control List (ACL) akun pengguna yang sedang login (`Owner SID: Full Control`, `SYSTEM: Full Control`, akun lain: `No Access`).
- Aplikasi **tidak memerlukan** hak istimewa administrator (*UAC Elevation* / `runas Administrator`). Menjalankan Flow Studio sebagai Administrator dilarang keras guna membatasi *blast radius* subprocess FFmpeg.

### 6.4 Pre-Flight Check Ruang Bebas Penyimpanan (Disk Space Budget)
Sebelum mengeksekusi antrean pipeline generasi multi-segmen, backend Rust menjalankan pre-flight audit ruang simpan bebas:
- Partisi target proyek wajib memiliki ruang kosong minimal **$2.0\text{ GB}$**.
- Jika ruang kosong $< 2.0\text{ GB}$, operasi ditolak seketika dengan kode error kanonikal `E_STORAGE_DISK_FULL` guna mencegah korupsi berkas MP4 di tengah proses ekspor video.

---

## 7. Strategi Distribusi & Deteksi FFmpeg (FFmpeg Bundling Strategy)

FFmpeg adalah komponen inti yang bertindak sebagai mesin manipulasi multimedia lokal Flow Studio. Aplikasi menerapkan strategi hibrida dalam mendeteksi dan menjalankan biner FFmpeg antara lingkungan pengembangan lokal dan paket distribusi rilis akhir.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FFMPEG RESOLUTION HIERARCHY                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
             [Pemeriksaan 1: FLOW_STUDIO_FFMPEG_PATH Override]
                                      │
                   (Path Ditetapkan & Valid? Gunakan biner ini)
                                      ▼
             [Pemeriksaan 2: Tauri Bundled Sidecar Binary]
             (%LOCALAPPDATA%\Programs\FlowStudio\ffmpeg.exe)
                                      │
                   (Biner Tersedia & Valid? Gunakan biner ini)
                                      ▼
             [Pemeriksaan 3: Windows System PATH (where.exe ffmpeg)]
                                      │
                   (Biner Ditemukan di PATH? Gunakan biner ini)
                                      ▼
            [Pemeriksaan Gagal: Lempar Error E_CONT_FFMPEG_NOT_FOUND]
```

### 7.1 Konfigurasi Sidecar pada `tauri.conf.json`

Pada paket rilis resmi (`FlowStudio_Setup_x64.exe`), biner FFmpeg didistribusikan secara terintegrasi menggunakan fitur **Tauri Sidecar**. File konfigurasi `src-tauri/tauri.conf.json` mengonfigurasi biner eksternal ini secara deklaratif:

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "externalBin": [
      "binaries/ffmpeg",
      "binaries/ffprobe"
    ],
    "resources": []
  }
}
```

Biner `ffmpeg-x86_64-pc-windows-msvc.exe` yang berada di `src-tauri/binaries/` dikemas secara otomatis oleh Tauri bundler ke dalam installer NSIS dan di-ekstrak ke direktori instalasi aplikasi (`%LOCALAPPDATA%\Programs\FlowStudio\ffmpeg.exe`) tanpa memerlukan konfigurasi manual dari pengguna akhir.

### 7.2 Isolasi Subproses & Eksekusi Tanpa Shell (Process Sandboxing)

Sesuai aturan keamanan `DOC-SEC-001` dan `DOC-ARCH-001`:
1. Biner FFmpeg dieksekusi secara langsung menggunakan `std::process::Command` atau `tauri::plugin::shell`.
2. **Tanpa Perantara Shell:** Eksekusi **dilarang mutlak** memanggil melalui shell sistem (`cmd.exe /c` atau `powershell.exe -Command`). Setiap argumen dilewatkan sebagai elemen array string terisolasi (`arg("-sseof")`, `arg("-1")`). Hal ini mengeliminasi 100% risiko celah keamanan *Command Injection*.
3. **Tanpa Soket Jaringan:** Subproses FFmpeg hanya diizinkan membaca berkas segmen lokal dan menulis ke berkas luaran lokal. Fitur streaming jaringan FFmpeg dinonaktifkan secara implisit karena argumen input selalu berupa berkas lokal terverifikasi.

---

## 8. Matriks Perbedaan Antar-Lingkungan (Dev vs Test vs Staging vs Production)

Aplikasi Flow Studio beroperasi secara konsisten lintas tahapan siklus hidup perangkat lunak. Perbedaan konfigurasi antar lingkungan diatur secara ketat melalui matriks berikut:

| Dimensi Karakteristik | Local Development (Dev) | Automated Test / CI | Staging / Preview QA | Production Release |
|---|---|---|---|---|
| **Target Eksekusi** | Mesin Pengembang Lokal | GitHub Actions Windows Runner | Mesin Penguji Internal / QA | Workstation Pengguna Akhir |
| **Biner Flow Studio** | Debug Build (`cargo build`) | Test Harness (`cargo test`) | Release Build (`--release`) | Signed Release NSIS Installer |
| **Penyimpanan DB SQLite** | `%APPDATA%\FlowStudio\flow_studio.db` | RAM In-Memory (`:memory:`) atau Temporary TempFile | `%APPDATA%\FlowStudio_QA\flow_studio.db` | `%APPDATA%\FlowStudio\flow_studio.db` |
| **Log Verbosity** | `DEBUG` / `TRACE` (Console + Logfile) | `WARN` / `ERROR` (Silent stdout) | `DEBUG` (File only) | `INFO` (Rolling File, Zero Console) |
| **Koneksi Google Flow** | Upstream Nyata atau Mock Proxy Lokal | **100% Mocked** (WireMock / HTTP Stubs) | Upstream Nyata (Akun Uji QA Khusus) | Upstream Nyata (Akun Pribadi Owner) |
| **Resolusi FFmpeg** | System PATH atau `src-tauri/binaries` | Mock CLI stub atau CI pre-installed FFmpeg | Bundled Sidecar Binary | Bundled Sidecar Binary |
| **WebView2 DevTools** | **Aktif** (Bisa dibuka via F12) | Nonaktif / Headless DOM test | Aktif untuk Diagnostik Internal | **Terkunci Mutlak** (F12 dinonaktifkan) |
| **Enkripsi Kredensial** | Aktif Penuh (Argon2id + AES-256-GCM) | Aktif (Kunci Ephemeral Deterministik) | Aktif Penuh | Aktif Penuh |

---

## 9. Kebijakan Akun Pengujian & Data Seeding (Seed & Test Account Policy)

Untuk mencegah pemblokiran akun personal, kebocoran data sensitif, atau pembengkakan biaya kredit pada layanan Google Flow, tim pengembang wajib mematuhi kebijakan akun pengujian berikut.

### 9.1 Kebijakan Pemisahan Akun Google (Account Isolation)
- **Larangan Akun Primer:** Pengembang dilarang keras mengimpor akun Google pribadi utama yang memuat data email privat, Google Drive keluarga, atau dokumen pekerjaan penting ke dalam lingkungan pengujian lokal (*development machine*).
- **Akun Khusus Pengembangan (Dedicated Disposable Accounts):** Pengujian integrasi live wajib menggunakan akun Google sekunder yang dibuat khusus untuk keperluan eksperimen generasi video.
- **Batasan Saldo Kredit:** Akun pengujian tidak boleh menggunakan kartu kredit pribadi yang terhubung dengan auto-billing tanpa batas. Kuota harus dibatasi pada *free monthly quota* atau batas kredit voucher tetap.

### 9.2 Data Seeding Prosedur untuk Pengujian Integrasi Lokal

Pengujian otomatis (integration test) tidak boleh bergantung pada akun nyata Google Flow. Sistem pengujian menggunakan modul seed deterministik yang menyuntikkan data buatan (*synthetic seed*) ke dalam basis data SQLite in-memory:

```rust
#[cfg(test)]
pub mod test_fixtures {
    use rusqlite::Connection;

    pub fn seed_mock_environment(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
        // 1. Inisialisasi Singleton Master Vault dengan Salt & PHC Hash deterministik
        conn.execute(
            "INSERT INTO credential_vault (id, master_password_hash, salt, kdf_iterations)
             VALUES (1, '$argon2id$v=19$m=65536,t=3,p=1$mock_salt_for_testing$mock_phc_hash', X'0102030405060708090A0B0C0D0E0F10', 3);",
            [],
        )?;

        // 2. Inisialisasi Akun Uji Sintetis dengan Payload Terenkripsi Dummy
        conn.execute(
            "INSERT INTO accounts (id, email, display_name, encrypted_cookies, encryption_iv, auth_tag, status, daily_credits_remaining)
             VALUES ('acc_test_01', 'tester.disposable@example.com', 'Test Account 01', X'CAFEBABE', X'0102030405060708090A0B0C', X'0102030405060708090A0B0C0D0E0F10', 'ACTIVE', 100);",
            [],
        )?;

        // 3. Inisialisasi Metadata Proyek Uji
        conn.execute(
            "INSERT INTO projects (id, name, file_path, status)
             VALUES ('proj_test_01', 'Integration Test Movie', 'C:\\TestProjects\\test.flowproj', 'READY');",
            [],
        )?;

        Ok(())
    }
}
```

### 9.3 Sanitasi Kredensial pada Git & CI Pipeline
- Seluruh file berekstensi `.env`, `.pem`, `.key`, `.db`, `.flowproj`, serta folder `temp/` dan `assets/` telah dimasukkan ke dalam `.gitignore`.
- Pre-commit hook pada repositori memindai setiap baris perubahan kode menggunakan pola deteksi entropi tinggi guna memastikan tidak ada string cookie Google atau kata sandi yang tidak sengaja ter-commit.

---

## 10. Tata Kelola Kredensial & Siklus Hidup Brankas (Secret Management & Vault Lifecycle)

Sesuai dokumen `DOC-SEC-001` dan `DOC-PERM-001`, Flow Studio menerapkan arsitektur **Zero-Knowledge Local Storage**. Rahasia akun pengguna dikelola secara independen di workstation lokal tanpa campur tangan server pusat pengembang.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   SECRET MANAGEMENT & VAULT LIFECYCLE                       │
└─────────────────────────────────────────────────────────────────────────────┘

 [Input Master Password] 
            │
            ▼
 [Argon2id Key Derivation] ──(Memory: 64MB, Iterations: 3, Parallelism: 1)
            │
            ▼
 [256-bit Master Derived Key] ──(Disimpan Eksklusif di RAM Berpelindung Zeroize)
            │
            ├─► [Verifikasi Canary Token] ──(Teks "FLOW_STUDIO_VAULT_CANARY_V1")
            │         │
            │         ├─ Valid: Status Brankas Menjadi UNLOCKED
            │         └─ Invalid: Zeroize RAM & Hitung Retry Penalty
            │
            ├─► [Enkripsi Cookie Akun Baru] ──(AES-256-GCM + Random 12-byte IV)
            │         │
            │         └─ Tulis Ciphertext, IV, Tag ke SQLite (%APPDATA%)
            │
            └─► [Dekripsi Cookie untuk Request HTTP]
                      │
                      └─ Ephemeral Closure: Dekripsi -> Kirim -> Zeroize Buffer
```

### 10.1 Spesifikasi Kriptografi KDF & Enkripsi
1. **Key Derivation Function (KDF):** Menggunakan **Argon2id** (versi PHC `v=19`).
   - *Memory Cost:* $65.536\text{ KiB}$ ($64\text{ MB}$).
   - *Time Cost:* $3\text{ iterasi}$.
   - *Parallelism:* $1\text{ thread}$.
   - *Salt:* $16\text{ byte}$ cryptographic random yang dihasilkan oleh OS CSPRNG (`ring::rand::SystemRandom`).
2. **Symmetric Encryption:** Menggunakan **AES-256-GCM** (Galois/Counter Mode).
   - *Key Size:* 256 bit ($32\text{ byte}$).
   - *Initialization Vector (IV/Nonce):* 96 bit ($12\text{ byte}$) unik per baris data akun.
   - *Authentication Tag:* 128 bit ($16\text{ byte}$) untuk menjamin integritas ciphertext terhadap manipulasi bit.

### 10.2 Siklus Hidup Status Brankas (Vault States)
- `UNINITIALIZED`: Basis data baru dibuat. Pengguna wajib mendaftarkan Master Password baru (panjang minimal 10 karakter dengan entropi memadai).
- `LOCKED`: Kunci master tidak ada di RAM. Database hanya memuat ciphertext. Seluruh fungsi generasi video dinonaktifkan.
- `UNLOCKED`: Master key berada di RAM terisolasi (`secrecy::SecretBox`). Fungsi generasi aktif.
- **Auto-Lock Timeout:** Brankas otomatis kembali ke status `LOCKED` setelah **15 menit inaktivitas** pengguna. Buffer RAM dibersihkan menggunakan pemanggilan eksplisit trait `zeroize::ZeroizeOnDrop`.

### 10.3 Prosedur Rotasi Kunci Master (Master Password Rotation Workflow)
1. Pengguna memasukkan Master Password lama dan Master Password baru melalui antarmuka Vault Settings.
2. Backend memvalidasi password lama menggunakan Canary Token Verifier.
3. Menurunkan Master Key baru via Argon2id dengan salt 16-byte baru.
4. Membuka transaksi atomik SQLite (`BEGIN IMMEDIATE`).
5. Membaca seluruh baris pada tabel `accounts`, mendekripsi masing-masing payload cookie dengan Master Key lama, mengenkripsi ulang dengan Master Key baru dan IV baru, lalu memperbarui tabel.
6. Memperbarui tabel `credential_vault` dengan hash baru, salt baru, dan verifier baru.
7. Mengeksekusi `COMMIT`. Jika terjadi kesalahan di tengah jalan, transaksi di-rollback secara utuh tanpa merusak data lama.
8. Membersihkan memori RAM dari seluruh instans key lama.

### 10.4 Prosedur Kedaluwarsa Sesi Cookie Google Flow
Cookie sesi peramban Google memiliki masa aktif terbatas. Saat upstream mengembalikan kode status HTTP `401 Unauthorized` atau mendeteksi invalidasi sesi:
1. Akun terkait ditandai dengan status `EXPIRED` pada basis data lokal.
2. Flow Router secara otomatis mengalihkan antrean generasi ke akun cadangan berikutnya yang berstatus `ACTIVE` di dalam Account Pool tanpa menghentikan rendering video.
3. Notifikasi visual ditampilkan pada UI memberitahukan Owner untuk memperbarui cookie sesi akun tersebut melalui tombol *Re-Authenticate Session*.

---

## 11. Diagnosa & Penanganan Masalah Lingkungan (Troubleshooting & Pitfalls)

Bagian ini merangkum masalah konfigurasi lingkungan yang paling sering terjadi pada sistem host Windows beserta prosedur penyelesaiannya secara langsung.

### 11.1 Masalah 1: Kompilasi Rust Gagal dengan Pesan Linker `link.exe not found`
- **Penyebab:** Visual Studio C++ Build Tools belum terpasang atau variabel PATH lingkungan Windows SDK belum dimuat.
- **Solusi:**
  1. Buka *Visual Studio Installer*, pilih *Visual Studio Build Tools 2022*.
  2. Pastikan beban kerja **Desktop development with C++** dicentang, termasuk komponen **MSVC v143 - VS 2022 C++ x64/x86 build tools** dan **Windows 11 SDK**.
  3. Buka terminal melalui *Developer PowerShell for VS 2022* atau jalankan perintah `vcvars64.bat`.

### 11.2 Masalah 2: Error `E_CONT_FFMPEG_NOT_FOUND` Saat Ekstraksi Frame Pertama
- **Penyebab:** Biner FFmpeg tidak berada di direktori sidecar `src-tauri/binaries/` dan tidak terdaftar pada PATH Windows.
- **Solusi:**
  1. Verifikasi ketersediaan FFmpeg pada terminal melalui `where.exe ffmpeg`.
  2. Jika biner terpasang di lokasi kustom (misalnya `D:\Tools\ffmpeg\bin\ffmpeg.exe`), atur variabel lingkungan pada berkas `.env`:
     ```ini
     FLOW_STUDIO_FFMPEG_PATH="D:\\Tools\\ffmpeg\\bin\\ffmpeg.exe"
     ```
  3. Muat ulang aplikasi menggunakan `pnpm tauri dev`.

### 11.3 Masalah 3: Layar Putih (Blank White Screen) Saat Aplikasi Dibuka
- **Penyebab:** Microsoft Edge WebView2 Runtime mengalami kegagalan inisialisasi atau direktori user data WebView2 mengalami izin akses terkunci.
- **Solusi:**
  1. Hapus folder cache sementara WebView2 yang berada di direktori aplikasi:
     ```powershell
     Remove-Item -Recurse -Force "$env:APPDATA\FlowStudio\EBWebView"
     ```
  2. Unduh dan jalankan ulang *Microsoft Edge WebView2 Evergreen Bootstrapper* dengan hak akses administrator.

### 11.4 Masalah 4: Basis Data Terkunci (`database is locked` / `busy_timeout`)
- **Penyebab:** Terdapat instans proses `flow-studio.exe` yang menggantung di latar belakang dan masih memegang *exclusive lock* pada berkas SQLite.
- **Solusi:**
  1. Periksa dan hentikan proses yang berjalan melalui PowerShell:
     ```powershell
     Get-Process -Name "flow-studio" -ErrorAction SilentlyContinue | Stop-Process -Force
     ```
  2. Pastikan berkas `flow_studio.db-wal` tidak terhapus secara paksa saat proses berjalan.

---

## 12. Matriks Penelusuran Kebutuhan Dokumen (Traceability Matrix)

| Kode Kebutuhan | Dokumen Sumber | Bagian Lingkungan | Implementasi & Kontrol Teknis | Status |
|---|---|---|---|---|
| **REQ-ENV-001** | `DOC-ARCH-001` (§1.1) | Bagian 2 (Prerequisites) | Menetapkan Windows 10/11 x64, Rust 1.80+, Node 22 LTS, WebView2 sebagai baseline platform. | Terpenuhi |
| **REQ-ENV-002** | `DOC-ARCH-001` (§9.1) | Bagian 6 (App Data) | Direktori `%APPDATA%\FlowStudio\` untuk DB, log rolling, buffer staging, dan batas disk 2GB. | Terpenuhi |
| **REQ-ENV-003** | `DOC-SEC-001` (§1.2) | Bagian 3 & 10 (Secrets) | Zero plaintext secret pada `.env.example`, isolasi KDF Argon2id dan AES-256-GCM. | Terpenuhi |
| **REQ-ENV-004** | `DOC-ARCH-001` (§17.1) | Bagian 7 (FFmpeg) | Biner sidecar Tauri 2.x x86_64, deteksi fallback sistem PATH, eksekusi tanpa shell. | Terpenuhi |
| **REQ-ENV-005** | `DOC-API-001` (§3.2) | Bagian 3.3 (Fail-Fast) | Startup pre-flight audit untuk DB, disk space, FFmpeg, dan WebView2 sebelum render UI. | Terpenuhi |
| **REQ-ENV-006** | `PLANNING_v5.2.md` (§11.15) | Bagian 8 & 9 (Matrix & Seed) | Perbedaan Dev/Test/Staging/Prod serta kebijakan isolasi akun uji dan fixture database. | Terpenuhi |

---
*Dokumen ini diterbitkan oleh Software Architect & Planning Lead sebagai standar konfigurasi lingkungan operasional Flow Studio. Segala perubahan konfigurasi wajib melalui proses Architecture Review.*
