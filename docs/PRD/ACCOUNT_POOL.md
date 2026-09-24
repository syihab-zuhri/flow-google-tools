# PRD: Account Pool

> **Feature ID:** FEAT-ACCOUNT_POOL  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Priority:** P0  
> **Owner:** Backend Agent  
> **Dependencies:** FEAT-CREDENTIAL_VAULT  
> **Last Updated:** 2026-09-24

---

## 1. Overview

Account Pool adalah modul `flow-router` di Rust backend yang berfungsi sebagai 9router-style proxy untuk pooling multiple akun Google Flow. Modul ini mengelola siklus hidup session (cookies dan tokens), melacak kredit (50 free harian per akun + kredit subscription bulanan), melakukan rotasi otomatis saat kredit habis, dan mendispatch generation request ke Google Flow backend melalui reverse-engineered HTTP endpoint.

Fitur ini menjadi fondasi utama pipeline execution — tanpa account pool yang berfungsi, tidak ada generasi video yang dapat dijalankan. Desain single-user (Owner) memungkinkan arsitektur yang disederhanakan tanpa multi-tenant overhead, namun tetap memerlukan enkripsi kuat karena menyimpan credential pihak ketiga.

Referensi SRS: Functional Requirements §4.1 (Account Management), §4.5 (Security — Credential Management).

---

## 2. Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G-001 | Memaksimalkan utilisasi kredit lintas semua akun yang terdaftar | ≥ 95% kredit harian terpakai sebelum pipeline berhenti karena "All accounts depleted" |
| G-002 | Mengeliminasi intervensi manual saat akun aktif kehabisan kredit | Zero manual account switch selama pipeline execution yang normal |
| G-003 | Memastikan session credential selalu terenkripsi dan tidak pernah terekspos di log | Zero plaintext credential di log file, console output, dan crash dump |
| G-004 | Menyediakan visibilitas real-time terhadap kapasitas kredit seluruh pool | Owner dapat melihat status kredit semua akun dalam < 3 detik setelah membuka account panel |
| G-005 | Meminimalkan downtime akibat session expired | Notifikasi proaktif saat session mendekati expiry; re-auth flow tersedia dalam ≤ 2 klik |

---

## 3. Non-Goals (khusus fitur ini)

| # | Non-Goal | Alasan |
|---|----------|--------|
| NG-001 | Automated Google login (credential stuffing) | Melanggar ToS Google; Owner melakukan login manual di browser lalu export cookie |
| NG-002 | Multi-user access ke account pool yang sama | Aplikasi single-user; tidak ada sharing atau permission delegation |
| NG-003 | Billing management atau pembayaran subscription Google Flow | Di luar scope — Owner mengelola subscription langsung di Google |
| NG-004 | Proxy chaining atau IP rotation | Tidak diperlukan untuk personal use; jika dibutuhkan, Owner menggunakan system-level proxy |
| NG-005 | Cookie extraction otomatis dari browser yang sedang berjalan | Risiko keamanan dan kompatibilitas; Owner menggunakan browser extension terpisah untuk export cookie |

---

## 4. Actors & Permissions

| Actor | Tipe | Deskripsi | Permissions |
|-------|------|-----------|-------------|
| Owner | Human — sole user | Satu-satunya pengguna aplikasi. Mengelola akun, memicu pipeline, memonitor kredit. | Full access: CRUD akun, trigger health check, view credits, execute pipeline, configure rotation policy |
| Google Flow Backend | External system | Server Google yang menerima generation request dan mengembalikan video. Berkomunikasi via HTTPS. | Receive-only: menerima HTTP request dari flow-router, mengembalikan response. Tidak memiliki akses ke sistem lokal. |
| Credential Vault | Internal subsystem | Modul penyimpanan terenkripsi (SQLite + AES-256-GCM). Dependency wajib. | Menyimpan dan mendekripsi credential atas permintaan flow-router. Tidak menginisiasi operasi sendiri. |
| Pipeline Executor | Internal subsystem | Modul yang menjalankan node graph secara sequential. Consumer utama dari account pool. | Request account allocation, release account setelah generation selesai, receive rotation event. |

---

## 5. Preconditions

| # | Precondition | Validasi |
|---|-------------|----------|
| PC-001 | Credential vault sudah di-unlock (master password dimasukkan) | `vault.is_unlocked() == true`; jika locked, tampilkan unlock dialog sebelum operasi account pool |
| PC-002 | Minimal satu akun Google Flow sudah ditambahkan ke pool | `account_pool.count() >= 1`; jika kosong, tampilkan empty state dengan CTA "Add Account" |
| PC-003 | Koneksi internet tersedia untuk health check dan generation dispatch | Network reachability check ke Google Flow endpoint; jika offline, tampilkan warning dan gunakan cached credit data |
| PC-004 | FFmpeg tersedia di PATH atau bundled (untuk downstream pipeline) | Diperiksa saat application startup; warning jika tidak ditemukan |

---

## 6. User Stories

### US-ACCT-001: Import Akun via Cookie
**Sebagai** Owner, **saya ingin** menambahkan akun Google Flow dengan mengimport cookie dari browser **agar** saya dapat mempoolkan kredit akun tersebut.

**Detail:**
- Owner mengekstrak cookie dari browser menggunakan extension (misal: EditThisCookie, Cookie-Editor) dalam format JSON.
- Owner mem-paste JSON ke dialog import atau memilih file `.json` via file picker.
- Sistem memvalidasi format cookie, mengirim test request ke Google Flow untuk verifikasi session, dan menyimpan credential terenkripsi ke vault.
- Jika valid, akun muncul di daftar dengan status "Active" beserta informasi kredit awal.

