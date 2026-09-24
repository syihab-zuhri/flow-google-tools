# Design System, Brand Contract & Component Library (DSD)

> **Project:** Flow Studio  
> **Document ID:** DOC-DSD-001  
> **Version:** 1.0.0  
> **Status:** Draft  
> **Owner:** Software Architect & Planning Lead  
> **Last Updated:** 2026-09-24  
> **Depends On:** DOC-DES-001  
> **Supersedes:** None  

---

## 1. Executive Summary & Core Principles

Dokumen **Design System & Component Library (DSD.md)** merupakan spesifikasi hidup (*living specification*) yang mengatur implementasi seluruh komponen antarmuka pengguna (UI) pada **Flow Studio**. Dokumen ini menjembatani spesifikasi estetika dan visual token dari `DESIGN.md` (DOC-DES-001) dengan implementasi kode produksi berbasis **React 19**, **Tailwind CSS**, dan **@xyflow/react v12+** dalam *desktop app shell* **Tauri 2.x**.

Sesuai dengan mandat **PLANNING_v5.2.md Section 11.5**, dokumen ini beroperasi di bawah prinsip fundamental:

1. **Artifact-First Mandate:** Setiap komponen yang terdaftar dalam inventaris wajib diwujudkan sebagai komponen kode yang berfungsi nyata (*working software*), disertai *story file* mandiri dalam format CSF3, dan lulus uji aksesibilitas otomatis. Deskripsi tekstual tanpa bukti artefak kode yang dapat diuji bernilai nol.
2. **Brand Contract Fidelity:** Seluruh warna, tipografi, radius, elevasi, dan spasi wajib merujuk secara ketat pada *CSS custom properties* (Design Tokens) yang bersumber dari `DESIGN.md`. Tidak diperbolehkan adanya nilai *hardcoded* (seperti hex code ad-hoc atau margin sembarang) di dalam kode komponen.
3. **Mandatory 6-State Visual Coverage:** Setiap komponen (baik primitif, komposit, maupun tingkat halaman) wajib mendefinisikan dan mengimplementasikan **enam visual states**: *Default*, *Disabled*, *Loading*, *Error*, *Empty*, dan *Mobile/Compact*.
4. **Zero-Tolerance Accessibility (WCAG 2.2 AA):** Aksesibilitas diuji secara ketat via `@storybook/addon-a11y` dengan mesin `axe-core` yang dikonfigurasi dalam mode `error` (pelanggaran a11y langsung menggagalkan *pipeline build* CI). Rasio kontras teks normal minimal 4.5:1 terhadap latar belakang gelap.
5. **Anti-AI-Slop Code Hygiene:** Contoh kode, komponen, dan berkas *story* bebas dari *stubs*, komentar naratif berlebihan, *swallowed exceptions*, *mock data* yang bocor ke *production build*, maupun *generic types* (`any`).

---

## A. Brand Contract Reference (DESIGN.md Tokens)

Flow Studio mengadopsi estetika **Creative Suite Dark Mode** yang terinspirasi oleh perangkat lunak kreasi profesional modern (Blender, DaVinci Resolve, ComfyUI). Seluruh antarmuka dioptimalkan untuk sesi kerja panjang, meminimalkan kelelahan mata, dan memprioritaskan kontras tinggi pada node canvas serta monitor status kuota.

### A.1 Color Tokens

Palet warna menggunakan turunan netral *slate/zinc* dengan saturasi dingin yang dalam, dipadukan dengan aksen fungsional untuk status eksekusi dan diferensiasi tipe node pipeline.

```css
:root {
  /* Surface & Background (Deep Void Palette) */
  --color-background: #090a0f;          /* Latar belakang utama canvas viewport */
  --color-surface: #12151f;             /* Permukaan node container, modal base, drawer */
  --color-surface-elevated: #1a1e2e;    /* Card background, header node, popover, dropdown */
  --color-surface-hover: #22273b;       /* State interaktif hover pada permukaan elevated */
  --color-surface-active: #2a3048;      /* State pressed/active */
  --color-surface-subtle: #0d0f17;       /* Canvas dot grid, background form input */

  /* Borders & Dividers */
  --color-border: #262c42;              /* Border netral default untuk node & panel */
  --color-border-subtle: #191e2e;       /* Garis pemisah internal, subtle separator */
  --color-border-hover: #3d4666;        /* Border saat mouse hovering */
  --color-border-focus: #6366f1;        /* Focus ring & node selection border */

  /* Primary Brand Accent (Electric Indigo) */
  --color-primary: #6366f1;             /* CTA utama, selected edge, active node highlight */
  --color-primary-hover: #4f46e5;       /* Hover state tombol primer */
  --color-primary-active: #4338ca;      /* Active/pressed tombol primer */
  --color-primary-subtle: rgba(99, 102, 241, 0.15); /* Aksen seleksi & badge tint */
  --color-primary-glow: rgba(99, 102, 241, 0.35);   /* Drop shadow glow untuk node aktif */

  /* Secondary Accent (Cyan Glow) */
  --color-secondary: #06b6d4;           /* Aksen timeline, scrubbing bar, metadata highlight */
  --color-secondary-hover: #0891b2;
  --color-secondary-active: #0e7490;
  --color-secondary-subtle: rgba(6, 182, 212, 0.15);

  /* Node Category Accents (Identitas visual per jenis Node) */
  --color-node-prompt: #f59e0b;         /* Amber 500: Prompt Node header & port */
  --color-node-prompt-border: #d97706;  /* Border Prompt Node */
  --color-node-prompt-subtle: rgba(245, 158, 11, 0.12);

  --color-node-image: #10b981;          /* Emerald 500: Reference Image Node header & port */
  --color-node-image-border: #059669;   /* Border Reference Image Node */
  --color-node-image-subtle: rgba(16, 185, 129, 0.12);

  --color-node-video: #8b5cf6;          /* Violet 500: Video/Clip Node header & port */
  --color-node-video-border: #7c3aed;   /* Border Video Node */
  --color-node-video-subtle: rgba(139, 92, 246, 0.12);

  --color-node-generate: #3b82f6;       /* Blue 500: Generation Orchestrator Node */
  --color-node-generate-border: #2563eb;/* Border Generation Node */
  --color-node-generate-subtle: rgba(59, 130, 246, 0.15);

  /* Semantic Feedback & Status */
  --color-success: #10b981;             /* Akun valid, job selesai, frame terverifikasi */
  --color-success-bg: rgba(16, 185, 129, 0.12);
  --color-warning: #f59e0b;             /* Kuota menipis (<20%), account cooldown */
  --color-warning-bg: rgba(245, 158, 11, 0.12);
  --color-error: #ef4444;               /* Job failed, vault locked, account banned */
  --color-error-bg: rgba(239, 68, 68, 0.12);
  --color-info: #0ea5e9;                /* In-progress polling, system notice */
  --color-info-bg: rgba(14, 165, 233, 0.12);

  /* Typography Colors (Memenuhi Kontras WCAG AA > 4.5:1) */
  --color-text-primary: #f8fafc;        /* Slate 50: Teks utama, judul, field value */
  --color-text-secondary: #94a3b8;      /* Slate 400: Label pembantu, port text, hint */
  --color-text-tertiary: #64748b;       /* Slate 500: Timestamp non-kritis, disabled subtle */
  --color-text-disabled: #475569;       /* Slate 600: Komponen dalam state non-aktif */
  --color-text-inverse: #090a0f;        /* Teks di atas background terang (misal Badge Amber) */
  --color-text-accent: #818cf8;         /* Teks link & highlight teknis */
}
```

### A.2 Typography Tokens

Keluarga font mengandalkan sans-serif netral bersudut tajam untuk hierarki teks antarmuka dan *monospace font* khusus untuk data kuota, durasi waktu video, seed AI, serta telemetry log.

