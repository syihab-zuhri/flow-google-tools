# CODE_QUALITY.md: Flow Studio — Code Quality Standards & Anti-AI-Slop Rules

> **Project:** Flow Studio  
> **Document ID:** DOC-QUAL-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-MANIFEST-001  
> **Supersedes:** None  

---

## 1. Pendahuluan & Filosofi Kualitas Kode

Dokumen ini mendefinisikan standar mutu rekayasa perangkat lunak (*software engineering baseline*), tata kelola kode, dan aturan anti-AI-slop (*anti-AI-slop hygiene*) yang mengikat secara mutlak untuk seluruh agen otonom, *toolchain* CI/CD, dan kontributor manusia yang bekerja pada repositori **Flow Studio**.

Flow Studio mengombinasikan antarmuka visual desktop berkinerja tinggi (**React 19**, **TypeScript 5.x**, `@xyflow/react`, Tailwind CSS) dengan mesin komputasi sistem dan orkestrator kriptografis lokal (**Rust 2021 Edition**, Tauri 2.x, SQLite/SQLx, subproses FFmpeg). Karena aplikasi ini menangani kredensial otentikasi Google berharga tinggi (*high-security tier*) dan memproses beban kerja video deterministik berdurasi panjang, toleransi terhadap kecacatan kode (*code defects*), ilusi implementasi (*stubs*), dan degradasi keterbacaan (*slop*) adalah nol.

### 1.1 Prinsip Fundamental Anti-AI-Slop
1. **Zero-Stub & Production-Grade Reality:** Setiap baris kode yang ditulis dan di-commit harus merupakan implementasi fungsional yang dapat dieksekusi (*runnable*). Tidak diperkenankan menaruh *placeholder*, mock palsu di jalur produksi, atau komentar penundaan implementasi (`TODO`, `FIXME`).
2. **Explicit Failure & Zero Silent Fallback:** Kegagalan sistemik, I/O, dekripsi, atau parsing upstream harus diekspos secara eksplisit melalui struktur error kanonikal (*canonical error envelope*). Mengabaikan error (*swallowed exceptions*) atau mengubah kondisi kritis menjadi nilai *dummy default* yang seolah aman tanpa notifikasi adalah pelanggaran fatal.
3. **Information-Dense Documentation:** Komentar kode hanya diizinkan untuk menjelaskan *alasan bisnis*, *dasar matematis*, *invarian keamanan*, atau *workaround bug upstream*. Komentar yang sekadar menarasikan ulang sintaks kode (*narrative comments*) atau label sepele (*trivial comments*) dilarang keras.
4. **Defensive Typing & Strict Invariants:** Frontend TypeScript dan backend Rust wajib memanfaatkan sistem tipe statis secara maksimal. Segala bentuk jalan pintas tipe (*escape hatches*) seperti `any` liar atau `unwrap()` tanpa justifikasi diblokir pada level kompilasi dan linting.

---

## 2. Hard Rules (HARD-001 s/d HARD-006)

Pelanggaran terhadap kategori **Hard Rules** merupakan cacat kritis tingkat blokir (*critical blocking failure*). Jika ditemukan satu saja pelanggaran pada diff PR (*Pull Request*) atau hasil pemindaian pipeline CI, proses penggabungan (*merge*) ke cabang utama (`main` / `master`) **langsung dibatalkan secara otomatis**, tanpa pengecualian.

