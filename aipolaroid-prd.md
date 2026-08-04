# PRD: AI Disposable Camera

**Author:** Nicho
**Status:** Draft
**Type:** Personal project / side experiment

---

## 1. Overview

AI Disposable Camera adalah web/app sederhana yang memungkinkan user membuka kamera langsung dari browser/app, capture foto, lalu foto tersebut diproses AI untuk terlihat seperti hasil kamera disposable era awal 2000-an — flash langsung yang keras, grain 35mm kasar, debu dan goresan, color cast hijau-kuning — dengan animasi "develop" bertahap selama AI memproses.

Ini adalah proyek personal (bukan untuk klien atau venture lain), dibuat karena keinginan iseng untuk eksplorasi dan showcase kemampuan AI generation + camera capture dalam satu produk kecil yang fun.

## 2. Goals

- User bisa capture foto langsung dari kamera device (browser/app), tanpa perlu upload manual.
- Hasil foto diproses AI untuk terlihat seperti cetakan kamera disposable (flash keras, grain kasar, vignette, imperfeksi film).
- Ada animasi generate/reveal — foto muncul bertahap seperti film yang sedang dicuci, bukan langsung jadi.
- Pengalaman terasa "magical". Catatan: AI image generation butuh ~10–40 detik, jadi **real-time bukan target yang realistis**. Yang dikejar bukan "cepat", tapi "menunggunya menyenangkan" — waktu tunggu dijadikan bagian dari pengalaman (animasi develop + countdown jujur), bukan disembunyikan di balik spinner.

## 3. Non-Goals (Out of Scope untuk v1)

- Tidak untuk multi-user/skala besar dulu — fokus dipakai sendiri.
- Tidak ada fitur social sharing/publish ke feed di dalam app (share manual via save/export dulu).
- Tidak buat versi cetak fisik (integrasi printer) di v1.
- Tidak ada penyimpanan foto permanen — gallery hilang saat refresh (lihat §5.5).
- Tidak ada judul foto maupun timestamp di bingkai (lihat §5.4).
- Tidak ada multi-style filter — satu look disposable untuk v1.

## 4. Target User

- Nicho sendiri (personal use) — app di-deploy live (accessible via URL) supaya bisa diakses dari browser HP, bukan cuma dijalankan di local.
- **Wajib akun (P0, lihat §5.8).** `/camera` — kamera, gallery, folder — hanya bisa diakses setelah sign in. Ini keputusan sadar: dibalik dari rencana awal "tidak ada akun", karena persistence & sinkron lintas device (roadmap) tidak masuk akal tanpa identitas user.

## 5. Core Features

### 5.1 Kamera & Capture
- Akses kamera device langsung dari browser (getUserMedia) atau native app camera.
- Tombol shutter untuk capture foto (dengan opsi front/back camera kalau di mobile).
- Preview foto sebelum diproses (retake option).

### 5.1a Viewfinder HUD
- Viewfinder menampilkan garis framing guide (rule of thirds) 1px tanpa fill sesuai
  spec design system, corner bracket, dan satu indikator REC yang berkedip.
- **Tidak ada readout angka.** Shutter speed, aperture, ISO, exposure compensation,
  WB, dan histogram sempat ditampilkan lalu dihapus: `getUserMedia` tidak mengekspos
  satu pun dari data itu, jadi semuanya angka karangan yang nilainya tidak pernah
  berubah. Instrumen palsu yang beku lebih mengganggu daripada tidak ada instrumen.
- Titik REC dipertahankan karena tidak mengklaim mengukur apa pun — dia cuma
  menandakan kamera sedang hidup, dan itu memang benar.

### 5.1b Self-timer
- Chip di header untuk cycle durasi self-timer: `OFF` → `3s` → `10s`.
- Countdown besar tampil di tengah viewfinder; tap shutter saat countdown berjalan akan membatalkannya.
- Sesuai spec Action Chip di design system ("toggling flash, timer, or lens").