```css
:root {
  /* Font Family Stacks */
  --font-family-heading: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;

  /* Font Scale & Line Heights */
  --font-size-xs: 0.75rem;     /* 12px - Footnote, port labels, tags */
  --line-height-xs: 1rem;      /* 16px */

  --font-size-sm: 0.875rem;    /* 14px - Body text secondary, inputs, buttons sm */
  --line-height-sm: 1.25rem;   /* 20px */

  --font-size-base: 1rem;      /* 16px - Body text default, form labels */
  --line-height-base: 1.5rem;  /* 24px */

  --font-size-lg: 1.125rem;    /* 18px - Card title, node headers */
  --line-height-lg: 1.75rem;   /* 28px */

  --font-size-xl: 1.25rem;     /* 20px - Modal title, drawer headline */
  --line-height-xl: 1.75rem;   /* 28px */

  --font-size-2xl: 1.5rem;     /* 24px - Section headers */
  --line-height-2xl: 2rem;     /* 32px */

  --font-size-3xl: 1.875rem;   /* 30px - Page-level headline */
  --line-height-3xl: 2.25rem;  /* 36px */

  /* Font Weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

### A.3 Spacing & Layout Tokens (Base-4 Grid)

```css
:root {
  --spacing-0_5: 0.125rem; /* 2px */
  --spacing-1: 0.25rem;    /* 4px - Base unit */
  --spacing-1_5: 0.375rem; /* 6px */
  --spacing-2: 0.5rem;     /* 8px */
  --spacing-3: 0.75rem;    /* 12px */
  --spacing-4: 1rem;       /* 16px */
  --spacing-5: 1.25rem;    /* 20px */
  --spacing-6: 1.5rem;     /* 24px */
  --spacing-8: 2rem;       /* 32px */
  --spacing-10: 2.5rem;    /* 40px */
  --spacing-12: 3rem;      /* 48px */
  --spacing-16: 4rem;      /* 64px */
}
```

### A.4 Border Radius Tokens

```css
:root {
  --radius-none: 0px;
  --radius-xs: 0.125rem;  /* 2px - Tag tipis & indicator pill */
  --radius-sm: 0.25rem;   /* 4px - Input controls, port connector handles */
  --radius-md: 0.375rem;  /* 6px - Button, dropdown item */
  --radius-lg: 0.5rem;    /* 8px - Node container, dialog base */
  --radius-xl: 0.75rem;   /* 12px - Floating toolbar, drawer base */
  --radius-2xl: 1rem;     /* 16px - Account cards, modal wrapper */
  --radius-full: 9999px;  /* Avatar, badge pill, status dot */
}
```

### A.5 Elevation & Depth Tokens

```css
:root {
  --shadow-none: none;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.45);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.55), 0 2px 4px -2px rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.65), 0 4px 6px -4px rgba(0, 0, 0, 0.55);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.75), 0 8px 10px -6px rgba(0, 0, 0, 0.65);

  /* Node-specific Canvas Shadows */
  --shadow-node: 0 0 0 1px var(--color-border), 0 8px 20px -4px rgba(0, 0, 0, 0.6);
  --shadow-node-selected: 0 0 0 2px var(--color-primary), 0 12px 28px -4px var(--color-primary-glow);
  --shadow-glow-prompt: 0 0 16px -2px rgba(245, 158, 11, 0.35);
  --shadow-glow-image: 0 0 16px -2px rgba(16, 185, 129, 0.35);
  --shadow-glow-video: 0 0 16px -2px rgba(139, 92, 246, 0.35);
  --shadow-glow-generate: 0 0 20px -2px rgba(59, 130, 246, 0.45);
}
```

### A.6 Motion & Animation Tokens

```css
:root {
  --motion-duration-fast: 150ms;
  --motion-duration-normal: 250ms;
  --motion-duration-slow: 400ms;
  --motion-easing-default: cubic-bezier(0.4, 0, 0.2, 1);
  --motion-easing-in: cubic-bezier(0.4, 0, 1, 1);
  --motion-easing-out: cubic-bezier(0, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-fast: 0ms;
    --motion-duration-normal: 0ms;
    --motion-duration-slow: 0ms;
  }
}
```

---

## B. Detailed Component Inventory

Setiap entri komponen di bawah memuat 8 metadata wajib: **Component ID**, **Category**, **Props/Variants**, **Visual States (6 state wajib)**, **Dependencies**, **Token References**, **a11y Requirements**, dan **Story File Path**.

---

### B.1 Primitive Components

#### 1. CMP-BUTTON

- **Component ID:** `CMP-BUTTON`
- **Category:** Primitive
- **Props/Variants:**
  - `variant`: `'primary'` | `'secondary'` | `'outline'` | `'ghost'` | `'destructive'` (default: `'primary'`)
  - `size`: `'sm'` (32px h) | `'md'` (40px h) | `'lg'` (48px h) | `'icon'` (square) (default: `'md'`)
  - `disabled`: `boolean` (default: `false`)
  - `loading`: `boolean` (default: `false`)
  - `leftIcon` / `rightIcon`: `React.ReactNode`
  - `onClick`: `(e: React.MouseEvent<HTMLButtonElement>) => void`
  - `fullWidth`: `boolean` (default: `false`)
- **Visual States (6 Wajib):**
  - **Default:** Background token sesuai variant, teks high contrast, border 1px sesuai spec, transition 150ms.
  - **Disabled:** Opacity 50%, background muted `--color-surface-hover`, cursor `not-allowed`, no hover/active events.
  - **Loading:** Spinner icon berputar menggantikan `leftIcon`, teks tetap ada atau diganti status loading, `pointer-events: none`, opacity 80%.
  - **Error:** Shake animation (200ms) jika dipicu oleh validasi aksi lokal, border warna `--color-error` (1px solid).
  - **Empty:** Render state tanpa label teks (khusus variant `'icon'`), memiliki fallback padding simetris dan icon terpusat sempurna.
  - **Mobile/Compact:** Mengisi lebar kontainer 100% (`w-full`), tinggi sentuh minimal 44px (`min-h-[44px]`) untuk kepatuhan touch target.
- **Dependencies:** `lucide-react` (Loader2, icons), `clsx`, `tailwind-merge`
- **Design Token References:** `--color-primary`, `--color-primary-hover`, `--color-error`, `--color-surface-hover`, `--font-family-body`, `--radius-md`, `--spacing-2`, `--spacing-4`
- **a11y Requirements:** `role="button"`, atribut `aria-disabled="true"` saat disabled/loading, `aria-busy="true"` saat loading. Indikator fokus keyboard `focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:outline-none`. Icon-only buttons wajib menyertakan `aria-label`.
- **Story File Path:** `src/components/ui/Button.stories.tsx`

---

#### 2. CMP-INPUT

- **Component ID:** `CMP-INPUT`
- **Category:** Primitive
- **Props/Variants:**
  - `type`: `'text'` | `'password'` | `'number'` | `'search'` (default: `'text'`)
  - `size`: `'sm'` | `'md'` | `'lg'` (default: `'md'`)
  - `placeholder`: `string`
  - `value`: `string | number`
  - `defaultValue`: `string | number`
  - `disabled`: `boolean` (default: `false`)
  - `readOnly`: `boolean` (default: `false`)
  - `error`: `string` (pesan validasi error)
  - `helperText`: `string`
  - `leftAddon` / `rightAddon`: `React.ReactNode`
  - `onChange`: `(e: React.ChangeEvent<HTMLInputElement>) => void`
- **Visual States (6 Wajib):**
  - **Default:** Background `--color-surface-subtle`, border 1px `--color-border`, teks `--color-text-primary`, placeholder `--color-text-tertiary`.
  - **Disabled:** Background `--color-surface`, border `--color-border-subtle`, teks `--color-text-disabled`, kursor `not-allowed`.
  - **Loading:** Spinner loader kecil di sisi kanan slot `rightAddon`, input bersifat `readOnly` sementara.
  - **Error:** Border 1px solid `--color-error`, label error muncul di bawah field menggunakan font `--font-size-xs` dengan warna `--color-error`.
  - **Empty:** Menampilkan teks placeholder default tanpa karakter terisi, tanpa indikator pembersihan field.
  - **Mobile/Compact:** Font size minimal 16px (1rem) pada perangkat sentuh untuk mencegah browser auto-zoom di mobile/webview, padding horizontal 12px.
- **Dependencies:** `clsx`, `tailwind-merge`
- **Design Token References:** `--color-surface-subtle`, `--color-border`, `--color-border-focus`, `--color-error`, `--color-text-primary`, `--font-size-sm`, `--radius-md`
- **a11y Requirements:** Menggunakan asosiasi eksplisit `id` dan `<label htmlFor={id}>`. Atribut `aria-invalid={!!error}`, `aria-describedby` merujuk ke elemen helper/error id. Tab stop aktif dan navigasi keyboard terstandar.
- **Story File Path:** `src/components/ui/Input.stories.tsx`

---

#### 3. CMP-SELECT

- **Component ID:** `CMP-SELECT`
- **Category:** Primitive
- **Props/Variants:**
  - `options`: `Array<{ value: string; label: string; icon?: React.ReactNode; disabled?: boolean }>`
  - `value`: `string`
  - `placeholder`: `string`
  - `disabled`: `boolean`
  - `error`: `string`
  - `size`: `'sm'` | `'md'`
  - `onSelect`: `(value: string) => void`
- **Visual States (6 Wajib):**
  - **Default:** Dropdown trigger dengan chevron icon di sisi kanan, surface `--color-surface-subtle`, dropdown list menu elevated `--color-surface-elevated`.
  - **Disabled:** Trigger meredup opacity 50%, pointer events dinonaktifkan, chevron icon warna `--color-text-disabled`.
  - **Loading:** Indikator skeleton atau mini spinner di sisi opsi saat fetching daftar opsi dinamis.
  - **Error:** Border trigger berubah menjadi `--color-error`, deskripsi pesan kesalahan dirender di bawah kontainer select.
  - **Empty:** Saat daftar `options` bernilai kosong (`[]`), dropdown menu menampilkan pesan `"No options available"` dalam warna `--color-text-tertiary`.
  - **Mobile/Compact:** Menu popover beralih menjadi modal drawer sheet bawah (*bottom-sheet*) pada viewport layar kecil dengan target opsi 44px.
- **Dependencies:** `@radix-ui/react-select`, `lucide-react`
- **Design Token References:** `--color-surface-elevated`, `--color-border`, `--color-border-focus`, `--color-text-primary`, `--color-surface-hover`, `--radius-md`
- **a11y Requirements:** Sesuai pola WAI-ARIA Listbox (`role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"`). Dukungan tombol navigasi Panah Atas/Bawah, Enter untuk memilih, Escape untuk menutup popup.
- **Story File Path:** `src/components/ui/Select.stories.tsx`