| ID | Rule Name | Deskripsi Teknis & Batasan | Alasan Dampak Kritis | Contoh Pelanggaran (Bad) | Contoh Kepatuhan (Good) |
|---|---|---|---|---|---|
| **HARD-001** | **No Swallowed Exceptions** | Dilarang membuat blok `catch` kosong, blok `catch` yang hanya mencetak log tanpa penanganan/re-throw, atau pola Rust `let _ = ...` / `if let Err(_) = ... {}` yang mengabaikan error kritis tanpa eskalasi atau fallback terstruktur. | Menghilangkan jejak diagnostik secara diam-diam (*silent failure*), mempersulit investigasi insiden di mesin pengguna, dan dapat meninggalkan aplikasi dalam *state* korup tak terduga. | `try { await saveVault(); } catch (e) {}` | `try { await saveVault(); } catch (err) { logger.error("Vault save failed", { err }); throw new VaultStorageError("Failed to persist vault state", { cause: err }); }` |
| **HARD-002** | **No Hallucinated Imports** | Setiap simbol, modul, pustaka, atau path file yang diimpor wajib terdaftar secara sah di `package.json` (frontend) atau `Cargo.toml` (backend), serta berkas target harus benar-benar ada di *tree* repositori. | Halusinasi AI terhadap package atau submodule yang tidak eksis menyebabkan kegagalan kompilasi fatal atau *runtime crash* instan. | `import { generateMagicKey } from 'tauri-plugin-crypto-magic';` *(package fiktif)* | `import { invoke } from '@tauri-apps/api/core';` *(terdaftar resmi di package.json)* |
| **HARD-003** | **No Stubs / TODO / FIXME in Main** | Tidak boleh ada deklarasi fungsi/metode kosong, throw placeholder (`throw new Error("TODO")`, `todo!()`, `unimplemented!()`), atau komentar penanda penundaan tugas (`TODO`, `FIXME`, `HACK`, `TBD`) pada kode produksi. | Kode yang belum tuntas merusak kontrak fungsional dan integritas sistem jika terdorong ke jalur rilis produksi. | `fn export_final_video() -> Result<()> { todo!("implement ffmpeg pipeline") }` | Implementasi tuntas algoritma ekspor video terintegrasi dengan subproses FFmpeg dan penanganan error lengkap. |
| **HARD-004** | **No Hardcoded Secrets** | Dilarang keras menanam kredensial, token API, *Google session cookies*, kunci enkripsi AES, nilai *salt*, atau path privat ke dalam kode sumber, unit test, ataupun konfigurasi statis. | Kebocoran keamanan permanen melalui *version control*, risiko kompromi akun Google pengguna (*account takeover*), dan pelanggaran regulasi privasi. | `const MOCK_COOKIE = "SID=AQAA...; HSID=AYYY...";` | Pembacaan kredensial runtime secara terisolasi via Vault terenkripsi Argon2id/AES-256-GCM atau *OS Keychain/DPAPI*. |
| **HARD-005** | **No Silent Fallbacks** | Dilarang mengubah kegagalan API, nilai `null`/`undefined` abnormal, atau kegagalan parsing downstream menjadi nilai *default* palsu yang seolah normal tanpa memancarkan peringatan diagnostik atau mencatat audit kegagalan. | Masalah degradasi upstream Google Flow atau integritas data tersembunyi hingga kuota akun terkuras habis atau output video korup total. | `const quota = response.data?.credits ?? 100;` *(mengasumsikan 100 jika response rusak)* | Validasi skema Zod ketat; jika response payload tidak sesuai skema, lemparkan `UpstreamProtocolError` dan picu rotasi akun. |
| **HARD-006** | **No Infinite Loops Without Guaranteed Exit** | Setiap konstruksi perulangan (`while`, `for`, `loop`, rekursi, atau *polling stream*) wajib memiliki batas iterasi maksimum (*timeout/max_retries*) dan kondisi terminasi deterministik yang terbukti secara formal. | Berpotensi mengunci thread utama (*UI freeze*), kebocoran CPU 100%, konsumsi memori tak terbatas, atau penguncian koneksi I/O lokal. | `while (!isReady) { await checkTask(); }` *(bisa berputar selamanya jika task stuck)* | `for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) { if (await checkTask()) return; await sleep(POLL_INTERVAL_MS); } throw new TimeoutError();` |

---

## 3. Standard Rules (STD-001 s/d STD-007)

Pelanggaran terhadap kategori **Standard Rules** menandakan kebiasaan rekayasa yang buruk dan residu pengerjaan AI (*AI-slop signatures*). Pelanggaran kategori ini **wajib diperbaiki** sebelum kode mendapatkan *approval* dari reviewer teknis atau *gate keeper*.

