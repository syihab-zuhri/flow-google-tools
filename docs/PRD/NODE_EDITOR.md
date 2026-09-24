# PRD: Node Editor

> **Feature ID:** FEAT-NODE_EDITOR  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Priority:** P0  
> **Owner:** Frontend Agent  
> **Dependencies:** FEAT-ACCOUNT_POOL  
> **Last Updated:** 2026-09-24

---

## 1. Overview

Node Editor adalah visual editor berbasis node yang dibangun menggunakan `@xyflow/react` (React Flow v12+). Fitur ini memungkinkan Owner membangun pipeline generasi video dengan menempatkan node di atas infinite canvas dan menghubungkannya melalui edge.

Tiga tipe node tersedia:

| Node Type | Fungsi | Input |
|---|---|---|
| **Prompt Node** | Menyimpan teks prompt untuk generasi video | Multi-line text input |
| **Image/Reference Node** | Menyimpan gambar referensi sebagai input visual | File picker / drag-drop (PNG, JPG, WEBP) |
| **Video/Clip Node** | Menyimpan video klip existing sebagai referensi | File picker / drag-drop (MP4, WEBM) |

Edge mendefinisikan data flow antar node. Pipeline dieksekusi secara sequential — satu segment selesai baru lanjut ke segment berikutnya. Hasil generasi ditampilkan langsung sebagai preview di node yang bersangkutan.

Implementasi menggunakan React 19 dengan `@xyflow/react` v12+ sebagai core canvas library, berjalan di dalam Tauri 2.x webview.

---

## 2. Goals

| # | Goal | Metric | Target |
|---|---|---|---|
| G-1 | Owner dapat membangun pipeline generasi video secara visual tanpa menulis kode | Task completion rate | 100% untuk pipeline linear ≤10 node |
| G-2 | Canvas responsif dan smooth pada pipeline kompleks | Frame rate saat pan/zoom | ≥ 30 FPS dengan 100 node aktif |
| G-3 | Project state persisten dan recoverable | Data loss rate | 0% — auto-save setiap 60 detik, crash recovery via autosave file |
| G-4 | Pipeline validation mencegah konfigurasi invalid sebelum execution | Invalid pipeline submission rate | 0% — validasi client-side sebelum execution |
| G-5 | Preview hasil generasi langsung di canvas tanpa perlu membuka external player | In-canvas preview success rate | 100% untuk video format MP4/WEBM |

---

## 3. Non-Goals (khusus fitur ini)

| # | Non-Goal | Alasan |
|---|---|---|
| NG-1 | Real-time collaboration / multi-user editing | Personal tool — single-user desktop application |
| NG-2 | Custom node type creation oleh end user | Scope MVP; plugin system ada di P2-01 roadmap |
| NG-3 | Audio editing atau audio track manipulation di canvas | Audio support adalah P1-02; Node Editor hanya menangani video pipeline |
| NG-4 | Cloud sync project files | Aplikasi fully local; tidak ada server component |
| NG-5 | Undo/redo history | Scope P1-06; MVP menggunakan manual save/load |
| NG-6 | Timeline view horizontal | Scope P1-04; MVP menggunakan node-based canvas |

---

## 4. Actors & Permissions

| Actor | Deskripsi | Permission |
|---|---|---|
| **Owner** | Single user yang menjalankan Flow Studio di desktop | Full access — create, read, update, delete semua node, edge, dan project |

Tidak ada multi-role karena ini adalah personal desktop tool. Satu-satunya gate adalah credential vault unlock (master password).

---

## 5. Preconditions

| # | Precondition | Validasi |
|---|---|---|
| PRE-1 | Aplikasi Flow Studio sudah di-launch dan running | Tauri window active, webview loaded |
| PRE-2 | Credential vault sudah di-unlock dengan master password | Vault state = `UNLOCKED`; tanpa ini, canvas di-render dalam state Disabled |
| PRE-3 | Minimal satu account tersedia di Account Pool | Account Pool mengembalikan `count >= 1` saat query; tanpa ini, generation button disabled |
| PRE-4 | FFmpeg tersedia di system PATH | Validasi saat app startup; warning banner jika tidak ditemukan (diperlukan untuk preview extraction) |

---

## 6. User Stories

### US-NODE-001: Prompt Node Creation

**Sebagai** Owner, **saya ingin** drag Prompt node ke canvas dan mengetik prompt generasi, **sehingga** saya dapat mendefinisikan instruksi teks untuk video generation.

**Acceptance Criteria:**
- Drag dari node palette → Prompt node muncul di posisi drop
- Node menampilkan multi-line text area yang langsung editable
- Character count ditampilkan di footer node
- Template variables (`{segment_number}`, `{previous_context}`) didukung dan di-highlight secara visual
- Teks tersimpan saat node di-deselect

**Refs:** FR-011

---

### US-NODE-002: Image/Reference Node Creation

**Sebagai** Owner, **saya ingin** drag Image node dan attach file gambar referensi, **sehingga** saya dapat menyediakan visual reference untuk generasi video.

**Acceptance Criteria:**
- Drag dari node palette → Image node muncul di posisi drop
- Klik node → file picker terbuka, filter: PNG, JPG, WEBP
- Drag-drop file gambar langsung ke canvas → auto-create Image node
- Node menampilkan thumbnail preview dari gambar yang dimuat
- File non-image ditolak dengan error message inline

**Refs:** FR-012

---

### US-NODE-003: Video/Clip Node Creation

**Sebagai** Owner, **saya ingin** drag Video/Clip node dan attach video klip existing, **sehingga** saya dapat menggunakan video yang sudah ada sebagai referensi generasi.