---

#### 4. CMP-MODAL

- **Component ID:** `CMP-MODAL`
- **Category:** Primitive
- **Props/Variants:**
  - `isOpen`: `boolean`
  - `onClose`: `() => void`
  - `title`: `React.ReactNode`
  - `description`?: `string`
  - `size`: `'sm'` (400px) | `'md'` (560px) | `'lg'` (720px) | `'xl'` (960px) | `'full'`
  - `children`: `React.ReactNode`
  - `footer`?: `React.ReactNode`
  - `closeOnOverlayClick`: `boolean` (default: `true`)
- **Visual States (6 Wajib):**
  - **Default:** Backdrop overlay gelap transparan (`rgba(0, 0, 0, 0.75)`), modal box di tengah layar dengan background `--color-surface`, border 1px `--color-border`, bayangan `--shadow-xl`.
  - **Disabled:** Elemen aksi footer (tombol confirm/cancel) berada dalam status disabled ketika proses blocking terjadi di dalam modal.
  - **Loading:** Konten modal menampilkan translucent overlay dengan spinner besar di tengah, mencegah interaksi form.
  - **Error:** Banner notifikasi error muncul di bagian atas modal header dengan latar belakang `--color-error-bg` dan border `--color-error`.
  - **Empty:** Render kontainer kosong dengan area slot konten netral, siap untuk injeksi template dinamis.
  - **Mobile/Compact:** Mengisi 100% viewport (`h-full w-full max-w-none rounded-none`) pada ukuran layar < 640px.
- **Dependencies:** `@radix-ui/react-dialog`, `lucide-react` (X icon)
- **Design Token References:** `--color-surface`, `--color-border`, `--shadow-xl`, `--color-background`, `--radius-xl`, `--spacing-6`
- **a11y Requirements:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` ke title id, `aria-describedby` ke description id. Focus trap aktif (fokus tidak boleh kabur ke luar modal), tombol Escape menutup modal, pemulihan fokus ke elemen pemanggil saat ditutup.
- **Story File Path:** `src/components/ui/Modal.stories.tsx`

---

#### 5. CMP-TOAST

- **Component ID:** `CMP-TOAST`
- **Category:** Primitive
- **Props/Variants:**
  - `id`: `string`
  - `type`: `'info'` | `'success'` | `'warning'` | `'error'` (default: `'info'`)
  - `title`: `string`
  - `message`?: `string`
  - `duration`?: `number` (default: `4000ms`, `0` = sticky)
  - `action`?: `{ label: string; onClick: () => void }`
  - `onDismiss`: `(id: string) => void`
- **Visual States (6 Wajib):**
  - **Default:** Floating card di pojok kanan bawah viewport, surface `--color-surface-elevated`, border kiri tebal 4px sesuai aksen tipe status, shadow `--shadow-lg`.
  - **Disabled:** Notifikasi tidak dapat diinteraksi bila aksi undo/action telah kedaluwarsa.
  - **Loading:** Type `'info'` menampilkan progress line berdenyut (*indeterminate loading indicator*) di border bawah toast.
  - **Error:** Border aksen warna `--color-error`, icon AlertCircle warna merah, teks error kontras tinggi.
  - **Empty:** Hanya menampilkan title tanpa sub-message/body deskripsi.
  - **Mobile/Compact:** Toast membentang selebar layar bawah (*full-width banner*) dengan margin 8px dari tepi layar mobile.
- **Dependencies:** `@radix-ui/react-toast` atau `sonner`
- **Design Token References:** `--color-surface-elevated`, `--color-border`, `--color-success`, `--color-warning`, `--color-error`, `--color-info`, `--shadow-lg`
- **a11y Requirements:** Menggunakan ARIA Live Region: `role="status"` dan `aria-live="polite"` untuk toast info/success; `role="alert"` dan `aria-live="assertive"` untuk toast error. Tombol dismiss memiliki label `aria-label="Close notification"`.
- **Story File Path:** `src/components/ui/Toast.stories.tsx`

---

#### 6. CMP-BADGE

- **Component ID:** `CMP-BADGE`
- **Category:** Primitive
- **Props/Variants:**
  - `variant`: `'neutral'` | `'primary'` | `'success'` | `'warning'` | `'error'` | `'prompt'` | `'image'` | `'video'`
  - `size`: `'sm'` (18px h) | `'md'` (24px h)
  - `dot`: `boolean` (default: `false`, menampilkan dot status menyala)
  - `children`: `React.ReactNode`
- **Visual States (6 Wajib):**
  - **Default:** Background transparan warna subtil (`--color-*-subtle`), border 1px warna aksen solid, teks tebal ukuran `--font-size-xs`.
  - **Disabled:** Warna pudar monokromatis (`--color-surface-hover`), teks `--color-text-disabled`.
  - **Loading:** Efek pulsa berkedip lembut (*subtle pulsing opacity 60% <-> 100%*) menandakan proses latar belakang.
  - **Error:** Variant `'error'` dengan dot berwarna merah menyala dan border solid `--color-error`.
  - **Empty:** Dot badge murni tanpa teks (lingkaran indikator status 8x8px).
  - **Mobile/Compact:** Padding dikompresi ke 4px horizontal, mempertahankan keterbacaan teks 11px.
- **Dependencies:** `clsx`, `tailwind-merge`
- **Design Token References:** `--color-primary-subtle`, `--color-success-bg`, `--color-warning-bg`, `--color-error-bg`, `--radius-full`, `--font-size-xs`
- **a11y Requirements:** Non-interactive status element. Menyertakan atribut visual teks tersembunyi `sr-only` jika badge hanya menampilkan warna/dot (misal: `<span className="sr-only">Status: Active</span>`).
- **Story File Path:** `src/components/ui/Badge.stories.tsx`

---

#### 7. CMP-SLIDER

- **Component ID:** `CMP-SLIDER`
- **Category:** Primitive
- **Props/Variants:**
  - `min`: `number` (default: `0`)
  - `max`: `number` (default: `100`)
  - `step`: `number` (default: `1`)
  - `value`: `number[]`
  - `defaultValue`: `number[]`
  - `disabled`: `boolean`
  - `onValueChange`: `(value: number[]) => void`
  - `showValueTooltip`: `boolean`
- **Visual States (6 Wajib):**
  - **Default:** Track horizontal warna `--color-surface-hover`, active filled track warna `--color-primary`, thumb bulat 16px dengan border 2px solid `--color-primary`.
  - **Disabled:** Track abu-abu gelap, thumb tidak dapat digeser, opacity 40%, cursor `not-allowed`.
  - **Loading:** Track menampilkan animasi shimmer saat nilai sedang dikalkulasi ulang oleh sistem worker.
  - **Error:** Track filled dan thumb berubah menjadi warna `--color-error` (misal nilai di luar batas toleransi seed).
  - **Empty:** Slider dengan nilai default pada titik nol (`0`).
  - **Mobile/Compact:** Target sentuh thumb diperluas secara tak terlihat menjadi 44x44px (*hit-box expansion*) menggunakan pseudo-elemen `::after`.
- **Dependencies:** `@radix-ui/react-slider`
- **Design Token References:** `--color-surface-hover`, `--color-primary`, `--color-primary-hover`, `--color-border-focus`, `--radius-full`
- **a11y Requirements:** `role="slider"`, atribut `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, dan `aria-valuetext`. Navigasi penuh via tombol keyboard Panah Kiri/Kanan (langkah kecil), Page Up/Down (langkah besar), Home/End (nilai min/max).
- **Story File Path:** `src/components/ui/Slider.stories.tsx`

---

### B.2 Composite Components

#### 8. CMP-PROMPT-NODE

- **Component ID:** `CMP-PROMPT-NODE`
- **Category:** Composite
- **Props/Variants:**
  - `id`: `string`
  - `data`: `{ promptText: string; negativePrompt?: string; styleLockEnabled: boolean; styleLockText?: string; tokenCount: number; inheritedContext?: string }`
  - `selected`: `boolean`
  - `isConnectable`: `boolean`
  - `onChange`: `(id: string, updatedData: Partial<PromptNodeData>) => void`