### 5.2 AI Generation — Disposable Camera Effect
- Foto hasil capture dikirim ke model image-to-image lewat OpenRouter Image API **hanya untuk film emulation**: flash frontal keras, grain 35mm kasar, debu & goresan, cast hijau-kuning, crushed blacks, vignette, softness lensa plastik.
- **Tidak ada bingkai sama sekali.** Hasil capture ditampilkan sebagai foto dengan sudut membulat (komponen `PhotoCard`), bukan cetakan instant film. Kamera disposable menghasilkan cetakan foto biasa — tidak ada kertas putih untuk ditulisi.
- Prompt secara eksplisit melarang model menambah border, teks, watermark, maupun date stamp.
- Foto capture dikirim sebagai `input_references` (base64 data URL) bersama prompt disposable.
- Model default: `x-ai/grok-imagine-image-quality` (Grok Imagine, `text+image->image`).
- **Biaya nyata: ~$0,06 per foto** (terukur dari tagihan, bukan dari field pricing API
  yang menampilkan $0,01). Ini angka penting: untuk dipakai sendiri masih ringan, tapi
  begitu app dibuka ke orang lain, kuota harus jadi bagian dari desain produk sejak
  awal — bukan ditambahkan belakangan. Album acara 600 foto = $36.
- Nama model disimpan di environment variable (`OPENROUTER_IMAGE_MODEL`), supaya bisa ditukar/dibandingkan tanpa ubah kode.
- Opsional: AI generate variasi kecil tiap kali (biar hasil tidak selalu identik/predictable, mirip randomness film asli).

### 5.3 Animasi "Reveal"
- Animasi develop **dimulai saat capture, berjalan bersamaan dengan request AI** — bukan setelah hasil diterima. Waktu tunggu jadi bagian dari pengalaman, bukan dead time.
- Progres animasi ditahan di ~85% kalau request AI belum selesai, lalu diselesaikan begitu hasil datang. Jadi animasi tidak pernah "selesai duluan" lalu menggantung.
- Layar processing memakai tema gelap (`--color-darkroom`) sebagai metafora darkroom.
- Menampilkan estimasi waktu yang jujur (countdown), bukan spinner tanpa informasi.
- Ada tombol Cancel untuk membatalkan request yang sedang berjalan.
- Animasi dibuat pakai CSS (kemungkinan dibantu beberapa library animasi front-end untuk transisi yang lebih halus).

### 5.4 Output & Export
- Setelah proses selesai, user bisa save/download hasil fotonya (resolusi cukup untuk share ke social media).
- **File yang di-download adalah foto itu sendiri** — tanpa bingkai, tanpa teks, tanpa tanggal. Tidak ada compositing di canvas, jadi output model tersimpan apa adanya tanpa re-encode.
- Di perangkat touch-only (iOS), penyimpanan memakai Web Share API supaya user bisa "Save Image" ke Photos; di desktop memakai download biasa.
- Prompt AI juga secara eksplisit melarang model membakar date stamp / angka ke dalam foto — kamera disposable era 2000-an biasanya mencetak tanggal oranye di pojok, dan itu tidak diinginkan di sini.

### 5.5 Gallery (session-only)
- Dua tab: **All Photos** dan **Folders**.
- **All Photos** — semua foto sesi ini, dikelompokkan per hari (`Today`, `Yesterday`,
  lalu tanggalnya) sehingga terbaca sebagai riwayat, bukan tumpukan datar.
- **Folders** — daftar folder buatan user (mis. "Japan 2026", "Nico Wedding")
  dengan cover foto terbaru dan jumlah isinya. Tap untuk membuka isinya.
  Foto yang belum difolder muncul di bagian "unsorted" di bawah daftar.
- Folder dibuat dari sheet "Add to folder" di layar hasil — tidak ada layar
  manajemen folder terpisah, supaya alurnya tetap satu arah.
- Satu foto berada di paling banyak satu folder (`folderId`, `null` = unsorted).
- Tab gallery menampilkan foto-foto yang dibuat **selama sesi berjalan saja**, disimpan in-memory (React state).
- **Foto tidak di-persist sama sekali** — refresh atau tutup tab = gallery kosong. Konsisten dengan §7 Storage: tidak ada server storage, dan foto tidak pernah masuk localStorage/IndexedDB.
- Tampilan memakai rotasi ringan ±2 derajat (semangat Film Stack dari design system), tapi tanpa bingkai kertas.
- User perlu diberi tahu secara halus bahwa foto tidak tersimpan permanen — save/download adalah satu-satunya cara menyimpan.

