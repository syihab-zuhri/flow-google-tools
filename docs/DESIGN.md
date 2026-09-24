# DESIGN.md: Flow Studio — Design System, Visual Contract & Story Specification

> **Project:** Flow Studio  
> **Document ID:** DOC-DES-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-PLAN-001  
> **Supersedes:** None  

---

## 1. Brand Contract YAML

Brand Contract mendefinisikan *single source of truth* untuk seluruh token desain, tipografi, grid spasi, elevasi bayangan, dan palet warna antarmuka Flow Studio. Seluruh nilai di bawah mengikat semua komponen antarmuka React 19, implementasi `@xyflow/react`, serta kelas utilitas Tailwind CSS.

```yaml
project_name: "Flow Studio"
tagline: "Sequential AI Video Orchestration Studio & Multi-Account Credit Chainer"

colors:
  primary:
    50:  "#E3F2FD"    # Tint paling halus / highlight subtle
    100: "#BBDEFB"    # Subtle accent surface
    500: "#2196F3"    # Default interactive primary / active outline
    600: "#1E88E5"    # Primary button hover
    700: "#185FA5"    # Brand deep primary base / pressed / dark core
    800: "#1565C0"    # Deep focused border
    900: "#0D47A1"    # Selected container background

  node_accents:
    prompt:
      base:     "#3B82F6"  # Blue (Tailwind blue-500)
      surface:  "#172554"  # blue-950/40
      border:   "#2563EB"  # blue-600
      glow:     "0 0 16px -2px rgba(59, 130, 246, 0.45)"
    image:
      base:     "#10B981"  # Emerald (Tailwind emerald-500)
      surface:  "#064E3B"  # emerald-950/40
      border:   "#059669"  # emerald-600
      glow:     "0 0 16px -2px rgba(16, 185, 129, 0.45)"
    video:
      base:     "#8B5CF6"  # Purple (Tailwind violet-500)
      surface:  "#2E1065"  # violet-950/40
      border:   "#7C3AED"  # violet-600
      glow:     "0 0 16px -2px rgba(139, 92, 246, 0.45)"
    generate:
      base:     "#F59E0B"  # Amber (Tailwind amber-500)
      surface:  "#451A03"  # amber-950/40
      border:   "#D97706"  # amber-600
      glow:     "0 0 16px -2px rgba(245, 158, 11, 0.45)"

  dark_surfaces:
    canvas_bg: "#0B0F19"   # Ultra-dark infinite canvas
    background: "#0F172A"  # Window root / App background (slate-900)
    surface:    "#1E293B"  # Card / Modal / Floating Panel surface (slate-800)
    surface_elevated: "#243147" # Elevated Card / Dropdown / Popover (slate-750)
    surface_subtle:   "#131D2E" # Subdued inner container / inset fields

  borders:
    subtle:  "#1E293B"     # Sibling dividers (slate-800)
    base:    "#334155"     # Default component border (slate-700)
    focused: "#64748B"     # Inactive node selection / element hover (slate-500)
    glow:    "#38BDF8"     # Active port glow / accent ring

  semantic:
    success: "#10B981"     # Emerald-500 (Generation pass / account online)
    warning: "#F59E0B"     # Amber-500 (Credit threshold low / retrying)
    error:   "#EF4444"     # Red-500 (Generation failed / cookie expired)
    info:    "#3B82F6"     # Blue-500 (System state informational)

  neutral:
    0:   "#FFFFFF"         # Pure white (High-emphasis text & icons)
    100: "#F1F5F9"         # Slate-100 (Primary UI text)
    200: "#E2E8F0"         # Slate-200 (Secondary UI text)
    300: "#CBD5E1"         # Slate-300 (Tertiary labels)
    400: "#94A3B8"         # Slate-400 (Placeholder & disabled text)
    500: "#64748B"         # Slate-500 (Subdued meta indicators)
    600: "#475569"         # Slate-600 (Disabled icons & subtle borders)
    700: "#334155"         # Slate-700 (Structural borders)
    800: "#1E293B"         # Slate-800 (Panel surface)
    900: "#0F172A"         # Slate-900 (Main background)
    950: "#020617"         # Slate-950 (Deep dark backdrop overlay)

typography:
  font_family_sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  font_family_mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace"
  scale:
    2xs:  ["0.6875rem", "0.875rem", "400"] # 11px / 14px - Port badge / compact tags
    xs:   ["0.75rem",   "1rem",     "400"] # 12px / 16px - Metadata / timestamp
    sm:   ["0.875rem",  "1.25rem",  "400"] # 14px / 20px - Node body text / inputs
    base: ["1rem",      "1.5rem",   "400"] # 16px / 24px - Standard dialog body
    md:   ["1rem",      "1.5rem",   "500"] # 16px / 24px - Button labels / node titles
    lg:   ["1.125rem",  "1.75rem",  "600"] # 18px / 28px - Panel headings / section titles
    xl:   ["1.25rem",   "1.75rem",  "600"] # 20px / 28px - Modal header / primary card titles
    2xl:  ["1.5rem",    "2rem",     "700"] # 24px / 32px - Metric numbers / hero modal titles
    3xl:  ["1.875rem",  "2.25rem",  "700"] # 30px / 36px - Window titles / workspace stats

spacing:
  unit: "4px"
  scale:
    0:  "0px"
    1:  "4px"     # 0.25rem - Micro gap / handle offsets
    2:  "8px"     # 0.50rem - Compact padding / icon margins
    3:  "12px"    # 0.75rem - Standard component inner padding
    4:  "16px"    # 1.00rem - Node card internal padding
    5:  "20px"    # 1.25rem - Medium section gap
    6:  "24px"    # 1.50rem - Modal dialog padding
    8:  "32px"    # 2.00rem - Tool panel margins
    10: "40px"    # 2.50rem - Canvas floating control distance
    12: "48px"    # 3.00rem - Large section separation
    16: "64px"    # 4.00rem - Canvas edge gutter

border_radius:
  none: "0px"
  sm:   "4px"     # Badges, handles, tags, sub-metrics
  md:   "6px"     # Form inputs, small buttons, status indicators
  lg:   "8px"     # Standard Node cards, buttons, dropdowns
  xl:   "12px"    # Modals, floating dock, canvas overlays, MiniMap
  2xl:  "16px"    # Outer application modal wrappers
  full: "9999px"  # Connection handles, avatars, circular pills

elevation:
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.35)"
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.45), 0 2px 4px -2px rgba(0, 0, 0, 0.30)"
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.55), 0 4px 6px -4px rgba(0, 0, 0, 0.40)"
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.65), 0 8px 10px -6px rgba(0, 0, 0, 0.50)"
  glow_primary:  "0 0 20px -3px rgba(33, 150, 243, 0.35)"
  glow_prompt:   "0 0 20px -3px rgba(59, 130, 246, 0.40)"
  glow_image:    "0 0 20px -3px rgba(16, 185, 129, 0.40)"
  glow_video:    "0 0 20px -3px rgba(139, 92, 246, 0.40)"
  glow_generate: "0 0 20px -3px rgba(245, 158, 11, 0.40)"
  glow_error:    "0 0 20px -3px rgba(239, 68, 68, 0.45)"
```