**Kriteria:**
- Format cookie yang diterima: Netscape cookie format dan JSON array `[{name, value, domain, path, ...}]`.
- Validasi session: HTTP GET ke Google Flow dashboard endpoint, expect 200 dengan user info di response.
- Error handling: Cookie format invalid → pesan error spesifik. Session invalid/expired → pesan "Session not valid, please re-export cookies after login."

---

### US-ACCT-002: Lihat Sisa Kredit
**Sebagai** Owner, **saya ingin** melihat sisa kredit untuk setiap akun **agar** saya mengetahui kapasitas generasi yang tersedia.

**Detail:**
- Account panel menampilkan daftar akun dengan kolom: label/email, status, kredit harian tersisa, kredit bulanan tersisa, last updated timestamp.
- Data kredit diambil dari cache lokal, di-refresh saat health check atau on-demand.
- Visual indicator: progress bar per akun, warna hijau (> 50%), kuning (20–50%), merah (< 20%).

---

### US-ACCT-003: Auto-Rotation Akun
**Sebagai** Owner, **saya ingin** sistem otomatis beralih ke akun lain ketika akun aktif kehabisan kredit **agar** generasi video tidak berhenti.

**Detail:**
- Saat generation request mendapat response "credit exhausted" atau kredit tercatat 0, flow-router secara otomatis memilih akun berikutnya dengan kredit terbanyak.
- Jika terjadi mid-generation (request sudah terkirim, response menunjukkan credit depleted), request di-queue ulang ke akun berikutnya.
- Jika seluruh akun habis, pipeline di-pause dan notifikasi "All accounts depleted" ditampilkan.
- Rotasi terjadi tanpa intervensi Owner.

---

### US-ACCT-004: Hapus Akun
**Sebagai** Owner, **saya ingin** menghapus akun dari pool ketika sudah tidak diperlukan **agar** daftar akun tetap bersih.

**Detail:**
- Penghapusan memerlukan konfirmasi dialog: "Hapus akun [label]? Credential, cached credit data, dan session state akan dihapus permanen."
- Jika akun sedang aktif digunakan oleh pipeline, penghapusan ditolak dengan pesan "Account is in use by active pipeline. Stop pipeline first."
- Setelah konfirmasi, semua data terkait dihapus dari SQLite: credential row, credit cache, health check history.

---

### US-ACCT-005: Notifikasi Session Expired
**Sebagai** Owner, **saya ingin** diberi notifikasi ketika session akun expired **agar** saya dapat segera melakukan re-autentikasi.

**Detail:**
- Health check berjalan setiap 30 menit mendeteksi session expired (HTTP 401/403 dari Google Flow).
- Notifikasi in-app muncul dengan detail: akun mana yang expired, kapan terakhir aktif, dan tombol "Re-authenticate".
- Jika pipeline sedang berjalan dan akun yang expired adalah akun aktif, rotasi otomatis ke akun lain terjadi bersamaan dengan notifikasi.
- Jika Owner mengklik "Re-authenticate", embedded webview dibuka untuk login ulang (FR-006).

---

## 7. Functional Flow (happy, alternate, failure)

### 7.1 Happy Path: Import Account → Generation

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│ Owner paste  │────►│ Validate     │────►│ Encrypt &     │────►│ Health Check │
│ cookie JSON  │     │ cookie format│     │ store to vault│     │ + fetch credit│
└─────────────┘     └──────────────┘     └───────────────┘     └──────┬───────┘
                                                                       │
                                                                       ▼
┌──────────────┐     ┌───────────────┐     ┌──────────────┐     ┌─────────────┐
│ Account list │◄────│ Status:Active │◄────│ Credit data  │◄────│ Response 200│
│ updated in UI│     │ label assigned│     │ cached locally│     │ + user info │
└──────────────┘     └───────────────┘     └──────────────┘     └─────────────┘
```

**Langkah detail:**

1. Owner membuka Account Pool panel, klik "Add Account".
2. Dialog import muncul: textarea untuk paste JSON atau tombol "Browse" untuk file picker.
3. Owner paste/load cookie JSON.
4. Sistem mem-parse JSON, memvalidasi field wajib (`name`, `value`, `domain` minimal mengandung domain Google Flow).
5. Sistem mengirim test HTTP request ke Google Flow dashboard menggunakan cookie tersebut.
6. Response 200 dengan user info → session valid.
7. Credential dienkripsi AES-256-GCM via vault dan disimpan ke SQLite.
8. Sistem mengekstrak credit data dari response atau melakukan API call terpisah untuk fetch kredit.
9. Akun muncul di daftar dengan status "Active", kredit harian dan bulanan terisi.
10. Health check scheduler menambahkan akun ke rotation pool.

### 7.2 Happy Path: Auto-Rotation during Pipeline

```
Pipeline Executor                flow-router                    Google Flow
       │                              │                              │
       │── request_generation(prompt) ►│                              │
       │                              │── select_best_account() ──►  │
       │                              │   (Account A: 12 credits)    │
       │                              │── HTTP POST /generate ──────►│
       │                              │◄── 200 OK + task_id ─────────│
       │                              │── poll /status/{task_id} ───►│
       │                              │◄── completed + video_url ────│
       │◄── generation_result ────────│                              │
       │                              │── decrement_credit(A) ──►    │
       │                              │                              │
```

### 7.3 Alternate Path: Mid-Generation Credit Depletion

```
Pipeline Executor                flow-router                    Google Flow
       │                              │                              │
       │── request_generation(prompt) ►│                              │
       │                              │── select_best_account() ──►  │
       │                              │   (Account A: 1 credit)      │
       │                              │── HTTP POST /generate ──────►│
       │                              │◄── 429 / credit_exhausted ──│
       │                              │                              │
       │                              │── mark A depleted ──►        │
       │                              │── select_next_account() ──►  │
       │                              │   (Account B: 35 credits)    │
       │                              │── HTTP POST /generate ──────►│
       │                              │◄── 200 OK + task_id ─────────│
       │◄── generation_result ────────│                              │
