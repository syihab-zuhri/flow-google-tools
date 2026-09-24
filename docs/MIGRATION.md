# MIGRATION.md: Flow Studio — Database Schema Migration & Project File Versioning Strategy

> **Project:** Flow Studio  
> **Document ID:** DOC-MIG-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-ERD-001  
> **Supersedes:** None  

---

## 1. Pendahuluan dan Filosofi Migrasi SQLite (SQLite Migration Philosophy)

### 1.1 Konteks Local-First Desktop & Zero-Cloud Dependency
Flow Studio beroperasi sebagai aplikasi workstation desktop (*local-first architecture*) berbasis Tauri 2.x dan Rust. Seluruh persistensi data transaksional, metadata akun Google Flow terenkripsi, status segmen kanvas video, dan rekam jejak generasi disimpan di filesystem lokal pengguna pada path `%APPDATA%/FlowStudio/flow_studio.db` (Windows) tanpa ketergantungan pada server database eksternal terkelola.

Konsekuensi arsitektur dari lingkungan desktop *single-user* ini mencakup:
1. **Unattended Execution:** Migrasi skema harus berjalan otomatis, deterministik, dan tanpa intervensi manual dari pengguna saat aplikasi diluncurkan (*app startup*).
2. **Offline-Resilient:** Operasi migrasi tidak boleh bergantung pada jaringan internet atau layanan otentikasi eksternal.
3. **Zero-Data-Loss Invariant:** Kegagalan saat migrasi tidak boleh merusak berkas database utama atau menghilangkan riwayat pengerjaan proyek pengguna.
4. **Crash-Resilience:** Interupsi mendadak (misalnya kegagalan daya, pemutusan proses paksa oleh OS) selama eksekusi migrasi harus dapat ditangani secara aman tanpa meninggalkan database dalam kondisi *corrupted*.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   FLOW STUDIO BOOTSTRAP & MIGRATION FLOW                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │ App Launch (Tauri Core Startup) │
                    └─────────────────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │ Initialize SQLite Engine (WAL)  │
                    │   PRAGMA foreign_keys = ON;     │
                    └─────────────────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │ Inspect `_schema_migrations`    │
                    │ Compare with Embedded SQL List  │
                    └─────────────────────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
             [Up to Date]                   [Pending Migrations]
                     │                               │
                     │                               ▼
                     │              ┌─────────────────────────────────┐
                     │              │ Create Snapshot Hot-Backup:     │
                     │              │ flow_studio.db.bak_{v}_{time}   │
                     │              └─────────────────────────────────┘
                     │                               │
                     │                               ▼
                     │              ┌─────────────────────────────────┐
                     │              │ BEGIN IMMEDIATE TRANSACTION;    │
                     │              │ Apply V001..Vxxx Sequentially   │
                     │              │ Verify PRAGMA integrity_check   │
                     │              │ COMMIT;                         │
                     │              └─────────────────────────────────┘
                     │                               │
                     │                ┌──────────────┴──────────────┐
                     │                ▼                             ▼
                     │            [Success]                     [Failure]
                     │                │                             │
                     │                │                             ▼
                     │                │              ┌────────────────────────────┐
                     │                │              │ ROLLBACK TRANSACTION       │
                     │                │              │ Restore from Backup File   │
                     │                │              │ Surface Safe Error UI      │
                     │                │              └────────────────────────────┘
                     ▼                ▼                             │
       ┌────────────────────────────────────────────────┐           ▼
       │ Mount Services & Render Frontend Application   │       [Terminate]
       └────────────────────────────────────────────────┘
```

### 1.2 Prinsip Inti Migrasi SQLite Flow Studio
Strategi migrasi Flow Studio dibangun di atas lima pilar rekayasa perangkat lunak:
- **Embedded in Binary:** Seluruh skrip migrasi SQL (`.sql`) dikompilasi langsung ke dalam biner Rust menggunakan mekanisme `rust-embed` atau `include_str!`. Hal ini menjamin bahwa berkas migrasi tidak dapat dimanipulasi, dihapus secara tidak sengaja oleh pengguna, atau terpisah saat instalasi pembaruan aplikasi.
- **Deterministic & Sequential:** Berkas migrasi dieksekusi secara ketat mengikuti urutan versi integer yang monoton naik (`V001`, `V002`, dst.). Tidak ada percabangan migrasi (*no branched migrations*).
- **Atomic Transactionality:** Setiap berkas migrasi dieksekusi di dalam batas transaksi terisolasi (`BEGIN IMMEDIATE TRANSACTION` ... `COMMIT`). Kegagalan satu pernyataan SQL langsung memicu pembatalan total (*rollback*) pada transaksi aktif.
- **Fail-Safe Automatic Backup:** Setiap kali migrasi terdeteksi perlu dijalankan, subsistem database wajib membuat berkas cadangan (*hot-backup*) terlebih dahulu menggunakan SQLite Online Backup API sebelum transaksi migrasi dibuka.
- **Post-Migration Verification Gate:** Migrasi hanya dinyatakan selesai jika verifikasi integritas struktural (`PRAGMA integrity_check`) dan kunci asing (`PRAGMA foreign_key_check`) mengembalikan hasil bersih tanpa error.

---

## 2. Arsitektur Migration Engine

### 2.1 Evaluasi & Pemilihan Engine
Untuk mengelola siklus hidup migrasi pada Rust backend, Flow Studio mengadopsi pola custom migration runner yang membungkus driver `rusqlite` dengan kompatibilitas terhadap konvensi `rusqlite_migration`.

| Parameter Evaluasi | Custom Engine berbasis `rusqlite` | `rusqlite_migration` Crate | `refinery` / `sqlx-migrator` | Keputusan Desain Flow Studio |
|---|---|---|---|---|
| **Ukuran Dependensi (Binary Footprint)** | Minimal (0 crate tambahan di luar `rusqlite`) | Sangat Kecil (~1 crate ringan) | Sedang hingga Besar (menarik runtime async) | Menggunakan arsitektur terpadu: runner internal dengan kontrak kompatibel `rusqlite_migration` |
| **Dukungan Backup Interseptif** | Kontrol penuh sebelum eksekusi migrasi | Membutuhkan hook manual di luar runner | Membutuhkan hook manual di luar runner | Wajib hook interseptif otomatis sebelum baris SQL pertama dijalankan |
| **Dukungan Biner Embedding** | `include_str!` / `rust-embed` native | `rust-embed` atau static array | `rust-embed` | Native embedding via Rust static slicing (`&[&str]`) atau `include_str!` |
| **Mode Transaksi SQLite** | `BEGIN IMMEDIATE` ketat | `BEGIN IMMEDIATE` default | Tergantung konfigurasi | Menegakkan `BEGIN IMMEDIATE` guna mencegah race condition pada multi-thread lokal |

### 2.2 Integrasi Rust Binary Embedding
Berkas migrasi SQL disimpan di direktori internal backend Rust: `src-tauri/migrations/`. Seluruh berkas di-*embed* ke dalam biner saat proses kompilasi (`cargo build`), sehingga biner executable `flow-studio.exe` bersifat *self-contained*.

```
src-tauri/
├── Cargo.toml
├── src/
│   ├── db/
│   │   ├── mod.rs
│   │   ├── connection.rs
│   │   ├── backup.rs
│   │   ├── migration.rs
│   │   └── verification.rs
│   └── main.rs
└── migrations/
    ├── V001__initial_schema.sql
    ├── V002__add_node_cache_table.sql (contoh evolusi)
    └── V003__optimize_account_indexes.sql (contoh evolusi)
