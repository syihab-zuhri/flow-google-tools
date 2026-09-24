# RUNBOOK.md: Flow Studio — Desktop Packaging, Release Engineering, Reliability & Incident Operations

> **Project:** Flow Studio  
> **Document ID:** DOC-RUN-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-ARCH-001, DOC-ENV-001  
> **Supersedes:** None  

---

## 1. Pendahuluan & Filosofi Operasional Desktop

Dokumen ini mendefinisikan prosedur standar operasional (*standard operating procedures* / SOP), rekayasa rilis (*release engineering*), verifikasi integritas gerbang CI/CD, keandalan aplikasi desktop (*desktop reliability engineering*), serta mitigasi insiden teknis untuk **Flow Studio**.

Berbeda dengan layanan berbasis server (*cloud SaaS*) yang bergantung pada *orchestration cluster* dan *centralized telemetry*, Flow Studio beroperasi di bawah paradigma **Local-First Desktop Workstation** pada lingkungan host Windows 10/11 x64. Paradigma ini menuntut pendekatan operasional yang khas:

1. **Self-Contained Reliability:** Aplikasi harus dapat mendeteksi, mengisolasi, dan memulihkan kegagalan sistemik secara otonom di workstation pengguna tanpa intervensi tim cloud (*zero remote hot-patching*).
2. **Zero Inbound Ports & Local Data Sovereignty:** Sesuai mandat `DOC-ARCH-001` dan `DOC-SEC-001`, tidak ada server lokal yang mendengarkan port jaringan (*zero listening sockets*). Seluruh telemetri, metrik performa, dan riwayat audit disimpan secara lokal di basis data SQLite pengguna (`%APPDATA%/FlowStudio/flow_studio.db`).
3. **Deterministic Packaging & Sidecar Integrity:** Rilis installer Windows (.exe via NSIS dan .msi via WiX) harus menjamin keterikatan biner *embedded* Rust, Microsoft Edge WebView2 Evergreen runtime, dan dependensi biner pihak ketiga (FFmpeg 6.0+ sidecar) secara utuh dan terverifikasi tanda tangan digitalnya (*code signed*).
4. **Strict Sanitization & Zero-Leakage Crash Operations:** Setiap berkas diagnosa, stack trace, dan panic dump wajib disanitasi secara deterministik di level kernel aplikasi sebelum ditulis ke disk lokal untuk mencegah kebocoran Google session cookies, token otentikasi, atau master password.

---

## 2. Prasyarat Lingkungan Kompilasi & Packaging (Build Prerequisites)

Sebelum menjalankan kompilasi rilis, workstation kompilasi atau runner CI/CD wajib memenuhi spesifikasi toolchain dan dependensi sistem operasi berikut:

### 2.1 Spesifikasi Host & Toolchain

| Komponen Toolchain | Versi Minimum | Deskripsi & Verifikasi | Perintah Pengecekan |
|---|---|---|---|
| **Sistem Operasi** | Windows 10 x64 (21H2+) / Windows 11 | Host target kompilasi native biner Win32. | `[System.Environment]::OSVersion.Version` |
| **Node.js Runtime** | Node.js v20.x LTS | Runtime kompilasi frontend Vite & bundling TypeScript. | `node --version` (Wajib `>= 20.10.0`) |
| **Package Manager** | pnpm v9.x | Manajemen paket monorepo & pnpm workspace. | `pnpm --version` (Wajib `>= 9.0.0`) |
| **Rust Toolchain** | Rust 1.78.0+ (Edition 2021) | Target `x86_64-pc-windows-msvc`. | `rustc --version` & `rustup target list` |
| **C++ Build Tools** | Visual Studio 2022 Build Tools | MSVC v143, Windows 10/11 SDK (10.0.22000.0+). | `cl.exe` via Developer Command Prompt |
| **Tauri CLI** | `@tauri-apps/cli` v2.x | CLI orkestrasi build native desktop shell. | `pnpm tauri --version` |
| **NSIS Engine** | NSIS 3.09+ | Engine pembuat installer `.exe` portable/setup. | `makensis /VERSION` |
| **WiX Toolset** | WiX Toolset v3.11.2+ / v4 | Utilitas kompilasi Windows Installer Package (`.msi`). | `candle.exe -?` |
| **WebView2 Runtime** | Evergreen Bootstrapper | WebView2 runtime browser engine bawaan Windows. | Registri: `HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients` |
| **FFmpeg Sidecar** | FFmpeg 6.0+ (x64 Windows static) | Biner `ffmpeg.exe` & `ffprobe.exe` static build. | `.\src-tauri\binaries\ffmpeg.exe -version` |

### 2.2 Penempatan Biner Sidecar FFmpeg
Tauri 2.x mensyaratkan penamaan biner eksternal (*sidecar*) dengan sufiks *target triple* arsitektur host:

```
flow-studio/
└── src-tauri/
    └── binaries/
        ├── ffmpeg-x86_64-pc-windows-msvc.exe
        └── ffprobe-x86_64-pc-windows-msvc.exe
```

Skrip validasi penempatan sidecar sebelum build:

```powershell
# scripts/verify-sidecars.ps1
$TargetTriple = "x86_64-pc-windows-msvc"
$BinDir = "src-tauri/binaries"
$RequiredBinaries = @("ffmpeg-$TargetTriple.exe", "ffprobe-$TargetTriple.exe")

foreach ($bin in $RequiredBinaries) {
    $Path = Join-Path $BinDir $bin
    if (-not (Test-Path $Path)) {
        Write-Error "CRITICAL: Sidecar binary '$Path' tidak ditemukan! Download FFmpeg 6.0+ release build dan letakkan sesuai path."
        exit 1
    }
    $Hash = (Get-FileHash -Path $Path -Algorithm SHA256).Hash
    Write-Host "Sidecar Verified: $bin [SHA256: $Hash]"
}
```

---

## 3. Prosedur Build & Release (Build & Release Procedures)

Proses kompilasi produksi menghasilkan installer terintegrasi yang mencakup kode UI terkompilasi, core biner native Rust, plugin persistensi SQLite, dan executable FFmpeg sidecar.

```
┌─────────────────┐       ┌─────────────────┐       ┌───────────────────┐
│  pnpm build     │ ----> │ cargo tauri     │ ----> │ Installer Bundles │
│  (Frontend UI)  │       │ build --release │       │ (.exe & .msi)     │
└─────────────────┘       └─────────────────┘       └───────────────────┘
```

### 3.1 Langkah 1: Kompilasi Frontend Web UI

Frontend dikompilasi menggunakan Vite dengan *strict typechecking* dan minifikasi aset CSS/JavaScript:

```bash
# 1. Bersihkan build cache lama
pnpm clean

# 2. Unduh dan verifikasi dependensi lockfile
pnpm install --frozen-lockfile

# 3. Validasi skema tipe TypeScript Specta (IPC bindings sync)
pnpm run check:types

# 4. Eksekusi kompilasi Vite production bundle
pnpm run build
```

*Verifikasi Hasil:* Direktori `dist/` wajib terbuat, memuat berkas `index.html`, bundle JavaScript ter-minifikasi (tanpa `.map` source map di release publik), dan folder `assets/`. Ukuran total `dist/` tidak boleh melebihi 15 MB.

### 3.2 Langkah 2: Kompilasi Native Rust Backend & Packaging Installer

Proses packaging desktop dieksekusi melalui Tauri CLI untuk menghasilkan bundel installer NSIS (`.exe`) dan Windows Installer (`.msi`):

```bash
# Kompilasi rilis penuh dengan bundle installer NSIS dan MSI
pnpm tauri build --bundles nsis,msi
```

Secara internal, perintah di atas menjalankan optimasi biner Cargo:

```toml
# src-tauri/Cargo.toml konfigurasi profil release
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
panic = "abort"
strip = true
```

*Flags Optimasi:*
- `opt-level = 3`: Mengaktifkan kompilasi performa maksimal untuk kalkulasi continuity prompt, decoding frame, dan kriptografi.
- `lto = "fat"`: *Link-Time Optimization* menyeluruh lintas modul Rust dan dependensi crate.
- `codegen-units = 1`: Memaksimalkan reduksi ukuran biner dan inlining fungsi.
- `panic = "abort"`: Mengeliminasi overhead stack unwinding pada jalur produksi; dipadukan dengan Panic Hook untuk logging darurat.
- `strip = true`: Memangkas simbol debug biner untuk menghemat memori dan mencegah inspeksi simbol mentah.

### 3.3 Langkah 3: Verifikasi Integritas Artefak Rilis

Setelah proses build selesai, artefak installer berada pada lokasi:
- **NSIS Installer:** `src-tauri/target/release/bundle/nsis/FlowStudio_{version}_x64-setup.exe`
- **MSI Package:** `src-tauri/target/release/bundle/msi/FlowStudio_{version}_x64_en-US.msi`

Skrip verifikasi pasca-build wajib dijalankan untuk menghitung hash kriptografis dan memeriksa ukuran berkas:

```powershell
# scripts/verify-artifacts.ps1
param (
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$Artifacts = @(
    "src-tauri/target/release/bundle/nsis/FlowStudio_${Version}_x64-setup.exe",
    "src-tauri/target/release/bundle/msi/FlowStudio_${Version}_x64_en-US.msi"
)

$MaxSizeBytes = 85MB # Maksimum ukuran paket installer termasuk FFmpeg sidecar

$VerificationTable = @()

foreach ($filePath in $Artifacts) {
    if (-not (Test-Path $filePath)) {
        Write-Error "GAGAL: Artefak rilis tidak ditemukan: $filePath"
        exit 1
    }

    $fileInfo = Get-Item $filePath
    $sha256 = (Get-FileHash -Path $filePath -Algorithm SHA256).Hash
    
    if ($fileInfo.Length -gt $MaxSizeBytes) {
        Write-Error "GAGAL: Ukuran berkas $($fileInfo.Name) ($([math]::Round($fileInfo.Length/1MB, 2)) MB) melebihi batas maksimum ($([math]::Round($MaxSizeBytes/1MB, 2)) MB)!"
        exit 1
    }

    $VerificationTable += [PSCustomObject]@{
        Filename   = $fileInfo.Name
        SizeBytes  = $fileInfo.Length
        SizeMB     = [math]::Round($fileInfo.Length / 1MB, 2)
        SHA256Hash = $sha256
    }
}

$VerificationTable | Format-Table -AutoSize
$VerificationTable | Export-Csv -Path "artifacts-checksums-$Version.csv" -NoTypeInformation
Write-Host "Verifikasi artefak rilis BERHASIL. Checksum tersimpan pada artifacts-checksums-$Version.csv."
```

---

## 4. Gerbang Pipeline CI/CD (CI/CD Pipeline Gates)

Seluruh perubahan kode (*Pull Requests*) dan rilis branch `main` wajib melewati rangkaian gerbang verifikasi otomatis berurutan (*sequential gating*). Jika terjadi kegagalan pada salah satu gerbang, proses integrasi langsung dibatalkan (*immediate pipeline rejection*).

```
┌──────────────┐     ┌───────────────┐     ┌───────────────┐
│ Gate 1: Lint │ --> │ Gate 2: Types │ --> │ Gate 3: Tests │
└──────────────┘     └───────────────┘     └───────────────┘
                                                   │
                                                   v
┌──────────────┐     ┌───────────────┐     ┌───────────────┐
│ Gate 6: Sec  │ <-- │ Gate 5: Build │ <-- │ Gate 4: A11y  │
└──────────────┘     └───────────────┘     └───────────────┘
```

### 4.1 Matriks Gerbang Verifikasi

| No | Gerbang (*Gate*) | Perintah Eksekusi | Kriteria Lolos (*Passing Criteria*) | Kondisi Pemblokir (*Blocking Conditions*) |
|---|---|---|---|---|
| **1** | **Linting & Anti-Slop** | `pnpm lint` && `cargo clippy --all-targets -- -D warnings` | Zero ESLint/Biome errors; Zero Rust clippy warnings; Skor anti-slop file $\ge 75$. | Peringatan clippy apa pun; pelanggaran `HARD-001` s/d `HARD-006` pada `CODE_QUALITY.md`. |
| **2** | **Typecheck** | `pnpm run check:types` | Kompilasi TypeScript sukses (`tsc --noEmit` exit 0); Rust strict type checking lolos. | Adanya bypass tipe `as any`, `@ts-ignore`, atau inkonsistensi skema Specta IPC. |
| **3** | **Automated Tests** | `pnpm test:unit` && `cargo test --workspace` | 100% test suite lulus (Unit tests, integration tests, vault encryption test, mock router test). | Ada 1 unit test gagal; timeout eksekusi test (> 300s); memory leak terdeteksi. |
| **4** | **Accessibility Audit** | `pnpm test:a11y` (axe-core test runner) | Kepatuhan WCAG 2.2 Level AA; 0 violations pada seluruh komponen antarmuka & modal. | Adanya pelanggaran kontras warna visual (< 4.5:1), missing `aria-label`, atau focus trap. |
| **5** | **Production Build** | `pnpm build` && `cargo tauri build --bundles nsis,msi` | Kompilasi frontend dan bundel installer Windows menghasilkan biner tanpa error. | Kegagalan linker MSVC; ukuran installer > 85 MB; sidecar FFmpeg hilang. |
| **6** | **Security Audit** | `cargo audit` && `pnpm audit --prod` && `gitleaks detect` | Zero HIGH / CRITICAL CVE pada pohon dependensi; Zero kebocoran kredensial/secret di git tree. | Ditemukan CVE aktif tanpa advisory patch resmi; deteksi token atau cookie plaintext. |

### 4.2 Spesifikasi GitHub Actions Workflow

Berkas implementasi CI/CD pada `.github/workflows/desktop-ci.yml`:

```yaml
name: Desktop CI & Release Gatekeeper

on:
  push:
    branches: [ main, develop ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main ]

env:
  CARGO_TERM_COLOR: always
  RUST_BACKTRACE: 1

jobs:
  quality-gate:
    name: Lint, Typecheck, Test & Security Audit
    runs-on: windows-2022

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js Runtime
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install pnpm
        run: corepack enable && corepack prepare pnpm@latest --activate

      - name: Install Rust Stable
        uses: dtolnay/rust-toolchain@stable
        with:
          toolchain: stable
          targets: x86_64-pc-windows-msvc
          components: clippy, rustfmt

      - name: Rust Cache
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      # GATE 1: Lint & Code Hygiene
      - name: Run Linters & Anti-Slop Scanner
        run: |
          pnpm lint
          cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings

      # GATE 2: Typecheck
      - name: TypeScript Typecheck
        run: pnpm run check:types

      # GATE 3: Automated Unit & Integration Tests
      - name: Run Frontend & Backend Tests
        run: |
          pnpm test:unit
          cargo test --manifest-path src-tauri/Cargo.toml --workspace

      # GATE 4: Accessibility Check
      - name: Run axe-core Accessibility Suite
        run: pnpm test:a11y

      # GATE 6: Security Audit
      - name: Run Cargo & pnpm Vulnerability Audit
        run: |
          cargo install cargo-audit
          cargo audit --ignore RUSTSEC-2020-0071
          pnpm audit --prod --audit-level=high

      - name: Run Git Secret Leak Detection
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build-and-package:
    name: Build & Package Windows Artifacts
    needs: [ quality-gate ]
    runs-on: windows-2022
    if: startsWith(github.ref, 'refs/tags/v')

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Environment
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install pnpm & Rust
        run: |
          corepack enable && corepack prepare pnpm@latest --activate
          rustup target add x86_64-pc-windows-msvc

      - name: Download Verified FFmpeg Sidecars
        shell: powershell
        run: |
          .\scripts\fetch-ffmpeg-sidecars.ps1 -Target "x86_64-pc-windows-msvc"
          .\scripts\verify-sidecars.ps1

      - name: Install Frontend Dependencies
        run: pnpm install --frozen-lockfile

      # GATE 5: Production Build & Packaging
      - name: Build Tauri Desktop Package
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_KEY_PWD }}
        run: pnpm tauri build --bundles nsis,msi

      - name: Verify Installer Artifacts Integrity
        shell: powershell
        run: |
          $Tag = "${{ github.ref_name }}".TrimStart("v")
          .\scripts\verify-artifacts.ps1 -Version $Tag

      - name: Upload Artifacts to Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            src-tauri/target/release/bundle/nsis/*.exe
            src-tauri/target/release/bundle/msi/*.msi
            artifacts-checksums-*.csv
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 5. Windows Packaging & Code Signing

Penandatanganan kode digital (*code signing*) adalah prasyarat mutlak pada platform Windows modern untuk mencegah peringatan proteksi **Windows Defender SmartScreen** ("Windows protected your PC / Unknown Publisher") dan menjamin bahwa biner aplikasi tidak mengalami modifikasi (*tampering*) sejak dirilis.

### 5.1 Opsi 1: Sertifikat Self-Signed (Penggunaan Personal & Pengujian Internal)

Untuk pengujian lokal, *dogfooding*, atau penggunaan workstation pribadi, sertifikat mandiri (*self-signed certificate*) dapat dibuat dan diinstal langsung ke toko sertifikat Windows.

#### Langkah 1: Pembangkitan Sertifikat Code Signing Lokal
Jalankan PowerShell dengan hak Administrator:

```powershell
# scripts/generate-self-signed-cert.ps1
$CertSubject = "CN=FlowStudioDev, O=Flow Studio Local, OU=Development"
$CertPassword = ConvertTo-SecureString -String "FlowStudioLocalPass2026!" -Force -AsPlainText

$Cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $CertSubject `
    -KeyUsage DigitalSignature `
    -KeySpec Signature `
    -KeyLength 3072 `
    -HashAlgorithm SHA256 `
    -NotAfter (Get-Date).AddYears(5) `
    -CertStoreLocation "Cert:\LocalMachine\My"

Write-Host "Sertifikat terbuat dengan Thumbprint: $($Cert.Thumbprint)"

# Export ke file PFX
$PfxPath = "$PSScriptRoot\FlowStudio_SelfSigned.pfx"
Export-PfxCertificate -Cert $Cert -FilePath $PfxPath -Password $CertPassword
Write-Host "Berkas PFX tersimpan pada: $PfxPath"
```

#### Langkah 2: Registrasi Sertifikat ke Trusted Root CA (Workstation Lokal)
Agar biner yang ditandatangani sertifikat mandiri dipercaya oleh Windows OS tanpa peringatan merah:

```powershell
# Jalankan pada mesin pengguna/workstation target
$CertPath = "scripts\FlowStudio_SelfSigned.pfx"
$CertPassword = ConvertTo-SecureString -String "FlowStudioLocalPass2026!" -Force -AsPlainText

