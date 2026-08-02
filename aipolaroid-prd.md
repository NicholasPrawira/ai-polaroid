# PRD: AI Polaroid

**Author:** Nicho
**Status:** Draft
**Type:** Personal project / side experiment

---

## 1. Overview

AI Polaroid adalah web/app sederhana yang memungkinkan user membuka kamera langsung dari browser/app, capture foto, lalu foto tersebut diproses AI untuk di-generate/animasikan menjadi foto bergaya polaroid — lengkap dengan tampilan bingkai khas, tekstur film, dan transisi/animasi "muncul perlahan" seperti polaroid asli yang baru dikocok.

Ini adalah proyek personal (bukan untuk klien atau venture lain), dibuat karena keinginan iseng untuk eksplorasi dan showcase kemampuan AI generation + camera capture dalam satu produk kecil yang fun.

## 2. Goals

- User bisa capture foto langsung dari kamera device (browser/app), tanpa perlu upload manual.
- Hasil foto diproses AI untuk terlihat seperti polaroid asli (warna, grain, vignette, bingkai putih khas).
- Ada animasi generate/reveal — foto muncul bertahap seperti polaroid yang baru keluar dari kamera, bukan langsung jadi.
- Pengalaman terasa "magical". Catatan: AI image generation butuh ~10–40 detik, jadi **real-time bukan target yang realistis**. Yang dikejar bukan "cepat", tapi "menunggunya menyenangkan" — waktu tunggu dijadikan bagian dari pengalaman (animasi develop + countdown jujur), bukan disembunyikan di balik spinner.

## 3. Non-Goals (Out of Scope untuk v1)

- Tidak untuk multi-user/skala besar dulu — fokus dipakai sendiri.
- Tidak ada sistem akun/login kompleks di awal.
- Tidak ada fitur social sharing/publish ke feed di dalam app (share manual via save/export dulu).
- Tidak buat versi cetak fisik (integrasi printer) di v1.
- Tidak ada penyimpanan foto permanen — gallery hilang saat refresh (lihat §5.5).
- Tidak ada judul foto maupun timestamp di bingkai (lihat §5.4).
- Tidak ada multi-style frame — satu style polaroid klasik untuk v1.

## 4. Target User

- Nicho sendiri (personal use) — app di-deploy live (accessible via URL) supaya bisa diakses dari browser HP, bukan cuma dijalankan di local.
- Tidak ada login/akun — akses langsung via link.

## 5. Core Features

### 5.1 Kamera & Capture
- Akses kamera device langsung dari browser (getUserMedia) atau native app camera.
- Tombol shutter untuk capture foto (dengan opsi front/back camera kalau di mobile).
- Preview foto sebelum diproses (retake option).

### 5.1a Viewfinder HUD (dekoratif)
- Viewfinder menampilkan overlay ala DSLR: shutter speed, aperture, ISO, exposure compensation, WB, drive mode, histogram, dan indikator REC.
- **Ini murni dekorasi, bukan data nyata.** `getUserMedia` di browser tidak mengekspos shutter speed / aperture / ISO dari kamera HP, jadi angka-angka ini di-hardcode sebagai *fake instrumentation*.
- Tujuannya estetis: memperkuat brand statement design system ("operating a high-end mechanical camera"). Angka yang statis adalah perilaku yang benar, bukan bug.
- Garis framing guide (rule of thirds) tetap 1px charcoal tanpa fill, sesuai spec design system.

### 5.1b Self-timer
- Chip di header untuk cycle durasi self-timer: `OFF` → `3s` → `10s`.
- Countdown besar tampil di tengah viewfinder; tap shutter saat countdown berjalan akan membatalkannya.
- Sesuai spec Action Chip di design system ("toggling flash, timer, or lens").

### 5.2 AI Generation — Polaroid Effect
- Foto hasil capture dikirim ke model image-to-image lewat OpenRouter Image API **hanya untuk film emulation**: tekstur & warna khas film polaroid (grain, light leak, warm tone, sedikit vignette, lifted blacks).
- **Bingkai putih polaroid TIDAK digenerate AI — digambar oleh app sendiri** (komponen `PolaroidFrame` di layar, dan canvas composite saat export).
  - Alasan: kalau bingkai digambar AI, proporsi dan ketebalannya bergeser tiap generate, sehingga tiap cetakan terlihat beda-beda. Bingkai yang digambar app menjamin geometri identik di semua foto — di layar maupun di file export (sesuai §7 "satu style untuk v1").
  - Prompt secara eksplisit melarang model menambah border, teks, atau watermark.
- Foto capture dikirim sebagai `input_references` (base64 data URL) bersama prompt polaroid.
- Model default: `x-ai/grok-imagine-image-quality` (Grok Imagine, `text+image->image`).
- Nama model disimpan di environment variable (`OPENROUTER_IMAGE_MODEL`), supaya bisa ditukar/dibandingkan tanpa ubah kode.
- Opsional: AI generate variasi kecil tiap kali (biar hasil tidak selalu identik/predictable, mirip randomness film asli).