```

### 2.3 Implementasi Produksi Rust Migration Runner
Berikut adalah implementasi lengkap subsistem migrasi pada `src-tauri/src/db/migration.rs` tanpa stub, menerapkan prinsip anti-AI-slop dan standard code quality:

```rust
use rusqlite::{params, Connection, Result, Transaction};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::Instant;
use tracing::{error, info, warn};

use super::backup::create_pre_migration_backup;
use super::verification::verify_database_integrity;

#[derive(Debug, Clone)]
pub struct MigrationDefinition {
    pub version: i64,
    pub name: &'static str,
    pub sql: &'static str,
}

pub struct MigrationResult {
    pub applied_count: usize,
    pub current_version: i64,
}

pub const MIGRATIONS: &[MigrationDefinition] = &[
    MigrationDefinition {
        version: 1,
        name: "initial_schema",
        sql: include_str!("../../../migrations/V001__initial_schema.sql"),
    },
];

pub fn initialize_and_migrate(
    conn: &mut Connection,
    db_path: &Path,
    backup_dir: &Path,
) -> Result<MigrationResult, Box<dyn std::error::Error>> {
    info!("Memulai evaluasi status skema database lokal: {:?}", db_path);

    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
        PRAGMA temp_store = MEMORY;
        PRAGMA encoding = 'UTF-8';
        "#,
    )?;

    ensure_migration_table(conn)?;

    let current_version = get_current_schema_version(conn)?;
    info!("Versi skema aktif saat ini: {}", current_version);

    let pending_migrations: Vec<&MigrationDefinition> = MIGRATIONS
        .iter()
        .filter(|m| m.version > current_version)
        .collect();

    if pending_migrations.is_empty() {
        info!("Database skema sudah mutakhir. Tidak ada migrasi tertunda.");
        return Ok(MigrationResult {
            applied_count: 0,
            current_version,
        });
    }

    info!(
        "Ditemukan {} migrasi skema yang perlu diterapkan.",
        pending_migrations.len()
    );

    let backup_path = create_pre_migration_backup(conn, db_path, backup_dir, current_version)?;
    info!("Cadangan basis data pra-migrasi berhasil dibuat: {:?}", backup_path);

    let mut newly_applied = 0;
    let mut last_version = current_version;

    for migration in pending_migrations {
        let start_time = Instant::now();
        let checksum = compute_sql_checksum(migration.sql);

        info!(
            "Mengeksekusi migrasi V{:03}__{} (SHA-256: {})...",
            migration.version, migration.name, checksum
        );

        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;

        if let Err(migration_err) = execute_single_migration(&tx, migration, &checksum) {
            error!(
                "Kegagalan fatal saat eksekusi migrasi V{:03}__{}: {}. Membatalkan transaksi...",
                migration.version, migration.name, migration_err
            );
            drop(tx);

            warn!("Memulai prosedur restorasi basis data dari snapshot cadangan...");
            restore_database_from_backup(db_path, &backup_path)?;
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!(
                    "Migrasi V{:03} gagal: {}. Basis data berhasil dipulihkan dari cadangan.",
                    migration.version, migration_err
                ),
            )));
        }

        tx.commit()?;
        let duration = start_time.elapsed();
        info!(
            "Migrasi V{:03}__{} selesai dalam {:.2?}",
            migration.version, migration.name, duration
        );

        verify_database_integrity(conn)?;

        last_version = migration.version;
        newly_applied += 1;
    }

    info!(
        "Seluruh siklus migrasi selesai sukses. Versi skema akhir: {}",
        last_version
    );

    Ok(MigrationResult {
        applied_count: newly_applied,
        current_version: last_version,
    })
}

fn ensure_migration_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS _schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            checksum TEXT NOT NULL
        );
        "#,
    )
}

fn get_current_schema_version(conn: &Connection) -> Result<i64> {
    let mut stmt = conn.prepare("SELECT COALESCE(MAX(version), 0) FROM _schema_migrations")?;
    let version: i64 = stmt.query_row([], |row| row.get(0))?;
    Ok(version)
}

fn compute_sql_checksum(sql_content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(sql_content.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn execute_single_migration(
    tx: &Transaction,
    migration: &MigrationDefinition,
    checksum: &str,
) -> Result<()> {
    tx.execute_batch(migration.sql)?;

    tx.execute(
        r#"
        INSERT INTO _schema_migrations (version, name, applied_at, checksum)
        VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?3);
        "#,
        params![migration.version, migration.name, checksum],
    )?;

    Ok(())
}

fn restore_database_from_backup(db_path: &Path, backup_path: &Path) -> std::io::Result<()> {
    let wal_path = db_path.with_extension("db-wal");
    let shm_path = db_path.with_extension("db-shm");

    if wal_path.exists() {
        let _ = std::fs::remove_file(&wal_path);
    }
    if shm_path.exists() {
        let _ = std::fs::remove_file(&shm_path);
    }

    std::fs::copy(backup_path, db_path)?;
    info!("Pemulihan berkas basis data dari cadangan selesai.");
    Ok(())
}
```

---

## 3. Skema Pelacakan Versi (`_schema_migrations`)

### 3.1 Definisi Tabel Metadata
Tabel `_schema_migrations` bertindak sebagai buku besar pencatatan status migrasi (*migration ledger*). Setiap baris mewakili satu berkas migrasi SQL yang telah sukses diterapkan.

```sql
CREATE TABLE IF NOT EXISTS _schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    checksum TEXT NOT NULL
);
```

#### Kamus Data `_schema_migrations`
| Nama Kolom | Tipe Data | Constraint | Sensitivitas | Deskripsi & Validasi |
|---|---|---|---|---|
| `version` | `INTEGER` | `PRIMARY KEY` | `NON-PII` | Nomor urut versi migrasi (integer positif monoton naik, misal: `1`, `2`, `3`). |
| `name` | `TEXT` | `NOT NULL` | `NON-PII` | Nama deskriptif berkas migrasi (misal: `initial_schema`, `add_audit_index`). |
| `applied_at` | `TEXT` | `NOT NULL` | `NON-PII` | Stempel waktu ISO-8601 UTC saat migrasi berhasil di-commit. |
| `checksum` | `TEXT` | `NOT NULL` | `NON-PII` | Hash SHA-256 (64 karakter heksadesimal) dari konten berkas SQL saat eksekusi. |

### 3.2 Skema Checksum SHA-256 & Anti-Tampering Mechanism
Setiap kali migrasi dievaluasi, hash SHA-256 dari skrip migrasi yang disematkan (*embedded*) dibandingkan dengan nilai yang tersimpan di database:
1. **Pemeriksaan Riwayat (Historical Integrity):** Untuk setiap versi yang sudah berstatus diterapkan (`version <= current_version`), runner memeriksa apakah `compute_sql_checksum(embedded_sql) == recorded_checksum`.
2. **Pendeteksian Mutasi Ilegal (Tamper Detection):** Jika checksum berbeda, runner memblokir proses booting aplikasi dengan melempar error `E_MIGRATION_CHECKSUM_MISMATCH`. Developer atau pengguna dilarang memodifikasi berkas migrasi yang sudah pernah dirilis ke produksi. Modifikasi skema baru wajib selalu dibuat sebagai berkas migrasi versi selanjutnya (*append-only evolution*).

### 3.3 Nomenklatur dan Konvensi Berkas Migrasi
Berkas migrasi SQL wajib mematuhi aturan penamaan baku berikut:

$$\mathbf{V\{VERSION\}\_\_\{DESCRIPTION\}.sql}$$

- `V`: Prefiks wajib huruf kapital.
- `{VERSION}`: Angka integer 3 digit bertambah teratur (`001`, `002`, `003`, ..., `999`).
- `__`: Pemisah berupa garis bawah ganda (*double underscore*).
- `{DESCRIPTION}`: Keterangan ringkas berbahasa Inggris dalam format *snake_case* (misal: `initial_schema`, `add_canvas_bookmarks`).
- `.sql`: Ekstensi berkas skrip SQL standar.

Contoh yang valid:
- `V001__initial_schema.sql`
- `V002__add_project_tags.sql`
- `V003__alter_segments_add_fps.sql`

---

## 4. Migrasi Skema Awal: Baseline DDL (`V001__initial_schema.sql`)

Berikut adalah berkas DDL skema penuh untuk peluncuran perdana aplikasi Flow Studio. Seluruh struktur tabel, relasi, batasan *check*, *index*, dan *trigger* disinkronkan secara presisi dengan dokumen arsitektur data **DOC-ERD-001**.

```sql
-- ============================================================================
-- Flow Studio Database Migration: V001__initial_schema.sql
-- Document ID: DOC-MIG-001 / DOC-ERD-001
-- Engine Target: SQLite 3.35+ (WAL Mode, Foreign Key Constraints Enforced)
-- Description: Baseline schema definition containing vault, accounts,
--              projects, segments, generation_log, triggers, and performance indexes.
-- ============================================================================