| ID | Rule Name | Deskripsi Batasan | Alasan Dampak Kualitas | Tindakan Korektif |
|---|---|---|---|---|
| **STD-001** | **No Debug Leftovers** | Dilarang menyisakan pemanggilan fungsi debugging sementara seperti `console.log`, `console.debug`, `console.time`, `dbg!()`, `println!()`, `eprintln!()` (di luar CLI helper resmi), atau *breakpoint statement* seperti `debugger;`. | Membebani buffer I/O standar, mencemari log produksi dengan informasi sampah, dan berpotensi membocorkan struktur memori internal. | Gunakan framework logging resmi: `tracing` (`tracing::info!`, `tracing::debug!`) pada backend Rust dan structured logger modular (`logger.ts`) pada frontend. |
| **STD-002** | **No Trivial Comments** | Dilarang menulis komentar tingkat rendah yang hanya mengulang fungsi sintaksis yang sudah jelas dari nama method/variabel (cth: `// increment counter`, `// return the result`, `// create new array`). | Menimbulkan kebisingan visual (*visual noise*), memperpanjang berkas tanpa menambah pemahaman kontekstual, dan mengaburkan logika penting. | Hapus komentar sepele tersebut. Biarkan kode deskriptif berbicara sendiri melalui *self-documenting identifier*. |
| **STD-003** | **No Narrative Comments** | Dilarang menulis komentar naratif bergaya agen AI yang menceritakan alur eksekusi (cth: `// In this step, we loop over each node to verify connections`, `// Step 1: Initialize variables`, `// Now we handle the edge case`). Dilarang pembatas dekoratif (`// ======= HELPERS =======`). | Tanda nyata kode hasil sintesis AI (*slop*) yang tidak profesional dan menduplikasi logika instruksi komputer ke dalam bahasa manusia. | Hapus seluruh narasi proses. Dokumentasikan hanya *pre-condition*, *post-condition*, atau *invarian bisnis* yang kompleks pada docstring standar (JSDoc/Rustdoc). |
| **STD-004** | **No Redundant Try/Catch** | Dilarang membungkus blok kode ke dalam `try/catch` jika blok `catch` tersebut hanya melempar kembali error yang sama persis tanpa menambahkan konteks kontekstual, tanpa transformasi envelope, atau tanpa aksi kompensasi sumber daya. | Menambah kedalaman *nesting* secara percuma, memperlambat *optimizing compiler*, dan mengacaukan pelacakan *stack trace* asli. | Hapus blok `try/catch` redundan dan biarkan error mengalir secara alami (*bubble up*) ke boundary handler utama, atau tambahkan konteks error yang bermakna. |
| **STD-005** | **No Unsafe Type Escapes** | Dilarang membypass validasi tipe TypeScript menggunakan `as any`, `as unknown as T`, `@ts-ignore`, atau macro casting Rust `unsafe { std::mem::transmute(...) }` tanpa komentar pembenaran teknis yang disetujui arsitek. | Menghancurkan jaminan type-safety, menyembunyikan inkonsistensi skema data saat runtime, dan menjadi celah munculnya `NullPointerException` / `undefined is not a function`. | Gunakan TypeScript discriminated unions, Type Guards (`is` operator), atau runtime validation via `zod`. Pada Rust, gunakan konversi tipe aman `TryFrom` / `TryInto`. |
| **STD-006** | **No Duplicate Imports** | Dilarang mengimpor entitas dari modul atau path paket yang sama secara berulang pada baris terpisah dalam satu berkas, atau mendeklarasikan ulang tipe/interface yang identik di beberapa berkas berbeda. | Mengindikasikan pemeliharaan kode yang ceroboh, memicu inkonsistensi saat dependensi di-refactor, dan memperlambat waktu parsing bundle. | Satukan seluruh import dari modul yang sama ke dalam satu statement terpadu menggunakan *named import destructing*. Tipe data bersama wajib dipusatkan di folder types. |
| **STD-007** | **No Unused Variables / Parameters** | Dilarang membiarkan variabel, parameter fungsi, konstanta, atau import yang tidak pernah direferensikan atau dipanggil di dalam scope aktif. | Dead-code noise yang membingungkan kontributor, memboroskan alokasi memori lokal, dan menyamarkan kemungkinan bug logika (variabel salah panggil). | Hapus variabel yang tidak digunakan. Jika parameter fungsi wajib ada karena kontrak antarmuka eksternal namun tidak dipakai, beri prefix garis bawah (cth: `_event`, `_ctx`). |

---

## 4. Quality Rules (QUAL-001 s/d QUAL-008)

Aturan **Quality Rules** membatasi kompleksitas struktural dan menjaga higienitas arsitektur jangka panjang. Pelanggaran aturan ini menghasilkan peringatan (*warning*) dan pemotongan skor kualitas. Jika total skor audit turun di bawah ambang batas **75**, maka penggabungan (*merge*) wajib ditolak hingga restrukturisasi dilakukan.

| ID | Rule Name | Batasan Metrik (Threshold) | Target Verifikasi & Rasional |
|---|---|---|---|
| **QUAL-001** | **Function Max Lines** | **Maksimal 80 baris kode** (tidak termasuk baris kosong dan komentar). | Memaksa penerapan *Single Responsibility Principle* (SRP). Fungsi yang terlalu panjang sulit diuji secara unit, memiliki terlalu banyak *state* internal, dan rawan efek samping (*side effects*). |
| **QUAL-002** | **File Max Lines** | **Maksimal 400 baris kode** (tidak termasuk baris kosong dan komentar). | Menjaga agar berkas kode tetap kohesif, modular, mudah ditinjau pada layar tunggal, dan mencegah terciptanya *God Objects* atau *dumping ground* logika. |
| **QUAL-003** | **Nesting Max Depth** | **Maksimal 5 tingkat kedalaman blok** (`if`, `for`, `switch`, closure/lambda). | *Deeply nested code* ("Arrow Anti-pattern") merusak *readability*. Gunakan *early returns* (guard clauses), ekstraksi fungsi pembantu, atau polimorfisme untuk meratakan struktur kontrol. |
| **QUAL-004** | **No Dead Code** | **0 instances** (cabang kondisional yang tidak mungkin dicapai, fungsi privat tak terpakai, deklarasi export tanpa konsumen). | Kode mati meningkatkan beban kognitif saat pemeliharaan, memperbesar ukuran biner/bundle produksi, dan berisiko membingungkan analisis audit keamanan. |
| **QUAL-005** | **No Generic Variable Names** | **Dilarang keras**: `data`, `data1`, `temp`, `temp2`, `result`, `res`, `obj`, `val`, `item`, `stuff`, `helper`. | Penamaan generik mengaburkan semantik domain bisnis video studio. Nama wajib spesifik dan merefleksikan domain (cth: `renderedFrameBuffer`, `candidateAccountPool`, `edgeConnectionMap`). |
| **QUAL-006** | **No Tautological Tests** | **0 instances** (pengujian yang pasti selalu berhasil seperti `expect(true).toBe(true)`, `assert_eq!(1, 1)`, perbandingan variabel statis dengan dirinya sendiri). | Pengujian tautologis menciptakan rasa aman palsu (*false confidence*) pada metrik *code coverage* tanpa menguji logika bisnis maupun *failure paths* yang sebenarnya. |
| **QUAL-007** | **Cyclomatic Complexity** | **Maksimal 15 per fungsi/metode**. | Mengukur independensi jalur eksekusi kode. Kompleksitas siklomatis di atas 15 mengindikasikan percabangan logika yang berlebihan dan memerlukan puluhan kombinasi test case untuk verifikasi menyeluruh. |
| **QUAL-008** | **Parameter Count** | **Maksimal 5 parameter per fungsi/metode**. | Parameter yang melebihi 5 membuat pemanggilan fungsi rentan terhadap *positional argument bugs*. Jika membutuhkan lebih dari 5 parameter, wajib dibungkus ke dalam *Parameter Object* (TypeScript Interface atau Rust Struct). |