```

### 7.4 Alternate Path: All Accounts Depleted

1. flow-router mencoba seluruh akun dalam pool, semua mengembalikan credit exhausted.
2. flow-router mengembalikan error `AllAccountsDepleted` ke Pipeline Executor.
3. Pipeline Executor mem-pause pipeline.
4. UI menampilkan notifikasi: "All accounts depleted. Pipeline paused. Credits will refresh at [next_reset_time]."
5. Saat kredit refresh (hari berikutnya untuk daily, awal bulan untuk monthly), health check mendeteksi kredit tersedia.
6. Owner dapat resume pipeline secara manual.

### 7.5 Failure Path: Invalid Cookie Import

1. Owner paste cookie JSON dengan format invalid (bukan JSON, atau field wajib hilang).
2. Parser mengembalikan error spesifik: `InvalidJsonFormat`, `MissingRequiredField(field_name)`, `InvalidDomain`.
3. UI menampilkan pesan error yang actionable: "Cookie JSON tidak valid: field 'value' tidak ditemukan pada entry ke-3."
4. Tidak ada data yang disimpan ke vault.

### 7.6 Failure Path: Session Expired during Pipeline

1. Health check atau generation request mendeteksi session expired (HTTP 401).
2. Akun ditandai status "Expired".
3. Jika akun lain tersedia → rotasi otomatis, pipeline lanjut.
4. Notifikasi in-app: "Session [account_label] expired. Klik Re-authenticate untuk memperbarui."
5. Jika tidak ada akun lain → pipeline pause dengan notifikasi.

---

## 8. Business Rules

| ID | Rule | Implementasi | Dampak Pelanggaran |
|----|------|-------------|-------------------|
| BR-ACCT-001 | Akun dengan 0 sisa kredit harian dilewati saat account selection | `select_best_account()` memfilter `daily_credits > 0` sebelum sorting | Akun tanpa kredit tidak pernah digunakan; mencegah request sia-sia |
| BR-ACCT-002 | Validitas session diperiksa setiap 30 menit | Background timer memanggil `health_check_all()` dengan interval 30 menit (configurable via `HEALTH_CHECK_INTERVAL_SECS` di settings) | Session expired terdeteksi dini; delay maksimal 30 menit sebelum deteksi |
| BR-ACCT-003 | Credit refresh mengikuti siklus daily/monthly Google | Daily: reset pada 00:00 UTC (atau sesuai timezone akun Google). Monthly: reset pada tanggal 1 setiap bulan. Sistem menyimpan `next_daily_reset` dan `next_monthly_reset` per akun. | Credit counter di-reset sesuai jadwal; polling memverifikasi angka aktual dari backend |
| BR-ACCT-004 | Maksimal 10 akun dalam pool (configurable) | `MAX_ACCOUNTS` default 10, dapat diubah di settings. Validasi saat `add_account()`. | Penambahan akun ke-11 ditolak dengan pesan "Pool limit reached (max: 10). Remove an account or increase limit in settings." |
| BR-ACCT-005 | Akun diurutkan berdasarkan sisa kredit descending untuk rotasi | `select_best_account()` mengurutkan `ORDER BY daily_credits_remaining DESC, monthly_credits_remaining DESC` | Akun dengan kredit terbanyak digunakan lebih dulu; memaksimalkan throughput sebelum rotasi |
| BR-ACCT-006 | Akun yang sedang digunakan pipeline tidak dapat dihapus | `delete_account()` memeriksa `account.in_use` flag sebelum eksekusi | Mencegah credential dihapus saat masih diperlukan oleh request yang sedang berjalan |
| BR-ACCT-007 | Credential tidak pernah ditulis ke log, temp file, atau console | Semua logging terkait account menggunakan `account_id` (UUID), bukan cookie value atau token | Zero credential leakage di diagnostic output |

---

## 9. Acceptance Criteria

### AC-ACCT-001: Import Cookie Valid
**Given** credential vault unlocked dan pool belum mencapai batas maksimal  
**When** Owner mem-paste cookie JSON yang valid dan klik "Add"  
**Then** sistem memvalidasi session via test request ke Google Flow, menyimpan credential terenkripsi, dan menampilkan akun baru di daftar dengan status "Active" beserta data kredit

### AC-ACCT-002: Import Cookie Invalid
**Given** credential vault unlocked  
**When** Owner mem-paste teks yang bukan valid JSON  
**Then** sistem menampilkan error "Format JSON tidak valid" tanpa menyimpan data apapun ke vault

### AC-ACCT-003: Import Cookie dengan Session Expired
**Given** credential vault unlocked  
**When** Owner mem-paste cookie JSON yang formatnya valid tetapi session sudah expired  
**Then** test request ke Google Flow mengembalikan 401, sistem menampilkan "Session tidak valid atau sudah expired. Silakan login ulang di browser dan export cookie baru."

### AC-ACCT-004: Display Credit per Akun
**Given** minimal satu akun dengan status "Active"  
**When** Owner membuka Account Pool panel  
**Then** setiap akun menampilkan: label, status, kredit harian tersisa / total, kredit bulanan tersisa / total, dan timestamp last update

### AC-ACCT-005: Auto-Rotation saat Kredit Habis
**Given** akun A (5 kredit) dan akun B (30 kredit) terdaftar, pipeline sedang berjalan  
**When** generasi menggunakan akun A dan Google Flow mengembalikan "credit exhausted"  
**Then** flow-router otomatis memilih akun B, mengirim ulang generation request, dan pipeline melanjutkan tanpa intervensi Owner

### AC-ACCT-006: All Accounts Depleted
**Given** semua akun dalam pool memiliki 0 kredit harian  
**When** pipeline executor meminta generation  
**Then** flow-router mengembalikan `AllAccountsDepleted`, pipeline di-pause, UI menampilkan notifikasi "All accounts depleted" dengan informasi `next_reset_time`

### AC-ACCT-007: Hapus Akun — Normal
**Given** akun terdaftar dan tidak sedang digunakan oleh pipeline  
**When** Owner klik "Remove" dan mengkonfirmasi dialog  
**Then** credential, credit cache, dan health check history dihapus dari SQLite; akun hilang dari daftar

### AC-ACCT-008: Hapus Akun — Sedang Digunakan
**Given** akun sedang aktif digunakan oleh pipeline yang berjalan  
**When** Owner klik "Remove"  
**Then** sistem menampilkan error "Account is in use by active pipeline. Stop pipeline first." dan tidak menghapus data

### AC-ACCT-009: Notifikasi Session Expired
**Given** akun dengan status "Active" terdaftar  
**When** health check mendeteksi session expired (response 401/403)  
**Then** status akun berubah menjadi "Expired", notifikasi in-app muncul dengan tombol "Re-authenticate"

### AC-ACCT-010: Health Check Periodik
**Given** minimal satu akun terdaftar dan vault unlocked  
**When** 30 menit telah berlalu sejak health check terakhir  
**Then** sistem melakukan health check ke semua akun dan memperbarui status serta kredit

### AC-ACCT-011: Pool Limit Enforcement
**Given** pool sudah berisi 10 akun (default max)  
**When** Owner mencoba menambahkan akun ke-11  
**Then** sistem menampilkan error "Pool limit reached (max: 10)" tanpa menyimpan data

### AC-ACCT-012: Credit Counter Update setelah Generation
**Given** akun A dipilih untuk generation dengan 20 kredit harian tersisa  
**When** generation request berhasil (response 200)  
**Then** kredit harian akun A berkurang 1 di local cache; counter di-verifikasi terhadap backend saat health check berikutnya

### AC-ACCT-013: Vault Locked saat Operasi Account
**Given** credential vault dalam keadaan locked  
**When** Owner mencoba operasi apapun pada account pool (add, remove, view details)  
**Then** sistem menampilkan dialog unlock vault sebelum melanjutkan operasi

---

## 10. UI/UX Specifications

### 10.1 Account Pool Panel

Komponen utama yang menampilkan daftar akun dan kontrol management. Diakses melalui sidebar atau menu bar.

**Layout:**
- Header: judul "Account Pool", badge jumlah akun aktif, tombol "Add Account"
- Body: daftar akun dalam card layout, setiap card menampilkan:
  - Label akun (editable, default: email atau "Account #N")
  - Status badge: Active (hijau), Expired (merah), Error (oranye), Checking (biru spinner)
  - Credit bar: progress bar horizontal, kredit harian dan bulanan
  - Last checked: relative timestamp ("2 menit lalu")
  - Actions: "Refresh", "Re-authenticate" (jika expired), "Remove"
- Footer: total kredit tersedia lintas semua akun, tombol "Refresh All"

**Visual States:**

| State | Deskripsi | Tampilan |
|-------|-----------|----------|
| **Default** | Minimal satu akun terdaftar, data kredit tersedia | Card list dengan kredit dan status per akun |
| **Disabled** | Vault locked — seluruh panel non-interaktif | Overlay semi-transparan dengan pesan "Unlock vault to manage accounts" dan tombol unlock |
| **Loading** | Health check sedang berjalan | Skeleton cards atau spinner overlay pada card yang sedang di-check |
| **Error** | Network error saat health check | Card menampilkan status "Error" dengan pesan spesifik dan tombol "Retry" |
| **Empty** | Belum ada akun terdaftar | Ilustrasi empty state dengan teks "No accounts added yet" dan CTA "Add Your First Account" dengan penjelasan singkat cara export cookie |
| **N/A (Desktop Only)** | Aplikasi desktop, tidak ada responsive mobile | Layout fixed sesuai minimum window size (1024×768) |

### 10.2 Add Account Dialog

- Modal dialog dengan dua tab: "Paste JSON" dan "Import File"
- Tab "Paste JSON": textarea dengan placeholder menunjukkan format yang diharapkan
- Tab "Import File": file picker dengan filter `.json`
- Tombol "Validate & Add": disabled hingga input terisi, menampilkan spinner saat validasi
- Error message area: di bawah input, warna merah, pesan spesifik
- Success: dialog tertutup otomatis, akun baru muncul di daftar

### 10.3 Delete Confirmation Dialog

- Modal dialog: "Hapus akun [label]?"
- Body: "Credential, cached credit data, dan session state akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
- Tombol: "Cancel" (secondary), "Hapus Permanen" (destructive/merah)
- Jika akun in-use: dialog tidak muncul, inline error di card

---

## 11. API References

### 11.1 Tauri IPC Commands (Frontend ↔ Rust Backend)

| Command | Input | Output | Deskripsi |
|---------|-------|--------|-----------|
| `account_pool::add_account` | `{ cookie_json: String, label?: String }` | `Result<AccountInfo, AddAccountError>` | Validasi cookie, test session, simpan terenkripsi, kembalikan info akun |
| `account_pool::remove_account` | `{ account_id: Uuid }` | `Result<(), RemoveAccountError>` | Hapus akun dan semua data terkait |
| `account_pool::list_accounts` | `{}` | `Vec<AccountSummary>` | Daftar semua akun dengan status dan kredit (data dari cache) |
| `account_pool::get_account_detail` | `{ account_id: Uuid }` | `Result<AccountDetail, AccountError>` | Detail lengkap satu akun termasuk health check history |
| `account_pool::refresh_account` | `{ account_id: Uuid }` | `Result<AccountInfo, HealthCheckError>` | Paksa health check dan credit refresh untuk satu akun |
| `account_pool::refresh_all` | `{}` | `Vec<Result<AccountInfo, HealthCheckError>>` | Health check semua akun |
| `account_pool::update_label` | `{ account_id: Uuid, label: String }` | `Result<(), AccountError>` | Update label display akun |

### 11.2 Internal Rust API (flow-router ↔ Pipeline Executor)

| Function | Signature | Deskripsi |
|----------|-----------|-----------|
| `select_best_account()` | `fn() -> Result<AccountHandle, PoolError>` | Pilih akun dengan kredit terbanyak, set `in_use` flag |
| `release_account()` | `fn(handle: AccountHandle) -> ()` | Lepas `in_use` flag setelah generation selesai |
| `report_credit_used()` | `fn(account_id: Uuid, count: u32) -> ()` | Decrement credit counter di local cache |
| `report_account_error()` | `fn(account_id: Uuid, error: AccountError) -> ()` | Tandai akun sebagai error, trigger rotation jika sedang aktif |

### 11.3 Google Flow Backend (Reverse-Engineered HTTP)

| Endpoint | Method | Deskripsi | Response |
|----------|--------|-----------|----------|
| Dashboard/user info | GET | Verifikasi session validity + extract user info | 200: valid session; 401/403: expired |
| Credit status | GET | Fetch sisa kredit harian dan bulanan | JSON dengan `daily_remaining`, `daily_total`, `monthly_remaining`, `monthly_total` |
| Generate video | POST | Kirim prompt + reference untuk generasi video | 200: `{ task_id }` untuk polling; 429: credit exhausted |
| Task status | GET | Poll status generasi | `{ status: "pending" | "processing" | "completed" | "failed", video_url? }` |
| Download video | GET | Download video hasil generasi | Binary video stream |

---

## 12. Data Model References

### 12.1 Tabel `accounts`

| Column | Type | Constraint | Deskripsi |
|--------|------|-----------|-----------|
| `id` | TEXT (UUID) | PRIMARY KEY | Identifier unik akun |
| `label` | TEXT | NOT NULL, DEFAULT 'Account #N' | Label display yang dapat diedit Owner |
| `encrypted_cookie` | BLOB | NOT NULL | Cookie data terenkripsi AES-256-GCM |
| `encryption_salt` | BLOB | NOT NULL | Salt unik untuk key derivation entry ini |
| `encryption_nonce` | BLOB | NOT NULL | Nonce untuk AES-256-GCM |
| `status` | TEXT | NOT NULL, CHECK IN ('active','expired','error') | Status terakhir health check |
| `daily_credits_remaining` | INTEGER | NOT NULL, DEFAULT 0 | Sisa kredit harian (cached) |
| `daily_credits_total` | INTEGER | NOT NULL, DEFAULT 50 | Total kredit harian |
| `monthly_credits_remaining` | INTEGER | NULL | Sisa kredit bulanan (NULL jika free tier) |
| `monthly_credits_total` | INTEGER | NULL | Total kredit bulanan (NULL jika free tier) |
| `next_daily_reset` | TEXT (ISO8601) | NOT NULL | Waktu reset kredit harian berikutnya |
| `next_monthly_reset` | TEXT (ISO8601) | NULL | Waktu reset kredit bulanan berikutnya |
| `last_health_check` | TEXT (ISO8601) | NULL | Timestamp health check terakhir |
| `created_at` | TEXT (ISO8601) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Waktu akun ditambahkan |
| `in_use` | INTEGER | NOT NULL, DEFAULT 0 | Flag: 1 jika sedang digunakan pipeline |
| `sort_order` | INTEGER | NOT NULL, DEFAULT 0 | Urutan manual (untuk tiebreaker) |

### 12.2 Tabel `health_check_log`

| Column | Type | Constraint | Deskripsi |
|--------|------|-----------|-----------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID log entry |
| `account_id` | TEXT (UUID) | FOREIGN KEY → accounts.id ON DELETE CASCADE | Akun yang di-check |
| `checked_at` | TEXT (ISO8601) | NOT NULL | Timestamp check |
| `status` | TEXT | NOT NULL | Hasil: 'active', 'expired', 'error' |
| `http_status` | INTEGER | NULL | HTTP status code dari Google Flow |
| `error_message` | TEXT | NULL | Pesan error jika ada |
| `daily_credits` | INTEGER | NULL | Kredit harian saat check |
| `monthly_credits` | INTEGER | NULL | Kredit bulanan saat check |

---

## 13. Notifications & Side Effects

| Event | Notifikasi | Side Effect |
|-------|-----------|-------------|
| Account added | In-app toast: "Account [label] added successfully" | Health check dan credit fetch dijalankan segera |
| Account removed | In-app toast: "Account [label] removed" | Credit pool total di-recalculate; rotation pool di-update |
| Session expired | In-app notification badge + card status merah | Akun dikeluarkan dari rotation pool; jika akun aktif, rotasi ke akun lain |
| All accounts depleted | In-app banner: "All accounts depleted. Next reset: [time]" | Pipeline di-pause; event `pipeline::paused` di-emit |
| Auto-rotation triggered | In-app log entry: "Switched from [A] to [B] — credit exhausted" | Credit counter akun lama di-update; request di-retry dengan akun baru |
| Health check failed (network) | In-app warning pada card akun | Status set "Error"; cached credit data tetap digunakan; retry saat health check berikutnya |
| Credit refresh detected | Silent update | Credit counter di-update di cache dan UI; akun yang sebelumnya depleted kembali ke rotation pool |

---

## 14. Error & Recovery Behavior

| Error Scenario | Detection | Recovery | User Communication |
|---------------|-----------|----------|-------------------|
| Cookie JSON parse error | JSON parser exception | Operasi dibatalkan, tidak ada data tersimpan | Error message spesifik: field mana yang bermasalah, contoh format yang benar |
| Session validation failed (401/403) | HTTP response code saat test request | Operasi import dibatalkan | "Session tidak valid. Login ulang di browser dan export cookie baru." |
| Session expired mid-pipeline | HTTP 401 saat generation request | Auto-rotate ke akun lain; tandai akun expired | In-app notification + log entry tentang rotation |
| Network timeout saat health check | HTTP timeout (30 detik) | Retry 1x setelah 5 detik; jika masih gagal, gunakan cached data | Card status: "Error — network timeout. Using cached data." |
| Network timeout saat generation | HTTP timeout (120 detik) | Retry sesuai NFR-003: 3x exponential backoff (2s, 4s, 8s) | Node status: "Retrying (attempt 2/3)..." |
| Google Flow rate limit (429 tanpa credit context) | HTTP 429 tanpa body "credit exhausted" | Backoff 60 detik, retry | Log: "Rate limited. Waiting 60s before retry." |
| Credit desync (local cache ≠ actual) | Health check mengembalikan angka berbeda dari cache | Update cache dengan data dari backend | Silent update; jika credit berkurang drastis, warning log |
| Vault locked saat rotation needed | Vault lock timeout selama pipeline | Pipeline tetap berjalan menggunakan credential yang sudah di-decrypt di memory | Jika rotation memerlukan decrypt credential baru → pause pipeline + prompt unlock |
| SQLite write error | Database exception | Retry 1x; jika gagal, operasi dibatalkan | Error dialog: "Failed to save account data. Check disk space." |
| Max account limit reached | `account_pool.count() >= MAX_ACCOUNTS` | Operasi add ditolak | "Pool limit reached (max: [N]). Remove an account or increase limit in Settings." |

---

## 15. Edge Cases

### EC-001: Input Ekstrem — Cookie JSON Sangat Besar
**Skenario:** Owner mem-paste cookie JSON > 1MB (ratusan cookie entries).  
**Handling:** Sistem hanya mengekstrak cookie yang relevan (domain Google Flow). Cookie lain diabaikan. Jika setelah filter tidak ada cookie yang relevan → error "No Google Flow cookies found in imported data."

### EC-002: Race Condition — Concurrent Generation Request
**Skenario:** Dua pipeline step meminta akun secara bersamaan.  
**Handling:** `select_best_account()` menggunakan mutex lock pada account pool. Hanya satu thread mendapat akun pada satu waktu. Akun yang sudah di-select ditandai `in_use` sehingga thread berikutnya mendapat akun berbeda (jika tersedia) atau menunggu release.

### EC-003: Empty State — Pool Kosong saat Pipeline Start
**Skenario:** Owner menjalankan pipeline tanpa akun terdaftar.  
**Handling:** Pipeline executor memeriksa `account_pool.count() > 0` sebelum start. Jika kosong → error: "No accounts in pool. Add at least one account before running pipeline."

### EC-004: Batas Kuota — Semua Akun Depleted Bersamaan
**Skenario:** Pipeline berjalan cepat dan menghabiskan kredit semua akun dalam satu sesi.  
**Handling:** Sesuai AC-ACCT-006. Pipeline pause, notifikasi dengan `next_reset_time` ditampilkan. Pipeline state disimpan agar bisa di-resume tanpa kehilangan progress.

### EC-005: Clock Skew — Local Time vs Google Server Time
**Skenario:** Jam lokal Owner berbeda signifikan dari server Google, menyebabkan `next_daily_reset` salah.  
**Handling:** `next_daily_reset` dikalkulasi berdasarkan timestamp dari Google Flow response header (`Date`), bukan clock lokal. Jika header tidak tersedia, gunakan clock lokal dengan warning log.

### EC-006: Duplicate Account Import
**Skenario:** Owner mengimport cookie dari akun Google yang sama dua kali.  
**Handling:** Setelah session validation, sistem mengecek apakah user identifier (dari Google Flow response) sudah ada di pool. Jika ya → dialog: "Account [email/id] already exists. Update existing session?" dengan opsi "Update" (replace cookie) atau "Cancel".

### EC-007: Cookie Domain Mismatch
**Skenario:** Owner mengimport cookie dari domain yang bukan Google Flow.  
**Handling:** Cookie filter memeriksa domain. Jika tidak ada cookie dengan domain yang cocok → error "Imported cookies do not contain Google Flow session data."

### EC-008: Vault Lock Timeout saat Background Health Check
**Skenario:** Vault terkunci karena inactivity sementara health check scheduler perlu decrypt credential.  
**Handling:** Health check di-skip untuk siklus ini. Status akun tetap menggunakan data terakhir yang diketahui. Saat vault di-unlock kembali, health check dijadwalkan segera.

---

## 16. Security & Privacy

### 16.1 Credential Protection

| Aspek | Implementasi |
|-------|-------------|
| Encryption at rest | AES-256-GCM; key diderivasi dari master password via Argon2id (memory: 64MB, iterations: 3, parallelism: 1). Salt unik per credential entry. |
| Encryption in memory | Credential di-decrypt hanya saat dibutuhkan (lazy decryption). Setelah HTTP request terkirim, plaintext credential di-zeroize dari memory. |
| Key management | Encryption key hanya ada di memory selama vault unlocked. Vault auto-lock setelah 15 menit inactivity (configurable). Lock = key dihapus dari memory. |
| Log sanitization | Session token dan cookie value TIDAK PERNAH ditulis ke log. Logging menggunakan `account_id` (UUID) sebagai identifier. |
| Crash dump protection | Crash handler melakukan memory sanitization sebelum dump. Credential fields di-tag `#[zeroize(drop)]` (Rust) untuk auto-wipe. |
| Database file protection | SQLite file permission: owner-only read/write (0600 pada Unix-like). Pada Windows, ACL membatasi akses ke user yang menjalankan aplikasi. |