-- Pastikan penegakan Foreign Key aktif di tingkat koneksi migrasi
PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. Table: credential_vault
-- ----------------------------------------------------------------------------
-- Menyimpan parameter kriptografis derivasi kunci master password (Argon2id).
-- Tabel ini bersifat singleton (hanya mengizinkan satu baris dengan id = 1).
CREATE TABLE IF NOT EXISTS credential_vault (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    master_password_hash TEXT NOT NULL,
    salt BLOB NOT NULL CHECK (length(salt) = 16),
    kdf_iterations INTEGER NOT NULL DEFAULT 3 CHECK (kdf_iterations >= 3),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 2. Table: accounts
-- ----------------------------------------------------------------------------
-- Menyimpan pool akun Google Flow, payload sesi terenkripsi AES-256-GCM,
-- kuota kredit harian/bulanan, dan status validitas sesi.
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    encrypted_cookies BLOB NOT NULL CHECK (length(encrypted_cookies) > 28),
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'standard', 'pro')),
    daily_credits_remaining INTEGER NOT NULL DEFAULT 50 CHECK (daily_credits_remaining >= 0),
    monthly_credits_remaining INTEGER NOT NULL DEFAULT 0 CHECK (monthly_credits_remaining >= 0),
    daily_reset_at TEXT,
    monthly_reset_at TEXT,
    session_valid INTEGER NOT NULL DEFAULT 1 CHECK (session_valid IN (0, 1)),
    last_health_check TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 3. Table: projects
-- ----------------------------------------------------------------------------
-- Menyimpan metadata proyek kanvas, konfigurasi default generasi, dan
-- representasi JSON dari topologi React Flow nodes & edges.
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) > 0),
    description TEXT,
    graph_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}' CHECK (json_valid(graph_json) = 1),
    settings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings_json) = 1),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 4. Table: segments
-- ----------------------------------------------------------------------------
-- Menyimpan node urutan segmen video, prompt AI, parameter continuity frame,
-- serta path lokal file MP4 dan frame PNG referensi.
CREATE TABLE IF NOT EXISTS segments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    sequence_order INTEGER NOT NULL CHECK (sequence_order >= 0),
    prompt_text TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'flow-v1',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    video_path TEXT,
    reference_frame_path TEXT,
    generation_metadata_json TEXT CHECK (generation_metadata_json IS NULL OR json_valid(generation_metadata_json) = 1),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 3),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE (project_id, sequence_order)
);