---

## 5. Language-Specific Rules

### 5.1 TypeScript & React 19 Standards (Frontend Context)

Setiap baris kode frontend pada Flow Studio wajib mematuhi standar TypeScript tingkat tinggi dan arsitektur komponen React 19:

1. **Strict Compiler Baseline:**
   Berkas `tsconfig.json` wajib mengaktifkan konfigurasi strict penuh tanpa kompromi:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "strictFunctionTypes": true,
       "strictBindCallApply": true,
       "strictPropertyInitialization": true,
       "noImplicitThis": true,
       "alwaysStrict": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "noImplicitReturns": true,
       "noFallthroughCasesInSwitch": true,
       "noUncheckedIndexedAccess": true
     }
   }
   ```
2. **Defensive Typing & Zero Untyped Any:**
   - Penggunaan tipe `any` dilarang keras di seluruh domain model, store manajemen state, dan komponen visual.
   - Jika tipe data eksternal belum diketahui saat parsing I/O, gunakan `unknown` dan wajib dilakukan penyempitan tipe (*type narrowing*) menggunakan *Type Guard* atau schema validator sebelum digunakan.
   - Pengecualian darurat `any` hanya diizinkan pada *low-level boundary wrapper* pustaka pihak ketiga yang tidak bertipe resmi, dengan kewajiban menyertakan komentar justifikasi formal berformat:
     `// SAFETY: [Alasan teknis mengapa library eksternal membutuhkan any]`.
   - Lebih pilih `interface` untuk definisi bentuk objek (*object shapes*) yang dapat diekstensi, dan gunakan `type` untuk *union types*, *intersection*, atau pemetaan primitif.
   - Jika membutuhkan anotasi supresi compiler sementara saat transisi tipe, wajib menggunakan `@ts-expect-error` disertai deskripsi masalah, dilarang menggunakan `@ts-ignore`.
   - Hindari TypeScript `enum` numerik konvensional; gunakan *Literal Union Types* atau objek konstan `as const` (cth: `export const NodeStatus = { IDLE: 'IDLE', RUNNING: 'RUNNING' } as const;`).
3. **Runtime Schema Validation via Zod:**
   - Semua data yang melintasi batas IPC Tauri (`invoke` response atau `listen` payload) dan respons parsing HTTP eksternal wajib divalidasi saat runtime menggunakan skema **Zod**.
   - Contoh implementasi validasi boundary yang benar:
   ```typescript
   import { z } from 'zod';
   import { invoke } from '@tauri-apps/api/core';

   export const AccountStatusSchema = z.object({
     accountId: z.string().uuid(),
     email: z.string().email(),
     tier: z.enum(['FREE', 'PAID', 'ENTERPRISE']),
     availableCredits: z.number().int().nonnegative(),
     isActive: z.boolean(),
   });

   export type AccountStatus = z.infer<typeof AccountStatusSchema>;

   export async function fetchAccountStatus(accountId: string): Promise<AccountStatus> {
     const rawPayload = await invoke<unknown>('get_account_status', { accountId });
     const parseResult = AccountStatusSchema.safeParse(rawPayload);
     if (!parseResult.success) {
       throw new Error(`IPC contract validation failed: ${parseResult.error.message}`);
     }
     return parseResult.data;
   }
   ```
4. **React 19 Specific Directives & Component Hygiene:**
   - Adopsi penuh primitif React 19 (seperti hook `use()` untuk resolusi promise/konteks terkelola).
   - Dilarang memanipulasi DOM secara langsung menggunakan `document.getElementById` atau `querySelector`; seluruh referensi node kanvas grafis wajib melalui mekanisme `useRef` dan API resmi `@xyflow/react`.
   - Penanganan state lokal wajib bersifat immutable; hindari mutasi properti objek secara langsung di dalam state React.
   - Komponen wajib bersih dari efek samping (*pure render*). Semua pemanggilan I/O atau mutasi lokal Tauri IPC harus berada di dalam *event handler* atau siklus efek terisolasi.