**Acceptance Criteria:**
- Drag dari node palette → Video node muncul di posisi drop
- Klik node → file picker terbuka, filter: MP4, WEBM
- Node menampilkan thumbnail frame pertama dari video
- File corrupt → error message inline pada node
- Metadata video (durasi, resolusi) ditampilkan di footer node

**Refs:** FR-013

---

### US-NODE-004: Edge Connection

**Sebagai** Owner, **saya ingin** menghubungkan node dengan edge untuk mendefinisikan pipeline generasi, **sehingga** data flow antar node terdefinisi jelas.

**Acceptance Criteria:**
- Drag dari output port node → edge terbentuk saat di-drop ke input port node lain
- Type constraint diterapkan: output Prompt/Image/Video → input Generation node
- Koneksi invalid → edge snap-back dengan visual feedback (warna merah sesaat)
- Edge yang valid menampilkan animated line saat pipeline sedang executing
- Satu output port dapat terhubung ke multiple input port

**Refs:** FR-014

---

### US-NODE-005: Model Selection

**Sebagai** Owner, **saya ingin** memilih model generasi (Gemini Omni, Veo 3.1, Nano Banana) per generation node, **sehingga** saya dapat mengontrol engine yang digunakan untuk setiap segment.

**Acceptance Criteria:**
- Generation node memiliki dropdown model selection di panel konfigurasi
- Opsi model: Gemini Omni, Veo 3.1, Nano Banana
- Default model diambil dari project settings
- Perubahan model tersimpan per node (tidak global)
- Parameter tambahan: aspect ratio, seed value (optional)

**Refs:** FR-016

---

### US-NODE-006: Generation Preview

**Sebagai** Owner, **saya ingin** melihat preview hasil generasi langsung di node, **sehingga** saya dapat menilai hasil tanpa membuka external player.

**Acceptance Criteria:**
- Setelah generasi selesai → video preview muncul di area body node
- Preview mendukung play/pause dan seekbar
- Klik kanan node → context menu dengan opsi "Open in system player"
- Preview auto-scales sesuai ukuran node
- Loading state ditampilkan selama generasi berlangsung (spinner + progress indicator)

**Refs:** FR-017

---

### US-NODE-007: Project Save & Load

**Sebagai** Owner, **saya ingin** menyimpan project dan memuat kembali nanti, **sehingga** pekerjaan saya persisten antar sesi.

**Acceptance Criteria:**
- `Ctrl+S` → save project ke file `.flowproj` (JSON format)
- `Ctrl+O` → load project dari file `.flowproj`
- File project berisi: graph structure (nodes, edges, positions), generation parameters, relative path ke generated assets
- Path relatif terhadap project directory — portable jika di-copy bersama assets
- Auto-save setiap 60 detik ke `.flowproj.autosave`
- Startup: detect autosave file → offer restore dialog

**Refs:** FR-018, NFR-013

---

### US-NODE-008: Canvas Navigation

**Sebagai** Owner, **saya ingin** pan dan zoom canvas secara bebas, **sehingga** saya dapat menavigasi pipeline yang besar.

**Acceptance Criteria:**
- Drag canvas (middle-click atau Space+drag) → pan
- Scroll wheel → zoom in/out
- Pinch gesture → zoom (touchpad support)
- Canvas infinite — tidak ada hard boundary
- Minimap di corner menampilkan overview dan posisi viewport saat ini
- Fit-to-view button untuk auto-center semua node

**Refs:** FR-010

---

### US-NODE-009: Node & Edge Deletion

**Sebagai** Owner, **saya ingin** menghapus node dan edge, **sehingga** saya dapat memodifikasi pipeline yang sudah dibuat.

**Acceptance Criteria:**
- Select node → tekan `Delete` → node dan semua connected edges terhapus
- Select edge → tekan `Delete` → edge terhapus
- Multi-select (`Shift+click` atau drag-select) → batch delete
- Jika node memiliki generated output → confirmation dialog sebelum delete
- `Ctrl+Z` mengembalikan state sebelumnya (jika undo/redo tersedia; di MVP, confirm dialog mencegah accidental delete)

**Refs:** FR-015

---

## 7. Functional Flow (happy, alternate, failure)

### 7.1 Happy Path — Pipeline Creation & Execution

```
1. Owner membuka Node Editor canvas
2. Owner drag Prompt node dari palette ke canvas
3. Owner mengetik prompt di text area node
4. Owner drag Image node → attach gambar referensi
5. Owner draw edge dari Prompt node → Generation node
6. Owner draw edge dari Image node → Generation node
7. Owner konfigurasi Generation node (model, aspect ratio)
8. Owner klik "Execute Pipeline"
9. Sistem validasi graph:
   a. Cek DAG (no cycles)
   b. Cek valid connections
   c. Cek semua required input terpenuhi
10. Validasi pass → execution dimulai
11. Node status berubah: idle → generating (spinner + progress)
12. Generasi selesai → node status: done (preview muncul)
13. Auto-save triggered
```

### 7.2 Alternate Path — Invalid Connection

```
1. Owner drag edge dari Prompt node output
2. Owner drop edge ke Prompt node input (invalid: Prompt→Prompt)
3. Edge snap-back ke origin dengan visual feedback merah
4. Toast notification: "Koneksi tidak valid — hanya Prompt/Image/Video ke Generation node"
```

### 7.3 Alternate Path — File Drop

```
1. Owner drag file PNG dari file explorer
2. Owner drop file ke canvas area kosong
3. Sistem detect file type → otomatis create Image node di drop position
4. Thumbnail preview rendered di node
```

### 7.4 Failure Path — Generation Error