- **Visual States (6 Wajib):**
  - **Default:** Node box lebar 280px, header dengan strip aksen warna Amber (`--color-node-prompt`), textarea input teks prompt, counter token mono, port output di sisi kanan.
  - **Disabled:** Seluruh field terkunci (read-only), background meredup ke `--color-surface`, port koneksi tidak dapat dihubungkan (`pointer-events: none`).
  - **Loading:** Status indikator auto-save berkedip lembut di sudut header saat sinkronisasi state ke store lokal.
  - **Error:** Border node berwarna `--color-error`, peringatan batas panjang prompt terlampaui (>2000 karakter).
  - **Empty:** Textarea kosong menampilkan placeholder `"Describe the scene, action, lighting, camera angle..."` dengan badge token `0/2000`.
  - **Mobile/Compact:** Mode kartu ringkas (*collapsed mode*) dengan hanya menampilkan 1 baris cuplikan prompt dan port handle.
- **Dependencies:** `@xyflow/react` (Handle, Position), `CMP-INPUT`, `CMP-BADGE`, `lucide-react` (Sparkles, Lock, FileText)
- **Design Token References:** `--color-node-prompt`, `--color-node-prompt-border`, `--color-node-prompt-subtle`, `--color-surface`, `--color-border`, `--shadow-node`, `--shadow-glow-prompt`
- **a11y Requirements:** `role="region"`, `aria-label="Prompt Input Node"`. Textarea diberi label programatis via `aria-label`. Tombol toggle style-lock memiliki `aria-pressed`. Keyboard shortcut untuk fokus langsung ke prompt (`Enter` saat node terseleksi).
- **Story File Path:** `src/features/canvas/components/nodes/PromptNode.stories.tsx`

---

#### 9. CMP-IMAGE-NODE

- **Component ID:** `CMP-IMAGE-NODE`
- **Category:** Composite
- **Props/Variants:**
  - `id`: `string`
  - `data`: `{ filePath?: string; previewUrl?: string; fileName?: string; resolution?: string; fileSize?: string; isContinuityFrame?: boolean }`
  - `selected`: `boolean`
  - `isConnectable`: `boolean`
  - `onUpload`: `(file: File) => void`
  - `onClear`: `() => void`
- **Visual States (6 Wajib):**
  - **Default:** Header aksen Emerald (`--color-node-image`), thumbnail gambar beresolusi tajam aspect-ratio 16:9, label nama berkas, port output di sisi kanan.
  - **Disabled:** Interaksi unggah berkas dinonaktifkan, gambar dirender dengan filter grayscale 50%.
  - **Loading:** Skeleton shimmer placeholder saat berkas gambar sedang dibaca dari disk atau diekstrak oleh FFmpeg.
  - **Error:** Ikon gambar rusak (*broken image*), pesan kesalahan format berkas (misal berkas korup atau format bukan PNG/JPG) dengan border `--color-error`.
  - **Empty:** Dropzone kosong dengan ikon Upload, teks `"Drop reference image here or browse"`, serta tombol pilih berkas.
  - **Mobile/Compact:** Thumbnail mini 64x64px dengan nama file terpotong (*truncated*) di sebelah kanan.
- **Dependencies:** `@xyflow/react`, `CMP-BUTTON`, `lucide-react` (Image, UploadCloud, AlertTriangle, Trash2)
- **Design Token References:** `--color-node-image`, `--color-node-image-border`, `--color-node-image-subtle`, `--color-surface`, `--color-surface-hover`, `--radius-lg`
- **a11y Requirements:** Gambar thumbnail memiliki atribut `alt` deskriptif. Dropzone dapat diaktifkan menggunakan keyboard (`Space` atau `Enter`). Input file tersembunyi dapat diakses via screen reader.
- **Story File Path:** `src/features/canvas/components/nodes/ImageNode.stories.tsx`

---

#### 10. CMP-VIDEO-NODE

- **Component ID:** `CMP-VIDEO-NODE`
- **Category:** Composite
- **Props/Variants:**
  - `id`: `string`
  - `data`: `{ videoPath?: string; durationSec?: number; segmentIndex?: number; status: 'ready' | 'processing' | 'error'; fps?: number }`
  - `selected`: `boolean`
  - `onPlayPreview`: `(videoPath: string) => void`
  - `onExtractFrame`: `(timestampSec: number) => void`
- **Visual States (6 Wajib):**
  - **Default:** Header aksen Violet (`--color-node-video`), poster video dengan tombol play overlay, badge durasi (e.g., `00:08`), port input & output video.
  - **Disabled:** Tombol playback dinonaktifkan, video poster redup.
  - **Loading:** Progress bar melingkar di tengah video poster dengan teks `"FFmpeg extracting metadata..."`.
  - **Error:** Pesan `"Unsupported codec or corrupted MP4"` dengan tombol retry.
  - **Empty:** Kontainer tanpa berkas video terlampir, menampilkan instruksi `"No video generated or linked"`.
  - **Mobile/Compact:** Card horizontal ramping dengan status playback mini dan timestamp durasi.
- **Dependencies:** `@xyflow/react`, `CMP-BUTTON`, `CMP-BADGE`, `lucide-react` (Film, Play, RefreshCw)
- **Design Token References:** `--color-node-video`, `--color-node-video-border`, `--color-node-video-subtle`, `--font-family-mono`, `--color-surface-elevated`
- **a11y Requirements:** Kontrol pemutar video memiliki label keyboard aksesibel (`aria-label="Play video segment preview"`). Durasi waktu disuarakan dengan format jelas (*"Duration 8 seconds"*).
- **Story File Path:** `src/features/canvas/components/nodes/VideoNode.stories.tsx`

---

#### 11. CMP-GENERATE-NODE

- **Component ID:** `CMP-GENERATE-NODE`
- **Category:** Composite
- **Props/Variants:**
  - `id`: `string`
  - `data`: `{ model: 'veo-2' | 'veo-3.1' | 'imagen-3'; aspectRatio: '16:9' | '9:16'; progress: number; status: 'idle' | 'queued' | 'generating' | 'downloading' | 'completed' | 'failed'; assignedAccount?: string; errorDetails?: string }`
  - `selected`: `boolean`
  - `onExecute`: `(nodeId: string) => void`
  - `onCancel`: `(nodeId: string) => void`
- **Visual States (6 Wajib):**
  - **Default:** Header aksen Blue (`--color-node-generate`), form pemilih model dan aspek rasio, port input multipel (Prompt, Reference Image, Context) di sisi kiri, tombol CTA "Generate Segment".
  - **Disabled:** Tombol eksekusi terkunci karena koneksi input wajib (Prompt) belum terhubung ke port input.
  - **Loading:** Animasi denyut biru glowing (`--shadow-glow-generate`), bilah progres horizontal interaktif (`0% - 100%`), label status `"Generating via Account: creator-01 (45%)"`, tombol ganti menjadi "Cancel".
  - **Error:** Border berkedip merah, kartu detail pesan kesalahan (e.g. `"Quota Exhausted (429) - Account Auto-Rotating..."`), tombol "Retry Segment".
  - **Empty:** Node dalam status bersih sebelum konfigurasi dipilih (default ke Veo-2 dan 16:9).
  - **Mobile/Compact:** Tampilan minimalis hanya menampilkan progress meter dan tombol cancel/retry.
- **Dependencies:** `@xyflow/react`, `CMP-BUTTON`, `CMP-SELECT`, `CMP-BADGE`, `lucide-react` (Cpu, Play, StopCircle, RefreshCw)
- **Design Token References:** `--color-node-generate`, `--color-node-generate-border`, `--color-node-generate-subtle`, `--shadow-glow-generate`, `--color-primary`
- **a11y Requirements:** Status eksekusi dikomunikasikan secara dinamis ke screen reader melalui `aria-live="polite"`. Progres generasi menggunakan atribut standar `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`.
- **Story File Path:** `src/features/canvas/components/nodes/GenerateNode.stories.tsx`

---

#### 12. CMP-EDGE-CONNECTOR

- **Component ID:** `CMP-EDGE-CONNECTOR`
- **Category:** Composite
- **Props/Variants:**
  - `id`: `string`
  - `source`: `string`
  - `target`: `string`
  - `sourceType`: `'prompt'` | `'image'` | `'video'`
  - `targetType`: `'prompt'` | `'image'` | `'video'`
  - `status`: `'idle'` | `'active'` | `'invalid'`
  - `selected`: `boolean`
- **Visual States (6 Wajib):**
  - **Default:** Garis bezier halus berwarna abu-abu kebiruan (`--color-border-hover`), ketebalan 2px, marker tanda panah di ujung target.
  - **Disabled:** Garis putus-putus (*dashed line*) redup abu-abu saat jalur non-aktif.
  - **Loading (Active Flow):** Garis bercahaya (*glow effect*) dengan animasi aliran dash bergerak (*stroke-dasharray animation*) berkecepatan 1s linear infinite yang merepresentasikan transfer data aktif.
  - **Error (Invalid Snap-back):** Warna garis merah menyala (`--color-error`), bergetar sesaat sebelum snap-back dan hilang saat tipe port tidak kompatibel.
  - **Empty:** Kondisi draft koneksi saat pengguna sedang menarik garis kursor mouse dari port sumber sebelum menempel ke port tujuan.
  - **Mobile/Compact:** Garis dipertebal menjadi 3px untuk memudahkan deteksi visual dan seleksi pada layar sentuh.