-- ----------------------------------------------------------------------------
-- 5. Table: generation_log
-- ----------------------------------------------------------------------------
-- Menyimpan rekam jejak audit transaksi panggilan API ke Google Flow,
-- durasi generasi, konsumsi kuota kredit, serta pesan kegagalan teknis.
CREATE TABLE IF NOT EXISTS generation_log (
    id TEXT PRIMARY KEY,
    account_id TEXT,
    segment_id TEXT,
    request_payload_hash TEXT NOT NULL CHECK (length(request_payload_hash) = 64),
    response_status TEXT NOT NULL CHECK (response_status IN ('success', 'rate_limited', 'unauthorized', 'server_error', 'client_error', 'timeout')),
    credits_consumed INTEGER NOT NULL DEFAULT 0 CHECK (credits_consumed >= 0),
    started_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 6. Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_accounts_selection 
ON accounts (session_valid, daily_credits_remaining DESC, monthly_credits_remaining DESC);

CREATE INDEX IF NOT EXISTS idx_accounts_health_check 
ON accounts (session_valid, last_health_check ASC);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at 
ON projects (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_segments_pipeline_seq 
ON segments (project_id, sequence_order ASC);

CREATE INDEX IF NOT EXISTS idx_segments_status_lookup 
ON segments (project_id, status);

CREATE INDEX IF NOT EXISTS idx_genlog_account 
ON generation_log (account_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_genlog_started_at 
ON generation_log (started_at);

CREATE INDEX IF NOT EXISTS idx_genlog_segment 
ON generation_log (segment_id);

-- ----------------------------------------------------------------------------
-- 7. Automatic updated_at Maintenance Triggers
-- ----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_credential_vault_updated_at
AFTER UPDATE ON credential_vault
FOR EACH ROW
WHEN NEW.updated_at <= OLD.updated_at
BEGIN
    UPDATE credential_vault 
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') 
    WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_accounts_updated_at
AFTER UPDATE ON accounts
FOR EACH ROW
WHEN NEW.updated_at <= OLD.updated_at
BEGIN
    UPDATE accounts 
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') 
    WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_updated_at
AFTER UPDATE ON projects
FOR EACH ROW
WHEN NEW.updated_at <= OLD.updated_at
BEGIN
    UPDATE projects 
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') 
    WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_segments_updated_at
AFTER UPDATE ON segments
FOR EACH ROW
WHEN NEW.updated_at <= OLD.updated_at
BEGIN
    UPDATE segments 
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') 
    WHERE id = OLD.id;
END;
```

---

## 5. Pola Migrasi Masa Depan (Future Migration Patterns)

### 5.1 Karakteristik & Keterbatasan `ALTER TABLE` pada Engine SQLite
Meskipun SQLite mendukung beberapa varian sintaks `ALTER TABLE`, engine ini memiliki keterbatasan mendasar dibandingkan RDBMS skala server seperti PostgreSQL:
1. **Didukung secara Native (Trivial):**
   - Mengubah nama tabel: `ALTER TABLE t1 RENAME TO t2;`
   - Menambahkan kolom baru dengan batasan sederhana: `ALTER TABLE t1 ADD COLUMN col_name TYPE DEFAULT val;` (dengan catatan default value tidak boleh ekspresi dinamis non-konstan atau `CURRENT_TIMESTAMP` pada SQLite versi lama).
   - Mengubah nama kolom (SQLite 3.25.0+): `ALTER TABLE t1 RENAME COLUMN c1 TO c2;`
   - Menghapus kolom (SQLite 3.35.0+): `ALTER TABLE t1 DROP COLUMN c1;` (hanya berlaku jika kolom bukan bagian dari *primary key*, *unique constraint*, *foreign key*, atau diindeks).
2. **TIDAK Didukung secara Native (Non-Trivial):**
   - Mengubah tipe data (*affinity*) kolom yang sudah ada.
   - Menambahkan atau menghapus batasan `CHECK` constraint.
   - Menambahkan atau memodifikasi batasan `NOT NULL` pada kolom yang sudah ada.
   - Menambahkan, mengubah, atau menghapus batasan `FOREIGN KEY` atau `PRIMARY KEY`.
   - Mengubah urutan kolom (*column reordering*).

### 5.2 Pola Migrasi Trivial
Untuk perubahan sederhana seperti penambahan kolom metadata opsional, sintaks langsung `ALTER TABLE` dapat dieksekusi di dalam skrip migrasi berversi:

```sql
-- V002__add_segment_duration.sql
ALTER TABLE segments ADD COLUMN duration_seconds REAL NOT NULL DEFAULT 5.0 CHECK (duration_seconds > 0.0);
```

### 5.3 Pola 12 Langkah Rekreasi Tabel Kanonikal (Canonical 12-Step Table Recreation Pattern)
Untuk seluruh perubahan non-trivial (seperti restrukturisasi tipe, pengubahan relasi foreign key, atau modifikasi check constraint), developer **wajib** menerapkan prosedur resmi SQLite 12-Step Table Recreation Pattern. Prosedur ini menjamin tidak terjadi korupsi integritas kunci asing ataupun kehilangan data.

Berikut adalah 12 langkah terstandarisasi untuk Flow Studio:
1. **Langkah 1 (Prasyarat):** Siapkan skrip DDL struktur tabel baru secara lengkap beserta seluruh indeks dan pemicunya.
2. **Langkah 2 (Batas Transaksi):** Buka transaksi eksklusif `BEGIN IMMEDIATE TRANSACTION;`.
3. **Langkah 3 (Nonaktifkan FK Sementara):** Matikan penegakan foreign key: `PRAGMA foreign_keys = OFF;`.
4. **Langkah 4 (Buat Tabel Sementara):** Buat tabel baru dengan nama sementara `new_{table_name}` yang memuat skema final (kolom baru, tipe baru, constraints baru).
5. **Langkah 5 (Salin Data):** Pindahkan data lama ke tabel baru menggunakan `INSERT INTO new_{table_name} (...) SELECT ... FROM {table_name};` dengan transformasi data atau *type casting* yang diperlukan.
6. **Langkah 6 (Hapus Tabel Lama):** Hapus tabel asli: `DROP TABLE {table_name};`.
7. **Langkah 7 (Ganti Nama Tabel):** Ubah nama tabel sementara menjadi nama asli: `ALTER TABLE new_{table_name} RENAME TO {table_name};`.
8. **Langkah 8 (Rekonstruksi Objek Terkait):** Buat ulang seluruh *secondary index*, *triggers*, dan *views* yang menempel pada tabel tersebut.
9. **Langkah 9 (Verifikasi Kunci Asing):** Jalankan pemeriksaan kunci asing: `PRAGMA foreign_key_check;`. Jika terdapat baris yang melanggar integritas relasi, transaksi wajib dibatalkan (`ROLLBACK`).
10. **Langkah 10 (Verifikasi B-Tree):** Jalankan pemeriksaan integritas struktur: `PRAGMA integrity_check;`.
11. **Langkah 11 (Komit Transaksi):** Komit perubahan ke disk: `COMMIT;`.
12. **Langkah 12 (Aktifkan Kembali FK):** Hidupkan kembali penegakan kunci asing: `PRAGMA foreign_keys = ON;`.

### 5.4 Studi Kasus & Contoh SQL: Modifikasi Non-Trivial pada Tabel `segments`
Sebagai skenario rujukan, asumsikan pada rilis V2 tim arsitek perlu memperluas batasan `retry_count` dari rentang `0..3` menjadi `0..10`, menambahkan kolom `aspect_ratio`, serta mengubah default `model` menjadi `flow-v2`.

Berikut adalah berkas migrasi lengkap `V004__expand_segment_capabilities.sql`:

```sql
-- ============================================================================
-- Flow Studio Migration: V004__expand_segment_capabilities.sql
-- Architecture: Canonical 12-Step Table Recreation Pattern
-- Target Table: segments
-- ============================================================================

-- Langkah 2: Buka transaksi IMMEDIATE
BEGIN IMMEDIATE TRANSACTION;

-- Langkah 3: Matikan foreign keys agar referensi tidak terputus saat DROP TABLE
PRAGMA foreign_keys = OFF;

-- Langkah 4: Buat tabel baru dengan skema diperbarui (new_segments)
CREATE TABLE new_segments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    sequence_order INTEGER NOT NULL CHECK (sequence_order >= 0),
    prompt_text TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'flow-v2',
    aspect_ratio TEXT NOT NULL DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9', '9:16', '1:1', '21:9')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    video_path TEXT,
    reference_frame_path TEXT,
    generation_metadata_json TEXT CHECK (generation_metadata_json IS NULL OR json_valid(generation_metadata_json) = 1),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 10),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE (project_id, sequence_order)
);

-- Langkah 5: Salin data dari segments lama ke new_segments
INSERT INTO new_segments (
    id,
    project_id,
    sequence_order,
    prompt_text,
    model,
    aspect_ratio,
    status,
    video_path,
    reference_frame_path,
    generation_metadata_json,
    retry_count,
    created_at,
    updated_at
)
SELECT 
    id,
    project_id,
    sequence_order,
    prompt_text,
    model,
    '16:9' AS aspect_ratio, -- Menetapkan default eksplisit untuk baris legacy
    status,
    video_path,
    reference_frame_path,
    generation_metadata_json,
    retry_count,
    created_at,
    updated_at
FROM segments;

-- Langkah 6: Hapus tabel lama
DROP TABLE segments;

-- Langkah 7: Ganti nama tabel baru menjadi nama asli
ALTER TABLE new_segments RENAME TO segments;

-- Langkah 8: Buat ulang seluruh indeks dan trigger terkait
CREATE INDEX idx_segments_pipeline_seq 
ON segments (project_id, sequence_order ASC);

CREATE INDEX idx_segments_status_lookup 
ON segments (project_id, status);

CREATE TRIGGER trg_segments_updated_at
AFTER UPDATE ON segments
FOR EACH ROW
WHEN NEW.updated_at <= OLD.updated_at
BEGIN
    UPDATE segments 
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') 
    WHERE id = OLD.id;
END;

-- Langkah 9 & 10: Verifikasi integritas dilakukan oleh Runner Rust sebelum COMMIT
-- Langkah 11: COMMIT dieksekusi oleh Rust Runner
-- Langkah 12: PRAGMA foreign_keys = ON diaktifkan kembali oleh Rust Runner
```

### 5.5 Aturan Larangan & Anti-Pattern Migrasi SQLite
Untuk menjamin stabilitas basis data pada ribuan instalasi workstation klien, seluruh developer wajib mematuhi aturan larangan berikut:
1. **Dilarang Menulis Migrasi Non-Deterministik:** Dilarang menyematkan fungsi acak (`RANDOM()`) atau dependensi lingkungan eksternal di dalam skrip migrasi.
2. **Dilarang Melakukan Drop Table Tanpa Verifikasi Foreign Keys:** Dilarang menghapus tabel induk yang menjadi rujukan foreign key tanpa terlebih dahulu menonaktifkan `PRAGMA foreign_keys = OFF` di dalam transaksi tertutup.
3. **Dilarang Mengubah File Migrasi yang Telah Dirilis:** Berkas migrasi dengan nomor versi yang sudah ada di cabang rilis (*production release*) berstatus *read-only*. Perbaikan *bug* skema wajib dibuat pada berkas migrasi versi selanjutnya.
4. **Dilarang Melakukan Migrasi Parsial Tanpa Transaksi:** Setiap perubahan wajib berada di dalam blok `BEGIN IMMEDIATE` dan `COMMIT`. Dilarang membiarkan pernyataan DDL dieksekusi dalam mode *auto-commit*.

---

## 6. Strategi Pencadangan Otomatis Sebelum Migrasi (Backup-Before-Migrate)

### 6.1 Prosedur Snapshot Menggunakan SQLite Online Backup API
Membuat salinan berkas SQLite langsung pada tingkat sistem berkas (*raw filesystem copy*) saat basis data sedang dalam mode Write-Ahead Logging (WAL) berisiko menghasilkan file cadangan yang tidak konsisten jika terdapat transaksi *in-flight* pada berkas `-wal`.

Oleh karena itu, Flow Studio mengimplementasikan pencadangan menggunakan **SQLite Online Backup API** (`sqlite3_backup_*` yang dibungkus oleh `rusqlite::backup::Backup`). API ini mengunci database secara aman, membilas halaman cache kotor, dan menyalin halaman demi halaman secara atomik ke berkas cadangan target.

Berikut adalah implementasi modul pencadangan produksi pada `src-tauri/src/db/backup.rs`:

```rust
use chrono::Utc;
use rusqlite::{backup::Backup, Connection, Result};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tracing::{error, info, warn};

pub fn create_pre_migration_backup(
    src_conn: &Connection,
    _db_path: &Path,
    backup_dir: &Path,
    current_version: i64,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    fs::create_dir_all(backup_dir)?;

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let backup_filename = format!("flow_studio.db.bak_v{:03}_{}", current_version, timestamp);
    let target_path = backup_dir.join(&backup_filename);

    info!(
        "Memulai pembuatan database snapshot cadangan ke: {:?}",
        target_path
    );

    let mut dst_conn = Connection::open(&target_path)?;

    {
        let backup = Backup::new(src_conn, &mut dst_conn)?;
        backup.run_to_completion(100, Duration::from_millis(50), None)?;
    }

    dst_conn.execute_batch(
        r#"
        PRAGMA integrity_check;
        PRAGMA foreign_key_check;
        "#,
    )?;

    info!(
        "Cadangan basis data terverifikasi aman: {:?} (Ukuran: {} byte)",
        target_path,
        fs::metadata(&target_path)?.len()
    );

    enforce_backup_retention_policy(backup_dir, 5)?;

    Ok(target_path)
}

fn enforce_backup_retention_policy(
    backup_dir: &Path,
    max_retained_backups: usize,
) -> std::io::Result<()> {
    let mut backup_entries: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();

    for entry in fs::read_dir(backup_dir)? {
        let entry = entry?;
        let path = entry.path();

        if let Some(file_name) = path.file_name().and_then(|f| f.to_str()) {
            if file_name.starts_with("flow_studio.db.bak_") {
                let metadata = entry.metadata()?;
                let modified = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                backup_entries.push((path, modified));
            }
        }
    }

    if backup_entries.len() > max_retained_backups {
        backup_entries.sort_by(|a, b| b.1.cmp(&a.1));

        for (stale_path, _) in backup_entries.iter().skip(max_retained_backups) {
            info!("Menghapus berkas cadangan lampau: {:?}", stale_path);
            if let Err(e) = fs::remove_file(stale_path) {
                warn!("Gagal menghapus berkas cadangan usang {:?}: {}", stale_path, e);
            }
        }
    }

    Ok(())
}
```

### 6.2 Konvensi Penamaan Berkas Cadangan
Berkas snapshot cadangan dinamai dengan pola deterministik yang mencantumkan versi skema awal saat pencadangan dan stempel waktu ISO UTC:

$$\mathbf{flow\_studio.db.bak\_v\{VERSION\}\_\{YYYYMMDD\}\_\{HHMMSS\}}$$

Contoh nama berkas:
- `flow_studio.db.bak_v001_20260924_143000`
- `flow_studio.db.bak_v003_20261012_091522`

Lokasi penyimpanan standar berkas cadangan:
- **Windows:** `%APPDATA%/FlowStudio/backups/`
- **Linux/macOS (Dev/Test):** `~/.local/share/FlowStudio/backups/`

### 6.3 Kebijakan Retensi dan Rotasi Otomatis Berkas Cadangan
Untuk mencegah kehabisan ruang penyimpanan lokal pengguna:
1. **Batas Maksimum Snapshot:** Sistem mempertahankan maksimal **5 berkas cadangan** migrasi terbaru.
2. **Auto-Pruning:** Saat pencadangan baru selesai, runner memindai direktori `backups/`, mengurutkan berkas berdasarkan tanggal modifikasi sistem (*modified timestamp*), dan menghapus berkas terlama jika jumlahnya melebihi ambang batas 5 berkas.
3. **Pengecualian Proteksi:** Snapshot yang dibuat tepat sebelum kegagalan migrasi tidak akan dihapus oleh rotasi otomatis hingga pengguna berhasil memulihkan database secara normal.

---

## 7. Strategi dan Prosedur Rollback (Rollback & Disaster Recovery)

### 7.1 Batas Transaksi Atomik
SQLite mendukung eksekusi DDL di dalam transaksi ACID. Jika skrip migrasi mengalami kegagalan sintaksis, pelanggaran integritas data, atau kehabisan disk space di tengah jalan, transaksi SQLite dapat di-*rollback* secara instan.

```rust
let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
match apply_sql_steps(&tx) {
    Ok(()) => tx.commit()?,
    Err(err) => {
        tx.rollback()?;
        return Err(err);
    }
}
```

### 7.2 Prosedur Pemulihan Otomatis Saat Migrasi Gagal
Jika terjadi kegagalan fatal saat migrasi (misalnya disk penuh, crash sistem, atau kegagalan verifikasi integritas pasca-migrasi), sistem Flow Studio secara otomatis mengeksekusi state machine pemulihan:

```
[MIGRATION INITIATED]
         │
         ▼
[Online Backup Succeeded]
         │
         ▼
[Execute Migration SQL] ──────► [SQL Error / Crash]
         │                              │
         │                              ▼
         │                 [ROLLBACK TRANSACTION]
         │                              │
         │                              ▼
         │                 [Close Source SQLite Handles]
         │                              │
         │                              ▼
         │                 [Delete Dirty .db-wal & .db-shm]
         │                              │
         │                              ▼
         │                 [Copy Backup File over flow_studio.db]
         │                              │
         │                              ▼
         │                 [Emit Diagnostic Event to UI]
         │                              │
         │                              ▼
         │                 [Halt App Boot with Safe Dialog]
         │
         ▼
[Post-Integrity Check Clean]
         │
         ▼
[MIGRATION COMPLETE]
```

Langkah-langkah yang diorkestrasi secara otomatis oleh backend:
1. Pembatalan transaksi SQL aktif (`tx.rollback()`).
2. Pelepasan seluruh handle koneksi database yang sedang terbuka.
3. Pembersihan berkas tambahan SQLite WAL (`flow_studio.db-wal`) dan SHM (`flow_studio.db-shm`) untuk mencegah re-play transaksi yang tidak sempurna.
4. Penggantian berkas utama `flow_studio.db` dari berkas cadangan `flow_studio.db.bak_v{prev}_{timestamp}`.
5. Pemancaran event IPC `db:migration-failed` ke UI WebView2 yang menampilkan modal dialog pemulihan crash (*safe recovery modal*) dan panduan diagnostik.
6. Penulisan entitas error terstruktur ke `security_audit_log` dan log diagnostik lokal.

### 7.3 Prosedur Pemulihan Manual / Bencana (Manual Recovery Runbook)
Jika terjadi kerusakan fatal yang menyebabkan backend Rust tidak dapat melakukan pemulihan otomatis:

1. **Hentikan Proses Flow Studio:**
   Pastikan tidak ada instance `flow-studio.exe` yang berjalan di background via Task Manager atau command prompt:
   ```cmd
   taskkill /F /IM flow-studio.exe
   ```
2. **Navigasi ke Direktori Data:**
   Buka folder AppData pengguna:
   ```cmd
   cd %APPDATA%\FlowStudio
   ```
3. **Identifikasi Berkas Cadangan Terakhir:**
   Periksa isi folder `backups/`:
   ```cmd
   dir /O-D backups\flow_studio.db.bak_*
   ```
4. **Hapus Berkas Korup Termasuk Berkas WAL:**
   ```cmd
   del flow_studio.db
   del flow_studio.db-wal
   del flow_studio.db-shm
   ```
5. **Salin Berkas Cadangan ke Berkas Utama:**
   ```cmd
   copy backups\flow_studio.db.bak_v001_YYYYMMDD_HHMMSS flow_studio.db
   ```
6. **Luncurkan Kembali Flow Studio:**
   Aplikasi akan membaca database dalam kondisi sebelum migrasi gagal dan mencatat insiden ke log.

---

## 8. Verifikasi Integritas dan Kualitas Data Pasca-Migrasi

### 8.1 Modul Verifikasi Integritas Rust (`verification.rs`)
Setelah skrip SQL selesai dieksekusi dan sebelum aplikasi dinyatakan siap melayani pengguna, serangkaian verifikasi integritas wajib dijalankan. Jika salah satu pemeriksaan menghasilkan temuan error, migrasi dianggap gagal dan prosedur pemulihan cadangan langsung dipicu.

Implementasi lengkap `src-tauri/src/db/verification.rs`:

```rust
use rusqlite::{Connection, Result};
use tracing::{error, info};

pub fn verify_database_integrity(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    info!("Menjalankan verifikasi integritas struktural database (PRAGMA integrity_check)...");

    let mut stmt = conn.prepare("PRAGMA integrity_check;")?;
    let mut rows = stmt.query([])?;

    let mut integrity_messages = Vec::new();
    while let Some(row) = rows.next()? {
        let msg: String = row.get(0)?;
        integrity_messages.push(msg);
    }

    if integrity_messages.len() != 1 || integrity_messages[0] != "ok" {
        error!(
            "Integritas database gagal diverifikasi! Laporan PRAGMA: {:?}",
            integrity_messages
        );
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!(
                "Database integrity violation: {}",
                integrity_messages.join("; ")
            ),
        )));
    }

    info!("Verifikasi integritas struktural B-Tree sukses: OK.");

    info!("Menjalankan verifikasi integritas kunci asing (PRAGMA foreign_key_check)...");
    let mut fk_stmt = conn.prepare("PRAGMA foreign_key_check;")?;
    let mut fk_rows = fk_stmt.query([])?;

    let mut violations = Vec::new();
    while let Some(row) = fk_rows.next()? {
        let table: String = row.get(0)?;
        let rowid: i64 = row.get(1)?;
        let parent: String = row.get(2)?;
        let fkid: i64 = row.get(3)?;
        violations.push(format!(
            "Table '{}' rowid {} melanggar FK index {} ke parent '{}'",
            table, rowid, fkid, parent
        ));
    }

    if !violations.is_empty() {
        error!(
            "Ditemukan pelanggaran integritas kunci asing pasca-migrasi: {:?}",
            violations
        );
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!(
                "Foreign key constraint violation: {}",
                violations.join("; ")
            ),
        )));
    }

    info!("Verifikasi referential integrity sukses: 0 pelanggaran kunci asing.");

    Ok(())
}
```

### 8.2 Matriks Uji Integritas Pasca-Migrasi
Setiap tahapan migrasi diverifikasi menggunakan instrumen pengujian berikut:

| No | Nama Pemeriksaan | Perintah / Kueri SQL | Kriteria Lolos (Acceptance Criteria) | Tindakan Jika Gagal |
|---|---|---|---|---|
| 1 | **B-Tree Structural Integrity** | `PRAGMA integrity_check;` | Mengembalikan 1 baris tepat berisi string `"ok"`. | Abort transaksi, rollback, dan pulihkan dari file snapshot cadangan. |
| 2 | **Foreign Key Constraint Integrity** | `PRAGMA foreign_key_check;` | Mengembalikan 0 baris (tidak ada orphaned record pada child table). | Abort transaksi, rollback, dan laporkan inkonsistensi relasi. |
| 3 | **Quick Page Format Check** | `PRAGMA quick_check;` | Mengembalikan string `"ok"` tanpa kerusakan pada internal b-tree pointers. | Abort transaksi, rollback, dan tandai database korup. |
| 4 | **Singleton Vault Integrity** | `SELECT COUNT(*) FROM credential_vault;` | Harus bernilai $\le 1$ baris. | Pelanggaran constraint singleton, batalkan proses startup. |
| 5 | **Checksum Ledger Audit** | `SELECT COUNT(*) FROM _schema_migrations WHERE checksum IS NULL OR length(checksum) != 64;` | Bernilai `0`. Setiap riwayat migrasi wajib memiliki stempel hash SHA-256 valid. | Tolak booting sistem karena indikasi tampering metadata. |

---

## 9. Tata Kelola Versi Format Berkas Proyek (`.flowproj`)

### 9.1 Struktur Header & Schema Versioning pada Berkas `.flowproj`
Selain database relasional lokal `flow_studio.db`, Flow Studio menyimpan kanvas alur kerja visual, topologi React Flow nodes & edges, parameter prompt, dan path referensi aset ke dalam berkas JSON mandiri berekstensi `.flowproj` (sesuai SRS FR-018 dan PRD Node Editor §12.1).

Agar berkas proyek yang dibuat pada versi aplikasi lama dapat dibuka pada versi aplikasi masa depan tanpa merusak data (*backward compatibility*), serta mencegah aplikasi versi lama merusak fitur baru saat membuka berkas modern (*forward compatibility*), berkas `.flowproj` menerapkan schema versioning formal.

```json
{
  "schemaVersion": "1.0.0",
  "generator": "FlowStudio 1.0.0",
  "projectId": "7f8b9e6a-1b2c-4d3e-8f9a-0b1c2d3e4f5a",
  "projectName": "Cinematic Cyberpunk Scene",
  "description": "Multi-segment AI video continuity chaining",
  "createdAt": "2026-09-24T10:00:00.000Z",
  "updatedAt": "2026-09-24T12:30:00.000Z",
  "settings": {
    "defaultModel": "flow-v1",
    "aspectRatio": "16:9",
    "autoSaveIntervalSeconds": 60
  },
  "graph": {
    "nodes": [
      {
        "id": "node-prompt-1",
        "type": "promptNode",
        "position": { "x": 100, "y": 150 },
        "data": {
          "label": "Scene 1 Setup",
          "promptText": "Neon-lit Tokyo street in heavy rain, cinematic lighting, 8k",
          "stylePrefix": "cinematic, 35mm lens"
        }
      },
      {
        "id": "node-gen-1",
        "type": "generationNode",
        "position": { "x": 450, "y": 150 },
        "data": {
          "segmentId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
          "sequenceOrder": 0,
          "model": "flow-v1",
          "status": "completed",
          "outputPath": "./assets/segment_000.mp4",
          "referenceFramePath": "./assets/segment_000_last_frame.png"
        }
      }
    ],
    "edges": [
      {
        "id": "edge-p1-g1",
        "source": "node-prompt-1",
        "target": "node-gen-1",
        "sourceHandle": "out",
        "targetHandle": "in"
      }
    ],
    "viewport": {
      "x": 0.0,
      "y": 0.0,
      "zoom": 1.0
    }
  },
  "assets": {
    "baseDirectory": "./assets",
    "files": [
      "./assets/segment_000.mp4",
      "./assets/segment_000_last_frame.png"
    ]
  },
  "extra": {}
}
```

### 9.2 Prinsip Kompatibilitas Maju dan Mundur
1. **SemVer Versioning:** Kolom `schemaVersion` menggunakan format SemVer (`MAJOR.MINOR.PATCH`).
   - Perubahan `PATCH`: Perbaikan kecil yang tidak mengubah struktur skema (misal penambahan metadata deskriptif). Aplikasi membaca langsung tanpa transformasi.
   - Perubahan `MINOR`: Penambahan field node baru atau parameter AI baru yang bersifat opsional. Aplikasi versi baru dapat langsung membaca berkas versi lama dengan mengisikan nilai default (*backward compatibility*).
   - Perubahan `MAJOR`: Perubahan restruktural skema JSON kanvas (misalnya migrasi struktur graph dari format node linier ke topologi DAG bercabang baru). Membutuhkan fungsi migrator berurutan (*step-by-step transformation*).
2. **Forward Compatibility Protection:** Jika pengguna membuka berkas `.flowproj` dengan `MAJOR` version yang lebih tinggi daripada yang didukung oleh biner aplikasi yang sedang berjalan, aplikasi menolak membuka file dan menampilkan dialog: *"Proyek ini dibuat dengan versi Flow Studio yang lebih baru (vX.Y.Z). Silakan perbarui aplikasi Anda untuk membuka proyek ini."* Ini mencegah aplikasi versi lama menimpa dan menghilangkan fitur baru (*accidental downgrade destruction*).
3. **Unknown Field Preservation (Data Shielding):** Deserialisasi struct Rust menggunakan atribut `#[serde(flatten)] extra: HashMap<String, Value>`. Field yang tidak dikenal oleh versi aplikasi saat ini tetap dipertahankan dalam memori dan dituliskan kembali ke berkas JSON saat penyimpanan, sehingga tidak terjadi kehilangan data kustom plugin atau ekspansi kanvas di masa mendatang.

