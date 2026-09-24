# API Specification: Flow Studio (Tauri IPC & Internal Flow-Router)

> **Project:** Flow Studio  
> **Document ID:** DOC-API-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-ERD-001, DOC-PERM-001  
> **Supersedes:** None  

---

## 1. Executive Summary & Scope

Dokumen ini mendefinisikan kontrak antarmuka pemrograman aplikasi (API Contract) untuk **Flow Studio**. Berbeda dengan arsitektur web konvensional berbasis REST API publik HTTP, Flow Studio beroperasi secara eksklusif sebagai aplikasi desktop Windows yang dibangun di atas framework **Tauri 2.x**. Batas antarmuka utama (IPC boundary) berada di antara **React 19 Frontend** (Webview2) dan **Rust Backend Core**, yang berkomunikasi melalui mekanisme native IPC Tauri:
1. **Tauri Commands (`invoke`)**: Komunikasi request-response dua arah (asinkron) dari frontend ke backend.
2. **Tauri Events (`emit` / `listen`)**: Aliran pesan satu arah (pub/sub asinkron) secara real-time dari backend ke frontend untuk streaming progress, perubahan status kredit, dan event lifecycle.
3. **Internal Rust API (`flow-router`)**: Kontrak in-process antara modul orkestrator pipeline, modul manajemen vault/akun, dan HTTP client internal yang berkomunikasi dengan layanan Google Flow melalui reverse-engineered API.

Semua payload IPC diatur secara ketat menggunakan pendekatan **contract-first** dan diverifikasi secara type-safe saat kompilasi menggunakan library `tauri-specta`. Setiap pemanggilan command mengembalikan tipe result terstandar dengan **canonical error envelope** seragam.

---

## 2. API Principles & Design Conventions

### 2.1 Contract-First & Type-Safe IPC
- **Single Source of Truth:** Definisi Rust struct pada backend bertindak sebagai schema otoritatif. Generator binding `specta` / `tauri-specta` secara otomatis menghasilkan TypeScript definitions (`src/bindings.ts`) untuk frontend pada build time.
- **Strict Serialization:** Semua pertukaran data menggunakan format JSON terstandardisasi via `serde` dan `serde_json`. Penamaan properti pada boundary IPC menggunakan konvensi `camelCase` di frontend yang dipetakan ke `snake_case` di backend melalui macro attribute Rust `#[serde(rename_all = "camelCase")]`.
- **Zero Raw Pointers / Arbitrary Objects:** Tidak ada command yang menerima atau mengembalikan data sembarang (`any`, untyped JSON string, atau map kosong tanpa skema).

### 2.2 IPC Transport Mechanics
- **Invoke Bridge:** Frontend memanggil `invoke<T>(command_name, args)` yang dipetakan ke handler Rust yang didekorasi dengan `#[tauri::command]`.
- **Binary/Heavy Asset Offloading:** File video hasil generasi dan frame referensi resolusi tinggi tidak dialirkan sebagai byte array base64 melalui IPC payload karena overhead memory serialization. Sebagai gantinya, IPC hanya mentransfer metadata dan path file absolut/relatif terverifikasi di local filesystem. File media dimuat oleh frontend melalui custom asset protocol Tauri (`asset://` atau streaming local chunk).

### 2.3 Semantic Versioning & Compatibility
- Kontrak IPC mengadopsi Semantic Versioning (SemVer 2.0.0). Format versi kontrak: `MAJOR.MINOR.PATCH`.
  - `MAJOR`: Perubahan breaking pada payload (penghapusan field, perubahan tipe data, perubahan nama command).
  - `MINOR`: Penambahan command baru atau penambahan optional field pada request/response tanpa merusak client sebelumnya.
  - `PATCH`: Perbaikan bug internal, perubahan deskripsi error code, atau optimasi kinerja backend tanpa perubahan interface.

---

## 3. Authentication, Vault Session & Permission Model

### 3.1 Local Authentication Lifecycle
Flow Studio tidak memiliki sistem user/role multi-tenant berbasis cloud. Keamanan berpusat pada **Master Password** lokal yang melindungi **Credential Vault** (SQLite terenkripsi AES-256-GCM dengan Argon2id key derivation sesuai FR-040, FR-041, FR-042).

```
                      ┌──────────────────────┐
                      │    UNINITIALIZED     │
                      └──────────┬───────────┘
                                 │ setup_vault (API-VAULT-001)
                                 ▼
                      ┌──────────────────────┐
                 ┌───►│        LOCKED        │◄──┐
                 │    └──────────┬───────────┘   │
                 │               │ unlock_vault  │
    lock_vault   │               │ (API-VAULT-002)
 (API-VAULT-003) │               ▼               │ Inactivity 15 mins /
        OR       │    ┌──────────────────────┐   │ Bad session
    app restart  └────┤       UNLOCKED       ├───┘
                      │ (Key active in memory│
                      └──────────────────────┘
```

1. **State `UNINITIALIZED`:** Aplikasi pertama kali dibuka. Master password belum dibuat. Hanya command `setup_vault` dan `check_vault_status` yang diizinkan.
2. **State `LOCKED`:** Database vault tertutup atau encryption key telah di-zeroize dari RAM. Command yang membutuhkan akses credential Google Flow ditolak dengan error `E_VAULT_LOCKED`.
3. **State `UNLOCKED`:** Master password terverifikasi. Kunci enkripsi AES-256 turunan disimpan di memory buffer khusus (`secrecy::SecretBox` atau `zeroize::Zeroize`). Command pembuat generasi dan manajemen akun dapat beroperasi.
4. **Session Timeout & Auto-Lock (FR-042):** Timer inaktivitas 15 menit berjalan di backend. Setiap pemanggilan IPC memperbarui timestamp aktivitas. Jika timeout tercapai, buffer kunci dihapus secara paksa dari memory dan event `vault:state_changed` dipublikasikan ke frontend.
5. **Non-Interrupting In-Progress Execution:** Pipeline generasi yang sedang aktif berjalan tetap memiliki copy handle session credential lokal hingga segmennya selesai; status lock hanya memblokir dispatch operasi baru.

### 3.2 Anti-Brute Force Cooldown
- Jika pemanggilan `unlock_vault` mengalami kegagalan verifikasi password sebanyak 3 kali berturut-turut, backend mengaktifkan periode penalti cooldown selama **30 detik**.
- Selama periode cooldown, setiap request `unlock_vault` langsung ditolak dengan status error `E_VAULT_RATE_LIMITED` beserta informasi sisa waktu penalti (`retryAfterSeconds`).

### 3.3 Command Permission Matrix

Setiap command diklasifikasikan ke dalam 4 tingkatan otorisasi:
- **`PUBLIC`**: Dapat dipanggil kapan saja tanpa syarat status vault (e.g. `check_vault_status`, `list_projects`).
- **`VAULT_LOCKED_REQUIRED`**: Hanya dapat dipanggil saat vault terkunci atau belum dibuat (e.g. `setup_vault`, `unlock_vault`).
- **`VAULT_UNLOCKED_REQUIRED`**: Memerlukan status vault `UNLOCKED` (e.g. `add_account`, `generate_video`, `list_accounts`).
- **`PIPELINE_MUTEX_REQUIRED`**: Memerlukan kepemilikan lock eksekusi tunggal; tidak boleh dijalankan jika pipeline generasi lain sedang aktif (e.g. `generate_video`, `concat_segments`).