- **Dependencies:** `@xyflow/react` (BaseEdge, getBezierPath)
- **Design Token References:** `--color-border-hover`, `--color-primary`, `--color-error`, `--color-node-prompt`, `--color-node-image`, `--color-node-video`
- **a11y Requirements:** Edge dapat dipilih menggunakan keyboard (fokus via tombol Tab antar node edge), dapat dihapus dengan menekan tombol `Delete` atau `Backspace`. Notifikasi screen reader mengumumkan rute koneksi: *"Connected from Prompt Node to Generate Node"*.
- **Story File Path:** `src/features/canvas/components/edges/EdgeConnector.stories.tsx`

---

#### 13. CMP-ACCOUNT-CARD

- **Component ID:** `CMP-ACCOUNT-CARD`
- **Category:** Composite
- **Props/Variants:**
  - `account`: `{ id: string; email: string; label: string; avatarUrl?: string; status: 'active' | 'exhausted' | 'cooldown' | 'banned' | 'expired'; creditsRemaining: number; totalCredits: number; cooldownUntil?: string; lastUsedAt?: string }`
  - `onRefresh`: `(id: string) => void`
  - `onDelete`: `(id: string) => void`
  - `onTest`: `(id: string) => void`
- **Visual States (6 Wajib):**
  - **Default:** Card surface elevated, avatar di kiri, alamat email bertopeng (*masked*), badge status warna hijau/kuning/merah, sisa kredit `135/150`, tombol aksi cepat.
  - **Disabled:** Kartu berbayang buram (opacity 40%) saat akun dinonaktifkan secara manual oleh pengguna dari pool rotasi.
  - **Loading:** Tombol refresh menampilkan ikon spinner berputar saat proses health check token/cookie sedang berlangsung.
  - **Error:** Status badge `'banned'` atau `'expired'`, kartu diberi aksen border merah solid dengan tombol aksi "Re-authenticate" / "Update Cookie".
  - **Empty:** State saat akun baru saja diimpor dan nilai kredit belum diverifikasi (`Kredit: -- / --`).
  - **Mobile/Compact:** Tampilan vertikal ramping di mana tombol aksi dipindah ke dalam dropdown menu kebab (3 titik) di pojok kanan atas.
- **Dependencies:** `CMP-BADGE`, `CMP-BUTTON`, `CMP-CREDIT-BAR`, `lucide-react` (User, RefreshCw, Trash2, ShieldCheck, MoreVertical)
- **Design Token References:** `--color-surface-elevated`, `--color-border`, `--color-success`, `--color-warning`, `--color-error`, `--font-family-mono`
- **a11y Requirements:** `role="article"`, `aria-label="Account card for {email}"`. Seluruh tombol aksi memiliki label keyboard deskriptif. Indikator status memiliki alternatif teks deskriptif untuk pembaca layar.
- **Story File Path:** `src/features/account-pool/components/AccountCard.stories.tsx`

---

#### 14. CMP-CREDIT-BAR

- **Component ID:** `CMP-CREDIT-BAR`
- **Category:** Composite
- **Props/Variants:**
  - `totalCredits`: `number` (default: `150`)
  - `usedCredits`: `number`
  - `thresholdWarning`?: `number` (default: `30` sisa)
  - `thresholdCritical`?: `number` (default: `10` sisa)
  - `showLabel`: `boolean` (default: `true`)
  - `compact`: `boolean` (default: `false`)
- **Visual States (6 Wajib):**
  - **Default:** Baris persentase kuota penuh dengan progress bar warna Cyan/Emerald (`--color-secondary`), teks mono `120 / 150 Credits (80%)`.
  - **Disabled:** Progress bar berwarna abu-abu netral saat sistem vault terkunci dan data pool tidak dapat dibaca.
  - **Loading:** Shimmer animasi horizontal pada progress track saat kuota sedang di-refresh via API endpoint.
  - **Error / Critical:** Saat sisa kredit < 10, bar berubah warna menjadi merah terang (`--color-error`), disertai peringatan denyut (*pulsing warning icon*).
  - **Empty (Exhausted):** Sisa kredit `0`, progress bar kosong (0%), badge teks berwarna merah pekat `"0 / 150 (Exhausted)"`.
  - **Mobile/Compact:** Hanya menampilkan baris tipis 4px tanpa teks label angka di sampingnya (nilai muncul saat di-hover/focus via tooltip).
- **Dependencies:** `lucide-react` (Zap, AlertTriangle), `CMP-BADGE`
- **Design Token References:** `--color-surface-hover`, `--color-secondary`, `--color-warning`, `--color-error`, `--font-family-mono`, `--radius-full`
- **a11y Requirements:** `role="progressbar"`, `aria-valuenow={usedCredits}`, `aria-valuemin="0"`, `aria-valuemax={totalCredits}`, `aria-valuetext="{remaining} credits remaining of {totalCredits}"`.
- **Story File Path:** `src/features/account-pool/components/CreditBar.stories.tsx`

---

#### 15. CMP-STORYBOARD-STRIP

- **Component ID:** `CMP-STORYBOARD-STRIP`
- **Category:** Composite
- **Props/Variants:**
  - `segments`: `Array<{ id: string; index: number; thumbnailSrc?: string; durationSec: number; status: 'pending' | 'ready' | 'failed'; promptSnippet: string }>`
  - `activeSegmentIndex`: `number`
  - `onSelectSegment`: `(index: number) => void`
  - `onReorder`: `(fromIndex: number, toIndex: number) => void`
- **Visual States (6 Wajib):**
  - **Default:** Strip horizontal di sisi bawah layar, kartu thumbnail segmen berurutan (Segmen 1, Segmen 2, Segmen 3), nomor segmen, durasi, dan ikon continuity link di antara segmen.
  - **Disabled:** Strip terkunci saat eksekusi pipeline aktif berlangsung untuk mencegah re-order urutan segmen di tengah jalan.
  - **Loading:** Indikator spinner melingkar pada kartu thumbnail segmen yang sedang dalam proses render video.
  - **Error:** Kartu segmen memiliki border merah dan badge tanda seru saat proses pembuatan segmen tersebut gagal.
  - **Empty:** State awal saat canvas belum memiliki node video/generasi: menampilkan slot placeholder kosong `"Drag generated segments or add nodes to build storyboard"`.
  - **Mobile/Compact:** Ukuran thumbnail diperkecil menjadi 80x45px dengan scroll horizontal berbasis sentuhan (*touch swipeable carousel*).
- **Dependencies:** `CMP-BADGE`, `lucide-react` (Link2, AlertCircle, GripVertical, Play)
- **Design Token References:** `--color-surface-elevated`, `--color-border`, `--color-primary`, `--color-secondary`, `--radius-md`, `--shadow-md`
- **a11y Requirements:** `role="region"`, `aria-label="Storyboard timeline sequence"`. Kartu segmen dapat difokuskan via keyboard; mendukung tombol Panah Kiri/Kanan untuk berpindah segmen. Operasi re-order dapat dilakukan melalui keyboard shortcut (`Alt + Panah Kiri/Kanan`).
- **Story File Path:** `src/features/storyboard/components/StoryboardStrip.stories.tsx`

---

### B.3 Page-Level Components

#### 16. CMP-CANVAS-WORKSPACE

- **Component ID:** `CMP-CANVAS-WORKSPACE`
- **Category:** Page-level
- **Props/Variants:**
  - `nodes`: `Node[]`
  - `edges`: `Edge[]`
  - `onNodesChange`: `(changes: NodeChange[]) => void`
  - `onEdgesChange`: `(changes: EdgeChange[]) => void`
  - `onConnect`: `(connection: Connection) => void`
  - `isVaultUnlocked`: `boolean`
  - `isExecuting`: `boolean`
- **Visual States (6 Wajib):**
  - **Default:** Layar kanvas penuh dengan latar belakang dot-grid halus, toolbar mengambang di atas, minimap di sudut kanan bawah, node-node terhubung aktif.
  - **Disabled (Vault Locked):** Kanvas buram (*blurred background with CSS backdrop-filter*), interaksi drag & edit terkunci sebelum master password dimasukkan.
  - **Loading:** Layar splash inisialisasi kanvas dengan loader teks `"Restoring graph state from project session..."`.
  - **Error:** Kanvas menampilkan modal dialog pemulihan crash (*crash recovery dialog*) saat berkas `.flowproj` terdeteksi memiliki struktur JSON tidak valid.
  - **Empty:** Kanvas kosong bersih dengan tombol panduan awal di tengah: *"Welcome to Flow Studio. Click + to add your first Prompt Node"*.
  - **Mobile/Compact:** Panel toolbar dan minimap diciutkan menjadi floating action button (FAB) tunggal untuk memaksimalkan ruang kerja pada resolusi kecil.