### 16.2 Anti-Abuse Measures

| Measure | Nilai | Keterangan |
|---------|-------|-----------|
| Rate limit | Not Applicable | Personal tool, single-user; tidak ada endpoint yang diekspos ke jaringan |
| Captcha | Not Applicable | Tidak ada registration atau public-facing form |
| Temp-mail check | Not Applicable | Tidak ada email-based flow |
| Bot detection | Not Applicable | Tidak ada public-facing API |
| Abuse scenario | Not Applicable | Tool personal, tidak diakses pihak lain. Risiko utama adalah credential leakage yang dimitigasi oleh enkripsi dan log sanitization. |

### 16.3 Network Security

| Aspek | Implementasi |
|-------|-------------|
| Transport | Semua komunikasi ke Google Flow via HTTPS (TLS 1.2+). Certificate validation enabled. |
| Proxy support | Mendukung system-level HTTP/HTTPS proxy (environment variable `HTTP_PROXY`/`HTTPS_PROXY`). Tidak ada custom proxy logic. |
| Request fingerprint | User-Agent dan header lain di-set menyerupai browser normal untuk menghindari deteksi bot oleh Google. |

---

## 17. Analytics & Audit Events

Semua analytics bersifat lokal (disimpan di SQLite). Tidak ada telemetry ke server eksternal.