```
1. Pipeline execution dimulai
2. Segment N gagal (API error, timeout, credit habis)
3. Node status berubah: generating → error (ikon error merah)
4. Error detail ditampilkan di node tooltip
5. Pipeline execution paused pada segment yang gagal
6. Owner dapat: (a) retry segment, (b) skip segment, (c) abort pipeline
7. Log entry ditulis ke diagnostic log
```

### 7.5 Failure Path — Vault Locked

```
1. Owner membuka Node Editor
2. Credential vault dalam state LOCKED
3. Canvas rendered dalam state Disabled — nodes visible tapi non-interactive
4. Banner: "Credential vault terkunci. Unlock untuk melanjutkan."
5. Owner klik unlock → master password dialog
6. Setelah unlock → canvas transisi ke state Default
```

### 7.6 Failure Path — Cycle Detection

```
1. Owner draw edge yang membentuk cycle dalam graph
2. Sistem detect cycle via topological sort validation
3. Edge ditolak — snap-back dengan visual feedback
4. Toast: "Pipeline harus berupa DAG — koneksi ini membentuk cycle"
```

---

## 8. Business Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-NODE-001 | Hanya valid edge connection yang diperbolehkan: output port Prompt/Image/Video → input port Generation node. Koneksi antar tipe yang sama atau reverse direction ditolak. | Client-side validation di `onConnect` handler. Edge snap-back jika invalid. |
| BR-NODE-002 | Pipeline harus berupa DAG (Directed Acyclic Graph). Tidak boleh ada cycle. | Topological sort validation sebelum execution dan pada setiap edge creation. |
| BR-NODE-003 | Maksimum 100 node per canvas. | Counter check saat node creation. Jika limit tercapai, node palette disabled dengan tooltip "Limit 100 node tercapai". |
| BR-NODE-004 | Project auto-save setiap 60 detik saat ada perubahan (dirty flag). | Timer-based auto-save ke `.flowproj.autosave`. Dirty flag di-reset setelah save. |
| BR-NODE-005 | Hapus node yang memiliki generated output memerlukan confirmation dialog. | Check `node.hasOutput` sebelum delete. Jika true → confirmation dialog: "Node ini memiliki output yang sudah di-generate. Hapus node dan output-nya?" |
| BR-NODE-006 | Satu Generation node harus memiliki minimal satu input edge (Prompt, Image, atau Video) sebelum bisa dieksekusi. | Validation saat Execute Pipeline — node tanpa input → error state dengan pesan "Missing input". |
| BR-NODE-007 | Default model untuk Generation node diambil dari project settings. Override per-node menggunakan dropdown di panel konfigurasi. | `projectSettings.defaultModel` sebagai fallback. Node-level override disimpan di `node.data.model`. |
| BR-NODE-008 | File yang di-attach ke Image/Video node harus dalam format yang didukung (PNG/JPG/WEBP untuk image, MP4/WEBM untuk video). | File extension + MIME type validation saat file selection. File invalid → error message inline. |

---

## 9. Acceptance Criteria

### AC-010: Canvas Pan & Zoom (FR-010)

```gherkin
Given canvas Node Editor sudah loaded
When Owner drag canvas dengan middle-click
Then viewport bergeser sesuai arah drag (pan)

Given canvas Node Editor sudah loaded
When Owner scroll wheel ke atas
Then canvas zoom in dengan smooth transition

Given canvas dengan 50+ node
When Owner klik tombol "Fit View"
Then semua node ter-frame di viewport

Given canvas Node Editor sudah loaded
When Owner melihat minimap di corner
Then minimap menampilkan overview seluruh graph dan viewport rectangle
```

### AC-011: Prompt Node (FR-011)

```gherkin
Given node palette visible
When Owner drag "Prompt" dari palette ke canvas
Then Prompt node muncul di posisi drop dengan text area kosong

Given Prompt node sudah di canvas
When Owner mengetik teks "A cinematic sunset over mountains"
And Owner klik area lain (deselect)
Then teks tersimpan di node data

Given Prompt node dengan teks berisi "{segment_number}"
When pipeline dieksekusi pada segment ke-3
Then "{segment_number}" di-resolve menjadi "3"
```

### AC-012: Image Node (FR-012)

```gherkin
Given node palette visible
When Owner drag "Image" dari palette ke canvas
And Owner klik node → file picker terbuka → pilih file PNG
Then Image node menampilkan thumbnail preview dari PNG tersebut

Given canvas area kosong
When Owner drag file JPG dari file explorer ke canvas
Then Image node otomatis terbuat dengan thumbnail dari file tersebut

Given file picker terbuka
When Owner memilih file .txt (bukan image)
Then file ditolak dengan pesan error "Format tidak didukung. Gunakan PNG, JPG, atau WEBP."
```

### AC-013: Video/Clip Node (FR-013)

```gherkin
Given node palette visible
When Owner drag "Video/Clip" dari palette ke canvas
And Owner klik node → file picker terbuka → pilih file MP4
Then Video node menampilkan thumbnail frame pertama dari MP4

Given file MP4 yang corrupt
When Owner attach ke Video node
Then node menampilkan error message "File video corrupt atau tidak dapat dibaca"
```

### AC-014: Edge Connection (FR-014)

```gherkin
Given Prompt node dan Generation node di canvas
When Owner drag dari output port Prompt → drop ke input port Generation
Then edge terbentuk antara kedua node

Given dua Prompt node di canvas
When Owner drag dari output port Prompt-A → drop ke input port Prompt-B
Then edge snap-back, tidak terbentuk koneksi
And visual feedback merah sesaat pada port

Given edge terbentuk dan pipeline executing
When generasi sedang berlangsung
Then edge menampilkan animated flow (dash animation atau particle effect)
```