### 5.3 Animasi "Reveal"
- Animasi develop **dimulai saat capture, berjalan bersamaan dengan request AI** — bukan setelah hasil diterima. Waktu tunggu jadi bagian dari pengalaman, bukan dead time.
- Progres animasi ditahan di ~85% kalau request AI belum selesai, lalu diselesaikan begitu hasil datang. Jadi animasi tidak pernah "selesai duluan" lalu menggantung.
- Layar processing memakai tema gelap (`--color-darkroom`) sebagai metafora darkroom. Token ini sengaja tidak ikut berbalik saat dark mode aktif (lihat §5.6).
- Menampilkan estimasi waktu yang jujur (countdown), bukan spinner tanpa informasi.
- Ada tombol Cancel untuk membatalkan request yang sedang berjalan.
- Animasi dibuat pakai CSS (kemungkinan dibantu beberapa library animasi front-end untuk transisi yang lebih halus).

### 5.4 Output & Export
- Setelah proses selesai, user bisa save/download hasil foto polaroid (format image, resolusi cukup untuk share ke social media).
- **Bingkai polaroid dibiarkan polos — tanpa judul dan tanpa tanggal.** Border atas dan bawah kosong, seperti cetakan instant film yang belum ditulisi. Ini berlaku di layar hasil, gallery, maupun file hasil download.
- Prompt AI juga secara eksplisit melarang model membakar date stamp / angka ke dalam foto — kamera disposable era 2000-an biasanya mencetak tanggal oranye di pojok, dan itu tidak diinginkan di sini.

### 5.5 Gallery (session-only)
- Tab gallery menampilkan foto-foto yang dibuat **selama sesi berjalan saja**, disimpan in-memory (React state).
- **Foto tidak di-persist sama sekali** — refresh atau tutup tab = gallery kosong. Konsisten dengan §7 Storage: tidak ada server storage, dan foto tidak pernah masuk localStorage/IndexedDB.
- Pengecualian yang bukan foto: preferensi light/dark mode disimpan di `localStorage` (§5.6). Ini setting UI, bukan data user.
- Tampilan memakai komponen Film Stack dari design system (deck bertumpuk dengan rotasi ±2 derajat).
- User perlu diberi tahu secara halus bahwa foto tidak tersimpan permanen — save/download adalah satu-satunya cara menyimpan.

### 5.6 Light & Dark Mode
- App mendukung light dan dark mode, di-toggle lewat tombol sun/moon di header.
- Default mengikuti preferensi OS (`prefers-color-scheme`); begitu user memilih manual, pilihannya disimpan di `localStorage` dan menang atas OS.
- Script inline dijalankan sebelum paint pertama supaya tidak ada kedip tema salah saat load.
- Palet dark diturunkan dari token light: hue netral dipertahankan, tangga tonalnya dibalik.
- **Dua hal sengaja tidak ikut berbalik:**
  - Kertas film (`--color-print`) tetap putih — "cetakan gelap" bukan benda yang ada di dunia nyata.
  - Layar processing (`--color-darkroom`) tetap gelap di kedua tema, karena metafora darkroom-nya bergantung pada itu.

## 6. User Flow

1. User buka app → diminta izin akses kamera.
2. User lihat live preview kamera → tekan tombol capture.
3. Foto diambil → preview sebentar → user konfirmasi (pakai foto ini / retake).
4. Foto dikirim ke proses AI generation di background **dan animasi reveal langsung mulai bersamaan**.
5. Layar processing (tema gelap) menampilkan polaroid yang develop bertahap + countdown. User bisa Cancel.
6. Hasil AI datang → animasi diselesaikan → hasil akhir foto polaroid ditampilkan penuh.
7. User bisa save/download atau capture ulang.
8. Foto masuk ke gallery sesi (hilang kalau di-refresh).

## 7. Technical Considerations

- **Camera capture:** browser API (getUserMedia) untuk web, atau native camera API kalau dibuat sebagai app.
- **AI processing:** model image-to-image lewat OpenRouter Image API (`input_references` + prompt) untuk transformasi foto capture jadi gaya polaroid.
- **Animasi reveal:** dibuat pakai CSS (kemungkinan dibantu beberapa library animasi), **dijalankan bersamaan dengan request AI** dan ditahan di ~85% sampai hasil datang. Ini menggantikan pendekatan "jalankan setelah hasil diterima" yang sempat ditulis di draft awal.
- **Frame:** bingkai putih klasik polaroid, satu style untuk v1.
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
- Hasil foto polaroid terlihat estetik dan konsisten kualitasnya.
- Waktu proses (capture sampai hasil jadi) terasa cepat/nyaman, bukan lama menunggu.

## 10. Future Considerations

- Multi-style frame/filter selection.
- Fitur share langsung ke social media dari dalam app.
- Kemungkinan dikembangkan jadi produk publik/kecil kalau responnya bagus.
- Integrasi cetak fisik (printer polaroid mini) kalau mau dijadikan produk nyata.