- **Dependencies:** `@xyflow/react`, `CMP-PROMPT-NODE`, `CMP-IMAGE-NODE`, `CMP-VIDEO-NODE`, `CMP-GENERATE-NODE`, `CMP-EDGE-CONNECTOR`, `lucide-react`
- **Design Token References:** `--color-background`, `--color-surface-subtle`, `--color-border`, `--color-primary`, `--shadow-lg`
- **a11y Requirements:** Seluruh kanvas dapat diakses tanpa mouse: `Tab` untuk berpindah antar node, `Panah` untuk menggeser posisi node terpilih, `Delete` untuk menghapus node, `Ctrl + Plus/Minus` untuk zoom in/out, `Ctrl + 0` untuk reset tampilan (*fit view*). Screen reader mengumumkan jumlah node aktif saat ini.
- **Story File Path:** `src/features/canvas/components/CanvasWorkspace.stories.tsx`

---

#### 17. CMP-ACCOUNT-DRAWER

- **Component ID:** `CMP-ACCOUNT-DRAWER`
- **Category:** Page-level
- **Props/Variants:**
  - `isOpen`: `boolean`
  - `onClose`: `() => void`
  - `accounts`: `Account[]`
  - `poolSummary`: `{ totalActive: number; totalCredits: number; exhaustedCount: number }`
  - `onImportCookie`: `(cookieJson: string) => Promise<void>`
  - `onTriggerRotation`: `() => void`
- **Visual States (6 Wajib):**
  - **Default:** Panel slide-over dari sisi kanan layar (lebar 420px), header ringkasan total kuota pool, daftar scrollable `CMP-ACCOUNT-CARD`, tombol CTA "Import Account Session".
  - **Disabled:** Seluruh tombol aksi dinonaktifkan saat sinkronisasi pool batch sedang berlangsung.
  - **Loading:** Shimmer skeleton cards memenuhi daftar akun saat pembacaan dari basis data SQLite lokal.
  - **Error:** Notifikasi peringatan di bagian atas drawer saat seluruh akun dalam pool berada dalam status exhausted atau cooldown.
  - **Empty:** Tampilan kosong dengan ilustrasi dompet kredensial dan pesan *"No Google accounts found in pool. Import cookies to start generating"*.
  - **Mobile/Compact:** Drawer membentang 100% selebar layar (*full-screen view*) pada viewport ponsel/tablet.
- **Dependencies:** `CMP-ACCOUNT-CARD`, `CMP-BUTTON`, `CMP-INPUT`, `lucide-react` (Users, Plus, AlertCircle, X)
- **Design Token References:** `--color-surface`, `--color-surface-elevated`, `--color-border`, `--shadow-xl`, `--font-family-heading`
- **a11y Requirements:** `role="dialog"`, `aria-label="Account Pool Management Drawer"`. Fokus keyboard otomatis berpindah ke tombol close pertama saat drawer terbuka, dan focus trap mencegah kursor navigasi tembus ke kanvas di belakang drawer.
- **Story File Path:** `src/features/account-pool/components/AccountDrawer.stories.tsx`

---

#### 18. CMP-EXPORT-MODAL

- **Component ID:** `CMP-EXPORT-MODAL`
- **Category:** Page-level
- **Props/Variants:**
  - `isOpen`: `boolean`
  - `onClose`: `() => void`
  - `totalDurationSec`: `number`
  - `segmentCount`: `number`
  - `onStartExport`: `(config: ExportConfig) => Promise<void>`
  - `exportProgress`: `{ stage: 'idle' | 'demuxing' | 'stitching' | 'encoding' | 'completed'; percent: number; etaSec: number }`
- **Visual States (6 Wajib):**
  - **Default:** Modal dialog di tengah layar dengan opsi pilihan resolusi (1080p, 4K), format video (MP4, WebM), estimasi ukuran berkas, path folder output, dan tombol "Start Export".
  - **Disabled:** Tombol "Start Export" dinonaktifkan jika belum ada segmen video yang berhasil di-generate.
  - **Loading (In-Progress Rendering):** Tampilan beralih ke panel status FFmpeg: progress bar horizontal beranimasi, persentase rendering, estimasi waktu tersisa (ETA), dan tombol "Cancel Export".
  - **Error:** Tampilan log kesalahan FFmpeg (misal: ruang disk penyimpanan lokal tidak cukup) dengan tombol "Copy Error Log" dan "Retry".
  - **Empty (Complete):** Layar sukses dengan animasi centang hijau, thumbnail preview hasil akhir video, tombol "Play Video" dan "Open in File Explorer".
  - **Mobile/Compact:** Formulir disederhanakan menjadi tata letak satu kolom vertikal yang pas di layar perangkat kecil.
- **Dependencies:** `CMP-MODAL`, `CMP-BUTTON`, `CMP-SELECT`, `CMP-INPUT`, `lucide-react` (Download, CheckCircle, AlertTriangle, Folder)
- **Design Token References:** `--color-surface`, `--color-surface-elevated`, `--color-primary`, `--color-success`, `--font-family-mono`
- **a11y Requirements:** `role="dialog"`, `aria-labelledby="export-modal-title"`. Perubahan tahapan rendering disuarakan via ARIA Live Region (`aria-live="polite"`). Tombol "Open in Explorer" mendapatkan auto-fokus saat ekspor selesai.
- **Story File Path:** `src/features/export/components/ExportModal.stories.tsx`

---

#### 19. CMP-VAULT-UNLOCK-SCREEN

- **Component ID:** `CMP-VAULT-UNLOCK-SCREEN`
- **Category:** Page-level
- **Props/Variants:**
  - `onUnlock`: `(masterPassword: string) => Promise<boolean>`
  - `isInitialSetup`: `boolean`
  - `lockoutRemainingSec`: `number` (jika terkena rate-limiting brute force)
  - `failedAttempts`: `number`
- **Visual States (6 Wajib):**
  - **Default:** Tampilan layar penuh elegan di tengah layar, logo Flow Studio bercahaya, input master password terenkripsi, tombol CTA "Unlock Vault", indikator status keamanan lokal (Argon2id + AES-256-GCM).
  - **Disabled:** Input dan tombol terkunci saat batas toleransi percobaan password terlampaui (lockout aktif).
  - **Loading (Deriving Key):** Spinner halus dengan teks informatif *"Deriving Argon2id encryption key... please wait"*, input password dalam status `readOnly`.
  - **Error:** Shake animation pada box kartu, pesan kesalahan merah *"Incorrect master password. 2 attempts remaining before 5-minute lockout"*, field password otomatis dikosongkan dan difokuskan kembali.
  - **Empty (Initial Setup):** Layar konfigurasi pertama kali: instruksi pembuatan password baru, input master password + input konfirmasi password, serta peringatan kehilangan password permanen.
  - **Mobile/Compact:** Card form merentang secara responsif dengan padding 16px, menjaga ukuran font input tetap 16px untuk menghindari zoom otomatis pada webview perangkat sentuh.
- **Dependencies:** `CMP-BUTTON`, `CMP-INPUT`, `lucide-react` (Lock, ShieldAlert, KeyRound, Check)
- **Design Token References:** `--color-background`, `--color-surface`, `--color-border`, `--color-primary`, `--color-error`, `--shadow-xl`
- **a11y Requirements:** `role="main"`, form memiliki label eksplisit untuk input password. Pesan kegagalan password disuarakan via `role="alert"` (`aria-live="assertive"`). Fokus otomatis ditempatkan pada field password saat layar dimuat.
- **Story File Path:** `src/features/vault/components/VaultUnlockScreen.stories.tsx`

---

## C. Story Specification (CSF3 Format)

Sesuai aturan **Component Story Format 3 (CSF3)** dan prinsip disiplin Storybook, di bawah ini adalah spesifikasi kode produksi lengkap untuk tiga komponen inti: **PromptNode**, **CreditBar**, dan **VaultUnlockScreen**. Setiap berkas mendefinisikan *args contract*, integrasi pengujian aksesibilitas `a11y: { test: 'error' }`, serta ekspor *named story* untuk seluruh *visual state*.

---

### C.1 PromptNode.stories.tsx