### AC-015: Delete Node & Edge (FR-015)

```gherkin
Given node tanpa generated output di canvas
When Owner select node → tekan Delete
Then node dan semua connected edges terhapus tanpa confirmation

Given node dengan generated output di canvas
When Owner select node → tekan Delete
Then confirmation dialog muncul: "Node ini memiliki output. Hapus?"
And Owner klik "Ya" → node dan output terhapus

Given 3 node selected (Shift+click)
When Owner tekan Delete
Then ketiga node dan semua terkait edges terhapus (batch delete)
```

### AC-016: Generation Parameters (FR-016)

```gherkin
Given Generation node di canvas
When Owner klik panel konfigurasi node
Then dropdown model menampilkan: Gemini Omni, Veo 3.1, Nano Banana

Given project settings default model = "Veo 3.1"
When Owner create Generation node baru
Then model default terisi "Veo 3.1"

Given Generation node dengan model = "Gemini Omni"
When Owner ubah ke "Nano Banana"
Then perubahan tersimpan per-node, tidak mengubah node lain
```

### AC-017: Preview Result (FR-017)

```gherkin
Given generasi segment selesai sukses
When node menerima video output
Then video preview muncul di body node dengan play/pause dan seekbar

Given video preview sedang playing di node
When Owner klik kanan node
Then context menu muncul dengan opsi "Open in system player"
And Owner klik opsi → video dibuka di default system video player
```

### AC-018: Save & Load Project (FR-018)

```gherkin
Given pipeline dengan 5 node dan 4 edge di canvas
When Owner tekan Ctrl+S → pilih lokasi → simpan
Then file .flowproj terbuat berisi JSON graph structure lengkap

Given file .flowproj yang valid
When Owner tekan Ctrl+O → pilih file → load
Then canvas menampilkan graph identik dengan state saat disimpan

Given project dengan auto-save aktif (dirty flag = true)
When 60 detik berlalu sejak perubahan terakhir
Then file .flowproj.autosave ter-update di project directory

Given app crash dengan .flowproj.autosave tersedia
When Owner restart aplikasi
Then dialog restore muncul: "Autosave ditemukan. Pulihkan project terakhir?"
And Owner klik "Ya" → state recovered dari autosave
```

---

## 10. UI/UX Specifications

### 10.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar: [Save] [Load] [Execute] [Fit View]  [Zoom ±]     │
├──────────┬──────────────────────────────────────────────────┤
│  Node    │                                                  │
│  Palette │           Infinite Canvas                        │
│          │                                                  │
│ ┌──────┐ │     ┌──────────┐      ┌──────────────┐          │
│ │Prompt│ │     │ Prompt   │─────▶│ Generation   │          │
│ └──────┘ │     │ Node     │      │ Node         │          │
│ ┌──────┐ │     └──────────┘      │              │          │
│ │Image │ │     ┌──────────┐      │ [Preview]    │          │
│ └──────┘ │     │ Image    │─────▶│              │          │
│ ┌──────┐ │     │ Node     │      └──────────────┘          │
│ │Video │ │     └──────────┘                                │
│ └──────┘ │                                                  │
│          │                                    ┌──────────┐  │
│          │                                    │ Minimap  │  │
│          │                                    └──────────┘  │
└──────────┴──────────────────────────────────────────────────┘
```

### 10.2 Theme

- **Canvas background:** Dark (#0F0F0F) dengan subtle dot grid pattern
- **Node card:** Surface color (#1A1A2E) dengan border radius 8px
- **Node shadow:** `0 4px 12px rgba(0,0,0,0.4)`

### 10.3 Node Header Colors

| Node Type | Header Color | Hex |
|---|---|---|
| Prompt | Blue | `#3B82F6` |
| Image/Reference | Green | `#22C55E` |
| Video/Clip | Purple | `#A855F7` |
| Generation | Orange | `#F97316` |

### 10.4 Status Indicators

| Status | Visual | Warna |
|---|---|---|
| Idle | Subtle border | `#374151` (gray) |
| Generating | Pulsing border + spinner overlay | `#3B82F6` (blue pulse) |
| Done | Checkmark badge + solid border | `#22C55E` (green) |
| Error | Error icon + solid border | `#EF4444` (red) |

### 10.5 Edge Styling

| State | Style |
|---|---|
| Default | Solid line, `#6B7280`, width 2px |
| Hover | Solid line, `#93C5FD`, width 3px |
| Executing | Animated dash, `#3B82F6`, width 2px |
| Invalid (snap-back) | Solid line, `#EF4444`, width 2px, fade out 300ms |

### 10.6 Component Visual States

Setiap komponen UI dalam Node Editor harus mendukung state berikut. Masing-masing state memiliki Storybook story (ref: DSD.md §Story Specification).

| State | Deskripsi | Visual Treatment |
|---|---|---|
| **Default** | Tampilan normal, data terisi, canvas interactive | Node cards visible, edge lines rendered, toolbar enabled |
| **Loading** | Generasi sedang berlangsung | Node: spinner overlay + pulsing border. Canvas: dimmed area di luar executing node. Toolbar: Execute button disabled, "Generating..." label |
| **Error** | Generasi gagal atau validasi error | Node: red border + error icon badge. Error detail di tooltip hover. Retry button visible di node |
| **Empty** | Zero-data state, first-use experience | Canvas kosong dengan centered illustration + teks "Drag node dari palette untuk memulai". Node palette highlighted dengan subtle pulse |
| **Disabled** | Vault locked, elemen non-interaktif | Canvas: grayscale overlay, pointer-events disabled. Banner overlay: "Credential vault terkunci. Unlock untuk melanjutkan." Toolbar: semua button disabled kecuali Settings |
| **Hover** | Cursor di atas node atau edge | Node: elevated shadow (`0 8px 24px rgba(0,0,0,0.6)`). Edge: width increase + color brighten. Port: scale up 1.2x + glow effect |
| **Focus** | Node atau edge selected via keyboard navigation | Node: focus ring (`2px solid #60A5FA`). Conformal dengan WCAG 2.1 focus indicator requirements |
| **Active** | Node sedang di-drag atau edge sedang di-draw | Node: opacity 0.85 + drop shadow. Edge: elastic preview line mengikuti cursor |
| **Mobile** | Tidak berlaku (desktop-only app) | N/A — Tauri desktop target. Touch target minimum 44×44px tetap diterapkan untuk touchpad/pen input |