### 5.2 Rust Standards (Backend & Tauri IPC Context)

Backend Rust bertindak sebagai inti komputasi, penyimpan rahasia (*vault supervisor*), dan pengontrol subsistem multimedia. Standar berikut wajib dipatuhi:

1. **Clippy Enforcement:**
   Pada berkas `src-tauri/src/lib.rs` atau `main.rs`, pasang atribut kompilasi ketat untuk menolak segala bentuk *clippy warning*:
   ```rust
   #![deny(clippy::all)]
   #![deny(clippy::pedantic)]
   #![allow(clippy::module_name_repetitions)] // Pengecualian terkendali jika nama modul berulang
   ```
2. **Strict Ban on `.unwrap()` and `.expect()` in Production Paths:**
   - Pemanggilan `.unwrap()` atau `.expect()` **dilarang keras** di seluruh jalur kode operasional/produksi.
   - Pengecualian satu-satunya adalah di dalam modul pengujian unit (`#[cfg(test)]`) atau inisialisasi konstanta global statis (*lazy static/once cell*) yang telah diverifikasi secara matematis tidak akan pernah gagal saat peluncuran biner.
   - Seluruh penanganan error wajib memanfaatkan operator `?` dan tipe error kanonikal berbasis `thiserror` atau `anyhow` untuk propagasi error kontekstual.
3. **Canonical Error Envelope & IPC Result:**
   - Semua fungsi `#[tauri::command]` wajib mengembalikan tipe `Result<T, CommandError>` di mana `CommandError` mengimplementasikan serialisasi JSON yang konsisten dengan frontend.
   - Contoh implementasi struktur error dan propagasi aman:
   ```rust
   use serde::Serialize;
   use thiserror::Error;

   #[derive(Debug, Error, Serialize)]
   #[serde(tag = "type", content = "details")]
   pub enum CommandError {
       #[error("Database error occurred: {message}")]
       Database { code: String, message: String },
       #[error("Vault lock failure: {0}")]
       VaultLocked(String),
       #[error("Validation failed for argument: {0}")]
       Validation(String),
       #[error("Upstream service unavailable")]
       UpstreamUnavailable,
   }

   #[tauri::command]
   pub async fn rotate_account_session(
       account_id: String,
       state: tauri::State<'_, AppState>,
   ) -> Result<AccountSessionSummary, CommandError> {
       if account_id.trim().is_empty() {
           return Err(CommandError::Validation("Account ID cannot be empty".into()));
       }

       let account = state
           .account_manager
           .get_account(&account_id)
           .await
           .map_err(|err| CommandError::Database {
               code: "DB_FETCH_FAILED".into(),
               message: err.to_string(),
           })?;

       let session = state
           .rotation_engine
           .rotate(&account)
           .await
           .map_err(|_| CommandError::UpstreamUnavailable)?;

       Ok(session)
   }
   ```
4. **Zeroization of Cryptographic Buffers:**
   - Kredensial sensitif seperti *Master Key*, *plaintext session cookies*, dan buffer kunci turunan Argon2id wajib dibungkus dalam tipe data yang mengimplementasikan trait `zeroize::Zeroize` atau `zeroize::ZeroizeOnDrop`.
   - Memori wajib dihapus (ditimpa dengan angka nol) seketika setelah selesai digunakan atau saat objek keluar dari scope memori (*dropped*).
   ```rust
   use zeroize::{Zeroize, ZeroizeOnDrop};

   #[derive(Zeroize, ZeroizeOnDrop)]
   pub struct MasterKeyBuffer {
       pub raw_bytes: [u8; 32],
   }
   ```
5. **Safe Concurrency & Lifetime Management:**
   - Hindari penggunaan `unsafe` block kecuali untuk interaksi Foreign Function Interface (FFI) tingkat rendah yang esensial, dengan dokumentasi *SAFETY invariant* lengkap.
   - Gunakan primitif sinkronisasi asinkron modern (`tokio::sync::Mutex` atau `tokio::sync::RwLock`) untuk menghindari *deadlock* pada pemrosesan antrean *node graph*.

---

## 6. File Decomposition Rules (Berdasarkan §7.11)

Untuk mencegah akumulasi logika masif yang sulit diuji dan dipelihara (*spaghetti monolith*), seluruh agen dan pengembang wajib mematuhi aturan dekomposisi file berikut:

### 6.1 Ambang Batas Dekomposisi (Thresholds)

| Kondisi Kode | Tindakan Wajib Rekayasa |
|---|---|
| **File > 400 baris** (tanpa komentar & baris kosong) | **Wajib dipecah secara mutlak**. Tidak ada pengecualian teknis yang diizinkan masuk ke cabang utama. |
| **File > 250 baris** | **Evaluasi dekomposisi**. Jika file menangani $\ge 2$ tanggung jawab domain yang berbeda, pisahkan segera. |
| **Fungsi / Metode > 80 baris** | **Wajib diekstraksi**. Pecah menjadi fungsi pembantu (*sub-routines*) yang fokus atau pindahkan ke helper file terpisah. |
| **File berisi $\ge 3$ Class / Struct / Complex Interface** | **Pisahkan ke file individual** per entitas jika tipe-tipe tersebut tidak terikat secara privat dan eksklusif. |
| **File mencampur UI + Business Logic + Data Access** | **Wajib dipisahkan berdasarkan layer arsitektur**. Lapisan UI dilarang melakukan pemanggilan query database atau orkestrator secara langsung. |