```tsx
/**
 * @file PromptNode.stories.tsx
 * @description CSF3 Storybook specification for PromptNode component (CMP-PROMPT-NODE).
 * Production-grade story file covering all 6 mandatory visual states + custom variants.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { PromptNode, type PromptNodeProps } from './PromptNode';

const meta: Meta<typeof PromptNode> = {
  title: 'Features/Canvas/Nodes/PromptNode',
  component: PromptNode,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'label', enabled: true },
        ],
      },
      // MANDATORY: Violation triggers CI build failure
      test: 'error',
    },
  },
  argTypes: {
    id: { control: 'text', description: 'Unique node identifier' },
    selected: { control: 'boolean', description: 'Node selection state on canvas' },
    isConnectable: { control: 'boolean', description: 'Handle connectivity permission' },
    data: { control: 'object', description: 'Payload data containing prompt text and metadata' },
    onChange: { action: 'onChange', description: 'Callback fired when prompt text or settings change' },
  },
  args: {
    id: 'node-prompt-01',
    selected: false,
    isConnectable: true,
    onChange: fn(),
    data: {
      promptText: 'A cinematic drone shot through misty pine forests at sunrise, 35mm lens, golden hour lighting',
      negativePrompt: 'blurry, oversaturated, lowres, text, watermark',
      styleLockEnabled: true,
      styleLockText: 'Cinematic, 35mm film grain, hyperrealistic photorealism',
      tokenCount: 42,
    },
  },
};

export default meta;
type Story = StoryObj<typeof PromptNode>;

/**
 * Default visual state: Normal node with prompt text, active style lock, and output port.
 */
export const Default: Story = {};

/**
 * Disabled visual state: Read-only mode, inactive input, disabled handles.
 */
export const Disabled: Story = {
  args: {
    isConnectable: false,
    data: {
      ...meta.args?.data,
      promptText: 'A cinematic drone shot through misty pine forests at sunrise (LOCKED FOR EXECUTION)',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Rendered when node editing is locked during active pipeline generation.',
      },
    },
  },
};

/**
 * Loading visual state: Auto-saving local sync indicator active.
 */
export const Loading: Story = {
  args: {
    data: {
      ...meta.args?.data,
      isSaving: true,
    } as PromptNodeProps['data'],
  },
};

/**
 * Error visual state: Token limit exceeded (>2000 chars) with error border and banner.
 */
export const Error: Story = {
  args: {
    data: {
      ...meta.args?.data,
      promptText: 'A '.repeat(1050) + 'overflowing text segment that strictly violates model limits',
      tokenCount: 2150,
      errorMessage: 'Prompt exceeds maximum context length of 2000 tokens',
    } as PromptNodeProps['data'],
  },
};

/**
 * Empty visual state: Clean node showing placeholder and zero token badge.
 */
export const Empty: Story = {
  args: {
    data: {
      promptText: '',
      negativePrompt: '',
      styleLockEnabled: false,
      tokenCount: 0,
    },
  },
};

/**
 * Mobile / Compact visual state: Collapsed view for dense graph representation.
 */
export const MobileCompact: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  args: {
    compact: true,
  } as Partial<PromptNodeProps>,
};

/**
 * Context Inherited visual state: Shows Continuity Engine inherited segment prefix badge.
 */
export const WithInheritedContext: Story = {
  args: {
    data: {
      ...meta.args?.data,
      inheritedContext: 'Continuing from Segment 2: Forest path opens into a crystal clear alpine lake',
    } as PromptNodeProps['data'],
  },
};
```

---

### C.2 CreditBar.stories.tsx

```tsx
/**
 * @file CreditBar.stories.tsx
 * @description CSF3 Storybook specification for CreditBar component (CMP-CREDIT-BAR).
 * Covers healthy, warning, critical, exhausted, loading, and mobile presentations.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { CreditBar } from './CreditBar';

const meta: Meta<typeof CreditBar> = {
  title: 'Features/AccountPool/Components/CreditBar',
  component: CreditBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'aria-progressbar-name', enabled: true },
        ],
      },
      test: 'error',
    },
  },
  argTypes: {
    totalCredits: { control: 'number', description: 'Total capacity pool limit' },
    usedCredits: { control: 'number', description: 'Currently allocated or available credits' },
    thresholdWarning: { control: 'number', description: 'Warning threshold mark' },
    thresholdCritical: { control: 'number', description: 'Critical threshold mark' },
    showLabel: { control: 'boolean', description: 'Toggle text label visibility' },
    compact: { control: 'boolean', description: 'Compact presentation without text' },
  },
  args: {
    totalCredits: 150,
    usedCredits: 125,
    thresholdWarning: 30,
    thresholdCritical: 10,
    showLabel: true,
    compact: false,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px', padding: '16px', backgroundColor: '#12151f', borderRadius: '8px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CreditBar>;

/**
 * Default visual state: Healthy pool balance (>80% remaining).
 */
export const Default: Story = {};

/**
 * Warning Threshold visual state: Remaining credits < 30 units (Amber indicator).
 */
export const WarningThreshold: Story = {
  args: {
    usedCredits: 28,
  },
};

/**
 * Critical Threshold visual state: Remaining credits < 10 units (Red warning & pulse).
 */
export const CriticalThreshold: Story = {
  args: {
    usedCredits: 8,
  },
};

/**
 * Empty / Exhausted visual state: 0 credits remaining, auto-rotation triggered.
 */
export const Empty: Story = {
  args: {
    usedCredits: 0,
  },
};

/**
 * Loading visual state: Synchronizing credit balance against Google Flow API.
 */
export const Loading: Story = {
  args: {
    isLoading: true,
  } as Record<string, unknown>,
};

/**
 * Disabled visual state: Credential vault is locked, hiding credit telemetry.
 */
export const Disabled: Story = {
  args: {
    disabled: true,
  } as Record<string, unknown>,
};

/**
 * Mobile / Compact visual state: Thin 4px track intended for tight account drawer rows.
 */
export const MobileCompact: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  args: {
    compact: true,
    showLabel: false,
  },
};
```

---

### C.3 VaultUnlockScreen.stories.tsx

```tsx
/**
 * @file VaultUnlockScreen.stories.tsx
 * @description CSF3 Storybook specification for VaultUnlockScreen component (CMP-VAULT-UNLOCK-SCREEN).
 * Covers security states: clean unlock, derivation progress, error mismatch, lockout, and setup.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { VaultUnlockScreen } from './VaultUnlockScreen';

const meta: Meta<typeof VaultUnlockScreen> = {
  title: 'Features/Vault/Components/VaultUnlockScreen',
  component: VaultUnlockScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'label', enabled: true },
        ],
      },
      test: 'error',
    },
  },
  argTypes: {
    isInitialSetup: { control: 'boolean', description: 'Prompt for initial master key configuration' },
    failedAttempts: { control: 'number', description: 'Counter of consecutive invalid attempts' },
    lockoutRemainingSec: { control: 'number', description: 'Remaining security cooldown in seconds' },
    onUnlock: { action: 'onUnlock', description: 'Async master key unlock dispatch handler' },
  },
  args: {
    isInitialSetup: false,
    failedAttempts: 0,
    lockoutRemainingSec: 0,
    onUnlock: fn().mockResolvedValue(true),
  },
};

export default meta;
type Story = StoryObj<typeof VaultUnlockScreen>;

/**
 * Default visual state: App cold start with locked database awaiting master password.
 */
export const Default: Story = {};

/**
 * Loading visual state: Executing Argon2id key derivation and AES-GCM database validation.
 */
export const Loading: Story = {
  args: {
    isDerivingKey: true,
  } as Record<string, unknown>,
};

/**
 * Error visual state: Incorrect password entered, showing warning banner & attempt countdown.
 */
export const Error: Story = {
  args: {
    failedAttempts: 2,
    errorMessage: 'Authentication failed: Master password mismatch (2 attempts remaining)',
  } as Record<string, unknown>,
};

/**
 * Disabled visual state: Security lockout active due to repeated brute-force attempts.
 */
export const Disabled: Story = {
  args: {
    failedAttempts: 5,
    lockoutRemainingSec: 284,
  },
};

/**
 * Empty / Initial Setup visual state: First application run, guiding user to create master vault key.
 */
export const Empty: Story = {
  args: {
    isInitialSetup: true,
    failedAttempts: 0,
    lockoutRemainingSec: 0,
  },
};

/**
 * Mobile / Compact visual state: Responsive viewport scaling for small screens or popout window.
 */
export const MobileCompact: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  args: {
    isInitialSetup: false,
  },
};
```

---

## D. Accessibility Testing Mandate

Aksesibilitas pada Flow Studio bukan sekadar pelengkap, melainkan bagian dari **Definition of Done (DoD)** yang diverifikasi secara otomatis pada level komponen dan halaman.

### D.1 Standar Acuan

| Item | Standar Spesifikasi | Keterangan Implementasi |
|---|---|---|
| **Target Kepatuhan** | **WCAG 2.2 Level AA** | Berlaku untuk seluruh komponen UI desktop WebView2 |
| **Testing Tool** | `@storybook/addon-a11y` + `axe-core` | Evaluasi terintegrasi di workshop komponen Storybook |
| **Test Mode** | **`error`** | Pelanggaran a11y memutus *build process* (CI failure) |
| **Kontras Teks Normal** | **≥ 4.5:1** | Teks body, label input, port description |
| **Kontras Teks Besar / UI** | **≥ 3.0:1** | Judul modal (≥18px bold), border seleksi, handle konektor |
| **Focus Indicator** | Visible 2px outline | Wajib terlihat jelas pada semua elemen interaktif via Tab |
| **Motion Respect** | `prefers-reduced-motion` | Nonaktifkan animasi canvas flow jika OS mengaktifkan opsi ini |

### D.2 Konfigurasi Storybook Preview (`.storybook/preview.ts`)