---

## 11. API References

Node Editor berinteraksi dengan backend Rust via Tauri Commands (IPC). Tidak ada REST API — semua komunikasi melalui Tauri invoke bridge.

| Command | Direction | Payload | Response | Refs |
|---|---|---|---|---|
| `save_project` | Frontend → Backend | `{ path: string, graph: GraphState }` | `{ success: boolean, error?: string }` | FR-018 |
| `load_project` | Frontend → Backend | `{ path: string }` | `{ graph: GraphState, assets: string[] }` | FR-018 |
| `start_generation` | Frontend → Backend | `{ nodeId: string, model: string, prompt: string, referenceFiles: string[], params: GenParams }` | `{ jobId: string }` | FR-016, FR-017 |
| `poll_generation_status` | Frontend → Backend | `{ jobId: string }` | `{ status: "pending" \| "generating" \| "done" \| "error", progress?: number, outputPath?: string, error?: string }` | FR-017 |
| `extract_first_frame` | Frontend → Backend | `{ videoPath: string }` | `{ framePath: string }` | FR-013 |
| `validate_file` | Frontend → Backend | `{ filePath: string, expectedType: "image" \| "video" }` | `{ valid: boolean, metadata?: FileMetadata, error?: string }` | FR-012, FR-013 |
| `get_available_models` | Frontend → Backend | `{}` | `{ models: Model[] }` | FR-016 |
| `get_project_settings` | Frontend → Backend | `{}` | `{ defaultModel: string, autoSaveInterval: number }` | FR-016, FR-018 |

### Data Types

```typescript
interface GraphState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: { x: number; y: number; zoom: number };
}

interface FlowNode {
  id: string;
  type: "prompt" | "image" | "video" | "generation";
  position: { x: number; y: number };
  data: PromptData | ImageData | VideoData | GenerationData;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

interface GenParams {
  model: string;
  aspectRatio: string;
  seed?: number;
}

interface FileMetadata {
  width: number;
  height: number;
  duration?: number; // seconds, video only
  format: string;
  sizeBytes: number;
}
```

---

## 12. Data Model References

### 12.1 Project File (`.flowproj`)

Format: JSON file disimpan di local filesystem. Tidak ada database table — project state sepenuhnya file-based.

```json
{
  "version": "1.0.0",
  "projectName": "My Pipeline",
  "createdAt": "2026-09-24T10:00:00Z",
  "updatedAt": "2026-09-24T12:30:00Z",
  "settings": {
    "defaultModel": "veo-3.1",
    "autoSaveInterval": 60
  },
  "graph": {
    "nodes": [],
    "edges": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  },
  "assets": {
    "basePath": "./assets",
    "files": []
  }
}
```

### 12.2 Node Data Structures

| Node Type | Fields | Stored In |
|---|---|---|
| Prompt | `id`, `text`, `templateVars` | `graph.nodes[].data` |
| Image | `id`, `filePath` (relative), `thumbnailPath`, `metadata` | `graph.nodes[].data` |
| Video | `id`, `filePath` (relative), `thumbnailPath`, `metadata`, `duration` | `graph.nodes[].data` |
| Generation | `id`, `model`, `aspectRatio`, `seed`, `status`, `outputPath` | `graph.nodes[].data` |

### 12.3 Autosave File (`.flowproj.autosave`)

Struktur identik dengan `.flowproj`. Ditulis secara atomik (write to temp file → rename) untuk mencegah corruption saat crash. Dihapus setelah successful manual save.

---

## 13. Notifications & Side Effects

| Event | Notification | Side Effect |
|---|---|---|
| Generation selesai (success) | Toast: "Segment [N] selesai di-generate" (3 detik auto-dismiss) | Preview video di-render di node. Asset disimpan di project directory. |
| Generation gagal (error) | Toast: "Segment [N] gagal: [error message]" (persistent sampai dismiss) | Node status → error. Log entry ditulis ke diagnostic log. Pipeline paused. |
| Auto-save triggered | Status bar indicator: "Auto-saved" (2 detik) | `.flowproj.autosave` di-update. Dirty flag di-reset. |
| Project saved (manual) | Toast: "Project disimpan" (2 detik auto-dismiss) | `.flowproj` di-update. `.flowproj.autosave` dihapus. |
| Node limit reached | Toast: "Limit 100 node tercapai" (persistent) | Node palette disabled. |
| Vault locked (timeout) | Banner overlay: "Vault terkunci" | Canvas → Disabled state. Semua interaction blocked kecuali unlock. |
| File validation failed | Inline error di node body | File tidak di-attach. Node tetap dalam Empty state. |
| Pipeline validation failed | Toast dengan detail: "Pipeline invalid: [reason]" | Execute button re-enabled. Problem node(s) highlighted dengan error border. |

---

## 14. Error & Recovery Behavior