| Event ID | Event Name | Data Captured | Trigger |
|----------|-----------|---------------|---------|
| EVT-ACCT-001 | `account.added` | `account_id`, `timestamp`, `initial_daily_credits`, `initial_monthly_credits` | Akun berhasil ditambahkan |
| EVT-ACCT-002 | `account.removed` | `account_id`, `timestamp` | Akun berhasil dihapus |
| EVT-ACCT-003 | `account.session_expired` | `account_id`, `timestamp`, `last_active_at` | Health check mendeteksi session expired |
| EVT-ACCT-004 | `account.session_renewed` | `account_id`, `timestamp` | Re-autentikasi berhasil |
| EVT-ACCT-005 | `account.rotated` | `from_account_id`, `to_account_id`, `reason` ("credit_exhausted" \| "session_expired" \| "error"), `timestamp` | Auto-rotation terjadi |
| EVT-ACCT-006 | `account.health_check` | `account_id`, `status`, `daily_credits`, `monthly_credits`, `response_time_ms`, `timestamp` | Health check selesai (per akun) |
| EVT-ACCT-007 | `pool.all_depleted` | `timestamp`, `account_count`, `next_reset_time` | Semua akun kehabisan kredit |
| EVT-ACCT-008 | `account.credit_used` | `account_id`, `credits_before`, `credits_after`, `generation_task_id`, `timestamp` | Kredit berkurang setelah generation |