### 5.6 Tema: gelap saja
- **Tidak ada light mode.** App memakai satu palet gelap — di landing maupun di
  seluruh layar aplikasi — dan tidak mengikuti preferensi OS.
- Alasannya: efek ASCII di landing hanya terbaca di latar hitam, dan layar
  processing memang harus gelap sejak awal (metafora darkroom). Menyediakan
  varian terang berarti mengirim versi yang lebih buruk dari yang dipilih.
- Toggle tema, hook `useTheme`, script anti-kedip, dan palet terang sudah dilepas.
  Riwayat git menyimpannya kalau suatu saat dibutuhkan lagi.
- Nilai warnanya tetap memakai hue netral dari design system, dengan tangga tonal
  yang dibalik.

### 5.7 Account
- Ikon user di kanan atas setiap layar di dalam `/camera` membuka sheet Account.
- Isinya sekarang: email user (diambil live dari Supabase, bukan dari session cache),
  jumlah foto & folder di sesi ini, kartu Upgrade to Pro, lalu menu — Change password
  (nyambung ke §5.8), Billing & invoices, Privacy & data, Sign out (nyambung).
- Sub-layar **Plans**: dua tier (Free / Pro) beserta daftar fiturnya.
- **Billing & Privacy masih placeholder** — belum ada payment provider, belum ada
  storage foto. Angka harga di Plans adalah sketsa, bukan penawaran — tapi kuotanya
  dihitung dari biaya nyata $0,06/foto: Free 10/bulan (biaya $0,60), Pro $9/bulan
  untuk 100 develop (biaya $6, margin ~33% saat dipakai penuh).
- **Tier "unlimited" tidak bisa ditawarkan.** Satu user berat akan menghabiskan nilai
  langganannya sendiri dalam hitungan hari. Di produk ini kuota adalah produknya,
  bukan sekadar pembatas.
- Item yang belum jalan tetap menjelaskan dirinya saat ditekan, bukan diam saja.

### 5.8 Auth (P0)
- **Metode: email + password.** Bukan magic link — dipilih supaya "reset password"
  jadi alur yang nyata, bukan konsep yang tidak berlaku.
- Provider: **Supabase Auth**, project `ai-disposable-camera` (`zsiagbnyxmjhkkfancsb`,
  region `ap-southeast-1`). Dibuat via Supabase MCP.
- Halaman: `/login`, `/signup`, `/signup/check-email`, `/forgot-password`,
  `/forgot-password/check-email`, `/update-password`. Semua satu palet gelap,
  konsisten dengan §5.6.
- `/camera` dan `/update-password` diproteksi oleh `src/proxy.ts` (lihat catatan
  penamaan di §7) — belum login akan di-redirect ke `/login?next=<path asal>`.
  Sebaliknya, `/login` `/signup` `/forgot-password` me-redirect balik ke `/camera`
  kalau user ternyata sudah punya session aktif.
- Reset password: `/forgot-password` (minta email) → email berisi link →
  `/auth/confirm` menukar `token_hash` jadi session → `/update-password`
  (set password baru). Change password dari sheet Account memakai layar yang sama,
  bedanya user sudah datang dengan session aktif.
- **Bergantung pada dua setting di Supabase Dashboard yang tidak bisa diatur lewat
  MCP** (di luar kemampuan tool yang tersedia saat ini):
  1. Authentication → URL Configuration: Site URL + Redirect URLs allow-list harus
     memuat domain app (`http://localhost:3000` untuk dev).
  2. Authentication → Email Templates: template "Confirm signup" dan "Reset
     Password" harus diubah supaya link mengarah ke `/auth/confirm` di app sendiri
     (format PKCE, `{{ .TokenHash }}`) — bukan endpoint verify bawaan Supabase.
     Tanpa ini, link di email tidak akan pernah sampai ke `/auth/confirm`.

## 6. User Flow