| Error Scenario | Detection | User Experience | Recovery |
|---|---|---|---|
| **API generation timeout** | HTTP timeout (configurable, default 120s) | Node status → error. Pesan: "Generation timeout — server tidak merespons." | Retry button di node. Auto-retry dengan exponential backoff (max 3 attempts). |
| **Credit habis semua akun** | Account Pool returns `no_credits_available` | Node status → error. Pesan: "Semua akun kehabisan credit." | Pipeline paused. Owner harus menunggu credit refresh atau add account baru. |
| **File system write error** | OS permission denied atau disk full | Dialog: "Gagal menyimpan: [OS error message]" | Owner pilih lokasi lain atau free up disk space. |
| **Corrupt project file** | JSON parse error saat load | Dialog: "File project corrupt. Coba load autosave?" | Offer autosave file jika tersedia. Else: buat project baru. |
| **FFmpeg not found** | PATH check saat startup | Warning banner: "FFmpeg tidak ditemukan. Preview dan export tidak tersedia." | Owner install FFmpeg. App tetap bisa digunakan untuk pipeline building tanpa preview. |
| **Node rendering crash** | React error boundary catch | Error boundary: "Node gagal di-render. Klik untuk reload." | Re-mount node component. State preserved dari last known good. |
| **Auto-save failure** | Write error ke autosave file | Status bar: "Auto-save gagal: [reason]" (persistent warning) | Retry pada interval berikutnya. Manual save tetap tersedia. |
| **Large file attachment** | File size > 50MB threshold | Warning: "File besar ([size]). Attach file ini?" | Owner confirm → file di-attach. Thumbnail generation mungkin lambat. |

---

## 15. Edge Cases

### 15.1 Input Ekstrem

| Case | Behavior |
|---|---|
| Prompt text sangat panjang (>10.000 karakter) | Character counter turns red. Warning: "Prompt mungkin terlalu panjang untuk model." Teks tetap dikirim — model API yang menentukan truncation. |
| 100 node dengan 200+ edge | Canvas tetap responsive (React Flow virtualization). Performance target: ≥30 FPS. Node di luar viewport tidak di-render (React Flow built-in optimization). |
| File gambar 100MB+ | Warning dialog sebelum attach. Thumbnail generation menggunakan downscaled version. Original file di-reference by path, tidak di-copy ke memory. |
| Sangat banyak edge ke satu node | Maximum 10 input edge per node. Attempt ke-11 ditolak dengan pesan "Maksimum 10 input per node." |

### 15.2 Race Condition

| Case | Mitigation |
|---|---|
| User delete node sementara generasi sedang running | Cancel generation job terlebih dahulu → tunggu cancellation confirmed → baru hapus node. Timeout 5 detik untuk cancellation; jika timeout, force delete dan orphan job di-cleanup oleh backend. |
| Multiple auto-save trigger bersamaan | Debounce auto-save — hanya satu write operation aktif. Subsequent trigger di-queue, bukan parallel. |
| Save dan auto-save bersamaan | Manual save mengambil priority. Auto-save di-skip jika manual save sedang in-progress. |
| User load project saat generasi running | Confirmation dialog: "Generasi sedang berlangsung. Load project baru akan membatalkan semua proses. Lanjutkan?" |

### 15.3 Empty State

| Case | Behavior |
|---|---|
| Canvas pertama kali dibuka (no project) | Empty state illustration + "Drag node dari palette untuk memulai" + quick-start guide link |
| Project loaded tapi semua node dihapus | Canvas kosong, toolbar tetap aktif. Prompt: "Canvas kosong. Tambahkan node untuk memulai." |
| Load project tanpa assets (files moved/deleted) | Node menampilkan "File not found: [relative path]" inline error. Pipeline bisa di-run untuk node yang valid. |

### 15.4 Batas Kuota

| Case | Behavior |
|---|---|
| 100 node limit tercapai | Node palette disabled. Toast: "Limit 100 node tercapai." Existing node tetap editable. |
| Disk space < 500MB | Warning banner: "Disk space rendah. Generasi mungkin gagal." Generasi tetap bisa dimulai — OS error di-handle di Error & Recovery. |

---

## 16. Security & Privacy

### 16.1 Anti-Abuse Measures

| Measure | Implementasi |
|---|---|
| **Rate limit** | Tidak berlaku — local application tanpa server endpoint. Generation rate dibatasi oleh Account Pool credit rotation. |
| **Captcha** | Tidak berlaku — single-user desktop tool, tidak ada registration flow. |
| **Temp-mail check** | Tidak berlaku — tidak ada email-based authentication. |
| **Bot detection** | Tidak berlaku — lokal application. |
| **Abuse scenario** | Tidak ada abuse vector karena single-user local tool. Satu-satunya risk: credential leak jika project file dibagikan dan berisi absolute path ke credential vault. Mitigasi: project file hanya menyimpan relative path, tidak ada credential data. |

### 16.2 Data Security

| Concern | Mitigation |
|---|---|
| Project file berisi sensitive prompt | Project file disimpan di local filesystem. Owner bertanggung jawab atas akses. Tidak ada encryption pada project file (non-credential data). |
| Generated video assets | Disimpan di project directory. Tidak di-upload ke cloud. Tidak ada telemetry yang mengirim konten. |
| Credential vault integration | Node Editor tidak menyimpan credential. Semua API call melalui Account Pool yang mengakses vault. Canvas hanya menerima generation results, bukan credential material. |
| Memory: sensitive data | Prompt text dan file path ada di React state (memory). Tidak di-persist ke log. Saat project di-close, React state di-unmount dan garbage collected. |
| Diagnostic logging | Generation log mencatat node ID, timestamp, status, dan duration. Tidak mencatat prompt text, file content, atau credential. Mask rule: jika prompt text terdeteksi di log → replace dengan `[PROMPT_REDACTED]`. |