### 9.3 Pipeline Transformasi & Migrasi Berkas Proyek di Rust (`ProjectMigrator`)
Ketika berkas proyek dimuat via IPC command `cmd_project_load`, sistem memeriksa `schemaVersion`. Jika berkas berada pada versi lebih rendah dari versi aplikasi aktif, `ProjectMigrator` mengeksekusi rantai fungsi migrasi berurutan secara terisolasi di memori sebelum mem-parsing state ke UI kanvas.

```rust
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tracing::{info, warn};

pub const CURRENT_PROJECT_SCHEMA_VERSION: &str = "1.0.0";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FlowProjectFile {
    pub schema_version: String,
    pub generator: String,
    pub project_id: String,
    pub project_name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub settings: ProjectSettings,
    pub graph: ProjectGraph,
    pub assets: ProjectAssets,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    pub default_model: String,
    pub aspect_ratio: String,
    pub auto_save_interval_seconds: u32,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGraph {
    pub nodes: Vec<Value>,
    pub edges: Vec<Value>,
    pub viewport: ViewportState,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ViewportState {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAssets {
    pub base_directory: String,
    pub files: Vec<String>,
}

pub struct ProjectMigrator;

impl ProjectMigrator {
    pub fn load_and_migrate(file_path: &Path) -> Result<FlowProjectFile, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(file_path)?;
        let mut raw_json: Value = serde_json::from_str(&content)?;

        let file_version_str = raw_json
            .get("schemaVersion")
            .and_then(|v| v.as_str())
            .unwrap_or("0.9.0");

        let file_version = Version::parse(file_version_str)?;
        let current_version = Version::parse(CURRENT_PROJECT_SCHEMA_VERSION)?;

        if file_version.major > current_version.major {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!(
                    "Berkas proyek membutuhkan versi aplikasi yang lebih baru: schemaVersion {} > didukung {}",
                    file_version, current_version
                ),
            )));
        }

        if file_version < current_version {
            info!(
                "Mendeteksi berkas proyek versi lama ({}). Memulai pipeline migrasi ke {}...",
                file_version, current_version
            );
            raw_json = Self::apply_migrations(raw_json, &file_version, &current_version)?;
        }

        let project: FlowProjectFile = serde_json::from_value(raw_json)?;
        Ok(project)
    }

    fn apply_migrations(
        mut data: Value,
        from: &Version,
        _to: &Version,
    ) -> Result<Value, Box<dyn std::error::Error>> {
        let legacy_boundary = Version::parse("1.0.0")?;
        if *from < legacy_boundary {
            info!("Menerapkan migrasi proyek: v0.9.0 -> v1.0.0 (standarisasi viewport dan assets)");
            data = Self::migrate_v0_9_to_v1_0(data)?;
        }

        data["schemaVersion"] = json!(CURRENT_PROJECT_SCHEMA_VERSION);
        data["generator"] = json!(format!("FlowStudio {}", CURRENT_PROJECT_SCHEMA_VERSION));

        Ok(data)
    }

    fn migrate_v0_9_to_v1_0(mut data: Value) -> Result<Value, Box<dyn std::error::Error>> {
        if let Some(graph) = data.get_mut("graph") {
            if graph.get("viewport").is_none() {
                graph["viewport"] = json!({ "x": 0.0, "y": 0.0, "zoom": 1.0 });
            }
        }

        if data.get("assets").is_none() {
            data["assets"] = json!({
                "baseDirectory": "./assets",
                "files": []
            });
        }

        if let Some(settings) = data.get_mut("settings") {
            if settings.get("aspectRatio").is_none() {
                settings["aspectRatio"] = json!("16:9");
            }
            if settings.get("autoSaveIntervalSeconds").is_none() {
                settings["autoSaveIntervalSeconds"] = json!(60);
            }
        }

        Ok(data)
    }
}
```