1. User buka app → diminta izin akses kamera.
2. User lihat live preview kamera → tekan tombol capture.
3. Foto diambil → preview sebentar → user konfirmasi (pakai foto ini / retake).
4. Foto dikirim ke proses AI generation di background **dan animasi reveal langsung mulai bersamaan**.
5. Layar processing (tema gelap) menampilkan foto yang develop bertahap + countdown. User bisa Cancel.
6. Hasil AI datang → animasi diselesaikan → hasil akhir foto ditampilkan penuh.
7. User bisa save/download atau capture ulang.
8. Foto masuk ke gallery sesi (hilang kalau di-refresh).

## 7. Technical Considerations

- **Camera capture:** browser API (getUserMedia) untuk web, atau native camera API kalau dibuat sebagai app.
- **AI processing:** model image-to-image lewat OpenRouter Image API (`input_references` + prompt) untuk transformasi foto capture jadi gaya disposable.
- **Animasi reveal:** dibuat pakai CSS (kemungkinan dibantu beberapa library animasi), **dijalankan bersamaan dengan request AI** dan ditahan di ~85% sampai hasil datang. Ini menggantikan pendekatan "jalankan setelah hasil diterima" yang sempat ditulis di draft awal.
- **Frame:** tidak ada bingkai. Foto ditampilkan full-bleed dengan sudut membulat.
- **Latency:** AI generation butuh ~10–40 detik. Loading state harus tetap immersive — animasi develop + countdown jujur, dengan opsi Cancel.
- **Camera constraint:** `getUserMedia` hanya memberi video stream. Metadata kamera (shutter/aperture/ISO) tidak tersedia — lihat §5.1a, HUD sepenuhnya dekoratif.
- **HTTPS:** `getUserMedia` hanya jalan di secure context. Di local pakai `localhost`; di production Vercel sudah HTTPS by default.
- **Platform:** web app biasa (bukan PWA/native), dibuka lewat browser di HP.
- **Storage:** tidak ada penyimpanan foto di server — foto diproses lalu langsung didownload/ditampilkan ke user, tidak ada database/object storage. Gallery in-memory saja (§5.5).
- **API key:** `OPENROUTER_API_KEY` hanya dipakai di server (API Route), tidak pernah dikirim ke client.

## 8. Tech Stack

- **Full-stack framework:** Next.js (frontend UI + camera capture, dan API Routes buat handle request ke AI).
- **AI Gateway:** OpenRouter Image API (`POST /api/v1/images/generations`), dipanggil dari API Route Next.js. Foto capture dikirim sebagai `input_references`, hasil dikembalikan ke frontend.
- **Model:** `x-ai/grok-imagine-image-quality` (default, via env `OPENROUTER_IMAGE_MODEL`). Alternatif: `google/gemini-3.1-flash-lite-image`, `google/gemini-3.1-flash-image`, `google/gemini-3-pro-image`, `openai/gpt-5.4-image-2`. Daftar lengkap model image-output: `https://openrouter.ai/api/v1/models?output_modalities=image` — perlu filter `output_modalities`, karena `/api/v1/models` polos tidak menampilkan model image-only.
- **Styling:** Tailwind CSS, dengan token dari `designsystem.md` di-map ke theme config.
- **Fonts:** Inter (UI) + Courier Prime (timestamp/metadata), via `next/font/google`.
- **Hosting:** Vercel (deploy satu Next.js app, frontend + API routes jalan bareng — gak ada backend service terpisah).
- **Storage/Database:** tidak ada — no persistence, foto diproses on-the-fly dan langsung didownload di client.

## 9. Success Metrics (untuk personal project)

- Tool berhasil dipakai end-to-end tanpa bug besar (capture → generate → reveal → save).
- Hasil fotonya terlihat estetik dan konsisten kualitasnya.
- Waktu proses (capture sampai hasil jadi) terasa cepat/nyaman, bukan lama menunggu.

## 10. Future Considerations

- Multi-style frame/filter selection.
- Fitur share langsung ke social media dari dalam app.
- Kemungkinan dikembangkan jadi produk publik/kecil kalau responnya bagus.
- Integrasi cetak fisik (printer foto mini) kalau mau dijadikan produk nyata.