---

## 17. Analytics & Audit Events

Semua analytics bersifat local-only. Tidak ada external telemetry. Data disimpan di local SQLite diagnostic database.

| Event | Trigger | Data Captured | Retention |
|---|---|---|---|
| `node.created` | Node ditambahkan ke canvas | `nodeId`, `nodeType`, `timestamp` | 90 hari |
| `node.deleted` | Node dihapus dari canvas | `nodeId`, `nodeType`, `hadOutput`, `timestamp` | 90 hari |
| `edge.created` | Edge terbentuk antar node | `edgeId`, `sourceType`, `targetType`, `timestamp` | 90 hari |
| `edge.deleted` | Edge dihapus | `edgeId`, `timestamp` | 90 hari |
| `pipeline.executed` | Execute button diklik | `pipelineId`, `nodeCount`, `edgeCount`, `timestamp` | 90 hari |
| `pipeline.completed` | Pipeline selesai (success/partial) | `pipelineId`, `duration`, `successCount`, `errorCount`, `timestamp` | 90 hari |
| `generation.started` | Segment generation dimulai | `jobId`, `nodeId`, `model`, `timestamp` | 90 hari |
| `generation.completed` | Segment generation selesai | `jobId`, `nodeId`, `status`, `duration`, `timestamp` | 90 hari |
| `project.saved` | Manual save atau auto-save | `projectPath` (hashed), `nodeCount`, `saveType`, `timestamp` | 90 hari |
| `project.loaded` | Project file loaded | `projectPath` (hashed), `nodeCount`, `timestamp` | 90 hari |
| `error.occurred` | Any unrecoverable error | `errorType`, `context` (no PII), `timestamp` | 90 hari |

---

## 18. Testing Scenarios

### 18.1 Unit Tests

| Test ID | Scope | Scenario | Expected |
|---|---|---|---|
| TEST-NOD-U01 | Graph validation | DAG validator: graph tanpa cycle → valid | `isDAG()` returns `true` |
| TEST-NOD-U02 | Graph validation | DAG validator: graph dengan cycle → invalid | `isDAG()` returns `false`, cycle path returned |
| TEST-NOD-U03 | Edge validation | Valid connection: Prompt → Generation | `isValidConnection()` returns `true` |
| TEST-NOD-U04 | Edge validation | Invalid connection: Prompt → Prompt | `isValidConnection()` returns `false` |
| TEST-NOD-U05 | Edge validation | Invalid connection: Generation → Prompt (reverse) | `isValidConnection()` returns `false` |
| TEST-NOD-U06 | Node limit | Add node when count = 100 | Node creation blocked, error returned |
| TEST-NOD-U07 | Template variable | Resolve `{segment_number}` di segment 3 | Output prompt contains "3" |
| TEST-NOD-U08 | File validation | PNG file → Image node | Valid, metadata extracted |
| TEST-NOD-U09 | File validation | TXT file → Image node | Invalid, error message returned |
| TEST-NOD-U10 | Serialization | GraphState → JSON → GraphState roundtrip | Objects identical |

### 18.2 Integration Tests

| Test ID | Scope | Scenario | Expected |
|---|---|---|---|
| TEST-NOD-I01 | Save/Load | Save project → load → compare state | Graph state identical, node positions preserved |
| TEST-NOD-I02 | Auto-save | Edit project → wait 60s → check autosave file | `.flowproj.autosave` exists with current state |
| TEST-NOD-I03 | Crash recovery | Write autosave → simulate restart → restore dialog | Dialog appears, state recovered on confirm |
| TEST-NOD-I04 | Generation flow | Create pipeline → execute → poll status → receive output | Node transitions: idle → generating → done |
| TEST-NOD-I05 | File attachment | Drag PNG ke canvas → verify thumbnail → save → load | Image node persists with thumbnail |
| TEST-NOD-I06 | Delete with output | Create node → generate output → delete → confirm | Node, edges, and output file removed |

### 18.3 E2E Tests

| Test ID | Scope | Scenario | Expected |
|---|---|---|---|
| TEST-NOD-E01 | Full pipeline | Create Prompt + Image → connect to Generation → execute → preview | Video preview appears in Generation node |
| TEST-NOD-E02 | Multi-segment | Build 3-segment pipeline → execute all → verify sequential completion | Segments complete in order, each preview visible |
| TEST-NOD-E03 | Error recovery | Trigger generation error → retry → success | Node transitions: error → generating → done |
| TEST-NOD-E04 | Navigation | 50 nodes → pan, zoom, fit-view, minimap interaction | All navigation smooth, minimap accurate |

### 18.4 Storybook Visual Tests

| Test ID | Component | State | Refs |
|---|---|---|---|
| TEST-NOD-S01 | PromptNode | Default, Hover, Focus, Active | §10.6 |
| TEST-NOD-S02 | PromptNode | Empty (no text), Loading, Error | §10.6 |
| TEST-NOD-S03 | ImageNode | Default (with thumbnail), Empty, Error (invalid file) | §10.6 |
| TEST-NOD-S04 | VideoNode | Default (with thumbnail), Empty, Error (corrupt file) | §10.6 |
| TEST-NOD-S05 | GenerationNode | Idle, Generating, Done (with preview), Error | §10.6 |
| TEST-NOD-S06 | Canvas | Empty state, Disabled (vault locked) | §10.6 |
| TEST-NOD-S07 | Edge | Default, Hover, Executing, Invalid snap-back | §10.6 |
| TEST-NOD-S08 | NodePalette | Default, Disabled (100 node limit) | §10.6 |

### 18.5 Test Coverage Mapping (SRS Traceability)