**Retensi:** Log audit disimpan 90 hari, kemudian di-prune otomatis oleh background task.

---

## 18. Testing Scenarios

### 18.1 Unit Tests

| ID | Scenario | Input | Expected Output |
|----|----------|-------|----------------|
| TEST-ACCT-U001 | Parse valid cookie JSON (Netscape format) | Valid Netscape cookie string | `Vec<Cookie>` dengan field lengkap |
| TEST-ACCT-U002 | Parse valid cookie JSON (JSON array format) | Valid JSON array | `Vec<Cookie>` dengan field lengkap |
| TEST-ACCT-U003 | Parse invalid JSON | Malformed string | `Err(InvalidJsonFormat)` |
| TEST-ACCT-U004 | Filter cookies by Google Flow domain | Mixed-domain cookie array | Hanya cookie dengan domain Google Flow |
| TEST-ACCT-U005 | `select_best_account()` — multiple accounts | 3 akun: A(10), B(30), C(5) kredit | Return akun B |
| TEST-ACCT-U006 | `select_best_account()` — all depleted | 3 akun: semua 0 kredit | `Err(AllAccountsDepleted)` |
| TEST-ACCT-U007 | `select_best_account()` — tiebreaker by sort_order | 2 akun: A(10, order=2), B(10, order=1) | Return akun B (lower sort_order) |
| TEST-ACCT-U008 | Credit decrement | Akun 20 kredit, decrement 1 | 19 kredit |
| TEST-ACCT-U009 | Duplicate account detection | Existing account ID in pool | `Err(AccountAlreadyExists)` |
| TEST-ACCT-U010 | Max account limit | Pool count = MAX_ACCOUNTS | `Err(PoolLimitReached)` |