| Operation ID | Command Name | Permission Tier | Concurrency Scope |
|---|---|---|---|
| `API-VAULT-001` | `setup_vault` | `VAULT_LOCKED_REQUIRED` | Exclusive |
| `API-VAULT-002` | `unlock_vault` | `VAULT_LOCKED_REQUIRED` | Exclusive |
| `API-VAULT-003` | `lock_vault` | `VAULT_UNLOCKED_REQUIRED`| Exclusive |
| `API-VAULT-004` | `check_vault_status` | `PUBLIC` | Shared / Concurrent |
| `API-VAULT-005` | `reset_vault` | `PUBLIC` (Requires confirmation flag) | Exclusive (Wipes DB) |
| `API-ACCT-001` | `add_account` | `VAULT_UNLOCKED_REQUIRED` | Mutex Account Pool |
| `API-ACCT-002` | `remove_account` | `VAULT_UNLOCKED_REQUIRED` | Mutex Account Pool |
| `API-ACCT-003` | `list_accounts` | `VAULT_UNLOCKED_REQUIRED` | Shared / Concurrent |
| `API-ACCT-004` | `get_account_credits` | `VAULT_UNLOCKED_REQUIRED` | Shared / Concurrent |
| `API-ACCT-005` | `health_check_account`| `VAULT_UNLOCKED_REQUIRED` | Mutex per Account ID |
| `API-ACCT-006` | `reauth_account` | `VAULT_UNLOCKED_REQUIRED` | Mutex per Account ID |
| `API-ACCT-007` | `update_account_label`| `VAULT_UNLOCKED_REQUIRED` | Mutex Account Pool |
| `API-GEN-001` | `generate_video` | `VAULT_UNLOCKED_REQUIRED` | `PIPELINE_MUTEX_REQUIRED` |
| `API-GEN-002` | `get_generation_status`| `PUBLIC` | Shared / Concurrent |
| `API-GEN-003` | `cancel_generation` | `PUBLIC` | Exclusive to Active Job |
| `API-GEN-004` | `download_result` | `VAULT_UNLOCKED_REQUIRED` | Mutex per Segment |
| `API-CONT-001` | `extract_frame` | `PUBLIC` | Concurrent Worker Pool |
| `API-CONT-002` | `get_prompt_context` | `PUBLIC` | Shared / Pure Read |
| `API-CONT-003` | `set_style_lock` | `PUBLIC` | Project Mutex |
| `API-EXP-001` | `concat_segments` | `PUBLIC` | `PIPELINE_MUTEX_REQUIRED` |
| `API-EXP-002` | `preview_export` | `PUBLIC` | Exclusive Export Worker |
| `API-EXP-003` | `export_video` | `PUBLIC` | `PIPELINE_MUTEX_REQUIRED` |
| `API-EXP-004` | `export_segment` | `PUBLIC` | Concurrent Export Worker|
| `API-PROJ-001` | `save_project` | `PUBLIC` | Mutex per Project File |
| `API-PROJ-002` | `load_project` | `PUBLIC` | Shared / Pure Read |
| `API-PROJ-003` | `list_projects` | `PUBLIC` | Shared / Pure Read |
| `API-PROJ-004` | `delete_project` | `PUBLIC` | Mutex per Project File |

---

## 4. Canonical Error Envelope & Error Taxonomy

Semua Tauri Command mengembalikan Rust `Result<T, IpcError>`, di mana `IpcError` diserialisasi menjadi canonical envelope tunggal yang konsisten di frontend.

### 4.1 Schema Envelope TypeScript & Rust