---

## 2. Typography Specification

Tipografi antarmuka Flow Studio memisahkan secara tegas antara hierarki teks antarmuka (*UI Chrome*) dan representasi teks teknis/kode/durasi/prompt (*Technical & Data Strings*).

### 2.1 Font Families

1. **Primary Interface Font:** `Inter` (dengan fallback `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`).
   - Digunakan untuk: label navigasi, judul dialog, header node, tombol aksi, status bar, menu konteks.
   - Karakteristik: Keterbacaan tinggi pada mode gelap, fitur font tabular (`tnum`) aktif untuk nilai angka yang dinamis.
2. **Monospace & Code Font:** `JetBrains Mono` (dengan fallback `'Fira Code', 'Cascadia Code', Menlo, monospace`).
   - Digunakan untuk: input Prompt text, style descriptor, frame timestamps, durasi detik, credit counters, token hashes, error stack traces, JSON inspection.
   - Karakteristik: Ligatur koding yang jelas, pembedaan tegas antara karakter `0` (nol bergaris) dan `O` (huruf kapital), serta `1`, `l`, `I`.

### 2.2 Typography Scale & Application Matrix

| Token | Font Size | Line Height | Weight | Tracking | Primary Usage | Sample Element |
|---|---|---|---|---|---|---|
| `font-2xs` | `0.6875rem` (11px) | `0.875rem` (14px) | Regular (400) / Medium (500) | `+0.02em` | Input/Output port names, mini badges | `<span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">` |
| `font-xs` | `0.75rem` (12px) | `1.00rem` (16px) | Regular (400) / SemiBold (600) | Normal | Metadata bar, status pill, credit metrics | `<p className="text-xs text-slate-400">` |
| `font-sm` | `0.875rem` (14px) | `1.25rem` (20px) | Regular (400) | `-0.01em` | Textarea prompt, form input, helper texts | `<textarea className="text-sm font-mono text-slate-200">` |
| `font-base` | `1.00rem` (16px) | `1.50rem` (24px) | Regular (400) | Normal | Dialog body text, notification content | `<p className="text-base text-slate-300">` |
| `font-md` | `1.00rem` (16px) | `1.50rem` (24px) | Medium (500) | `-0.01em` | Node header titles, primary action buttons | `<h3 className="text-base font-medium text-white">` |
| `font-lg` | `1.125rem` (18px) | `1.75rem` (28px) | SemiBold (600) | `-0.02em` | Floating panel headers, drawer headers | `<h2 className="text-lg font-semibold text-white">` |
| `font-xl` | `1.25rem` (20px) | `1.75rem` (28px) | SemiBold (600) | `-0.02em` | Modal dialog titles (Unlock Vault, Export) | `<h2 className="text-xl font-semibold text-white">` |
| `font-2xl` | `1.50rem` (24px) | `2.00rem` (32px) | Bold (700) | `-0.03em` | Total Credit Counter, generation duration | `<span className="text-2xl font-bold font-mono text-blue-400">` |
| `font-3xl` | `1.875rem` (30px) | `2.25rem` (36px) | Bold (700) | `-0.03em` | Application Title Bar, Hero metrics | `<h1 className="text-3xl font-bold tracking-tight text-white">` |

---

## 3. Spacing Tokens (4px Unit Grid)

Layout, margin, dan padding Flow Studio berbasis kelipatan matematis **4px** (*8pt grid system* dengan granularitas *4pt half-step*). Desain ini mencegah pergeseran sub-piksel pada Windows HiDPI scaling (125%, 150%, 200%).

| Token | Nilai Absolut | Nilai Rem | Aplikasi Konkret dalam Workspace |
|---|---|---|---|
| `spacing-0` | `0px` | `0rem` | Reset margin / border collapse |
| `spacing-1` | `4px` | `0.25rem` | Micro spacing: gap badge status, handle anchor margin, offset titik koneksi |
| `spacing-2` | `8px` | `0.50rem` | Compact spacing: padding tombol toolbar, padding internal badge, gap horizontal input |
| `spacing-3` | `12px` | `0.75rem` | Inner element padding: list item pool akun, tab header, port row spacing |
| `spacing-4` | `16px` | `1.00rem` | Node internal padding: konten kartu node, spacing antar grup form |
| `spacing-5` | `20px` | `1.25rem` | Header padding: node header container, modal title separator |
| `spacing-6` | `24px` | `1.50rem` | Dialog padding: margin body MasterPasswordModal, padding ExportProgressBar card |
| `spacing-8` | `32px` | `2.00rem` | Layout gutter: jarak docking kontrol kanvas dari tepi jendela viewport |
| `spacing-10` | `40px` | `2.50rem` | Distance overlay: jarak MiniMap floating dari pojok kanan bawah |
| `spacing-12` | `48px` | `3.00rem` | Major separator: jarak vertikal antar section settings |
| `spacing-16` | `64px` | `4.00rem` | Canvas boundary safety margin: batas padding auto-center `fitView()` |