# Import ke Trusted Root & Trusted Publishers
Import-PfxCertificate -FilePath $CertPath -CertStoreLocation "Cert:\LocalMachine\Root" -Password $CertPassword
Import-PfxCertificate -FilePath $CertPath -CertStoreLocation "Cert:\LocalMachine\TrustedPublisher" -Password $CertPassword
Write-Host "Sertifikat berhasil ditambahkan ke Trusted Root & Trusted Publishers!"
```

#### Langkah 3: Penandatanganan Biner Menggunakan `signtool.exe`
Gunakan utilitas resmi dari Windows SDK:

```powershell
# scripts/sign-binary.ps1
param (
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

$SignTool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22000.0\x64\signtool.exe"
$PfxPath = "scripts\FlowStudio_SelfSigned.pfx"
$PfxPassword = "FlowStudioLocalPass2026!"
$TimestampServer = "http://timestamp.digicert.com"

& $SignTool sign /f $PfxPath /p $PfxPassword /fd SHA256 /tr $TimestampServer /td SHA256 /as /v $FilePath
& $SignTool verify /pa /v $FilePath
```

### 5.2 Opsi 2: Konfigurasi Sertifikat Terpercaya Komersial (Standard / EV Code Signing)

Untuk rilis publik tanpa peringatan SmartScreen, Flow Studio dikonfigurasikan dengan sertifikat **Extended Validation (EV)** atau **Cloud HSM-based Signing** (seperti Azure Trusted Signing, DigiCert ONE, atau Certum Cloud):

1. **Hardware Security Module (HSM) Token:**
   Kunci privat tersimpan di perangkat USB token fisik (YubiKey / SafeNet eToken). Penandatanganan lokal memerlukan driver kartu pintar (*smart card driver*) dan Windows SDK SignTool:
   ```powershell
   signtool.exe sign /n "Flow Studio Software LLC" /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /v "path\to\FlowStudio_setup.exe"
   ```

2. **Integrasi CI/CD via Azure Trusted Signing (d/h Microsoft Azure Code Signing):**
   Pada GitHub Actions, biner ditandatangani menggunakan GitHub Action resmi `dotnet/sign` atau Azure CLI tanpa mengekspos file PFX mentah:
   ```yaml
   - name: Sign Artifacts with Azure Trusted Signing
     uses: azure/trusted-signing-action@v0.4.1
     with:
       azure-tenant-id: ${{ secrets.AZURE_TENANT_ID }}
       azure-client-id: ${{ secrets.AZURE_CLIENT_ID }}
       azure-client-secret: ${{ secrets.AZURE_CLIENT_SECRET }}
       endpoint: https://weu.codesigning.azure.net/
       code-signing-account-name: FlowStudioSignAccount
       certificate-profile-name: FlowStudioEVProfile
       files: |
         src-tauri/target/release/bundle/nsis/*.exe
         src-tauri/target/release/bundle/msi/*.msi
       timestamp-rfc3161: http://timestamp.digicert.com
   ```

3. **SmartScreen Reputation Warming:**
   Sertifikat Standard Code Signing memerlukan akumulasi unduhan sebelum SmartScreen otomatis mempercayai biner baru. Sertifikat EV memberikan reputasi instan tanpa peringatan *SmartScreen filter*.

---

## 6. Desktop Reliability & Service Level Objectives (SLOs)

Flow Studio menerapkan Service Level Objectives (SLO) berbasis metrik lokal untuk menjamin performa workstation, kehalusan interaksi grafis, dan daya tahan pipeline generasi video panjang terhadap anomali jaringan.

### 6.1 Definisi SLI & Target SLO

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DESKTOP RELIABILITY MATRIX                      │
├────────────────────────────────────────────────────────────────────────┤
│ SLO-001: Generation Dispatch Latency (P95 < 2.0s)       [SRS: NFR-002] │
│ SLO-002: Canvas Render Frame Rate (P95 >= 60 FPS)       [SRS: NFR-001] │
│ SLO-003: Pipeline Crash Recovery (Auto-Resume = 100%)   [SRS: NFR-005] │
│ SLO-004: Application Cold Start Time (Startup < 3.0s)   [SRS: NFR-008] │
└────────────────────────────────────────────────────────────────────────┘
```

| SLO ID | Metrik Indikator (SLI) | Ambang Batas Target (*SLO*) | Metode Pengukuran & Instrumentasi | Hubungan Persyaratan |
|---|---|---|---|---|
| **SLO-001** | **Generation Dispatch Latency**<br>Durasi waktu sejak node pipeline dieksekusi di canvas hingga paket HTTP POST pertama terkirim ke Google Flow. | **P95 < 2.0 detik**<br>(Rolling window 50 request inferensi) | Timer internal pada `ContinuityPipelineEngine` di Rust backend: delta antara `job_enqueued_at` dan `upstream_request_dispatched_at`. Dicatat pada tabel `generation_log`. | `NFR-002`<br>(Request Dispatch Latency) |
| **SLO-002** | **Canvas Interactive Frame Rate**<br>Tingkat kehalusan visual editor node saat operasi pan, zoom, dan seleksi dengan beban minimal 50 node dan 100 edge. | **P95 $\ge$ 60 FPS**<br>(Frame render time P95 $\le$ 16.67 ms) | Hook `useFrameRateMonitor` di React Frontend menggunakan `performance.now()` dalam loop `requestAnimationFrame`. | `NFR-001`<br>(Canvas Render Performance) |
| **SLO-003** | **Pipeline Crash Recovery**<br>Kemampuan memulihkan state pipeline yang terhenti akibat crash aplikasi atau power loss tanpa kehilangan segmen yang telah selesai. | **100% Deterministic Auto-Resume**<br>(0 segmen selesai yang digenerasi ulang) | Unit/E2E test state restoration dari SQLite DB + verifikasi file fisik segmen di direktori proyek lokal pasca-restart. | `NFR-005`<br>(Unattended Pipeline Execution) |
| **SLO-004** | **Application Cold Start Time**<br>Durasi peluncuran biner aplikasi hingga render penuh antarmuka utama. | **Cold Start < 3.0 detik**<br>(Hardware minimum i5 Gen 8, 8GB RAM) | Stopwatch logging pada event `tauri://ready` dan inisialisasi context store React di frontend. | `NFR-008`<br>(Application Cold Start) |

### 6.2 Kebijakan Error Budget (Error Budget Policy)

Meskipun Flow Studio adalah aplikasi desktop lokal, anggaran error (*error budget*) bulanan dihitung berdasarkan metrik sesi lokal yang terekam pada tabel `generation_log`.

- **Alokasi Error Budget Bulanan:** Toleransi kegagalan dispatch tidak terduga $\le 2\%$ dari total generasi bulanan.
- **Tindakan Saat Error Budget Terbakar:**

```
                  ┌──────────────────────────────┐
                  │ Error Budget Consumption     │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │ < 50% Terbakar        │ 50% - 99% Terbakar    │ >= 100% Terbakar
         v                       v                       v
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Status: HEALTHY │     │ Status: WARN    │     │ Status: FREEZE  │
│ Lanjutkan fitur │     │ Review latency, │     │ Feature Freeze! │
│ sprint normal.  │     │ audit FFmpeg.   │     │ Fokus perbaikan │
└─────────────────┘     └─────────────────┘     │ reliability.    │
                                                └─────────────────┘
```

1. **Konsumsi Budget < 50% (Normal):** Pengembangan fitur roadmap berlanjut sesuai sprint backlog.
2. **Konsumsi Budget 50% - 99% (Warning):** Investigasi bottleneck latensi dispatch, audit efisiensi FFmpeg, dan lakukan profiling rendering node canvas.
3. **Konsumsi Budget $\ge$ 100% (Budget Exhausted / Reliability Freeze):**
   - **Fitur Baru Di-Freeze:** Tidak ada fitur baru yang di-merge ke branch `main`.
   - **Sprint Keandalan Wajib:** Prioritas kerja dialihkan 100% untuk optimasi threading Rust, pengurangan footprint alokasi memori, perbaikan isolasi child process FFmpeg, dan refactoring query SQLite WAL.

### 6.3 Sistem Peringatan & Observabilitas Lokal (In-App Alerting)

Karena ketiadaan server pemantau terpusat, observabilitas diimplementasikan melalui sinyal visual dan log audit lokal:

1. **In-App Toast & Status Badge:**
   - Latensi dispatch > 2s: Badge indikator jaringan pada toolbar berubah kuning (*Warning: Slow upstream dispatch*).
   - Frame rate drop < 45 FPS: Notifikasi optimasi performa merekomendasikan mode *Canvas Low-Detail / Node Virtualization*.
2. **Windows OS Native Notification:**
   - Pipeline background selesai: Memancarkan notifikasi toast Windows WinRT (*"Pipeline completed: 18 segments rendered successfully"*).
   - Fatal unrecoverable failure: Memancarkan notifikasi darurat (*"Pipeline halted: Account rotation exhausted. Re-authentication required"*).
3. **Structured Tracing Event:**
   - Seluruh event SLO dicatat dengan crate `tracing` di Rust menggunakan format JSON terstruktur pada `%APPDATA%/FlowStudio/logs/`.

---

## 7. Penanganan Kegagalan Umum & Troubleshooting (Common Failure Modes)

Bagian ini menyediakan runbook taktis untuk menyelesaikan 5 moda kegagalan utama yang mungkin terjadi pada workstation pengguna.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      COMMON FAILURE MODES CATALOG                      │
├────────────────────────────────────────────────────────────────────────┤
│ FAIL-001: Google Flow HTTP 401/403 (Session Expired / Token Invalid)  │
│ FAIL-002: Google Flow HTTP 429 (Rate Limit / Quota Exhausted)         │
│ FAIL-003: Subproses FFmpeg Crash (Corrupt Extraction / Out of Memory)  │
│ FAIL-004: SQLite Database Locked / Corrupted (WAL Lock Contention)     │
│ FAIL-005: WebView2 Runtime Missing / Damaged Bootstrapper              │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 7.1 FAIL-001: Google Flow Mengembalikan HTTP 401 / 403 (Session Expired)

#### Gejala & Indikator
- Log backend mencatat: `[ERROR] [FlowRouter] Upstream error 401 Unauthorized / 403 Forbidden for account: acc_xxxxxxxx`.
- Node aktif pada visual editor bertransisi ke status merah dengan label `SESSION_EXPIRED`.
- Toast notifikasi muncul: *"Sesi Google Flow telah berakhir. Silakan lakukan login ulang untuk memperbarui token."*

#### Akar Masalah (Root Cause)
1. Masa berlaku Google session cookie (`__Secure-3PSID`, `SAPISID`) telah habis (biasanya 14–30 hari).
2. Terjadi perubahan IP drastis atau tantangan keamanan dari Google (*security checkpoint*).
3. Akun keluar (*logged out*) dari browser utama pengguna.

#### Prosedur Pemulihan Bertahap (Step-by-Step Recovery)

```
[Akun 401/403] ──> [Tandai Status EXPIRED] ──> [Buka Re-Auth Modal]
                                                       │
                                                       v
[Lanjutkan Pipeline] <── [Perbarui Vault DB] <── [Capture Cookie Baru]
```

1. **Isolasi Akun Otomatis:**
   Backend secara otomatis menandai akun terkait dengan flag `status = 'EXPIRED'` di tabel `accounts` dan memblokir penggunaannya dari antrean pipeline aktif.
2. **Tampilkan Re-Authentication Modal:**
   Frontend menampilkan modal popup dengan embedded WebView2 yang mengarah ke `https://accounts.google.com/ServiceLogin?service=flow`.
3. **Penyelesaian Otentikasi Pengguna:**
   Pengguna memasukkan kredensial Google mereka di dalam WebView2 yang terisolasi.
4. **Intersepsi Cookie & Update Vault:**
   - Handler Rust menangkap event navigasi WebView2 saat mencapai domain `flow.google.com`.
   - Mengambil header cookie baru via `WebviewWindow::with_webview`.
   - Melakukan enkripsi AES-256-GCM terhadap cookie baru menggunakan Master Key vault aktif.
   - Menyimpan ciphertext ke tabel `accounts` dan mengembalikan status akun menjadi `HEALTHY`.
5. **Resume Eksekusi:**
   Pengguna mengklik tombol *"Retry Failed Segment"* pada toolbar node editor.

---

### 7.2 FAIL-002: Google Flow Mengembalikan HTTP 429 (Rate Limit / Quota Exhaustion)

#### Gejala & Indikator
- Log backend mencatat: `[WARN] [FlowRouter] Upstream HTTP 429 Too Many Requests. Header Retry-After: 60s`.
- Konsumsi kredit akun aktif mencapai 0/50 kredit harian.
- Pipeline berhenti sejenak dengan status node `ROTATING_ACCOUNT`.

#### Akar Masalah (Root Cause)
1. Kuota generasi akun aktif telah habis untuk siklus hari tersebut.
2. Kecepatan dispatch melampaui batas *concurrency* per menit Google Flow (burst limit).

#### Prosedur Pemulihan Bertahap (Step-by-Step Recovery)

1. **Pemeriksaan Akun Alternatif (Auto-Rotation):**
   `AccountPoolManager` secara otomatis mengeksekusi rotasi akun sesuai urutan prioritas:
   ```rust
   // Pseudo-code orkestrator rotasi akun
   let next_account = account_pool.find_healthy_account_with_credits().await;
   match next_account {
       Some(account) => {
           tracing::info!("Auto-rotating pipeline to account: {}", account.id);
           account_pool.set_active_account(account.id).await?;
           pipeline.retry_current_segment_with_active_account().await?;
       }
       None => {
           tracing::error!("All accounts in pool exhausted or rate limited!");
           pipeline.pause_with_reason(PauseReason::AllAccountsExhausted).await;
       }
   }
   ```
2. **Jika Akun Alternatif Tersedia:**
   - Pipeline otomatis dialihkan ke akun cadangan dalam waktu < 500 ms tanpa perlu intervensi pengguna.
   - Akun lama ditandai `RATE_LIMITED` dengan timestamp `cooldown_until = now() + retry_after`.
3. **Jika Seluruh Akun di Pool Habis Kuota:**
   - Pipeline beralih ke mode `PAUSED`.
   - Menampilkan modal peringatan: *"Semua akun telah mencapai batas kuota harian. Pipeline diistirahatkan."*
   - Menghitung waktu mundur (*countdown timer*) hingga reset kuota harian Google Flow berikutnya (biasanya pukul 00:00 UTC / 07:00 WIB).
   - Pengguna memiliki opsi menambahkan akun baru ke pool atau menunggu cooldown.

---

### 7.3 FAIL-003: Subproses FFmpeg Crash (Corrupted Frame Extraction / Transcode Failure)

#### Gejala & Indikator
- Log aplikasi mencatat: `[ERROR] [FFmpeg] Child process exited with code -1073741819 (STATUS_ACCESS_VIOLATION)` atau exit code non-zero.
- Ekstraksi frame terakhir gagal; berkas `last_frame.png` tidak terbentuk di folder sementara segmen.
- Status node pipeline menjadi `FRAME_EXTRACTION_FAILED`.

#### Akar Masalah (Root Cause)
1. Bitstream berkas MP4 hasil unduhan upstream mengalami *packet loss* atau chunk terpotong.
2. Seek parameter `-sseof -1` mengalami kesalahan kalkulasi durasi jika metadata moov atom video korup.
3. Alokasi memori sistem penuh (*out of memory*) saat merender stitching video 4K durasi panjang.

#### Prosedur Pemulihan Bertahap (Step-by-Step Recovery)

1. **Verifikasi Integritas Berkas Video Input:**
   Jalankan inspeksi probe via Rust wrapper:
   ```bash
   # Verifikasi integritas container video
   ffprobe.exe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 segment_001.mp4
   ```
   Jika `ffprobe` mengembalikan error, video dinyatakan korup: lakukan redownload segmen dari Google Flow asset URL.
2. **Eksekusi Fallback Extraction Parameters:**
   Jika metode seek cepat (*fast seek input flag*) gagal, beralih secara otomatis ke metode *accurate frame decode*:
   - *Primary Command (Fast Seek):*
     ```bash
     ffmpeg.exe -y -sseof -0.1 -i segment_001.mp4 -update 1 -q:v 2 last_frame.png
     ```
   - *Fallback Command (Accurate Full Decode):*
     ```bash
     ffmpeg.exe -y -i segment_001.mp4 -vf "select='eq(n\,prev_selected_n+1)'" -fps_mode vfr -q:v 2 last_frame_fallback_%03d.png
     ```
3. **Pembersihan Berkas Parsial (Garbage Collection):**
   Hapus berkas output berukuran 0-byte atau `.tmp` di direktori proyek sebelum mencoba kembali:
   ```powershell
   Remove-Item -Path "$ProjectDir/temp/*.tmp" -Force -ErrorAction SilentlyContinue
   ```
4. **Alokasi Memori & Concat Recovery:**
   Jika crash terjadi saat ekspor final (*video stitching concat*):
   - Ubah strategi ekspor dari direct re-encoding ke *Lossless Demuxer Copy*:
     ```bash
     ffmpeg.exe -y -f concat -safe 0 -i filelist.txt -c copy final_export.mp4
     ```

---

### 7.4 FAIL-004: SQLite Database Locked / Corrupted (`flow_studio.db` WAL Lock)

#### Gejala & Indikator
- Error UI: `Database locked: SQLite error code 5 (SQLITE_BUSY)` atau `Database file is malformed (SQLITE_CORRUPT)`.
- Aplikasi membeku (*hang*) saat startup pada tahap *Initializing Local Database*.
- Berkas `flow_studio.db-wal` membengkak hingga ratusan megabyte tanpa menyusut.

#### Akar Masalah (Root Cause)
1. Shutdown mendadak (*abnormal termination*, listrik padam, atau task termination paksa) saat transaksi write masih berlangsung.
2. Terdapat proses biner liar (*orphan/zombie FlowStudio.exe*) yang masih menahan handle kunci berkas database NTFS.
3. Korupsi file shared-memory (`flow_studio.db-shm`) akibat sinkronisasi disk drive eksternal atau crash filesystem.

#### Prosedur Pemulihan Bertahap (Step-by-Step Recovery)

```powershell
# scripts/recover-sqlite-database.ps1
# 1. Pastikan seluruh proses aplikasi ditutup
Stop-Process -Name "FlowStudio" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$DbDir = "$env:APPDATA\FlowStudio"
$DbFile = Join-Path $DbDir "flow_studio.db"
$WalFile = Join-Path $DbDir "flow_studio.db-wal"
$ShmFile = Join-Path $DbDir "flow_studio.db-shm"
$BackupDir = Join-Path $DbDir "backups"

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item $DbFile -Destination (Join-Path $BackupDir "flow_studio_corrupt_$Timestamp.db")

Write-Host "Langkah 1: Mencoba pembersihan lock shared memory..."
if (Test-Path $ShmFile) {
    Remove-Item $ShmFile -Force
    Write-Host "File shared memory (.db-shm) berhasil dihapus."
}

Write-Host "Langkah 2: Mencoba force WAL checkpoint..."
# Menggunakan sqlite3 command line utility untuk recovery
$SqliteCmd = "sqlite3.exe"
if (Get-Command $SqliteCmd -ErrorAction SilentlyContinue) {
    & $SqliteCmd $DbFile "PRAGMA wal_checkpoint(TRUNCATE);"
    & $SqliteCmd $DbFile "PRAGMA integrity_check;"
} else {
    Write-Warning "sqlite3.exe CLI tidak ditemukan di PATH. Menjalankan fallback raw recovery..."
}

Write-Host "Langkah 3: Verifikasi status database..."
```

Jika database dinyatakan korup permanen (*malformed header*):
1. Ekspor data yang masih dapat dibaca ke berkas SQL dump:
   ```bash
   sqlite3.exe flow_studio.db ".recover" | sqlite3.exe flow_studio_recovered.db
   ```
2. Ganti nama berkas `flow_studio_recovered.db` menjadi `flow_studio.db`.
3. Jalankan aplikasi Flow Studio. Migrasi database otomatis akan memvalidasi skema.

---

### 7.5 FAIL-005: WebView2 Runtime Missing / Incompatible

#### Gejala & Indikator
- Aplikasi gagal dibuka saat peluncuran biner: muncul dialog error sistem Windows bertuliskan *"Microsoft Edge WebView2 Runtime is required to run Flow Studio"*.
- Installer NSIS berhenti di tengah jalan dengan pesan *"Failed to download or initialize WebView2 bootstrapper"*.

#### Akar Masalah (Root Cause)
1. Workstation menjalankan Windows 10 versi lawas (di bawah build 2004) di mana WebView2 belum terpasang sebagai komponen OS default.
2. Komponen WebView2 rusak (*corrupted registry key*) akibat utilitas *bloatware remover* atau software pembersih registri pihak ketiga.

#### Prosedur Pemulihan Bertahap (Step-by-Step Recovery)

1. **Pemeriksaan Status Instalasi Registri:**
   Buka PowerShell dan periksa path runtime WebView2:
   ```powershell
   $RegPath = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-F385-41E5-B648-5807303E0F78}"
   if (Test-Path $RegPath) {
       $Version = (Get-ItemProperty -Path $RegPath).pv
       Write-Host "WebView2 terdeteksi: Versi $Version"
   } else {
       Write-Host "WebView2 TIDAK terpasang pada sistem!"
   }
   ```
2. **Instalasi Mandiri via Microsoft Evergreen Bootstrapper:**
   Unduh dan jalankan installer silent resmi Microsoft:
   ```powershell
   # scripts/install-webview2.ps1
   $BootstrapperUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
   $InstallerPath = "$env:TEMP\MicrosoftEdgeWebview2Setup.exe"

   Write-Host "Mengunduh Microsoft Edge WebView2 Evergreen Bootstrapper..."
   Invoke-WebRequest -Uri $BootstrapperUrl -OutFile $InstallerPath

   Write-Host "Menjalankan silent installation WebView2..."
   Start-Process -FilePath $InstallerPath -Args "/silent /install" -Wait
   Remove-Item $InstallerPath -Force

   Write-Host "Instalasi WebView2 selesai. Silakan luncurkan kembali Flow Studio."
   ```

---

## 8. Prosedur Cadangan & Pemulihan (Backup & Disaster Recovery)

Flow Studio menyimpan dua kategori data penting yang wajib dilindungi:
1. **Master System Database:** `%APPDATA%\FlowStudio\flow_studio.db` (Kredensial terenkripsi vault, riwayat generasi, konfigurasi akun, dan cache log).
2. **Project Files:** Berkas dokumen proyek `<nama-proyek>.flowproj` beserta folder media (`assets/`, `segments/`, `exports/`).

### 8.1 Strategi Backup Database Master (`flow_studio.db`)

Penyalinan berkas database SQLite secara langsung (*raw copy*) saat aplikasi aktif berbahaya karena mode Write-Ahead Logging (WAL) dapat mengakibatkan salinan korup. Prosedur pencadangan wajib menggunakan perintah aman **SQLite Online Backup API** (`VACUUM INTO`).

#### Skrip Otomatisasi Backup Terjadwal (PowerShell)

```powershell
# scripts/backup-flowstudio-db.ps1
$DbPath = "$env:APPDATA\FlowStudio\flow_studio.db"
$BackupFolder = "$env:APPDATA\FlowStudio\backups"
$MaxRetentionDays = 30

if (-not (Test-Path $BackupFolder)) {
    New-Item -ItemType Directory -Path $BackupFolder -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupTargetFile = Join-Path $BackupFolder "flow_studio_backup_$Timestamp.db"

Write-Host "Mengeksekusi hot atomic backup via SQLite VACUUM INTO..."

# Panggil perintah native command via sqlite3 CLI atau SQLite connection
$SqlCmd = "VACUUM INTO '$BackupTargetFile';"

if (Get-Command "sqlite3.exe" -ErrorAction SilentlyContinue) {
    & sqlite3.exe $DbPath $SqlCmd
    Write-Host "Backup database berhasil dibuat pada: $BackupTargetFile"
} else {
    # Fallback jika sqlite3 CLI tidak tersedia: gunakan safe file copy jika proses tertutup
    $AppProcess = Get-Process -Name "FlowStudio" -ErrorAction SilentlyContinue
    if ($null -eq $AppProcess) {
        Copy-Item $DbPath $BackupTargetFile
        Write-Host "Cold backup berhasil dibuat: $BackupTargetFile"
    } else {
        Write-Error "Aplikasi sedang berjalan dan sqlite3 CLI tidak tersedia. Backup dibatalkan untuk mencegah korupsi WAL."
        exit 1
    }
}

# Rotasi pembersihan backup lama melebihi masa retensi
Get-ChildItem -Path $BackupFolder -Filter "flow_studio_backup_*.db" | Where-Object {
    $_.CreationTime -lt (Get-Date).AddDays(-$MaxRetentionDays)
} | Remove-Item -Force
```

### 8.2 Prosedur Pemulihan Berkas Proyek (`.flowproj`)

Sesuai `API.md`, penyimpanan berkas proyek menggunakan metode **Atomic File Write**:
1. Frontend mengirim data kanvas ke backend Rust.
2. Rust menulis konten JSON ke berkas sementara: `<nama-proyek>.flowproj.tmp`.
3. Rust mengeksekusi operasi atomik rename OS Win32 (`std::fs::rename`) menggantikan `<nama-proyek>.flowproj`.

#### Prosedur Pemulihan Proyek Rusak (*Corrupt Project Recovery*)

Jika pengguna mengalami crash saat sistem operasi mematikan daya di tengah proses penulisan:
1. Periksa direktori proyek untuk berkas cadangan otomatis:
   - `<nama-proyek>.flowproj.bak` (Cadangan versi sebelumnya).
   - `<nama-proyek>.flowproj.tmp` (Berkas penulisan terakhir yang belum selesai).
2. Verifikasi validitas JSON pada berkas cadangan:
   ```powershell
   Get-Content -Path "my_video.flowproj.bak" -Raw | ConvertFrom-Json | Out-Null
   if ($?) {
       Copy-Item "my_video.flowproj.bak" "my_video.flowproj" -Force
       Write-Host "Proyek berhasil dipulihkan dari cadangan otomatis .bak!"
   }
   ```
3. Buka proyek kembali di Flow Studio. Mesin validasi akan memverifikasi kesesuaian referensi file video di folder `segments/`.

### 8.3 Disaster Recovery Drill (Uji Kelayakan Pemulihan)

Setiap siklus rilis major/minor, lakukan pengujian pemulihan bencana (*DR drill*):
1. **Simulasi:** Buat salinan folder `%APPDATA%\FlowStudio` ke direktori terisolasi.
2. **Injeksi Kerusakan:** Hapus `flow_studio.db` atau simulasikan transaksi gantung di `flow_studio.db-wal`.
3. **Restorasi:** Jalankan prosedur restore dari file backup terbaru.
4. **Verifikasi:** Luncurkan Flow Studio, buka brankas dengan Master Password, pastikan daftar akun, kredit, dan riwayat pipeline utuh 100%.

---

## 9. Pelaporan Crash & Sanitasi Log Diagnostik (Crash Reporting & Log Sanitization)

Sesuai prinsip keamanan tingkat tinggi (`DOC-SEC-001`), **dilarang keras** mencatat Google session cookies, authorization token, atau plaintext master password ke dalam log file, panic dump, ataupun error report.

```
┌─────────────────┐      ┌─────────────────────────┐      ┌──────────────────┐
│ Unhandled Panic │ ---> │ Sanitization Filter     │ ---> │ Sanitized Dump   │
│ or Exception    │      │ (Regex Masking Engine)  │      │ %APPDATA%/crashes│
└─────────────────┘      └─────────────────────────┘      └──────────────────┘
```

### 9.1 Direktori Crash Dump & Panic Hook

Crash dump dan file diagnostik disimpan pada direktori lokal pengguna:
- **Crash Directory:** `%APPDATA%\FlowStudio\crashes\`
- **Application Logs:** `%APPDATA%\FlowStudio\logs\flow_studio_YYYY-MM-DD.log`

Backend Rust mengimplementasikan Panic Hook kustom untuk menangani terminasi abnormal dan memastikan sanitasi data:

```rust
// src-tauri/src/diagnostics/panic_handler.rs
use std::panic;
use std::fs::{self, OpenOptions};
use std::io::Write;
use chrono::Utc;

pub fn setup_custom_panic_hook() {
    panic::set_hook(Box::new(|panic_info| {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let crash_dir = match crate::storage::resolve_appdata_path("crashes") {
            Ok(p) => p,
            Err(_) => return,
        };

        let _ = fs::create_dir_all(&crash_dir);
        let crash_file = crash_dir.join(format!("crash_{}.log", timestamp));

        let payload = match panic_info.payload().downcast_ref::<&str>() {
            Some(s) => *s,
            None => match panic_info.payload().downcast_ref::<String>() {
                Some(s) => &s[..],
                None => "Box<Any> payload with unknown panic type",
            },
        };

        let location = panic_info.location().map_or(
            "unknown location".to_string(),
            |loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column())
        );

        let raw_report = format!(
            "Timestamp: {}\nLocation: {}\nPayload: {}\nBacktrace:\n{:?}",
            Utc::now().to_rfc3339(),
            location,
            payload,
            std::backtrace::Backtrace::capture()
        );

        // EKSEKUSI SANITASI KETAT SEBELUM MENULIS KE DISK
        let sanitized_report = sanitize_diagnostic_text(&raw_report);

        if let Ok(mut file) = OpenOptions::new().create(true).write(true).open(&crash_file) {
            let _ = file.write_all(sanitized_report.as_bytes());
        }
    }));
}
```

### 9.2 Mesin Sanitasi Log & Masking Kredensial

Setiap teks log diagnostik atau panic dump wajib dilewatkan ke pemfilter ekspresi reguler (*regex sanitization*) berikut sebelum ditulis ke disk atau diekspor oleh pengguna:

```rust
// src-tauri/src/diagnostics/sanitizer.rs
use regex::Regex;
use std::sync::LazyLock;

static COOKIE_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(__Secure-3PSID|SAPISID|HSID|SSID|APISID|SID)=([a-zA-Z0-9_\-\.]{10,})")
        .expect("Valid regex")
});

static AUTH_HEADER_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(Authorization:\s*Bearer\s+)([a-zA-Z0-9_\-\.]{15,})")
        .expect("Valid regex")
});

static PASSWORD_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?i)("?master_password"?\s*[:=]\s*)"([^"]+)""#)
        .expect("Valid regex")
});

pub fn sanitize_diagnostic_text(input: &str) -> String {
    let step1 = COOKIE_REGEX.replace_all(input, "$1=[REDACTED_COOKIE]");
    let step2 = AUTH_HEADER_REGEX.replace_all(&step1, "$1[REDACTED_BEARER_TOKEN]");
    let step3 = PASSWORD_REGEX.replace_all(&step2, r#"$1"[REDACTED_PASSWORD]""#);
    step3.to_string()
}
```

### 9.3 Format Standar Laporan Crash Tersanitasi

Contoh berkas `crash_20260924_143000.log` yang telah tersanitasi aman:

```
=== FLOW STUDIO SANITIZED CRASH REPORT ===
Document ID: DOC-RUN-001 / Crash Handler v1.0
App Version: 1.0.0 (Windows x64 MSVC)
OS Version: Microsoft Windows 11 Pro 10.0.22631
Timestamp: 2026-09-24T14:30:00.123456Z

Panic Location: src-tauri/src/export/ffmpeg_supervisor.rs:184:13
Message: Subprocess FFmpeg returned unexpected STATUS_ACCESS_VIOLATION during demux concat.

Sanitization Verification:
- Plaintext Cookies: ZERO DETECTED (Masked)
- Auth Bearer Tokens: ZERO DETECTED (Masked)
- Master Password: ZERO DETECTED (Masked)

Backtrace:
   0: std::backtrace::Backtrace::create
   1: flow_studio::diagnostics::panic_handler::setup_custom_panic_hook::{{closure}}
   2: std::panicking::rust_panic_with_hook
   3: flow_studio::export::ffmpeg_supervisor::execute_concat_pipeline
   4: tokio::runtime::task::core::CoreStage::poll
   5: tokio::runtime::scheduler::multi_thread::worker::Context::run
=== END OF REPORT ===
```

### 9.4 Kebijakan Rotasi Berkas Log

Sesuai `SRS.md` Section 5.8:
- Berkas log aplikasi dirotasi harian: `flow_studio_YYYY-MM-DD.log`.
- Ukuran maksimal per berkas log: **10 MB**.
- Jumlah retensi maksimal: **5 berkas log** (Total kapasitas maksimal $\le 50$ MB).
- Berkas log tertua otomatis dihapus (*rolling overwrite*) saat batas retensi tercapai.

---

## 10. Smoke Tests Pasca-Instalasi (Post-Install Smoke Testing)

Setelah proses instalasi awal atau pembaruan versi selesai pada workstation pengguna, lakukan checklist verifikasi kesehatan sistem (*health check checklist*) berikut:

| Item Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
|---|---|---|:---:|
| **1. Cold Start Launch** | Jalankan aplikasi melalui shortcut desktop atau Start Menu. | Aplikasi terbuka dalam waktu $< 3.0$ detik (NFR-008); jendela utama dirender tanpa visual glitch. | [ ] |
| **2. Storage & SQLite Init** | Periksa folder `%APPDATA%\FlowStudio`. | Berkas `flow_studio.db`, `flow_studio.db-wal`, dan subdirektori `logs/` terbentuk otomatis dengan permission aman. | [ ] |
| **3. Vault Initialization** | Masukkan master password baru pada dialog inisialisasi awal. | Brankas terinisialisasi, kunci diturunkan via Argon2id (RAM 64MB), status vault berubah menjadi `UNLOCKED`. | [ ] |
| **4. FFmpeg Sidecar Probe** | Buka menu *Settings* -> *Subsystem Health* -> Klik tombol *"Probe FFmpeg"*. | Menampilkan versi biner FFmpeg 6.0+ terpasang beserta codec H.264/AAC aktif. | [ ] |
| **5. Google Flow Egress** | Klik *"Test Connection"* pada Account Manager. | Status konektivitas HTTPS port 443 ke `flow.google.com` sukses (HTTP 200/302). | [ ] |
| **6. Visual Canvas Node Add**| Buat proyek baru; tambahkan 3 node prompt; hubungkan edge. | Node terhubung mulus tanpa drop frame; status tersimpan di memori proyek lokal. | [ ] |
| **7. Disk Space Check** | Amati indikator kapasitas disk pada status bar bawah. | Menampilkan kapasitas sisa drive lokal (peringatan jika sisa ruang $< 5$ GB). | [ ] |

---

## 11. Klasifikasi Keparahan Insiden & Prosedur Eskalasi (Incident Severity & Escalation)

Meskipun dioperasikan secara lokal, Flow Studio mengadopsi taksonomi keparahan insiden untuk memprioritaskan investigasi bug, hotfix rilis, dan komunikasi rilis perbaikan.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      INCIDENT SEVERITY HIERARCHY                       │
├────────────────────────────────────────────────────────────────────────┤
│ SEV-1: CRITICAL   - Kebocoran Kredensial / Kerusakan Database Permanen │
│ SEV-2: MAJOR      - Semua Akun Terblokir / FFmpeg Crash Total         │
│ SEV-3: MODERATE   - Satu Akun Expired / Kegagalan Transient Segmen     │
│ SEV-4: MINOR      - Masalah Kosmetik UI / Glitch Visual Non-Blokir     │
└────────────────────────────────────────────────────────────────────────┘
```

### 11.1 Matriks Tingkat Keparahan Insiden

| Severity | Definisi & Dampak | Contoh Kasus Nyata | Target Resolusi / SLA | Tindakan Operasional |
|---|---|---|---|---|
| **SEV-1 (Critical)** | Insiden keamanan kritis, kebocoran plaintext kredensial, atau korupsi permanen basis data utama yang tidak dapat dipulihkan. | - Plaintext cookie tertulis di log.<br>- Panic loop saat membuka aplikasi.<br>- Master password gagal membuka vault valid. | **< 2 Jam**<br>(Immediate Hotfix) | 1. Tarik rilis installer dari distribusi publik.<br>2. Freeze seluruh pekerjaan fitur.<br>3. Rilis versi patch darurat (cth: `v1.0.1`). |
| **SEV-2 (Major)** | Kerusakan fungsionalitas inti P0: pipeline tidak dapat mengeksekusi generasi video pada semua akun, atau ekspor final selalu crash. | - Perubahan API mendadak dari Google Flow yang merusak router.<br>- FFmpeg crash saat concat video.<br>- Kuota pool hang total. | **< 6 Jam**<br>(Same-Day Patch) | 1. Analisis respons jaringan upstream via proxy.<br>2. Perbarui regex header / endpoint API.<br>3. Distribusikan update biner terverifikasi. |
| **SEV-3 (Moderate)** | Hambatan fungsional parsial yang memiliki *workaround* alternatif atau hanya berdampak pada segmen spesifik. | - 1 akun dari 5 akun di pool expired.<br>- Frame rate canvas drop saat 80+ node.<br>- Cache folder temp tidak terhapus otomatis. | **< 24 Jam**<br>(Next Minor/Patch) | 1. Tampilkan peringatan pemulihan di UI.<br>2. Dokumentasikan solusi sementara di runbook.<br>3. Jadwalkan perbaikan pada sprint aktif. |
| **SEV-4 (Minor)** | Masalah visual, kosmetik, ketidaksesuaian tipografi, atau teks log yang kurang informatif tanpa memengaruhi eksekusi. | - Tooltip node salah format.<br>- Tombol zoom offset beberapa pixel.<br>- Indikator progress bar melompat dari 90% ke 100%. | **Regular Sprint**<br>(Scheduled Release) | Masukkan ke backlog pemeliharaan reguler. |

---

## 12. Prosedur Rollback Versi (Rollback Procedure)

Jika versi rilis baru mengalami regresi fatal pada workstation pengguna (seperti insiden SEV-1 atau SEV-2), ikuti prosedur *clean rollback* ke versi stabil sebelumnya:

```
[Uninstall Versi Rusak] ──> [Preserve AppData DB] ──> [Install Versi Stabil] ──> [Verifikasi Schema]
```

1. **Amankan Data Lokal (Crucial Step):**
   Pastikan direktori `%APPDATA%\FlowStudio` tidak dihapus. Jalankan skrip cadangan darurat:
   ```powershell
   Copy-Item -Path "$env:APPDATA\FlowStudio" -Destination "$env:USERPROFILE\Desktop\FlowStudio_Emergency_Backup" -Recurse
   ```
2. **Uninstall Versi Baru:**
   - Buka *Settings* Windows -> *Installed Apps* -> Pilih *Flow Studio* -> Klik *Uninstall*.
   - Uninstaller Flow Studio secara sengaja **tidak menghapus** berkas database `%APPDATA%` untuk menjaga kedaulatan data pengguna.
3. **Instalasi Versi Stabil Sebelumnya (Downgrade):**
   - Jalankan installer versi stabil sebelumnya (misalnya `FlowStudio_0.9.8_x64-setup.exe`).
   - Selesaikan wizard instalasi hingga tuntas.
4. **Verifikasi Kompatibilitas Skema Database:**
   - Luncurkan aplikasi. Modul persistensi Rust akan memvalidasi versi skema SQLite.
   - Jika versi database lebih tinggi dari biner (akibat migrasi maju), jalankan skrip migrasi turun (*down-migration*) sesuai panduan `MIGRATION.md` atau pulihkan berkas `flow_studio.db` dari backup sebelum upgrade.
5. **Verifikasi Fungsionalitas Pasca-Downgrade:**
   Jalankan checklist *Smoke Test* pada Seksi 10 untuk memastikan brankas dan koneksi upstream kembali normal.

---

## 13. Kepemilikan Sistem & Tata Kelola Rilis (System Ownership)

| Peran Tanggung Jawab | Pemilik (*Owner*) | Lingkup Tugas & Wewenang |
|---|---|---|
| **Software Architect & Planning Lead** | Solo Lead / Core Architect | Otorisasi rilis biner resmi, penandatanganan sertifikat produksi, review insiden keamanan SEV-1/SEV-2, tata kelola skema SQLite. |
| **Desktop Release Engineer** | CI/CD Automated Workflow | Orkestrasi build multi-target, verifikasi hash SHA-256, kompilasi installer NSIS/MSI, pemindaian kerentanan dependensi. |
| **Workstation Operator** | End-User (Owner Workstation) | Pengelolaan master password vault, eksekusi backup database berkala, input kredensial pool akun Google Flow. |

---

## 14. Referensi Silang Dokumen Terkait

- **`DOC-ARCH-001` (ARCHITECTURE.md):** Arsitektur Modular Monolith, topologi proses Tauri 2.x, batas trust boundary, dan model persistensi SQLite WAL.
- **`DOC-SEC-001` (SECURITY.md):** Standar kriptografi AES-256-GCM / Argon2id, model ancaman STRIDE, isolasi memori, dan zeroization buffer.
- **`DOC-API-001` (API.md):** Kontrak perintah Tauri IPC commands, format event streaming, dan taksonomi canonical error envelope.
- **`DOC-QUAL-001` (CODE_QUALITY.md):** Standar kualitas kode, aturan anti-AI-slop (HARD-001 s/d HARD-006), dan ambang batas kompleksitas.
- **`DOC-ENV-001` (ENVIRONMENT.md):** Konfigurasi variabel lingkungan, spesifikasi platform host, dan prasyarat instalasi WebView2/FFmpeg.
- **`DOC-ERD-001` (ERD.md):** Skema tabel SQLite lokal, relasi entitas, constraint referensial, dan tagging klasifikasi PII data.