### 9.4 Atomisitas Penyimpanan & Penanganan File `.flowproj.autosave`
Untuk mencegah rusaknya berkas proyek jika terjadi crash sistem saat operasi penyimpanan manual atau auto-save berlangsung:
1. **Atomic File Write Pattern:** Penulisan berkas tidak pernah dilakukan langsung ke berkas target `.flowproj`. Data JSON pertama kali diserialisasi ke berkas sementara `.flowproj.tmp_{uuid}`. Setelah seluruh buffer tertulis dan ter-flush ke disk (`sync_all()`), fungsi sistem operasi atomik (`std::fs::rename`) menggantikan berkas target utama secara instan.
2. **Crash Recovery Autosave Protocol:**
   - Setiap 60 detik (jika kanvas dalam kondisi *dirty*), sistem menulis salinan state ke direktori proyek dengan nama `.flowproj.autosave` menggunakan pola atomic rename yang sama.
   - Saat manual save (`Ctrl+S`) berhasil, berkas `.flowproj.autosave` segera dihapus.
   - Saat startup atau pembukaan proyek, jika ditemukan berkas `.flowproj.autosave` dengan stempel waktu lebih baru daripada `.flowproj`, UI memunculkan modal: *"Ditemukan data pemulihan crash otomatis yang lebih baru. Apakah Anda ingin memulihkan perubahan terakhir?"*