---

## 4. Border Radius Tokens

Radius lengkungan sudut dirancang konsisten untuk menciptakan hierarki visual antara elemen mikro (port & tag) hingga jendela modular (modal & canvas panel).

| Token | Nilai | Visual Purpose | Contoh Implementasi |
|---|---|---|---|
| `rounded-none` | `0px` | Sudut tajam, frame video raw tanpa container, grid canvas | `canvas.bg-sharp` |
| `rounded-sm` | `4px` | Sub-elemen mikro: tag tipe format video (`MP4`, `1080p`), chip prompt token | `span.badge-tag` |
| `rounded-md` | `6px` | Elemen interaktif level dasar: input field Master Password, tombol kontrol MiniMap | `input.vault-password`, `button.canvas-control` |
| `rounded-lg` | `8px` | Kontainer utama node: `NodeCard` (Prompt, Image, Video, Generate) | `div.flow-node-card` |
| `rounded-xl` | `12px` | Modal dialog, dock panel mengambang (*floating canvas control panel*) | `div.canvas-dock`, `div.modal-container` |
| `rounded-2xl` | `16px` | Dialog popover berukuran besar, master layout wrapper | `div.vault-card-wrapper` |
| `rounded-full` | `9999px` | Circular elements: Connection `Handle`, Account avatar indicator, Credit pill meter | `div.react-flow__handle`, `div.account-pill` |

---

## 5. Elevation Tokens & Dark Mode Glow Effects

Mode gelap Flow Studio menggunakan bayangan ganda (*multi-layer dark shadow*) yang dikombinasikan dengan efek pendaran cahaya aksen (*colored glow*) untuk merefleksikan status pemrosesan aktif (generasi, rendering, streaming data).

### 5.1 Shadow Levels

```css
/* Tailwind theme extension tokens */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.40);
--shadow-md: 0 4px 8px -2px rgba(0, 0, 0, 0.50), 0 2px 4px -2px rgba(0, 0, 0, 0.35);
--shadow-lg: 0 12px 20px -4px rgba(0, 0, 0, 0.65), 0 4px 6px -2px rgba(0, 0, 0, 0.40);
--shadow-xl: 0 24px 32px -8px rgba(0, 0, 0, 0.75), 0 8px 12px -4px rgba(0, 0, 0, 0.50);
```

### 5.2 Node Colored Glow Accents (Interactive & Active Status)

Ketika node berada dalam state aktif, terseleksi, atau sedang mengeksekusi generasi, border dan bayangannya mengaktifkan aksen glow berbasis tipe node:

1. **Prompt Node Glow (Blue):**
   `box-shadow: 0 0 0 1px #3B82F6, 0 0 20px -3px rgba(59, 130, 246, 0.50);`
2. **Image Node Glow (Emerald):**
   `box-shadow: 0 0 0 1px #10B981, 0 0 20px -3px rgba(16, 185, 129, 0.50);`
3. **Video Node Glow (Purple):**
   `box-shadow: 0 0 0 1px #8B5CF6, 0 0 20px -3px rgba(139, 92, 246, 0.50);`
4. **Generate Node Glow (Amber / Pulse in Generating State):**
   `box-shadow: 0 0 0 1px #F59E0B, 0 0 24px 0px rgba(245, 158, 11, 0.55);`
5. **Node Error Glow (Red):**
   `box-shadow: 0 0 0 1px #EF4444, 0 0 20px -2px rgba(239, 68, 68, 0.60);`

---

## 6. Component Inventory & Visual States Specification

Berdasarkan arsitektur Flow Studio dan kebutuhan antarmuka kreatif desktop, berikut adalah 8 komponen inti UI beserta rincian 7 visual states wajib:
1. `Default` (Keadaan idle normal)
2. `Hover` (Kursor melintas)
3. `Active / Selected` (Fokus aktif, terseleksi, atau ditekan)
4. `Disabled` (Nonaktif / kontrol diblokir)
5. `Loading / Generating` (Sedang melakukan request IPC, transcode, atau generasi upstream)
6. `Error` (Gagal validasi, kuota habis, koneksi terputus, atau rendering crash)
7. `Empty` (Data belum diinput, list kosong, atau belum ada file yang dimuat)

### 6.1 Matriks 8 Komponen UI Utama

| Komponen | Deskripsi Fungsional | Token Tipe | Priority | Storybook Path |
|---|---|---|---|---|
| **NodeCard** | Kontainer visual untuk simpul graf `@xyflow/react` (Prompt, Image, Video, Generate) | Node Container | **P0** | `Canvas/NodeCard` |
| **Handle** | Titik terminal port (Source/Target) untuk koneksi edge multi-tipe | Port Endpoint | **P0** | `Canvas/Handle` |
| **CanvasControls** | Floating dock navigasi zoom in/out, fit-view, lock, dan reset orientation | Navigation Dock | **P0** | `Canvas/CanvasControls` |
| **MiniMap** | Peta overview miniatur canvas dengan visualisasi node dan viewport locator | Spatial Locator | **P0** | `Canvas/MiniMap` |
| **AccountBadge** | Indikator status akun Google Flow (nama, email mask, tier, health status) | Session Indicator | **P0** | `Account/AccountBadge` |
| **CreditMeter** | Progress bar visual utilitas kredit gabungan dan per-akun | Quota Meter | **P0** | `Account/CreditMeter` |
| **MasterPasswordModal** | Dialog otorisasi kriptografis untuk membuka kunci credential vault | Security Dialog | **P0** | `Security/MasterPasswordModal` |
| **ExportProgressBar** | Panel pemantau status stitching FFmpeg, progress bar persentase & ETA | Render Monitor | **P0** | `Export/ExportProgressBar` |

---

### 6.2 Visual States Specification Per Komponen