### 6.2 Pola Dekomposisi Berdasarkan Prioritas

Pemisahan berkas dilakukan mengikuti hierarki disiplin berikut:

```
src/
├── features/
│   ├── account-pool/               # Feature / Domain Directory
│   │   ├── components/            # Layer: UI / Presentation
│   │   │   ├── AccountCard.tsx
│   │   │   └── AccountTable.tsx
│   │   ├── hooks/                 # Layer: State & Orchestration
│   │   │   └── useAccountRotation.ts
│   │   ├── services/              # Layer: Data Transfer & IPC Invocation
│   │   │   └── accountIpcService.ts
│   │   ├── types/                 # Layer: Domain Interfaces & Schemas
│   │   │   └── account.types.ts
│   │   ├── utils/                 # Layer: Pure Utilities
│   │   │   └── quotaCalculator.ts
│   │   └── index.ts               # Barrel file: Public API eksternal saja
```

1. **Decomposition by Responsibility:**
   Setiap berkas hanya memegang satu alasan untuk berubah (*Single Responsibility*). Penamaan berkas mencerminkan perannya secara transparan:
   - `video-export.service.ts` (Logika orkestrasi ekspor)
   - `video-export.types.ts` (Definisi tipe data)
   - `video-export.validator.ts` (Validasi skema parameter ekspor)
   - `VideoExportDialog.tsx` (Render UI dialog ekspor)
   - *Bukan:* `videoExport.ts` yang menumpuk dialog, validasi form, eksekusi IPC, dan konversi format sekaligus.
2. **Decomposition by Feature / Domain:**
   Seluruh artefak yang saling bekerja sama untuk satu fitur spesifik dikelompokkan ke dalam satu direktori fitur di bawah `features/` (frontend) atau modul crate di bawah `src-tauri/src/modules/` (backend).
3. **Decomposition by Layer:**
   - *Presentation Layer:* Komponen murni React, hook visual, style Tailwind.
   - *Application Layer:* Manajemen *state* terdistribusi, *use-cases*, *event listeners*.
   - *Infrastructure Layer:* Klien IPC Tauri, adapter storage lokal, pembungkus proses native FFmpeg.

### 6.3 Tata Kelola Re-Export (Barrel Files)
- Setiap folder fitur diperbolehkan memiliki satu berkas `index.ts` yang bertindak sebagai *public API gateway* untuk modul tersebut.
- Berkas barrel file **hanya boleh** berisi pernyataan re-export eksplisit:
  ```typescript
  export { AccountCard } from './components/AccountCard';
  export { useAccountRotation } from './hooks/useAccountRotation';
  export type { AccountProfile } from './types/account.types';
  ```
- **Dilarang keras:**
  1. Menulis logika implementasi, deklarasi variabel, atau fungsi di dalam file `index.ts`.
  2. Menggunakan wildcard export tak terkontrol (`export * from './...'`) yang dapat merusak kemampuan *tree-shaking* dan memicu tubrukan nama simbol.
  3. Membuat satu *mega-barrel file* di root (`src/index.ts`) yang mere-export seluruh aplikasi, karena dapat memicu dependensi sirkular (*circular dependency graph*) dan memperlambat kompilasi bundler Vite.

### 6.4 Aturan Penamaan File Hasil Pemisahan
- Penamaan berkas wajib mendeskripsikan konten fungsionalnya secara eksplisit, bukan nomor urut arbitrer (contoh: gunakan `frame-cache-cleaner.ts`, dilarang menggunakan `cleaner2.ts` atau `helperNew.ts`).
- Konvensi penamaan:
  - React Components: `PascalCase.tsx` (cth: `PromptNodeWidget.tsx`).
  - Hooks: `camelCase.ts` berawalan `use` (cth: `usePipelineGraph.ts`).
  - Services / Utils / Modules: `kebab-case.ts` atau `camelCase.ts` yang seragam (cth: `account-pool.service.ts`).
  - Rust Modules: `snake_case.rs` (cth: `continuity_engine.rs`, `vault_cipher.rs`).
- Berkas pengujian unit wajib diletakkan berdampingan (*co-located*) dengan file sumber yang diujinya (cth: `continuity-stitcher.ts` berdampingan dengan `continuity-stitcher.spec.ts`).

---

## 7. Tool Integration & CI Enforcement

Seluruh aturan kualitas kode ditegakkan secara mekanis melalui integrasi *toolchain* pada proses kompilasi lokal dan pipeline otomatisasi GitHub Actions / CI Server:

| Tool | Lingkungan Bahasa | Fungsi Operasional & Pintu Gerbang Kualitas | Perintah Eksekusi / Konfigurasi |
|---|---|---|---|
| **aislop** | Multi-Language (TS & Rust) | Memindai tanda-tanda AI-slop, komentar naratif, *swallowed exceptions*, dan menghitung skor kualitas objektif (0–100). | `aislop scan --threshold 75 --strict` |
| **ESLint** | TypeScript / React | Menegakkan kebersihan sintaks, aturan React Hooks, deteksi *unused imports*, dan batas kompleksitas fungsi. | `eslint "src/**/*.{ts,tsx}" --max-warnings 0` |
| **Prettier** | TypeScript / CSS / JSON | Memastikan konsistensi format whitespace, pembungkusan baris (*line wrapping*), dan penataan import. | `prettier --check "src/**/*.{ts,tsx,css,json}"` |
| **TypeScript (tsc)** | TypeScript | Verifikasi statis tipe data tanpa emisi biner untuk memastikan tidak ada kesalahan kompilasi kontrak tipe. | `tsc --noEmit --project tsconfig.json` |
| **Clippy** | Rust | Analisis kode statis backend Rust untuk mendeteksi *inefficient patterns*, pelanggaran idiomatik, dan *safety traps*. | `cargo clippy --all-targets -- -D warnings` |
| **Cargo Audit** | Rust Dependencies | Memindai berkas `Cargo.lock` terhadap kerentanan keamanan (*vulnerabilities*) yang terdaftar di RustSec Advisory DB. | `cargo audit --deny warnings` |
| **Cargo Test** | Rust Unit/Integration | Memverifikasi fungsionalitas logika bisnis inti (vault, router, stitching) dan menjamin tidak ada regresi logika. | `cargo test --all` |

### 7.1 Pipeline CI Workflow Trigger
Setiap pembukaan Pull Request dan push ke cabang utama memicu verifikasi berurutan:
1. `audit-gate`: `cargo audit` & `npm audit --audit-level=high`
2. `format-gate`: `prettier --check` & `cargo fmt --check`
3. `lint-gate`: `eslint --max-warnings 0` & `cargo clippy -- -D warnings`
4. `type-gate`: `tsc --noEmit`
5. `slop-gate`: `aislop scan --threshold 75`
6. `test-gate`: `cargo test` & `vitest run`

Kegagalan pada salah satu gate akan menghentikan pipeline dan menandai PR dengan status *Check Failed* (blokir merge).

---

## 8. Scoring Formula & Quality Thresholds

Setiap evaluasi kode menghasilkan nilai numerik terstandarisasi berskala **0 hingga 100**. Formula pembobotan dirancang untuk memberikan penalti berat terhadap cacat operasional dan residu AI:

$$\text{Final Score} = 100 - (\text{HARD\_violations} \times 15) - (\text{STD\_violations} \times 5) - (\text{QUAL\_violations} \times 2)$$

### 8.1 Matriks Evaluasi Pita Kualitas (Quality Bands)

```
100                          75                       50                       0
 ┌────────────────────────────┬────────────────────────┬───────────────────────┐
 │       🟢 HEALTHY           │     🟡 NEEDS WORK      │      🔴 CRITICAL      │
 │    (Merge Diizinkan)       │    (Merge Diblokir)    │   (Arsitektur Ditolak)│
 └────────────────────────────┴────────────────────────┴───────────────────────┘
```

| Pita Kualitas | Rentang Skor | Status Kebijakan Merge | Konsekuensi & Tindakan Pemulihan |
|---|---|---|---|
| 🟢 **Healthy** | **75 – 100** | **APPROVED FOR MERGE** | Kode memenuhi standar mutu rekayasa Flow Studio. Reviewer manusia/agen dapat menyetujui penggabungan jika fungsionalitas dan unit test telah lengkap. |
| 🟡 **Needs Work** | **50 – 74** | **BLOCKED (Wajib Perbaikan)** | Penggabungan diblokir otomatis. Pengembang/agen wajib membersihkan pelanggaran Standard Rules dan mereduksi kompleksitas Quality Rules hingga skor mencapai $\ge 75$. |
| 🔴 **Critical** | **0 – 49** | **BLOCKED (Review Arsitektural)** | Kode ditolak secara sistemik. Mengindikasikan penumpukan *AI-slop* parah, struktur *God Object*, atau degradasi arsitektur serius. Diperlukan penulisan ulang modul secara terdekomposisi. |

### 8.2 Invarian Blokir Keras (Hard Violation Circuit Breaker)
Terlepas dari hasil numerik formula di atas, berlaku aturan **Invarian Pemutus Arus**:
> **Jika terdapat minimal 1 (satu) pelanggaran kategori HARD RULE (HARD-001 s/d HARD-006) yang belum terselesaikan, status kode dinyatakan otomatis GAGAL (FAIL) dan merge DIBLOKIR SECARA MUTLAK, meskipun perhitungan matematis skor berada di atas 75.**

---

## 9. Code Review Checklist Before Merge