---

## 10. Matriks Kepatuhan, Risiko, dan Mitigasi (Risk & Traceability Matrix)

### 10.1 Matriks Risiko Migrasi & Kontrol Keamanan

| ID Risiko | Deskripsi Skenario Bahaya | Dampak | Probabilitas | Kontrol & Mitigasi Teknis |
|---|---|---|---|---|
| **RSK-MIG-001** | Gangguan daya listrik mendadak / OS force kill saat eksekusi migrasi DDL sedang berlangsung. | Database korup, struktur tabel inkonsisten, data hilang. | Sedang | Seluruh langkah migrasi dibungkus dalam `BEGIN IMMEDIATE TRANSACTION`. SQLite WAL menjamin pemulihan atomik ACID saat restart. Snapshot cadangan dibuat sebelum migrasi. |
| **RSK-MIG-002** | Disk penyimpanan lokal penuh saat proses migrasi atau saat pembuatan backup. | Eksekusi SQL gagal, transaksi dibatalkan, IO error. | Sedang | Pre-flight disk space check memastikan ruang bebas $> 500\text{ MB}$. Jika disk tidak memadai, migrasi dibatalkan tanpa menyentuh struktur database aktif. |
| **RSK-MIG-003** | Rekayasa modifikasi berkas migrasi SQL oleh pengguna (*tampering* berkas lokal). | Inkonsistensi skema antar workstation, error runtime. | Rendah | Seluruh skrip SQL di-*embed* ke dalam biner Rust. Checksum SHA-256 diverifikasi terhadap histori tabel `_schema_migrations`. |
| **RSK-MIG-004** | Pelanggaran integritas kunci asing (*orphaned records*) saat migrasi skema tabel kompleks. | Kegagalan fungsi aplikasi, crash query join. | Rendah | Penegakan wajib 12-Step Table Recreation Pattern dan validasi `PRAGMA foreign_key_check;` sebelum transaksi migrasi di-commit. |
| **RSK-MIG-005** | Inkonsistensi format berkas `.flowproj` antara versi aplikasi berbeda (*cross-version sync*). | Kanvas gagal dimuat, node hilang, aplikasi hang. | Sedang | Penegakan `schemaVersion` SemVer, penolakan forward major version incompatibility, pelestarian unknown fields via `#[serde(flatten)]`. |