#### 1. NodeCard (Tipe: Prompt, Image, Video, Generate)
- **Default:** Latar `#1E293B` (slate-800), border 1px `#334155`, shadow-md. Header menampilkan bar aksen warna sesuai tipe (3B82F6, 10B981, 8B5CF6, F59E0B).
- **Hover:** Border berubah menjadi `#64748B`, elevasi naik ke shadow-lg, header icon sedikit memudar terang.
- **Active / Selected:** Border 1px warna aksen node tipe, shadow glow aksen menyala (misal `#3B82F6` dengan glow `0 0 20px -3px rgba(59, 130, 246, 0.40)`).
- **Disabled:** Opacity 50%, grayscale 30%, border `#1E293B`, kursor `not-allowed`. Tidak dapat di-drag atau di-connect.
- **Loading / Generating:** Header menampilkan badge animasi spinner SVG, border node bernapas (*pulsing glow keyframe animation* 1.5s), progress tracker tampil pada footer node.
- **Error:** Border 1px `#EF4444`, bayangan glow merah intens (`rgba(239, 68, 68, 0.5)`), ikon peringatan muncul pada header dengan tooltip penyebab error.
- **Empty:** Konten body menampilkan placeholder kosong dengan garis putus-putus (`border-dashed border-slate-700`) bertuliskan *"No prompt defined / Drag media here"*.

#### 2. Handle (Port Source & Target)
- **Default:** Lingkaran 12px x 12px, border 2px `#0F172A`, background sesuai tipe data: Biru `#3B82F6` (Text/Prompt), Emerald `#10B981` (Image Frame), Ungu `#8B5CF6` (Video Clip).
- **Hover:** Skala membesar 125% (`scale-125`), border menebal menjadi 2px `#FFFFFF`, glow subtle sesuai warna tipe data.
- **Active (Connecting / Dragging Edge):** Lingkaran membesar 140%, background warna aksen solid dengan animasi ring berkedip (`ring-4 ring-sky-400/40`).
- **Disabled:** Background `#475569`, border `#1E293B`, pointer events `none`. Menolak koneksi jika tipe data incompatible.
- **Loading:** Handle berkedip lembut (*subtle breathing*) saat data sedang dialirkan melewati edge tersebut.
- **Error:** Handle berwarna merah cerah `#EF4444` dengan ring merah jika koneksi edge menghasilkan cyclic dependency atau type mismatch.
- **Empty:** Tampilan default saat belum ada edge yang tertaut ke port tersebut.

#### 3. CanvasControls (Floating Navigation Dock)
- **Default:** Floating container `#1E293B`/90 dengan backdrop-blur 8px, border 1px `#334155`, rounded-xl, shadow-lg. Tombol-tombol berlatar transparan dengan ikon `#94A3B8`.
- **Hover (Button):** Tombol target berubah latar menjadi `#334155`, ikon menjadi putih `#FFFFFF`, tooltip label muncul di atas tombol.
- **Active (Pressed):** Tombol berlatar `#185FA5`, ikon biru cerah `#38BDF8`, skala tombol `scale-95`.
- **Disabled:** Tombol berwarna abu-abu kusam `#475569`, ikon redup, tooltip menampilkan *"Action unavailable in current state"*.
- **Loading:** Tombol fit-view memutar ikon panah halus saat animasi transisi kamera viewport sedang berjalan.
- **Error:** Tidak memiliki error state mandiri; bila engine canvas crash, border dock berubah menjadi `#EF4444`.
- **Empty:** N/A (Dock selalu berisi minimal 4 kontrol: Zoom In, Zoom Out, Fit View, Lock Canvas).

#### 4. MiniMap
- **Default:** Panel sudut kanan bawah ukuran 180px x 120px, latar `#0B0F19`/90, border 1px `#334155`, rounded-xl, shadow-lg. Representasi node berupa kotak kecil beraksen warna masing-masing. Jendela viewport berupa poligon transparan dengan border `#38BDF8`.
- **Hover:** Border panel menjadi `#64748B`, slider transparansi muncul di header MiniMap.
- **Active (Dragging Viewport Box):** Viewport box terisi aksen `#38BDF8`/20 dengan kursor `grabbing`, pergerakan kamera kanvas tersinkronisasi seketika (60 FPS).
- **Disabled:** Panel MiniMap ditutup atau diminimalkan menjadi tombol toggle kecil berukuran 32px x 32px.
- **Loading:** Efek shimmer garis diagonal melintasi MiniMap saat canvas sedang mengkalkulasi ulang ratusan node.
- **Error:** Tampilan watermark subtle *"Viewport desynchronized"* dengan border merah jika koordinat bounding-box di luar kalkulasi.
- **Empty:** Kotak MiniMap kosong tanpa blok node dengan teks redup *"Empty Canvas"*.

#### 5. AccountBadge
- **Default:** Pill container `#1E293B`, border 1px `#334155`, rounded-full, padding horizontal 12px. Menampilkan inisial avatar, email terpotong (*e.g., al***@gmail.com*), tag tier (*Pro/Ultra*), dan dot status hijau.
- **Hover:** Latar `#243147`, border `#64748B`, tooltip menampilkan status masa aktif session dan health score akun.
- **Active / Selected:** Border 1px `#2196F3`, glow halus biru, indikator panah popover dropdown aktif.
- **Disabled:** Latar `#0F172A`, teks `#475569`, dot status abu-abu, badge bertuliskan *"Inactive / Standby"*.
- **Loading:** Dot status berkedip kuning lembut (*pulsing yellow*) bertuliskan *"Validating Session..."*.
- **Error:** Dot status merah pekat `#EF4444`, teks badge *"Expired / Re-auth required"*, tombol aksi cepat *"Login"* muncul.
- **Empty:** Tampilan placeholder *"No Account Bound"* dengan ikon tambah (+).