Sebelum sebuah Pull Request diajukan atau disetujui untuk penggabungan ke cabang `main`, checklist verifikasi berikut wajib diisi dan divalidasi oleh agen pengembang maupun reviewer teknis:

```markdown
### Pre-Merge Code Quality & Anti-Slop Verification Checklist

#### 1. Hard Rules Compliance (Non-Negotiable)
- [ ] [HARD-001] Tidak ada swallowed exceptions (semua blok catch/Result error ditangani atau dieskalasi).
- [ ] [HARD-002] Tidak ada hallucinated imports (seluruh dependency terdaftar sah dan lulus kompilasi bersih).
- [ ] [HARD-003] Tidak ada TODO, FIXME, STUB, atau unimplemented!() pada berkas kode produksi.
- [ ] [HARD-004] Tidak ada rahasia, token Google, session cookie, master key, atau credential hardcoded di diff.
- [ ] [HARD-005] Tidak ada silent fallback (kegagalan upstream tidak disamarkan menjadi nilai default palsu).
- [ ] [HARD-006] Semua perulangan dan recursive calls memiliki batas iterasi/timeout dan terminasi deterministik.

#### 2. Standard Hygiene & Anti-AI-Slop Cleanliness
- [ ] [STD-001] Seluruh console.log, dbg!(), println!(), dan debugger statement telah dibersihkan.
- [ ] [STD-002] Bebas dari komentar sepele (trivial comments) yang hanya mengulang sintaks kode.
- [ ] [STD-003] Bebas dari komentar naratif bergaya agen AI dan separator dekoratif nir-makna.
- [ ] [STD-004] Tidak ada redundant try/catch yang hanya sekadar re-throw tanpa penambahan konteks.
- [ ] [STD-005] Tidak ada unsafe type escape (any / @ts-ignore / transmute) tanpa komentar justifikasi resmi.
- [ ] [STD-006] Import bersih terkelola, tanpa deklarasi duplikat dari modul yang sama.
- [ ] [STD-007] Tidak ada variabel atau parameter menganggur tanpa prefix garis bawah (_).

#### 3. Metrics, Decomposition & Maintainability
- [ ] [QUAL-001] Tidak ada fungsi/metode yang panjangnya melebihi 80 baris kode logis.
- [ ] [QUAL-002] Tidak ada berkas yang panjangnya melebihi 400 baris kode logis.
- [ ] [QUAL-003] Tingkat kedalaman nesting blok kontrol maksimum tidak melebihi 5 level.
- [ ] [QUAL-004] Tidak ada dead code, unreachable branches, atau fungsi privat tak berpenghuni.
- [ ] [QUAL-005] Penamaan variabel dan fungsi menggunakan domain substantif (bebas data1, temp, helper).
- [ ] [QUAL-006] Tidak ada tautological test (setiap test case memiliki potensi gagal dan memvalidasi edge-case).
- [ ] [QUAL-007] Cyclomatic complexity setiap fungsi terkontrol $\le 15$.
- [ ] [QUAL-008] Jumlah parameter fungsi tidak melebihi 5 (atau dibungkus Parameter Object).

#### 4. Architecture, Security & Contract Integrity
- [ ] Perubahan kontrak API/IPC telah dicatat dan disinkronkan terlebih dahulu pada `API.md`.
- [ ] Komunikasi frontend-backend mematuhi skema data tauri-specta dan divalidasi runtime via Zod.
- [ ] Data sensitif pada backend Rust mengimplementasikan zeroize saat keluar dari scope memori.
- [ ] Modul dekomposisi mematuhi struktur domain/feature dan barrel file hanya berisi export API publik.
- [ ] Skor akhir audit kualitas kode (aislop / quality formula) terverifikasi $\ge 75$.
```

---

## 10. Dokumen Terkait & Riwayat Perubahan

### 10.1 Dokumen Dependensi
- **DOC-MANIFEST-001 (`PROJECT_MANIFEST.md`):** Registri dokumen proyek dan rencana tahapan pengembangan.
- **DOC-ARCH-001 (`ARCHITECTURE.md`):** Arsitektur sistem desktop, topologi proses Tauri, dan pembagian layer.
- **DOC-SEC-001 (`SECURITY.md`):** Arsitektur keamanan, isolasi kredensial vault, dan baseline OWASP Top 10.
- **DOC-API-001 (`API.md`):** Kontrak antarmuka IPC Tauri commands, events, dan format canonical error envelope.
- **DOC-PLAN-001 (`PLANNING.md`):** Cakupan fitur proyek, North Star, dan batasan operasional.

### 10.2 Riwayat Revisi
| Versi | Tanggal | Pemilik Perubahan | Ringkasan Modifikasi |
|---|---|---|---|
| **1.0.0** | **2026-09-24** | **Software Architect & Planning Lead** | Inisiasi dokumen standar kualitas kode resmi sesuai spesifikasi PLANNING_v5.2.md §11.21; definisi Hard/Standard/Quality Rules, aturan dekomposisi file §7.11, integrasi toolchain ESLint/Clippy, formula skor kualitas, dan checklist review sebelum merge. |