```typescript
/**
 * @file .storybook/preview.ts
 * @description Enforces strict WCAG 2.2 AA validation across all Storybook stories.
 */

import type { Preview } from '@storybook/react';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'flow-dark',
      values: [
        { name: 'flow-dark', value: '#090a0f' },
        { name: 'flow-surface', value: '#12151f' },
      ],
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'label', enabled: true },
          { id: 'button-name', enabled: true },
          { id: 'aria-roles', enabled: true },
          { id: 'aria-valid-attr', enabled: true },
          { id: 'aria-required-children', enabled: true },
        ],
      },
      options: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag22aa'],
        },
      },
      // MODE ERROR: Wajib fail CI, bukan sekadar warning atau todo.
      manual: false,
    },
  },
};

export default preview;
```

### D.3 Matriks Navigasi Keyboard & Manajemen Fokus

| Komponen | Tombol Keyboard | Aksi / Perilaku Sistem |
|---|---|---|
| **Canvas Workspace** | `Tab` / `Shift+Tab` | Berpindah fokus urut antar-node di kanvas |
| **Selected Node** | `Panah (↑ ↓ ← →)` | Menggeser posisi fisik node pada grid (langkah 8px) |
| **Selected Node** | `Delete` / `Backspace` | Menghapus node beserta edge yang terhubung (dengan dialog konfirmasi) |
| **Canvas Global** | `Ctrl + Plus` / `Ctrl + Minus` | Zoom in dan zoom out kanvas secara proporsional |
| **Canvas Global** | `Ctrl + 0` | Reset viewport dan fit-view semua node |
| **Modal / Dialog** | `Escape` | Menutup dialog dan mengembalikan fokus ke tombol pemanggil |
| **Modal / Dialog** | `Tab` (Focus Trap) | Membatasi perpindahan fokus hanya di dalam batas modal box |
| **Drawer Panel** | `Escape` | Menutup drawer dan memulihkan fokus kanvas |
| **Slider Control** | `Panah Kiri / Kanan` | Mengurangi atau menambah nilai slider sebesar 1 unit step |
| **Slider Control** | `Home / End` | Memindahkan slider langsung ke nilai minimum / maksimum |

---

## E. Five-Dimensional Critique Checklist (Applied to Flow Studio)

Setiap komponen yang diajukan ke dalam repositori wajib melewati audit tinjauan kode (*code review gate*) berdasarkan lima dimensi evaluasi berikut:

```
                  ┌─────────────────────────────────────┐
                  │ 5-DIMENSIONAL CRITIQUE CHECKLIST     │
                  └──────────────────┬──────────────────┘
                                     │
         ┌──────────────┬────────────┼────────────┬──────────────┐
         ▼              ▼            ▼            ▼              ▼
  1. Correctness   2. Brand     3. Code      4. Security    5. Complete
  (Behavior, 6     (Design      (Zero-Slop,  (No Leak,      (Stories,
   Visual States)   Tokens)      Clean TS)    Sanitize)      a11y Pass)
```

| # | Dimensi | Pertanyaan Evaluasi Spesifik Flow Studio | Kriteria Kegagalan (*Fail Condition*) | Status Gate |
|---|---|---|---|:---:|
| **1** | **Correctness** | Apakah komponen merefleksikan seluruh state mesin pipeline (`idle`, `queued`, `generating`, `downloading`, `failed`)? Apakah seluruh 6 visual states berfungsi tanpa *runtime error*? | Terdapat *edge state* yang tidak tertangani, state loading macet tanpa fallback timeout, atau port koneksi putus secara visual. | ❌ Wajib Revisi |
| **2** | **Brand Consistency** | Apakah styling menggunakan token CSS dari Section A (`--color-surface`, `--color-node-prompt`, dll.)? Apakah rasio kontras warna gelap memenuhi standar dark mode studio? | Menggunakan warna *hardcoded* (seperti `bg-[#131313]`), border radius di luar token, atau spasi acak. | ❌ Wajib Revisi |
| **3** | **Code Quality** | Apakah kode bersih dari AI-slop pattern? Apakah tipe TypeScript didefinisikan secara ketat tanpa `any`? Apakah tidak ada komentar naratif basi (*"this function renders a button"*), console debug, atau *dead imports*? | Skor AI-slop < 75, terdapat fungsi duplikat, kompleksitas siklomatis > 15, atau file > 500 baris. | ❌ Wajib Revisi |
| **4** | **Security** | Apakah masukan teks prompt di-sanitize dari XSS? Apakah session token dan master password tidak pernah bocor ke DOM, atribut HTML, atau story args publik? Apakah pemanggilan IPC Tauri tervalidasi skemanya? | Password atau session cookie terlihat di atribut elemen DOM atau tertulis mentah dalam file story. | ❌ Wajib Tolak |
| **5** | **Completeness** | Apakah berkas `.stories.tsx` (CSF3) lengkap dengan 6 visual states? Apakah seluruh pengujian `@storybook/addon-a11y` lolos dalam mode `error`? Apakah prop types terdokumentasi otomatis via JSDoc? | Berkas story hilang, pengujian axe-core gagal, atau atribut ARIA penting tidak dideklarasikan. | ❌ Wajib Revisi |

> **Aturan Kelulusan Review:** Komponen dinyatakan **SIAP PRODUKSI (PRODUCTION-READY)** hanya jika memperoleh status **LULUS (✅)** pada seluruh 5 dimensi. Adanya satu tanda **GAGAL (❌)** mewajibkan perbaikan seketika sebelum penggabungan kode (*merge*).

---

## F. Artifact-First Mandate

Sesuai mandat inti **PLANNING_v5.2.md Section 11.5**, Flow Studio memberlakukan aturan keras:

### F.1 Filosofi "No Code, No Spec"

Spesifikasi antarmuka yang tertulis di dalam dokumen ini bukanlah angan-angan konseptual, melainkan **kontrak implementasi langsung**. Setiap entri dalam inventaris komponen mewakili berkas komponen nyata di dalam struktur direktori proyek:

```
src/
├── components/
│   └── ui/
│       ├── Button.tsx
│       ├── Button.stories.tsx
│       ├── Input.tsx
│       ├── Input.stories.tsx
│       ├── Select.tsx
│       ├── Select.stories.tsx
│       ├── Modal.tsx
│       ├── Modal.stories.tsx
│       ├── Toast.tsx
│       ├── Toast.stories.tsx
│       ├── Badge.tsx
│       ├── Badge.stories.tsx
│       ├── Slider.tsx
│       └── Slider.stories.tsx
└── features/
    ├── canvas/
    │   └── components/
    │       ├── CanvasWorkspace.tsx
    │       ├── CanvasWorkspace.stories.tsx
    │       ├── nodes/
    │       │   ├── PromptNode.tsx
    │       │   ├── PromptNode.stories.tsx
    │       │   ├── ImageNode.tsx
    │       │   ├── ImageNode.stories.tsx
    │       │   ├── VideoNode.tsx
    │       │   ├── VideoNode.stories.tsx
    │       │   ├── GenerateNode.tsx
    │       │   └── GenerateNode.stories.tsx
    │       └── edges/
    │           ├── EdgeConnector.tsx
    │           └── EdgeConnector.stories.tsx
    ├── account-pool/
    │   └── components/
    │       ├── AccountCard.tsx
    │       ├── AccountCard.stories.tsx
    │       ├── CreditBar.tsx
    │       ├── CreditBar.stories.tsx
    │       ├── AccountDrawer.tsx
    │       └── AccountDrawer.stories.tsx
    ├── storyboard/
    │   └── components/
    │       ├── StoryboardStrip.tsx
    │       └── StoryboardStrip.stories.tsx
    ├── export/
    │   └── components/
    │       ├── ExportModal.tsx
    │       └── ExportModal.stories.tsx
    └── vault/
        └── components/
            ├── VaultUnlockScreen.tsx
            └── VaultUnlockScreen.stories.tsx
```

### F.2 Component Definition of Done (DoD)

Sebuah komponen dianggap selesai dan diizinkan diintegrasikan ke dalam halaman aplikasi jika dan hanya jika memenuhi seluruh kriteria berikut:

1. **Implementasi Lengkap:** Komponen dirender murni menggunakan React 19 dan Tailwind CSS dengan mengonsumsi CSS custom properties dari `DESIGN.md`.
2. **Six Visual States:** Seluruh 6 state (*Default*, *Disabled*, *Loading*, *Error*, *Empty*, *Mobile/Compact*) terdefinisi dan dapat diuji secara terisolasi.
3. **CSF3 Storybook Deliverable:** Berkas `ComponentName.stories.tsx` disertakan bersama kode komponen, dengan named exports yang merepresentasikan tiap visual state.
4. **Automated a11y Passed:** Pengujian `test-storybook` menjalankan `axe-core` pada setiap story dan menghasilkan nol pelanggaran (`0 violations`) dalam mode `error`.
5. **Zero-Stub & Production-Ready:** Tidak ada fungsi kosong tanpa implementasi (`() => {}`), tidak ada komentar `// TODO`, dan tidak ada data tiruan yang di-hardcode ke dalam kode komponen produksi.

---

*Dokumen ini merupakan spesifikasi resmi living design system Flow Studio per PLANNING_v5.2.md §11.5. Setiap revisi pada token atau inventaris komponen wajib diperbarui secara tersinkronisasi dengan kode implementasi.*