#### 6. CreditMeter
- **Default:** Dual-layer visual bar. Kontainer berlatar `#0F172A`, progress bar terisi gradien `#185FA5` ke `#2196F3`, teks numerik *"140 / 200 Credits"* dengan font `JetBrains Mono`.
- **Hover:** Tooltip melayang muncul menampilkan rincian: *"50 Daily Free, 90 Subscription, Resets in 4h 12m"*.
- **Active:** Progress bar disorot dengan ring fokus biru saat panel rincian kuota dibuka.
- **Disabled:** Bar berwarna `#334155` solid dengan teks abu-abu gelap *"Credits Unmonitored"*.
- **Loading:** Animasi garis bergaris miring (*striped indeterminate animation*) bergerak melintasi bar saat sinkronisasi API sedang berjalan.
- **Error (Depleted / Low < 5%):** Bar berubah warna menjadi oranye/merah (`#EF4444`), teks peringatan *"Quota Exhausted - Auto-rotating account"*.
- **Empty:** Bar 0% dengan pesan *"No Credits Available"*.

#### 7. MasterPasswordModal
- **Default:** Modal terpusat berlatar `#1E293B`, backdrop gelap `#020617`/80 dengan blur 12px. Form input password aktif berlatar `#0F172A`, border `#334155`, placeholder *"Enter master password to unlock vault..."*.
- **Hover (Input/Buttons):** Border input field menjadi `#64748B`. Tombol submit *"Unlock Vault"* hover menjadi `#1E88E5`.
- **Active (Focused Input):** Input border 2px `#2196F3`, glow bayangan biru (`box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.25)`).
- **Disabled:** Tombol submit nonaktif (`opacity-50`, kursor `not-allowed`) selama karakter password kurang dari minimum 8 karakter.
- **Loading (Argon2id Verification):** Input terkunci (*read-only*), tombol submit menampilkan spinner SVG animasi dan teks *"Deriving Cryptographic Key..."*.
- **Error:** Shake animation pada card modal (CSS `@keyframes shake`), border input menjadi merah pekat `#EF4444`, pesan peringatan tampil: *"Invalid master password. 2 attempts remaining before 5m cooldown."*
- **Empty:** Form input terinisialisasi bersih tanpa karakter, tombol submit berada dalam status disabled.

#### 8. ExportProgressBar
- **Default:** Card mengambang atau dock bottom-bar `#1E293B`, border 1px `#334155`, rounded-xl, shadow-xl. Menampilkan judul video output, bar kemajuan 0-100%, badge durasi, dan tombol pause/cancel.
- **Hover:** Detail teknis FFmpeg muncul (frame rendering speed `fps=24.4`, bitrate `6200 kbps`, ETA `01:45`).
- **Active:** Bar kemajuan berpendar dengan aksen biru gradien (`#2196F3` ke `#38BDF8`), tombol cancel dapat diklik.
- **Disabled:** Seluruh kontrol transcode terkunci saat proses finalisasi muxing container MP4 sedang berlangsung.
- **Loading (Transcoding / Concat in Progress):** Progress bar mengisi secara dinamis, ikon reel film berputar halus pada header status.
- **Error:** Bar berhenti dan berubah warna menjadi merah `#EF4444`, teks error menampilkan log ringkas: *"FFmpeg demux error: Non-monotonous DTS in segment 4"*, disertai tombol *"Retry Export"* dan *"View Crash Log"*.
- **Empty:** Tampilan awal sebelum tombol *"Export Sequence"* ditekan: *"Queue Empty - Configure pipeline nodes to begin export"*.

---

## 7. Story Specification Format (CSF3)

Komponen UI wajib memiliki spesifikasi berkas Storybook menggunakan **Component Story Format 3 (CSF3)**. Setiap berkas story wajib memenuhi ketentuan:
1. Tag `['autodocs']` aktif;
2. Parameter audit aksesibilitas `axe-core` pada mode `error`;
3. Meng-cover seluruh visual states relevan tanpa stubs.

Di bawah ini adalah 4 contoh kode implementasi Story production-grade untuk komponen representatif:

### 7.1 NodeCard.stories.tsx (CSF3)

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { NodeCard } from './NodeCard';

const meta: Meta<typeof NodeCard> = {
  title: 'Canvas/NodeCard',
  component: NodeCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'aria-roles', enabled: true },
        ],
      },
    },
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['prompt', 'image', 'video', 'generate'],
      description: 'Tipe fungsionalitas node yang mengontrol aksen warna & ikonografi',
    },
    state: {
      control: 'select',
      options: ['default', 'hover', 'selected', 'disabled', 'generating', 'error', 'empty'],
      description: 'Kondisi status visual simpul dalam graph canvas',
    },
    title: { control: 'text' },
    subtitle: { control: 'text' },
    errorMessage: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof NodeCard>;

export const DefaultPromptNode: Story = {
  args: {
    id: 'node-prompt-01',
    type: 'prompt',
    state: 'default',
    title: 'Cinematic Style Prompt',
    subtitle: 'Segment 01 Narrative Base',
    content: 'A futuristic cybernetic observatory looking over neon ringed gas planet, 8k render, octane style.',
    inputs: [],
    outputs: [{ id: 'out-text', label: 'Prompt Text', dataType: 'string' }],
  },
};

export const SelectedWithGlow: Story = {
  args: {
    id: 'node-prompt-02',
    type: 'prompt',
    state: 'selected',
    title: 'Active Master Prompt',
    subtitle: 'Currently Focused Node',
    content: 'Hyper-detailed close up shot of retro astronaut helmet reflecting glowing purple nebula.',
    inputs: [],
    outputs: [{ id: 'out-text', label: 'Prompt Text', dataType: 'string' }],
  },
};

export const GeneratingStateWithProgress: Story = {
  args: {
    id: 'node-gen-01',
    type: 'generate',
    state: 'generating',
    title: 'Google Flow Worker #1',
    subtitle: 'Rendering Video Segment...',
    progress: 68,
    statusText: 'Polling clip status: 6.8s / 10.0s elapsed',
    inputs: [
      { id: 'in-prompt', label: 'Context Prompt', dataType: 'string' },
      { id: 'in-ref', label: 'Last Frame PNG', dataType: 'image' },
    ],
    outputs: [{ id: 'out-clip', label: 'Generated Clip', dataType: 'video' }],
  },
};