### 18.2 Integration Tests

| ID | Scenario | Setup | Expected Behavior |
|----|----------|-------|-------------------|
| TEST-ACCT-I001 | Full add account flow | Mock Google Flow server, valid cookie | Cookie → validate → encrypt → store → health check → UI update |
| TEST-ACCT-I002 | Auto-rotation during generation | 2 akun, akun A kredit 1, mock server return credit_exhausted setelah 1 request | Generation 1: akun A → success. Generation 2: akun A → credit_exhausted → rotate ke B → success |
| TEST-ACCT-I003 | Health check cycle | 2 akun, mock server (A: valid, B: expired) | A status "Active", B status "Expired", notifikasi untuk B |
| TEST-ACCT-I004 | Pipeline pause on all depleted | 3 akun semua 0 kredit | Pipeline pause, notifikasi "All accounts depleted" |
| TEST-ACCT-I005 | Delete account cascade | Akun dengan health check history | Account row + health_check_log rows dihapus (CASCADE) |
| TEST-ACCT-I006 | Vault lock during health check | Vault di-lock saat health check scheduled | Health check di-skip, status unchanged, retry setelah vault unlock |

### 18.3 End-to-End Tests

| ID | Scenario | Precondition | Steps | Expected Result |
|----|----------|-------------|-------|----------------|
| TEST-ACCT-E001 | Owner adds account and sees credits | App running, vault unlocked | 1. Open Account Pool panel 2. Click "Add Account" 3. Paste valid cookie 4. Click "Validate & Add" | Akun muncul di daftar dengan status Active dan kredit terisi |
| TEST-ACCT-E002 | Owner removes account | Akun terdaftar, tidak sedang digunakan | 1. Click "Remove" pada akun 2. Confirm dialog | Akun hilang dari daftar |
| TEST-ACCT-E003 | Auto-rotation transparently during pipeline | 2 akun terdaftar, pipeline 10 segmen | 1. Start pipeline 2. Akun A habis setelah 5 segmen | Segmen 6+ menggunakan akun B; pipeline selesai tanpa intervensi |