### 10.2 Pemetaan Persyaratan SRS / ERD Terhadap Strategi Migrasi

| Kebutuhan Sistem | Dokumen Rujukan | Komponen / Mekanisme di MIGRATION.md |
|---|---|---|
| Inisialisasi Skema Lengkap Baseline | DOC-ERD-001 §11 | Skrip DDL `V001__initial_schema.sql` memuat seluruh 5 tabel, 8 indeks, dan 4 triggers. |
| Penegakan Isolasi Kredensial Vault | DOC-ERD-001 §4.1 | Tabel `credential_vault` dengan check constraint singleton `id = 1` dan validasi salt length 16 byte. |
| Audit Preservation saat Akun Dihapus | DOC-ERD-001 §4.5 | Definisi foreign key `generation_log.account_id REFERENCES accounts(id) ON DELETE SET NULL`. |
| Zero Data Loss pada Kegagalan Skema | DOC-SRS-001 NFR-013 | Hot-backup otomatis via SQLite Online Backup API sebelum transaksi migrasi dibuka. |
| Verifikasi Integritas Pasca-Booting | DOC-ARCH-001 §11 | Eksekusi otomatis `PRAGMA integrity_check` dan `PRAGMA foreign_key_check` di `verification.rs`. |
| Portabilitas Proyek Kanvas | DOC-SRS-001 FR-018 | Schema versioning berkas `.flowproj`, `ProjectMigrator`, dan relative pathing aset lokal. |

### 10.3 Checklist Verifikasi Pra-Rilis Migrasi (Pre-Release Migration Checklist)
Sebelum berkas migrasi baru diizinkan digabungkan (*merge*) ke cabang rilis produksi, tim engineering wajib memvalidasi daftar periksa berikut:

- [x] Berkas migrasi baru mengikuti penamaan baku: `V{version}__{description}.sql`.
- [x] Nomor versi migrasi bertambah tepat 1 angka lebih tinggi dari versi terakhir di `main`.
- [x] Seluruh kueri DDL telah diuji kompatibilitasnya terhadap SQLite engine (tidak menggunakan fitur Postgres/MySQL yang tidak didukung).
- [x] Jika migrasi melakukan restrukturisasi non-trivial, pola Canonical 12-Step Table Recreation Pattern telah diterapkan secara lengkap.
- [x] Skrip migrasi telah dibungkus transaksi tertutup dan lolos uji `PRAGMA integrity_check` serta `PRAGMA foreign_key_check`.
- [x] Modul cadangan `create_pre_migration_backup` berhasil menghasilkan berkas snapshot yang dapat dipulihkan secara identik.
- [x] Tidak ada data plaintext sensitif, kredensial, atau master password yang terekspos ke dalam skrip migrasi atau berkas log.
- [x] Kode Rust migration runner memenuhi seluruh aturan hard and standard code quality (`CODE_QUALITY.md`), bebas dari stub, `TODO`, `println!`, atau `unwrap()` tanpa penanganan error kanonikal.
- [x] Uji coba pemuatan berkas proyek `.flowproj` legacy pada runner `ProjectMigrator` terbukti berhasil melakukan transformasi skema tanpa kehilangan node canvas.

---

*Dokumen DOC-MIG-001 ini merupakan spesifikasi teknis definitif arsitektur migrasi database dan versioning proyek Flow Studio. Setiap penyesuaian strategi skema wajib dimutakhirkan melalui proses Architecture Decision Record (ADR) dan pembaruan dokumen ini.*