export const ErrorStateWithDiagnostics: Story = {
  args: {
    id: 'node-gen-02',
    type: 'generate',
    state: 'error',
    title: 'Generation Failed',
    subtitle: 'Worker dispatch error',
    errorMessage: 'Account quota exhausted during execution. Upstream returned 429 Too Many Requests.',
    inputs: [{ id: 'in-prompt', label: 'Prompt', dataType: 'string' }],
    outputs: [{ id: 'out-clip', label: 'Video', dataType: 'video' }],
  },
};

export const EmptyStatePromptNode: Story = {
  args: {
    id: 'node-prompt-03',
    type: 'prompt',
    state: 'empty',
    title: 'New Prompt Node',
    subtitle: 'Awaiting User Input',
    content: '',
    inputs: [],
    outputs: [{ id: 'out-text', label: 'Prompt Text', dataType: 'string' }],
  },
};

export const DisabledNode: Story = {
  args: {
    id: 'node-video-01',
    type: 'video',
    state: 'disabled',
    title: 'Raw Clip Reference',
    subtitle: 'Offline Node',
    content: '/assets/cache/clip_09_archive.mp4',
    inputs: [],
    outputs: [{ id: 'out-stream', label: 'Stream', dataType: 'video' }],
  },
};
```

---

### 7.2 CreditMeter.stories.tsx (CSF3)

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { CreditMeter } from './CreditMeter';

const meta: Meta<typeof CreditMeter> = {
  title: 'Account/CreditMeter',
  component: CreditMeter,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    a11y: {
      config: {
        rules: [{ id: 'color-contrast', enabled: true }],
      },
    },
  },
  argTypes: {
    totalCredits: { control: 'number' },
    usedCredits: { control: 'number' },
    tier: { control: 'select', options: ['Free', 'Plus', 'Pro', 'Ultra'] },
    state: { control: 'select', options: ['default', 'hover', 'low', 'exhausted', 'syncing'] },
  },
};

export default meta;
type Story = StoryObj<typeof CreditMeter>;

export const DefaultHealthy: Story = {
  args: {
    accountId: 'acc-uuid-001',
    accountName: 'Production Pool Alpha',
    totalCredits: 1000,
    usedCredits: 240,
    tier: 'Pro',
    state: 'default',
    resetTimeFormatted: '06h 45m',
  },
};

export const LowCreditWarning: Story = {
  args: {
    accountId: 'acc-uuid-002',
    accountName: 'Free Tier Standby',
    totalCredits: 50,
    usedCredits: 46,
    tier: 'Free',
    state: 'low',
    resetTimeFormatted: '01h 12m',
  },
};

export const QuotaExhausted: Story = {
  args: {
    accountId: 'acc-uuid-003',
    accountName: 'Daily Worker Beta',
    totalCredits: 200,
    usedCredits: 200,
    tier: 'Plus',
    state: 'exhausted',
    resetTimeFormatted: '18h 30m',
  },
};

export const SyncingWithUpstream: Story = {
  args: {
    accountId: 'acc-uuid-004',
    accountName: 'Ultra High-Volume',
    totalCredits: 10000,
    usedCredits: 4120,
    tier: 'Ultra',
    state: 'syncing',
    resetTimeFormatted: 'Calculating...',
  },
};
```

---

### 7.3 MasterPasswordModal.stories.tsx (CSF3)

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { MasterPasswordModal } from './MasterPasswordModal';