---

## 19. Dependencies & Rollout

### 19.1 Dependencies

| Dependency | Tipe | Status | Impact jika Tidak Tersedia |
|-----------|------|--------|---------------------------|
| FEAT-CREDENTIAL_VAULT | Internal (P0) | Planned | **Blocker** — tanpa vault, credential tidak bisa disimpan terenkripsi. Account pool tidak dapat berfungsi. |
| Google Flow Backend | External | Available | **Blocker** — tanpa backend, tidak ada generation dan credit data. Health check tidak bisa dilakukan. |
| SQLite (via `rusqlite`) | Library | Available | **Blocker** — persistent storage untuk account data dan audit log. |
| `reqwest` (Rust HTTP client) | Library | Available | **Blocker** — diperlukan untuk HTTP communication ke Google Flow. |
| `ring` atau `aes-gcm` (Rust crypto) | Library | Available | **Blocker** — implementasi AES-256-GCM untuk credential encryption. |
| `argon2` (Rust) | Library | Available | **Blocker** — key derivation dari master password. |
| Tauri 2.x IPC | Framework | Available | **Blocker** — bridge antara React frontend dan Rust backend. |

### 19.2 Rollout Plan

| Phase | Scope | Gate Criteria |
|-------|-------|--------------|
| Phase 1: Core Storage | Encrypt/decrypt credential, SQLite CRUD untuk accounts | Unit test pass; credential tidak readable di DB file |
| Phase 2: Session Management | Health check, status tracking, cookie validation | Integration test pass; health check cycle berjalan setiap 30 menit |
| Phase 3: Credit Tracking | Fetch dan cache kredit, credit decrement, reset detection | Credit display akurat; refresh menghasilkan data terbaru |
| Phase 4: Rotation Engine | Auto-rotation, pool selection, pipeline integration | Auto-rotation berfungsi transparan; semua AC rotation pass |
| Phase 5: UI Integration | Account Pool panel, Add/Remove dialog, notifikasi | E2E test pass; semua visual states terverifikasi |

### 19.3 Feature Flag

| Flag | Default | Deskripsi |
|------|---------|-----------|
| `account_pool.enabled` | `true` | Master switch untuk fitur account pool |
| `account_pool.max_accounts` | `10` | Batas maksimal akun dalam pool |
| `account_pool.health_check_interval_secs` | `1800` | Interval health check dalam detik |
| `account_pool.auto_rotation` | `true` | Enable/disable auto-rotation |

---

## 20. Open Questions

| # | Question | Impact | Proposed Default | Status |
|---|----------|--------|-----------------|--------|
| OQ-001 | Apakah Google Flow memiliki rate limit per-IP selain per-account? Jika ya, pooling banyak akun dari IP yang sama bisa trigger IP-level block. | Rotation strategy mungkin perlu jeda antar switch. | Implement configurable delay antar rotation (default: 0 detik). Monitor dan adjust. | Open |
| OQ-002 | Format cookie export bervariasi antar browser extension. Apakah perlu mendukung format selain JSON array dan Netscape? | Scope cookie parser. | Dukung JSON array dan Netscape format. Tambahkan format lain berdasarkan feedback. | Resolved — defer to feedback |
| OQ-003 | Apakah kredit Google Flow di-reset berdasarkan UTC midnight atau timezone akun? | Akurasi `next_daily_reset`. | Gunakan timestamp dari Google Flow response header. Fallback ke UTC jika tidak tersedia. | Open |
| OQ-004 | Apakah re-authentication via embedded webview (FR-006) bisa diblokir oleh Google (detect non-standard browser)? | Fallback strategy jika webview di-block. | Jika webview diblokir, fallback ke manual cookie re-export dari browser biasa. | Open |
| OQ-005 | Bagaimana handling jika Google mengubah API endpoint atau response format? | flow-router berhenti berfungsi. | Versioned adapter pattern: endpoint dan parser di-isolasi agar mudah di-update. Fallback ke Playwright headless browser (FR ref: SRS §3.1 Playwright). | Open |