#### Definisi Rust (`src-tauri/src/error.rs`)
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcError {
    pub code: String,
    pub message: String,
    pub domain: ErrorDomain,
    pub details: Option<serde_json::Value>,
    pub timestamp: i64, // Unix ms
    pub retryable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorDomain {
    Vault,
    Account,
    Generation,
    Continuity,
    Export,
    Project,
    Ipc,
    Internal,
}
```

#### Definisi TypeScript (`src/types/ipc.ts`)
```typescript
export type ErrorDomain =
  | 'VAULT'
  | 'ACCOUNT'
  | 'GENERATION'
  | 'CONTINUITY'
  | 'EXPORT'
  | 'PROJECT'
  | 'IPC'
  | 'INTERNAL';

export interface IpcError {
  code: string;
  message: string;
  domain: ErrorDomain;
  details?: Record<string, unknown> | null;
  timestamp: number; // Unix timestamp ms
  retryable: boolean;
}

export type IpcResult<T> = 
  | { success: true; data: T }
  | { success: false; error: IpcError };
```

### 4.2 Error Taxonomy Catalog

Setiap kode error memiliki format terstruktur `E_{DOMAIN}_{SPECIFIC_CODE}`:

| Error Code | HTTP-Equivalent | Retryable | Deskripsi |
|---|---|---|---|
| **Domain: VAULT** | | | |
| `E_VAULT_NOT_INITIALIZED` | 404 | No | Vault belum pernah di-setup (belum ada master password). |
| `E_VAULT_ALREADY_EXISTS` | 409 | No | `setup_vault` dipanggil pada database vault yang sudah terinisialisasi. |
| `E_VAULT_LOCKED` | 401 | No | Operasi membutuhkan vault terbuka, namun vault dalam kondisi locked. |
| `E_VAULT_INVALID_PASSWORD` | 403 | No | Master password salah. |
| `E_VAULT_RATE_LIMITED` | 429 | Yes (after delay) | Password salah 3x berturut-turut, penalti cooldown aktif. |
| `E_VAULT_CORRUPT` | 500 | No | File SQLite atau integritas header database terdistorsi / hash gagal. |
| **Domain: ACCOUNT** | | | |
| `E_ACCT_INVALID_COOKIE` | 400 | No | Struktur cookie JSON malformed atau tidak memiliki field autentikasi Google. |
| `E_ACCT_SESSION_EXPIRED` | 401 | No | Session cookie ditolak Google Flow (401/403 HTTP status). |
| `E_ACCT_NOT_FOUND` | 404 | No | Account ID yang diminta tidak terdaftar di database. |
| `E_ACCT_ALREADY_EXISTS` | 409 | No | Email atau cookie identity sudah ada di account pool. |
| `E_ACCT_IN_USE` | 409 | Yes (retryable) | Akun sedang menjalankan pipeline aktif dan tidak dapat dihapus. |
| `E_ACCT_ALL_DEPLETED` | 429 | Yes (at reset) | Seluruh akun di pool kehabisan kredit harian dan bulanan. |
| `E_ACCT_NETWORK_ERROR` | 503 | Yes | Gagal menghubungi Google Flow backend saat health check / verifikasi. |
| **Domain: GENERATION** | | | |
| `E_GEN_PIPELINE_BUSY` | 409 | No | Satu pipeline sedang berjalan; P0 hanya mengizinkan 1 active execution. |
| `E_GEN_JOB_NOT_FOUND` | 404 | No | Job ID tidak ditemukan pada active queue maupun history. |
| `E_GEN_INVALID_NODE_STATE` | 400 | No | Node graph input tidak valid (misal: node Prompt kosong). |
| `E_GEN_UPSTREAM_FAILED` | 502 | Yes | Google Flow mengembalikan HTTP 5xx saat proses pembuatan video. |
| `E_GEN_UPSTREAM_TIMEOUT` | 504 | Yes | Polling status generasi melebihi batas waktu (timeout). |
| `E_GEN_DOWNLOAD_CORRUPT` | 502 | Yes | File video hasil download berukuran 0 byte atau header MP4 invalid. |
| `E_GEN_CANCELLED` | 499 | No | Generasi dibatalkan secara manual oleh Owner. |
| **Domain: CONTINUITY** | | | |
| `E_CONT_FFMPEG_NOT_FOUND` | 500 | No | Binary executable FFmpeg tidak ditemukan di system PATH maupun sidecar. |
| `E_CONT_FRAME_EXTRACTION` | 500 | Yes | Eksekusi FFmpeg ekstraksi frame mengembalikan exit code non-zero. |
| `E_CONT_FILE_NOT_FOUND` | 404 | No | File video input untuk ekstraksi frame tidak ada di filesystem. |
| `E_CONT_CONTEXT_TOO_LONG` | 400 | No | Akumulasi prompt melebihi batas token / karakter Google Flow model. |
| **Domain: EXPORT** | | | |
| `E_EXP_NO_SEGMENTS` | 400 | No | Tidak ada segmen berstatus 'Complete' untuk diekspor. |
| `E_EXP_CONCAT_FAILED` | 500 | No | FFmpeg concat demuxer gagal menggabungkan segmen video. |
| `E_EXP_DISK_FULL` | 507 | No | Sisa kapasitas disk penyimpanan tidak mencukupi estimasi file hasil. |
| `E_EXP_INVALID_DIRECTORY`| 400 | No | Directory output target bersifat read-only atau tidak valid. |
| **Domain: PROJECT** | | | |
| `E_PROJ_FILE_CORRUPTED` | 500 | No | File `.flowproj` tidak dapat diparsing (JSON invalid / schema mismatch). |
| `E_PROJ_WRITE_DENIED` | 403 | No | Permission denied saat menulis file project atau assets di OS filesystem. |
| `E_PROJ_NOT_FOUND` | 404 | No | File project tidak ditemukan di path yang ditentukan. |

---

## 5. Concurrency & Locking Architecture (P0 Specification)

Sesuai arsitektur Fase P0 (MVP Single User Desktop), sistem menerapkan aturan konkurensi deterministik untuk mencegah collision, resource starvation, dan abuse deteksi bot Google:

### 5.1 Pipeline Execution Mutex (`Single Active Pipeline Rule`)
1. **Global Pipeline Lock:** Di backend Rust, pipeline generasi dikendalikan oleh state singleton `Arc<tokio::sync::Mutex<PipelineExecutionState>>`.
2. **Aturan Eksklusif:** Hanya ada **satu (1)** sesi pipeline generasi yang diizinkan berstatus `RUNNING` pada satu waktu.
3. Jika frontend memanggil `API-GEN-001 (generate_video)` saat pipeline lain sedang berjalan, backend segera mengembalikan error `E_GEN_PIPELINE_BUSY` tanpa memblokir thread IPC.
4. **Export Mutual Exclusion:** Selama proses `export_video` atau `concat_segments` berskala besar yang menguras CPU/GPU via FFmpeg berlangsung, pemanggilan `generate_video` baru dicegah untuk mencegah penurunan frame rate OS dan memory exhaustion.

### 5.2 Idempotency Mutation Key
Untuk setiap pemanggilan command yang melakukan mutasi data penting (`setup_vault`, `add_account`, `generate_video`, `export_video`), frontend wajib menyertakan parameter `clientRequestId` (UUID v4).
- Jika command dengan `clientRequestId` yang sama diterima backend dalam window 10 detik terakhir:
  - Backend tidak mengulangi proses bisnis / network call.
  - Backend langsung mengembalikan cached response atau status in-progress yang sedang berjalan.

---

## 6. Command Inventory & Specifications

Katalog berikut merinci 25 Tauri Commands yang terbagi ke dalam 6 grup fungsional.

### 6.1 Grup 1: Vault Commands (`API-VAULT-*`)

#### API-VAULT-001: `setup_vault`
- **Tujuan:** Menginisialisasi credential vault pertama kali dengan master password Owner (FR-040).
- **Precondition:** Vault berstatus `UNINITIALIZED`. File database belum memiliki master salt/hash.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn setup_vault(
      state: State<'_, AppState>,
      request: SetupVaultRequest
  ) -> Result<SetupVaultResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface SetupVaultRequest {
    clientRequestId: string;
    masterPassword: string; // Plaintext, will be Argon2id hashed
    confirmPassword: string;
    autoLockTimeoutMinutes?: number; // Default 15, range: 1 - 120
  }

  export interface SetupVaultResponse {
    status: 'unlocked';
    vaultCreatedAt: number; // Unix ms
    autoLockTimeoutMinutes: number;
  }
  ```
- **Validation Rules:**
  - `masterPassword`: Minimum 8 karakter, tidak boleh hanya whitespace.
  - `masterPassword === confirmPassword`, jika tidak cocok kembalikan `E_VAULT_INVALID_PASSWORD`.
  - `autoLockTimeoutMinutes`: Integer antara 1 hingga 120 (default 15).
- **Payload Example:**
  ```json
  // Request
  {
    "clientRequestId": "550e8400-e29b-41d4-a716-446655440000",
    "masterPassword": "MySecretPassphrase123!",
    "confirmPassword": "MySecretPassphrase123!",
    "autoLockTimeoutMinutes": 15
  }
  // Response
  {
    "status": "unlocked",
    "vaultCreatedAt": 1727164800000,
    "autoLockTimeoutMinutes": 15
  }
  ```

#### API-VAULT-002: `unlock_vault`
- **Tujuan:** Membuka credential vault dengan memverifikasi master password dan menurunkan AES-256-GCM encryption key ke memory (FR-040, FR-041).
- **Precondition:** Vault berstatus `LOCKED`. Cooldown penalti tidak aktif.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn unlock_vault(
      state: State<'_, AppState>,
      request: UnlockVaultRequest
  ) -> Result<UnlockVaultResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface UnlockVaultRequest {
    masterPassword: string;
  }

  export interface UnlockVaultResponse {
    status: 'unlocked';
    unlockedAt: number;
    activeAccountCount: number;
  }
  ```
- **Validation Rules:**
  - Verifikasi Argon2id hash. Jika gagal: increment counter kegagalan. Jika counter mencapai 3: aktifkan 30 detik cooldown dan return `E_VAULT_RATE_LIMITED`.
  - Jika password salah (< 3x): return `E_VAULT_INVALID_PASSWORD` dengan detail `remainingAttempts`.
- **Payload Example:**
  ```json
  // Request
  { "masterPassword": "MySecretPassphrase123!" }
  // Response
  {
    "status": "unlocked",
    "unlockedAt": 1727164830000,
    "activeAccountCount": 4
  }
  ```

#### API-VAULT-003: `lock_vault`
- **Tujuan:** Mengunci vault secara manual dan membersihkan encryption key dari memory buffer (FR-042).
- **Precondition:** Vault berstatus `UNLOCKED`.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn lock_vault(state: State<'_, AppState>) -> Result<LockVaultResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface LockVaultResponse {
    status: 'locked';
    lockedAt: number;
  }
  ```
- **Payload Example:**
  ```json
  // Response
  {
    "status": "locked",
    "lockedAt": 1727164900000
  }
  ```

#### API-VAULT-004: `check_vault_status`
- **Tujuan:** Memeriksa status operasional vault saat aplikasi dibuka atau dipulihkan dari idle.
- **Precondition:** `PUBLIC`.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn check_vault_status(state: State<'_, AppState>) -> Result<VaultStatusResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface VaultStatusResponse {
    state: 'uninitialized' | 'locked' | 'unlocked';
    autoLockTimeoutMinutes: number;
    hasActiveLockout: boolean;
    lockoutRemainingSeconds?: number;
    lastUnlockedAt?: number | null;
  }
  ```
- **Payload Example:**
  ```json
  // Response
  {
    "state": "unlocked",
    "autoLockTimeoutMinutes": 15,
    "hasActiveLockout": false,
    "lastUnlockedAt": 1727164830000
  }
  ```

#### API-VAULT-005: `reset_vault`
- **Tujuan:** Tindakan pemulihan darurat jika Owner lupa password. Menghapus database SQLite vault secara permanen dan mereset status ke `UNINITIALIZED`.
- **Precondition:** `PUBLIC` dengan confirmation flag bernilai `I_UNDERSTAND_DATA_LOSS_IS_PERMANENT`.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn reset_vault(
      state: State<'_, AppState>,
      request: ResetVaultRequest
  ) -> Result<ResetVaultResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface ResetVaultRequest {
    confirmationFlag: string;
  }

  export interface ResetVaultResponse {
    success: boolean;
    wipedAt: number;
  }
  ```
- **Validation Rules:**
  - `confirmationFlag` wajib bernilai string persis `"I_UNDERSTAND_DATA_LOSS_IS_PERMANENT"`. Jika tidak sesuai, tolak dengan `E_VAULT_INVALID_PASSWORD`.

---

### 6.2 Grup 2: Account Commands (`API-ACCT-*`)

#### API-ACCT-001: `add_account`
- **Tujuan:** Mengimpor akun Google Flow baru melalui session cookie JSON yang diekstrak dari browser, menguji validitasnya, dan mengenkripsi kredensial ke vault (FR-001, FR-041).
- **Precondition:** Vault `UNLOCKED`.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn add_account(
      state: State<'_, AppState>,
      request: AddAccountRequest
  ) -> Result<AccountDetailResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface AddAccountRequest {
    clientRequestId: string;
    cookieJson: string; // Plaintext JSON array of cookies from browser
    label?: string; // Optional user label, default: "Account #{n}"
  }

  export interface AccountDetailResponse {
    id: string; // UUID v4
    label: string;
    email: string;
    status: 'active' | 'expired' | 'error';
    dailyCreditsRemaining: number;
    dailyCreditsTotal: number;
    monthlyCreditsRemaining?: number | null;
    monthlyCreditsTotal?: number | null;
    nextDailyReset: string; // ISO 8601
    lastHealthCheck: string; // ISO 8601
    inUse: boolean;
    createdAt: string;
  }
  ```
- **Validation Rules:**
  - `cookieJson` wajib berupa serialisasi JSON valid yang mengandung cookie penting Google (`__Secure-1PSID`, `__Secure-3PSID`, atau token flow session terkait). Jika tidak ada, tolak dengan `E_ACCT_INVALID_COOKIE`.
  - Backend memanggil Google Flow API user endpoint. Jika mengembalikan HTTP 401/403, kembalikan `E_ACCT_SESSION_EXPIRED`.
- **Payload Example:**
  ```json
  // Request
  {
    "clientRequestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "cookieJson": "[{\"name\":\"__Secure-1PSID\",\"value\":\"abcd...\",\"domain\":\".google.com\"}]",
    "label": "Work Account 01"
  }
  // Response
  {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "label": "Work Account 01",
    "email": "creator.pro@gmail.com",
    "status": "active",
    "dailyCreditsRemaining": 50,
    "dailyCreditsTotal": 50,
    "monthlyCreditsRemaining": 1000,
    "monthlyCreditsTotal": 1000,
    "nextDailyReset": "2026-09-25T00:00:00Z",
    "lastHealthCheck": "2026-09-24T12:00:00Z",
    "inUse": false,
    "createdAt": "2026-09-24T12:00:00Z"
  }
  ```

#### API-ACCT-002: `remove_account`
- **Tujuan:** Menghapus akun dan semua rekaman kredensial terenkripsi secara permanen dari database lokal (FR-002).
- **Precondition:** Vault `UNLOCKED`. Akun dengan `accountId` tidak sedang `in_use == true`.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn remove_account(
      state: State<'_, AppState>,
      request: RemoveAccountRequest
  ) -> Result<RemoveAccountResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface RemoveAccountRequest {
    accountId: string; // UUID v4
  }

  export interface RemoveAccountResponse {
    removedAccountId: string;
    success: boolean;
  }
  ```
- **Validation Rules:**
  - Jika akun sedang dipakai dalam running pipeline (`in_use == true`), tolak penghapusan dengan error `E_ACCT_IN_USE`.

#### API-ACCT-003: `list_accounts`
- **Tujuan:** Mengambil daftar seluruh akun yang tersimpan beserta ringkasan status dan sisa kredit cached (FR-003).
- **Precondition:** Vault `UNLOCKED`.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn list_accounts(
      state: State<'_, AppState>
  ) -> Result<Vec<AccountDetailResponse>, IpcError>;
  ```

#### API-ACCT-004: `get_account_credits`
- **Tujuan:** Mengambil data kuota kredit spesifik dari satu akun (cached atau refresh) (FR-003).
- **Precondition:** Vault `UNLOCKED`.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn get_account_credits(
      state: State<'_, AppState>,
      accountId: String
  ) -> Result<AccountCreditsResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface AccountCreditsResponse {
    accountId: string;
    dailyRemaining: number;
    dailyTotal: number;
    monthlyRemaining: number | null;
    monthlyTotal: number | null;
    nextResetDaily: string;
    nextResetMonthly: string | null;
  }
  ```

#### API-ACCT-005: `health_check_account`
- **Tujuan:** Melakukan verifikasi session aktif secara langsung ke endpoint Google Flow dan memperbarui cache kredit serta status akun (FR-005).
- **Precondition:** Vault `UNLOCKED`.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn health_check_account(
      state: State<'_, AppState>,
      accountId: String
  ) -> Result<AccountDetailResponse, IpcError>;
  ```
- **Side Effect:** Jika session mati, status diubah menjadi `expired`, dan event `account:session_warning` dipancarkan.

#### API-ACCT-006: `reauth_account`
- **Tujuan:** Memperbarui cookie session akun yang expired setelah Owner login ulang via embedded webview (FR-006).
- **Precondition:** Vault `UNLOCKED`.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn reauth_account(
      state: State<'_, AppState>,
      request: ReauthAccountRequest
  ) -> Result<AccountDetailResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface ReauthAccountRequest {
    accountId: string;
    newCookieJson: string;
  }
  ```

#### API-ACCT-007: `update_account_label`
- **Tujuan:** Memperbarui nama/label display akun untuk kemudahan manajemen antarmuka.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn update_account_label(
      state: State<'_, AppState>,
      accountId: String,
      newLabel: String
  ) -> Result<(), IpcError>;
  ```

---

### 6.3 Grup 3: Generation Commands (`API-GEN-*`)

#### API-GEN-001: `generate_video`
- **Tujuan:** Memulai eksekusi generasi video AI untuk satu segmen atau pipeline rangkaian segmen yang telah disusun di Node Editor (FR-016, FR-024).
- **Precondition:** Vault `UNLOCKED`. Minimal satu akun berstatus `active` dengan kredit > 0. Tidak ada pipeline lain yang sedang berjalan.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn generate_video(
      state: State<'_, AppState>,
      request: GenerateVideoRequest
  ) -> Result<GenerateVideoResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface GenerateVideoRequest {
    clientRequestId: string;
    projectId: string;
    segmentId: string;
    model: 'veo-2' | 'veo-3.1' | 'gemini-omni';
    prompt: string;
    aspectRatio: '16:9' | '9:16' | '1:1';
    seed?: number;
    referenceFramePath?: string | null; // Path absolut/relatif ke PNG frame
    styleLockText?: string | null;
  }

  export interface GenerateVideoResponse {
    jobId: string;
    segmentId: string;
    status: 'queued' | 'generating';
    dispatchedAccountId: string;
    startedAt: number;
  }
  ```
- **Validation Rules:**
  - `prompt`: String 1 - 2000 karakter, tidak boleh kosong.
  - `model`: Salah satu dari string enum yang didukung.
  - `referenceFramePath`: Jika diisi, file harus ada di disk dan berformat valid PNG/JPEG/WEBP.
  - Jika mutex pipeline sedang dipegang oleh job lain: return `E_GEN_PIPELINE_BUSY`.
- **Payload Example:**
  ```json
  // Request
  {
    "clientRequestId": "1e2f3a4b-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
    "projectId": "proj-space-odyssey-2026",
    "segmentId": "seg-001",
    "model": "veo-3.1",
    "prompt": "Cinematic shot of an astronaut stepping onto red Martian dust, dust swirls around boots",
    "aspectRatio": "16:9",
    "seed": 42099,
    "referenceFramePath": null,
    "styleLockText": "Hyperrealistic, 35mm lens, Kodachrome color grading"
  }
  // Response
  {
    "jobId": "job-882194-veo",
    "segmentId": "seg-001",
    "status": "queued",
    "dispatchedAccountId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "startedAt": 1727165000120
  }
  ```

#### API-GEN-002: `get_generation_status`
- **Tujuan:** Mengambil status realtime dari pekerjaan generasi yang sedang aktif atau terakhir selesai (FR-017).
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn get_generation_status(
      state: State<'_, AppState>,
      jobId: String
  ) -> Result<GenerationStatusResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface GenerationStatusResponse {
    jobId: string;
    segmentId: string;
    status: 'queued' | 'generating' | 'downloading' | 'complete' | 'failed' | 'cancelled';
    progressPct: number; // 0 - 100
    videoUrl?: string | null;
    localVideoPath?: string | null;
    errorMessage?: string | null;
    retryCount: number;
    elapsedMs: number;
  }
  ```

#### API-GEN-003: `cancel_generation`
- **Tujuan:** Menghentikan proses generasi yang sedang berjalan secara paksa dan membebaskan account lock.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn cancel_generation(
      state: State<'_, AppState>,
      jobId: String
  ) -> Result<CancelGenerationResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface CancelGenerationResponse {
    jobId: string;
    status: 'cancelled';
    cancelledAt: number;
  }
  ```

#### API-GEN-004: `download_result`
- **Tujuan:** Mengunduh binary video stream dari upstream Google Flow dan menyimpannya sebagai file `.mp4` lokal di project assets directory.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn download_result(
      state: State<'_, AppState>,
      request: DownloadResultRequest
  ) -> Result<DownloadResultResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface DownloadResultRequest {
    jobId: string;
    targetDirectory: string;
    filename: string;
  }

  export interface DownloadResultResponse {
    localPath: string;
    fileSizeBytes: number;
    durationSeconds: number;
  }
  ```

---

### 6.4 Grup 4: Continuity Commands (`API-CONT-*`)

#### API-CONT-001: `extract_frame`
- **Tujuan:** Menjalankan FFmpeg sidecar untuk mengekstrak frame terakhir dari klip video yang selesai di-generate sebagai basis kontinuitas visual segmen berikutnya (FR-020, FR-021).
- **Precondition:** File video sumber tersedia di disk dan FFmpeg binary terdeteksi.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn extract_frame(
      state: State<'_, AppState>,
      request: ExtractFrameRequest
  ) -> Result<ExtractFrameResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface ExtractFrameRequest {
    videoPath: string;
    outputDirectory: string;
    method?: 'sseof' | 'exact_timestamp'; // default: 'sseof' (-sseof -1)
    timestampSeconds?: number;
  }

  export interface ExtractFrameResponse {
    framePath: string; // Absolute path to extracted PNG
    resolution: {
      width: number;
      height: number;
    };
    extractionDurationMs: number;
  }
  ```
- **Command Invocation Execution (FFmpeg CLI):**
  `ffmpeg -y -sseof -1 -i "{videoPath}" -update 1 -q:v 1 "{outputDirectory}/{frameName}.png"`
- **Payload Example:**
  ```json
  // Request
  {
    "videoPath": "D:/FlowProjects/SciFi/assets/seg_001.mp4",
    "outputDirectory": "D:/FlowProjects/SciFi/assets",
    "method": "sseof"
  }
  // Response
  {
    "framePath": "D:/FlowProjects/SciFi/assets/seg_001_last_frame.png",
    "resolution": { "width": 1920, "height": 1080 },
    "extractionDurationMs": 142
  }
  ```

#### API-CONT-002: `get_prompt_context`
- **Tujuan:** Merangkai prompt gabungan dengan membawa konteks visual dan deskripsi dari hingga 3 segmen sebelumnya (Context Carry-Over window) sesuai FR-022.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn get_prompt_context(
      state: State<'_, AppState>,
      request: PromptContextRequest
  ) -> Result<ComposedPromptResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface PromptContextRequest {
    currentPrompt: string;
    previousPrompts: string[]; // Up to 3 prompts
    styleLockText?: string | null;
  }

  export interface ComposedPromptResponse {
    finalComposedPrompt: string;
    styleLockApplied: string | null;
    contextCarryOverApplied: string | null;
    totalCharacters: number;
    isTruncated: boolean;
  }
  ```
- **Formatting Logic:**
  `[Style Lock: {styleLockText}] Continuing from: {prev_prompts.join(" -> ")}. Next scene: {currentPrompt}`

#### API-CONT-003: `set_style_lock`
- **Tujuan:** Mengonfigurasi deskriptor style lock global yang secara otomatis disematkan pada setiap request generasi dalam project (FR-023).
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn set_style_lock(
      state: State<'_, AppState>,
      projectId: string,
      styleLockText: Option<String>
  ) -> Result<StyleLockResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface StyleLockResponse {
    projectId: string;
    styleLockText: string | null;
    updatedAt: number;
  }
  ```

---

### 6.5 Grup 5: Export Commands (`API-EXP-*`)

#### API-EXP-001: `concat_segments`
- **Tujuan:** Menggabungkan daftar segmen video berurutan menjadi satu file output menggunakan FFmpeg concat demuxer (FR-030).
- **Precondition:** Minimal 2 segmen berstatus `complete`. FFmpeg binary ready.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn concat_segments(
      state: State<'_, AppState>,
      request: ConcatSegmentsRequest
  ) -> Result<ExportVideoResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface ConcatSegmentsRequest {
    clientRequestId: string;
    projectId: string;
    segmentPaths: string[];
    outputPath: string;
    format: 'mp4' | 'webm';
    resolution: 'original' | '1080p' | '720p';
  }

  export interface ExportVideoResponse {
    success: boolean;
    outputPath: string;
    durationSeconds: number;
    fileSizeBytes: number;
  }
  ```
- **Security Check:** Argument FFmpeg dibersihkan dan disanitasi. Path diverifikasi bukan system folder Windows (e.g. `C:\Windows`, `C:\Program Files`). Flag `-map_metadata -1` diterapkan untuk menghapus jejak Google Flow session IDs.

#### API-EXP-002: `preview_export`
- **Tujuan:** Membuat file preview cepat (resolusi 720p di direktori temp OS) beserta marker timestamp per segmen untuk ditinjau pada embedded preview player (FR-031).
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn preview_export(
      state: State<'_, AppState>,
      projectId: String
  ) -> Result<PreviewExportResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface PreviewExportResponse {
    previewFilePath: string;
    segmentMarkers: number[]; // Array timestamp detik posisi awal setiap segmen
    totalDurationSeconds: number;
  }
  ```

#### API-EXP-003: `export_video`
- **Tujuan:** Menjalankan export final pipeline proyek secara menyeluruh dengan konfigurasi bitrate, format (MP4 H.264 / WEBM VP9), dan resolusi pilihan (FR-033).
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn export_video(
      state: State<'_, AppState>,
      request: ExportVideoRequest
  ) -> Result<ExportVideoResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface ExportVideoRequest {
    clientRequestId: string;
    projectId: string;
    format: 'mp4' | 'webm';
    resolution: 'original' | '1080p' | '720p';
    videoBitrateKbps?: number; // default: 8000
    audioBitrateKbps?: number; // default: 192
    outputDirectory: string;
    customFilename?: string;
  }
  ```

#### API-EXP-004: `export_segment`
- **Tujuan:** Mengekspor satu segmen individual secara mandiri dari canvas/node context menu ke format target (FR-032).
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn export_segment(
      state: State<'_, AppState>,
      request: ExportSegmentRequest
  ) -> Result<ExportSegmentResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface ExportSegmentRequest {
    segmentId: string;
    sourceVideoPath: string;
    targetPath: string;
    format: 'mp4' | 'webm';
    resolution: 'original' | '1080p' | '720p';
  }

  export interface ExportSegmentResponse {
    exportedPath: string;
    fileSizeBytes: number;
  }
  ```

---

### 6.6 Grup 6: Project Commands (`API-PROJ-*`)

#### API-PROJ-001: `save_project`
- **Tujuan:** Menyimpan graph node editor, layout, dan metadata project ke dalam file format JSON `.flowproj` lokal (FR-018).
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn save_project(
      state: State<'_, AppState>,
      request: SaveProjectRequest
  ) -> Result<SaveProjectResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface ProjectGraphData {
    nodes: Array<{
      id: string;
      type: 'prompt' | 'image' | 'video' | 'generation';
      position: { x: number; y: number };
      data: Record<string, unknown>;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
    }>;
    viewport: { x: number; y: number; zoom: number };
  }

  export interface SaveProjectRequest {
    filePath: string;
    projectName: string;
    settings: {
      defaultModel: string;
      autoSaveIntervalSeconds: number;
      styleLockText?: string | null;
    };
    graph: ProjectGraphData;
  }

  export interface SaveProjectResponse {
    savedPath: string;
    savedAt: string; // ISO 8601
    fileSizeBytes: number;
  }
  ```
- **Safety Guarantee:** Penulisan menggunakan pola atomik: simpan ke file temporary (`.flowproj.tmp`) lalu di-atomic rename untuk mencegah rusaknya file jika aplikasi mengalami crash saat proses save.

#### API-PROJ-002: `load_project`
- **Tujuan:** Membaca file `.flowproj` dan mengembalikan state graph serta referensi asset lokal ke React frontend (FR-018).
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn load_project(
      state: State<'_, AppState>,
      filePath: String
  ) -> Result<LoadProjectResponse, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface LoadProjectResponse {
    projectName: string;
    version: string;
    settings: {
      defaultModel: string;
      autoSaveIntervalSeconds: number;
      styleLockText?: string | null;
    };
    graph: ProjectGraphData;
    assets: string[];
    updatedAt: string;
  }
  ```

#### API-PROJ-003: `list_projects`
- **Tujuan:** Menemukan dan menampilkan riwayat file project terbaru dari default project directory OS.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn list_projects(
      state: State<'_, AppState>
  ) -> Result<Vec<ProjectSummaryResponse>, IpcError>;
  ```
- **TypeScript Types:**
  ```typescript
  export interface ProjectSummaryResponse {
    projectName: string;
    filePath: string;
    lastModified: string;
    segmentCount: number;
  }
  ```

#### API-PROJ-004: `delete_project`
- **Tujuan:** Menghapus file proyek `.flowproj` beserta file autosave terkait.
- **Rust Signature:**
  ```rust
  #[tauri::command]
  pub async fn delete_project(
      state: State<'_, AppState>,
      filePath: String
  ) -> Result<bool, IpcError>;
  ```

---

## 7. Tauri Event Inventory (Real-Time Pub/Sub)

Semua event dikirim dari Rust Backend ke Frontend menggunakan `app_handle.emit(event_name, payload)`. Di frontend, listener didaftarkan melalui `listen<T>(event_name, handler)`.

Setiap event payload wajib mengikutsertakan:
- `sequenceId`: Integer inkremental berurutan untuk mendeteksi out-of-order delivery.
- `timestamp`: Unix timestamp dalam milidetik.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tauri Event System                              │
├──────────────────────────┬──────────────────────────┬──────────────────┤
│ Event Channel            │ Direction                │ Frequency        │
├──────────────────────────┼──────────────────────────┼──────────────────┤
│ generation:progress      │ Rust ──► React           │ High (~1 Hz)     │
│ generation:status_changed│ Rust ──► React           │ Per state change │
│ generation:completed     │ Rust ──► React           │ On completion    │
│ generation:failed        │ Rust ──► React           │ On error         │
│ account:credits_updated  │ Rust ──► React           │ Post generation  │
│ account:session_warning  │ Rust ──► React           │ On expiry/error  │
│ account:rotated          │ Rust ──► React           │ On credit exhaust│
│ vault:state_changed      │ Rust ──► React           │ On lock/unlock   │
│ export:progress          │ Rust ──► React           │ High (~1 Hz)     │
│ export:complete          │ Rust ──► React           │ On concat end    │
└──────────────────────────┴──────────────────────────┴──────────────────┘
```

### 7.1 Katalog Event Spesifikasi

#### API-EVT-001: `generation:progress`
- **Pemicu:** Update progress saat video sedang di-render oleh Google Flow atau sedang di-download ke disk lokal.
- **TypeScript Payload:**
  ```typescript
  export interface GenerationProgressEvent {
    sequenceId: number;
    timestamp: number;
    jobId: string;
    segmentId: string;
    phase: 'queued' | 'rendering' | 'downloading' | 'extracting_frame';
    progressPct: number; // 0 - 100
    detailMessage?: string;
  }
  ```

#### API-EVT-002: `generation:status_changed`
- **Pemicu:** Transisi status node atau segmen pada state machine pipeline.
- **TypeScript Payload:**
  ```typescript
  export interface GenerationStatusChangedEvent {
    sequenceId: number;
    timestamp: number;
    segmentId: string;
    previousStatus: string;
    newStatus: 'idle' | 'queued' | 'generating' | 'downloading' | 'complete' | 'failed' | 'skipped';
  }
  ```

#### API-EVT-003: `generation:completed`
- **Pemicu:** Segmen video tunggal atau keseluruhan pipeline berhasil diselesaikan.
- **TypeScript Payload:**
  ```typescript
  export interface GenerationCompletedEvent {
    sequenceId: number;
    timestamp: number;
    jobId: string;
    segmentId: string;
    videoPath: string;
    durationSeconds: number;
    extractedFramePath?: string | null;
  }
  ```

#### API-EVT-004: `generation:failed`
- **Pemicu:** Generasi segmen gagal setelah seluruh jatah retry terpakai, atau terjadi non-retryable error.
- **TypeScript Payload:**
  ```typescript
  export interface GenerationFailedEvent {
    sequenceId: number;
    timestamp: number;
    jobId: string;
    segmentId: string;
    error: IpcError;
    willHaltPipeline: boolean;
  }
  ```

#### API-EVT-005: `account:credits_updated`
- **Pemicu:** Terjadi pengurangan kuota kredit setelah generasi, atau setelah health check selesai.
- **TypeScript Payload:**
  ```typescript
  export interface AccountCreditsUpdatedEvent {
    sequenceId: number;
    timestamp: number;
    accountId: string;
    dailyRemaining: number;
    monthlyRemaining: number | null;
    totalUsedToday: number;
  }
  ```

#### API-EVT-006: `account:session_warning`
- **Pemicu:** Cookie Google Flow terdeteksi kedaluwarsa atau request ditolak dengan HTTP 401/403.
- **TypeScript Payload:**
  ```typescript
  export interface AccountSessionWarningEvent {
    sequenceId: number;
    timestamp: number;
    accountId: string;
    label: string;
    warningType: 'SESSION_EXPIRED' | 'CAPTCHA_REQUIRED' | 'SUSPECTED_BLOCK';
    message: string;
  }
  ```

#### API-EVT-007: `account:rotated`
- **Pemicu:** Akun aktif kehabisan kredit harian/bulanan sehingga flow-router secara otomatis beralih ke akun berikutnya dalam pool (FR-004).
- **TypeScript Payload:**
  ```typescript
  export interface AccountRotatedEvent {
    sequenceId: number;
    timestamp: number;
    previousAccountId: string;
    newAccountId: string;
    reason: 'CREDIT_EXHAUSTED' | 'RATE_LIMITED' | 'SESSION_ERROR';
    segmentId: string;
  }
  ```

#### API-EVT-008: `vault:state_changed`
- **Pemicu:** Status vault berubah akibat unlock manual, lock manual, auto-lock timeout 15 menit, atau lockout cooldown.
- **TypeScript Payload:**
  ```typescript
  export interface VaultStateChangedEvent {
    sequenceId: number;
    timestamp: number;
    newState: 'uninitialized' | 'locked' | 'unlocked';
    reason: 'USER_ACTION' | 'INACTIVITY_TIMEOUT' | 'INITIALIZATION' | 'FAILED_ATTEMPTS';
  }
  ```

#### API-EVT-009: `export:progress`
- **Pemicu:** Progress transcoding atau perakitan file concat oleh worker FFmpeg.
- **TypeScript Payload:**
  ```typescript
  export interface ExportProgressEvent {
    sequenceId: number;
    timestamp: number;
    projectId: string;
    phase: 'transcoding' | 'concatenating' | 'finalizing';
    progressPct: number;
    currentSegment: number;
    totalSegments: number;
    elapsedSeconds: number;
    estimatedRemainingSeconds: number;
  }
  ```

#### API-EVT-010: `export:complete`
- **Pemicu:** File video gabungan akhir selesai ditulis dan siap diputar.
- **TypeScript Payload:**
  ```typescript
  export interface ExportCompleteEvent {
    sequenceId: number;
    timestamp: number;
    projectId: string;
    outputPath: string;
    fileSizeBytes: number;
    durationSeconds: number;
  }
  ```

---

## 8. Retry Semantics & Failure Recovery

### 8.1 Klasifikasi Error Upstream Google Flow
Untuk menjaga kestabilan unattended pipeline (NFR-005), modul backend mengklasifikasikan setiap error ke dalam kategori tindakan:

```
                          ┌───────────────────────────┐
                          │   HTTP Error Response     │
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┼───────────────────────────┐
           ▼                            ▼                           ▼
    [HTTP 401 / 403]             [HTTP 429 / 0 cred]        [HTTP 5xx / Timeout]
           │                            │                           │
           ▼                            ▼                           ▼
   Non-retryable               Auto-Rotate Account           Transient Error
   Mark account EXPIRED        Switch to next account        Retry (Backoff: 2s, 4s, 8s)
   Emit session_warning        Retry request on Account B    Max 3 attempts
```

1. **Transient Errors (Retryable):**
   - HTTP 500 Internal Server Error, HTTP 502 Bad Gateway, HTTP 503 Service Unavailable, HTTP 504 Gateway Timeout.
   - Network drop, TCP reset, DNS failure temporer.
   - Polling timeout (proses render Google melebihi batas waktu poll).
2. **Quota & Rate Errors (Rotatable):**
   - HTTP 429 Too Many Requests atau Response Body "credit exhausted".
   - Tindakan: Sistem tidak menunggu backoff panjang, melainkan langsung melakukan **Account Rotation** ke akun cadangan berikutnya yang memiliki sisa kredit.
3. **Non-Retryable Errors (Fatal):**
   - HTTP 400 Bad Request (prompt melanggar terms atau parameter tidak valid).
   - HTTP 401 Unauthorized / 403 Forbidden (session mati). Akun ditandai `expired`.
   - File corruption lokal pada reference image.

### 8.2 Backoff Policy Algoritma
Untuk transient errors, sistem menerapkan Exponential Backoff dengan jitter acak untuk menghindari thundering herd:

$$\text{Delay}_i = 2^i \times 1000\text{ ms} \pm \text{RandomJitter}(0, 500\text{ ms})$$

- Attempt 1: 2 detik
- Attempt 2: 4 detik
- Attempt 3: 8 detik
- Setelah 3x percobaan berturut-turut gagal pada akun yang sama:
  - Coba switch ke akun lain jika masih tersedia.
  - Jika seluruh akun gagal atau akun habis: Tandai segmen sebagai `Failed`, pause pipeline, dan pancarkan `generation:failed`.

---

## 9. Internal Rust API Specification (`flow-router` Module)

Modul `flow-router` beroperasi di dalam Rust core backend (bukan daemon terpisah). Modul ini menyediakan antarmuka internal berikut untuk modul `pipeline_executor`:

### 9.1 Rust Traits & Signatures

```rust
use uuid::Uuid;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Handle akun aktif yang di-checkout dari pool untuk eksekusi
pub struct AccountHandle {
    pub account_id: Uuid,
    pub session_cookie: secrecy::SecretString,
    pub daily_remaining: u32,
    pub monthly_remaining: Option<u32>,
}

#[async_trait::async_trait]
pub trait FlowRouterService: Send + Sync {
    /// Memilih akun terbaik (kredit terbanyak) dan menandai `in_use = true`
    async fn select_best_account(&self) -> Result<AccountHandle, RouterError>;

    /// Melepas flag `in_use = false` setelah job generasi selesai
    async fn release_account(&self, handle: AccountHandle) -> Result<(), RouterError>;

    /// Memperbarui catatan pemakaian kredit lokal
    async fn report_credit_used(&self, account_id: Uuid, amount: u32) -> Result<(), RouterError>;

    /// Menangani feedback error dari upstream; trigger rotasi otomatis jika kuota habis
    async fn report_account_error(&self, account_id: Uuid, error: UpstreamError) -> Result<AccountRotationDecision, RouterError>;

    /// Mengirim request pembuatan video ke upstream Google Flow
    async fn dispatch_generation_request(
        &self,
        handle: &AccountHandle,
        payload: &GenerationPayload
    ) -> Result<GoogleFlowJobReceipt, UpstreamError>;

    /// Melakukan polling status task di Google Flow hingga video selesai dibuat
    async fn poll_task_status(
        &self,
        handle: &AccountHandle,
        task_id: &str
    ) -> Result<GoogleFlowTaskResult, UpstreamError>;
}
```

### 9.2 Adapter Header & Network Sanitization
- Setiap request HTTP keluar melalui `reqwest::Client` Rust wajib disematkan header standar browser modern (User-Agent, Sec-Fetch-Dest, Sec-Fetch-Mode, Origin) agar identik dengan interaksi web client resmi Google Flow.
- Proxy HTTP lokal dapat dikonfigurasi melalui application settings jika Owner membutuhkan per-account egress routing.

---

## 10. Client SDK & TypeScript Integration Guide

### 10.1 Tauri-Specta Generated Client
Dengan `tauri-specta`, frontend mengimpor wrapper command dengan autocomplete penuh:

```typescript
// src/services/ipc.ts
import { commands, events } from '../bindings';

// Contoh eksekusi command: Unlock Vault
export async function unlockVault(password: string) {
  try {
    const res = await commands.unlockVault({ masterPassword: password });
    return res;
  } catch (err: unknown) {
    const error = err as IpcError;
    console.error(`[${error.code}] ${error.message}`);
    throw error;
  }
}
```

### 10.2 React Custom Hook Contoh (`usePipelineRunner`)

```typescript
// src/hooks/usePipelineRunner.ts
import { useEffect, useState, useCallback } from 'react';
import { commands, events } from '../bindings';
import type { GenerationProgressEvent, IpcError } from '../types/ipc';

export function usePipelineRunner(projectId: string) {
  const [activeJob, setActiveJob] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [phase, setPhase] = useState<string>('idle');
  const [error, setError] = useState<IpcError | null>(null);

  useEffect(() => {
    // Listen to real-time progress events
    const unlistenProgress = events.generationProgress.listen((evt) => {
      const data: GenerationProgressEvent = evt.payload;
      setProgress(data.progressPct);
      setPhase(data.phase);
    });

    const unlistenFail = events.generationFailed.listen((evt) => {
      setError(evt.payload.error);
      setActiveJob(null);
    });

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenFail.then((fn) => fn());
    };
  }, []);

  const triggerSegment = useCallback(async (segmentId: string, prompt: string) => {
    setError(null);
    try {
      const response = await commands.generateVideo({
        clientRequestId: crypto.randomUUID(),
        projectId,
        segmentId,
        model: 'veo-3.1',
        prompt,
        aspectRatio: '16:9'
      });
      setActiveJob(response.jobId);
    } catch (err) {
      setError(err as IpcError);
    }
  }, [projectId]);

  return { activeJob, progress, phase, error, triggerSegment };
}
```

---

## 11. Security & Anti-Abuse Controls

### 11.1 IPC Boundary Attack Mitigation
1. **Isolation Context:** Tauri Webview berjalan dengan context isolation penuh. Script injection dari string prompt yang di-render di canvas tidak dapat mengakses API native Rust secara sembarangan.
2. **Safe Path Normalization:**
   - Semua input path file (`filePath`, `outputDirectory`, `videoPath`) divalidasi oleh fungsi pembantu Rust `validate_safe_path()`:
     - Mencegah Path Traversal (`../` atau `..\`).
     - Memastikan direktori berada dalam drive lokal yang valid dan memiliki permission write.
3. **Subprocess Sanitization:**
   - Command FFmpeg tidak pernah dirakit melalui string concatenation shell (`sh -c` atau `cmd /c`).
   - Eksekusi menggunakan `tokio::process::Command::new("ffmpeg")` dengan argument passing eksplisit melalui `.arg()`, mengeliminasi celah Command Injection.
4. **Memory Hygiene:**
   - Semua variable yang menampung master password dan session cookie dienkapsulasi menggunakan trait `ZeroizeOnDrop` dari crate `zeroize` sehingga memory buffer dihapus seketika setelah variable keluar dari scope.

---

## 12. Verification & Traceability Matrix

Tabel berikut memetakan relasi antara kebutuhan sistem (SRS), referensi PRD, dan implementasi spesifikasi API:

| Requirement ID | Operation ID / Event ID | Domain Function | Acceptance Verification |
|---|---|---|---|
| **FR-040** | `API-VAULT-001`, `API-VAULT-002` | Setup & Unlock Master Password | Master password tersimpan dalam Argon2id; unlock salah 3x memicu cooldown 30 detik. |
| **FR-041** | `API-VAULT-001`, `API-ACCT-001` | AES-256-GCM Credential Vault | SQLite entry terenkripsi dengan nonce unik; raw cookie tidak pernah tersimpan sebagai plaintext. |
| **FR-042** | `API-VAULT-003`, `API-EVT-008` | Inactivity Auto-Lock | Timer 15 menit tanpa aktivitas memicu auto-lock dan memancarkan event `vault:state_changed`. |
| **FR-001** | `API-ACCT-001` | Add Account & Validate | Import cookie memvalidasi session ke Google Flow dan menyimpan ke vault berstatus Active. |
| **FR-002** | `API-ACCT-002` | Remove Account | Kredensial dan cache terhapus permanen dari SQLite; tolak jika akun sedang `in_use`. |
| **FR-003** | `API-ACCT-003`, `API-ACCT-004` | List & Credits Query | Menampilkan kuota harian/bulanan; polling update counter. |
| **FR-004** | `API-EVT-007` | Automatic Account Rotation | Saat kredit habis (HTTP 429), router otomatis berpindah ke akun berikutnya tanpa error fatal. |
| **FR-005** | `API-ACCT-005`, `API-EVT-006` | Session Health Check | Memverifikasi keabsahan cookie; memancarkan peringatan jika terdeteksi expired. |
| **FR-016** | `API-GEN-001` | Dispatch Video Generation | Model selection, prompt, dan aspect ratio terkirim secara tepat ke Google Flow. |
| **FR-018** | `API-PROJ-001`, `API-PROJ-002` | Save & Load Project | File `.flowproj` disimpan atomik; graph visual dipulihkan secara identik. |
| **FR-020** | `API-CONT-001` | Last Frame Extraction | FFmpeg sidecar mengekstrak frame terakhir berformat PNG `-sseof -1`. |
| **FR-022** | `API-CONT-002` | Context Carry-Over | Prompt dirangkai dengan context 3 segmen terakhir dan style lock. |
| **FR-024** | `API-GEN-001`, `API-EVT-001` | Sequential Pipeline Run | Segmen N selesai sebelum N+1; UI menerima update status berkala. |
| **FR-030** | `API-EXP-001` | Video Concatenation | FFmpeg concat demuxer menggabungkan segmen menjadi satu file utuh. |
| **FR-031** | `API-EXP-002` | Full Video Preview | File temporary 720p terbuat beserta marker posisi detik junction antar segmen. |
| **FR-033** | `API-EXP-003` | Transcode & Export Video | Output MP4 (H.264) atau WebM (VP9) dengan resolusi pilihan Owner. |
| **NFR-003** | `API-GEN-001` (Retry Logic) | Auto-Retry Generation | Maksimal 3 retry attempt dengan exponential backoff (2s, 4s, 8s). |
| **NFR-004** | All Vault & Account APIs | Credential Protection | Tidak ada credential di plaintext logs, file temp, atau unhandled crash error. |