const meta: Meta<typeof MasterPasswordModal> = {
  title: 'Security/MasterPasswordModal',
  component: MasterPasswordModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: true },
          { id: 'color-contrast', enabled: true },
        ],
      },
    },
  },
  argTypes: {
    isOpen: { control: 'boolean' },
    isUnlocking: { control: 'boolean' },
    errorMessage: { control: 'text' },
    remainingAttempts: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof MasterPasswordModal>;

export const DefaultPrompt: Story = {
  args: {
    isOpen: true,
    isUnlocking: false,
    errorMessage: undefined,
    remainingAttempts: 5,
    vaultStatus: 'LOCKED',
  },
};

export const KeyDerivationInProgress: Story = {
  args: {
    isOpen: true,
    isUnlocking: true,
    errorMessage: undefined,
    remainingAttempts: 5,
    vaultStatus: 'LOCKED',
  },
};

export const AuthenticationFailed: Story = {
  args: {
    isOpen: true,
    isUnlocking: false,
    errorMessage: 'Kata sandi master salah. Periksa caps-lock Anda.',
    remainingAttempts: 2,
    vaultStatus: 'LOCKED',
  },
};

export const CooldownLocked: Story = {
  args: {
    isOpen: true,
    isUnlocking: false,
    errorMessage: 'Terlalu banyak percobaan gagal. Vault terkunci sementara selama 300 detik.',
    remainingAttempts: 0,
    cooldownSecondsRemaining: 284,
    vaultStatus: 'LOCKED',
  },
};
```

---

### 7.4 ExportProgressBar.stories.tsx (CSF3)

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ExportProgressBar } from './ExportProgressBar';

const meta: Meta<typeof ExportProgressBar> = {
  title: 'Export/ExportProgressBar',
  component: ExportProgressBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    a11y: {
      config: {
        rules: [{ id: 'color-contrast', enabled: true }],
      },
    },
  },
  argTypes: {
    progress: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    status: { control: 'select', options: ['idle', 'concatenating', 'transcoding', 'completed', 'error'] },
  },
};

export default meta;
type Story = StoryObj<typeof ExportProgressBar>;

export const StitchingInProgress: Story = {
  args: {
    status: 'concatenating',
    progress: 42,
    currentStepText: 'Merging video segments via FFmpeg Concat Demuxer (12 / 28 clips)',
    outputFileName: 'cyberpunk_odyssey_final_1080p.mp4',
    etaFormatted: '00:01:24',
    processingSpeed: '32.4 fps',
  },
};

export const TranscodingH264: Story = {
  args: {
    status: 'transcoding',
    progress: 89,
    currentStepText: 'Encoding final stream: libx264 high-profile CRF 18',
    outputFileName: 'cyberpunk_odyssey_final_1080p.mp4',
    etaFormatted: '00:00:15',
    processingSpeed: '48.1 fps',
  },
};

export const ExportSuccess: Story = {
  args: {
    status: 'completed',
    progress: 100,
    currentStepText: 'Export sukses! File video siap diputar.',
    outputFileName: 'cyberpunk_odyssey_final_1080p.mp4',
    outputFilePath: 'C:\\Users\\Owner\\Videos\\FlowStudio\\cyberpunk_odyssey_final_1080p.mp4',
    fileSizeBytes: 489201504,
  },
};

export const DemuxFailure: Story = {
  args: {
    status: 'error',
    progress: 35,
    currentStepText: 'FFmpeg sidecar terminated with non-zero exit code (1).',
    outputFileName: 'cyberpunk_odyssey_final_1080p.mp4',
    errorDetails: 'Invalid data found when processing input segment_05.mp4: moov atom not found.',
  },
};
```

---

## 8. Accessibility Baseline (WCAG 2.2 AA & axe-core)

Flow Studio menempatkan aksesibilitas setara dengan fungsionalitas inti. Sebagai workstation desktop kreatif, pengguna harus dapat bernavigasi dan mengontrol alur kerja secara penuh menggunakan keyboard, kontras warna yang tidak menyebabkan kelelahan mata, serta dukungan assistive technology.

### 8.1 Kontrak Aksesibilitas Formal

1. **Standard Compliance:** Wajib memenuhi **WCAG 2.2 Level AA**.
2. **Kontras Warna Minimum (Color Contrast Ratios):**
   - Teks biasa (*regular text* < 18pt atau < 14pt bold): Rasio kontras minimum **4.5:1** terhadap latar belakang (`#0F172A` atau `#1E293B`).
   - Teks besar (*large text* ≥ 18pt atau ≥ 14pt bold) dan elemen grafis antarmuka interaktif (borders, focus indicators): Rasio kontras minimum **3.0:1**.
   - Verifikasi token: Warna teks `#F1F5F9` di atas surface `#1E293B` menghasilkan rasio **11.4:1** (melebihi standar WCAG AAA). Warna placeholder `#94A3B8` di atas `#1E293B` menghasilkan rasio **4.8:1** (Pass WCAG AA).
3. **CI/CD Axe-Core Verification:**
   - Plugin Storybook `@storybook/addon-a11y` dijalankan pada setiap pipeline test dengan level keparahan: **`error`**.
   - Setiap pelanggaran (*violation*) otomatis membatalkan status build (*blocking merge*).
4. **Motion & Reduced Motion:**
   - Semua efek visual animasi (pulse glow pada node saat generating, scale hover pada handle, transisi modal) wajib dibungkus dalam media query `@media (prefers-reduced-motion: reduce)`.
   - Ketika preferensi pengguna aktif, animasi durasi dipangkas menjadi `0ms` atau ditransformasikan menjadi pergantian opacity instan.
5. **Focus Management & Ring Semantics:**
   - Semua elemen interaktif wajib memiliki outline fokus yang terlihat jelas menggunakan token `ring-2 ring-primary-500 ring-offset-2 ring-offset-slate-900`.
   - Urutan fokus tab (`tabindex`) harus terstruktur secara logis: Header window → Toolbar Canvas → Daftar Node → Inspector Panel → Status Bar.

---

### 8.2 Canvas Keyboard Navigation Shortcuts

Navigasi kanvas node `@xyflow/react` tidak boleh eksklusif bergantung pada mouse/trackpad. Pengguna dapat mengoperasikan kanvas secara penuh via keyboard:

| Pintasan Keyboard | Aksi Fungsional pada Kanvas | Keterangan Aksesibilitas |
|---|---|---|
| `Space + Drag` / `Panah Arah` | Panning viewport kamera ke segala arah | Navigasi spasial kanvas tanpa mouse |
| `Ctrl + +` / `Ctrl + -` | Memperbesar (*Zoom In*) / Memperkecil (*Zoom Out*) | Granularitas zoom per 10% step |
| `Ctrl + 0` | Fit View (Pusatkan seluruh simpul node ke layar) | Auto-framing seluruh node aktif |
| `Tab` / `Shift + Tab` | Berpindah fokus antar simpul node secara berurutan | Urutan navigasi traversal topological graph |
| `Enter` / `Spasi` | Membuka editor konten pada node yang sedang terfokus | Masuk ke mode edit prompt / inspeksi |
| `Escape` | Membatalkan seleksi aktif / Menutup modal dialog | Menghindari keyboard trap |
| `Delete` / `Backspace` | Menghapus simpul node atau kabel edge yang terseleksi | Disertai konfirmasi undoable buffer |
| `Ctrl + A` | Memilih seluruh node di dalam workspace kanvas | Seleksi massal untuk pemindahan posisi |
| `C` | Memulai koneksi edge dari port output yang terfokus | Menghubungkan node secara serial via keyboard |
| `Ctrl + E` | Membuka panel Master Export Video | Pintasan langsung ke alur render |
| `Ctrl + L` | Mengunci atau membuka brankas kredensial (*Vault Lock*) | Keamanan instan saat meninggalkan meja |

---

## 9. Responsive & Desktop Layout Rules

Flow Studio dikembangkan secara spesifik untuk lingkungan desktop Windows x64 dengan antarmuka berbasis Tauri 2.x WebView2.

### 9.1 Batasan Resolusi Window

- **Minimum Supported Window Size:** **1024 x 768 piksel**.
  - Pada resolusi minimum, dock panel inspektor kanan otomatis beralih ke mode laci mengambang (*collapsible floating drawer*), MiniMap disembunyikan secara default (dapat diaktifkan via tombol toggle), dan bar status menampilkan metrik ringkas.
- **Optimal Target Resolution:** **1920 x 1080 piksel (Full HD)** hingga **2560 x 1440 (2K / QHD)**.
  - Tampilan optimal menampilkan layout 3-kolom: Panel Kiri (Account Pool & Node Palette), Tengah (Infinite Node Canvas), dan Kanan (Inspector & Clip Preview), dengan MiniMap persisten di pojok kanan bawah.
- **Maximum / Ultra-Wide Scaling:** **3840 x 2160 (4K)**.
  - Komponen menggunakan penskalaan font berbasis `rem` sehingga elemen UI tetap proporsional dan tajam saat Windows DPI Scaling diatur ke 150% atau 200%.

### 9.2 Struktur Grid Workspace Desktop

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ WINDOW TITLE BAR: Project Title • Unlocked Status • Global Credit Bar • Win Controls   │
├─────────────────┬────────────────────────────────────────────────────┬─────────────────┤
│ LEFT DOCK       │ CENTER WORKSPACE: @xyflow/react INFINITE CANVAS    │ RIGHT INSPECTOR │
│ (Width: 260px)  │                                                    │ (Width: 320px)  │
│                 │  ┌──────────┐         ┌──────────┐                 │                 │
│ • Account Pool  │  │ Prompt   │────────>│ Generate │                 │ • Node Property │
│   Health Status │  └──────────┘         └──────────┘                 │ • Prompt Editor │
│ • Credit Meter  │                             │                      │ • Continuity    │
│ • Node Palette  │                             ▼                      │   Frame Preview │
│   (Drag items)  │                       ┌──────────┐                 │ • Style Lock    │
│                 │                       │ VideoOut │                 │   Descriptor    │
│                 │                       └──────────┘                 │                 │
│                 │                                    ┌─────────────┐ │                 │
│                 │ ┌──────────────┐                   │ MiniMap     │ │                 │
│                 │ │CanvasControls│                   │ [180x120px] │ │                 │
│                 │ └──────────────┘                   └─────────────┘ │                 │
├─────────────────┴────────────────────────────────────────────────────┴─────────────────┤
│ STATUS FOOTER: Active Account: acc_01 • Engine: Idle • FFmpeg: v6.1 • Memory: 142MB    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Five-Dimensional Critique Checklist

Setiap komponen UI atau fitur antarmuka sebelum diserahkan (*pre-merge*) wajib dievaluasi menggunakan daftar periksa lima dimensi berikut:

| # | Dimensi Evaluasi | Kriteria Pemeriksaan Mandiri | Batas Kelulusan (Gate Threshold) |
|---|---|---|---|
| **1** | **Correctness** | Apakah komponen meng-handle seluruh 7 visual states (Default, Hover, Active, Disabled, Loading, Error, Empty)? Apakah propagasi state sesuai dengan spesifikasi PRD/SRS? | **Wajib 100% Pass** tanpa kompromi. |
| **2** | **Brand Consistency** | Apakah styling menggunakan token desain dari `DESIGN.md`? Apakah ada hardcoded hex code (misal `#123456`) di file CSS/TSX? Apakah aksen warna tipe node konsisten? | **Zero hardcoded values**. Seluruh warna mengacu pada token Tailwind/YAML. |
| **3** | **Code Quality** | Apakah kode lolos anti-AI-slop scan? Tanpa narrative comments, tanpa placeholder TODO, tanpa dead code, dan fungsi ≤ 80 baris? | Skor AI-slop ≥ 85, lolos verifikasi linter Biome/ESLint. |
| **4** | **Security** | Apakah input teks prompt disanitasi terhadap XSS? Apakah komponen tidak membocorkan plaintext cookie ke console/DOM? Apakah master password segera di-zeroize? | **Zero plain credentials**. Memenuhi OWASP Top 10 dan DOC-SEC-001. |
| **5** | **Completeness** | Apakah story file CSF3 tersedia dan berjalan di Storybook? Apakah lolos audit axe-core tanpa violation? Apakah layout diuji pada resolusi 1024x768 dan 1920x1080? | Storybook build sukses, zero axe-core errors. |

---

## 11. Artifact-First Principle

Untuk menjaga integritas arsitektur antarmuka antargenerasi dan mencegah komponen setengah matang masuk ke repositori utama, Flow Studio menerapkan **Artifact-First Principle**:

1. **Working Storybook Artifact as Gate Requirement:**
   Implementasi komponen UI **tidak dianggap selesai** hanya karena kode TypeScript-nya terkompilasi. Setiap komponen wajib disertai berkas `.stories.tsx` yang dapat dieksekusi secara visual di Storybook.
2. **Deterministic a11y Automated Proof:**
   Setiap story file wajib lolos uji mesin `axe-core` dengan parameter mode `error`. Kegagalan rasio kontras warna atau atribut ARIA yang hilang merupakan cacat rilis (*blocker bug*).
3. **Traceable Component Inventory:**
   Setiap komponen yang tercantum dalam Section 6 inventori wajib memiliki pemetaan 1-ke-1 terhadap berkas implementasi dan story file di direktori proyek:
   - `src/components/canvas/NodeCard.tsx` ↔ `src/components/canvas/NodeCard.stories.tsx`
   - `src/components/canvas/Handle.tsx` ↔ `src/components/canvas/Handle.stories.tsx`
   - `src/components/canvas/CanvasControls.tsx` ↔ `src/components/canvas/CanvasControls.stories.tsx`
   - `src/components/canvas/MiniMap.tsx` ↔ `src/components/canvas/MiniMap.stories.tsx`
   - `src/components/account/AccountBadge.tsx` ↔ `src/components/account/AccountBadge.stories.tsx`
   - `src/components/account/CreditMeter.tsx` ↔ `src/components/account/CreditMeter.stories.tsx`
   - `src/components/security/MasterPasswordModal.tsx` ↔ `src/components/security/MasterPasswordModal.stories.tsx`
   - `src/components/export/ExportProgressBar.tsx` ↔ `src/components/export/ExportProgressBar.stories.tsx`
4. **No Code Without Visual Grounding:**
   Frontend agent dilarang menulis CSS inline kustom baru tanpa mengikatnya ke dalam Design Token Brand Contract yang didefinisikan pada dokumen ini.