| FR | Test IDs | PRD Section |
|---|---|---|
| FR-010 | TEST-NOD-E04, TEST-NOD-S06 | §9 AC-010 |
| FR-011 | TEST-NOD-U07, TEST-NOD-S01, TEST-NOD-S02 | §9 AC-011 |
| FR-012 | TEST-NOD-U08, TEST-NOD-U09, TEST-NOD-I05, TEST-NOD-S03 | §9 AC-012 |
| FR-013 | TEST-NOD-S04 | §9 AC-013 |
| FR-014 | TEST-NOD-U03, TEST-NOD-U04, TEST-NOD-U05, TEST-NOD-S07 | §9 AC-014 |
| FR-015 | TEST-NOD-I06, TEST-NOD-U06 | §9 AC-015 |
| FR-016 | TEST-NOD-S05, TEST-NOD-I04 | §9 AC-016 |
| FR-017 | TEST-NOD-E01, TEST-NOD-E02 | §9 AC-017 |
| FR-018 | TEST-NOD-U10, TEST-NOD-I01, TEST-NOD-I02, TEST-NOD-I03 | §9 AC-018 |

---

## 19. Dependencies & Rollout

### 19.1 Feature Dependencies

```
FEAT-ACCOUNT_POOL (P0)
  └──► FEAT-NODE_EDITOR (P0) — this feature
         ├──► FEAT-CONTINUITY_ENGINE (P0) — frame extraction, context chaining
         └──► FEAT-VIDEO_EXPORT (P0) — FFmpeg concat, export
```

| Dependency | Type | Detail | Impact jika Blocked |
|---|---|---|---|
| FEAT-ACCOUNT_POOL | Hard | Generation memerlukan account credentials dari Account Pool | Generation button disabled. Canvas dan pipeline building tetap berfungsi. |
| `@xyflow/react` v12+ | Library | Core canvas library | Blocking — tidak bisa render canvas. |
| React 19 | Library | UI framework | Blocking — tidak bisa render application. |
| Tauri 2.x | Platform | Desktop runtime dan IPC bridge | Blocking — tidak bisa invoke backend commands. |
| FFmpeg | System | Video thumbnail extraction dan preview | Degraded — node building berfungsi, preview dan frame extraction tidak tersedia. |

### 19.2 Rollout Plan

| Phase | Scope | Gate Criteria |
|---|---|---|
| **Phase 1: Canvas Foundation** | Canvas rendering, pan/zoom, minimap, grid. Node palette (empty nodes). | FR-010 tests pass. Canvas renders at ≥60 FPS empty, ≥30 FPS with 100 placeholder nodes. |
| **Phase 2: Node Types** | Prompt, Image, Video node implementation. File attachment, thumbnail generation. | FR-011, FR-012, FR-013 tests pass. All node types render correctly with data. |
| **Phase 3: Edge & Validation** | Edge connections, type validation, DAG validation, delete operations. | FR-014, FR-015 tests pass. Invalid connections rejected. Cycle detection working. |
| **Phase 4: Generation Integration** | Model selection, generation execution, status polling, preview rendering. | FR-016, FR-017 tests pass. End-to-end generation → preview working. |
| **Phase 5: Persistence** | Save/load project, auto-save, crash recovery. | FR-018 tests pass. Roundtrip save/load verified. Auto-save and crash recovery tested. |

### 19.3 Feature Flags

| Flag | Default | Purpose |
|---|---|---|
| `ENABLE_NODE_EDITOR` | `true` | Master toggle untuk seluruh Node Editor feature |
| `ENABLE_AUTOSAVE` | `true` | Toggle auto-save (untuk debugging persistence issues) |
| `MAX_NODES_PER_CANVAS` | `100` | Configurable node limit |
| `AUTOSAVE_INTERVAL_MS` | `60000` | Auto-save interval (ms) |

---

## 20. Open Questions

| # | Question | Impact | Proposed Resolution | Status |
|---|---|---|---|---|
| OQ-1 | Apakah Generation node menjadi tipe node tersendiri atau behavior di-attach ke node existing? | Arsitektur node types | Proposed: Generation node sebagai tipe keempat yang dedicated — separation of concerns lebih jelas antara input nodes dan processing node. | PROPOSED |
| OQ-2 | Bagaimana handling partial pipeline execution — jika segment 3 dari 5 gagal, apakah segment 4-5 tetap dieksekusi? | UX pipeline execution | Proposed: Pipeline paused pada segment yang gagal. Owner memilih: retry, skip, atau abort. Skip melanjutkan ke segment berikutnya tanpa output dari segment yang gagal. | PROPOSED |
| OQ-3 | Apakah perlu node grouping / sub-graph untuk pipeline yang kompleks? | UX complexity management | Proposed: Defer ke P2. MVP cukup dengan flat graph + minimap navigation. | DEFERRED |
| OQ-4 | Apakah undo/redo masuk scope MVP atau tetap di P1? | UX safety net | Proposed: Tetap di P1-06. MVP menggunakan confirmation dialog + auto-save sebagai safety net. | CONFIRMED — P1 |
| OQ-5 | Format project file: JSON vs binary (MessagePack/protobuf)? | Performance, portability | Proposed: JSON untuk MVP (human-readable, debuggable). Jika performance jadi issue di project besar, migrate ke binary di P2. | PROPOSED |
| OQ-6 | Apakah edge animation saat execution menggunakan CSS animation atau canvas rendering? | Performance | Proposed: CSS animation via React Flow built-in animated edge. Fallback ke static edge jika performance < 30 FPS. | PROPOSED |

---

*Document generated per PLANNING_v5.2.md §11.4 PRD template. All 20 sections covered.*
