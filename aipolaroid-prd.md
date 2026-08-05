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
- Tidak ada sinkron lintas device atau shared folder — itu roadmap Pro (lihat §5.5, §4).
- Tidak ada judul foto maupun timestamp di bingkai (lihat §5.4).
- Tidak ada multi-style filter — satu look disposable untuk v1.

## 4. Target User

- Nicho sendiri (personal use) — app di-deploy live (accessible via URL) supaya bisa diakses dari browser HP, bukan cuma dijalankan di local.
- **Wajib akun (P0, lihat §5.8).** `/camera` — kamera, gallery, folder — hanya bisa diakses setelah sign in. Ini keputusan sadar: dibalik dari rencana awal "tidak ada akun", karena persistence & sinkron lintas device tidak masuk akal tanpa identitas user. Keduanya sudah jalan sekarang, gratis di semua tier, karena satu mekanisme (Supabase per-`user_id`) memberi keduanya sekaligus — lihat §5.5, §7.

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

### 5.5 Gallery (persisted per-akun)
- Dua tab: **All Photos** dan **Folders**.
- **All Photos** — semua foto milik user, dikelompokkan per hari (`Today`, `Yesterday`,
  lalu tanggalnya) sehingga terbaca sebagai riwayat, bukan tumpukan datar.
- **Folders** — daftar folder buatan user (mis. "Japan 2026", "Nico Wedding")
  dengan cover foto terbaru dan jumlah isinya. Tap untuk membuka isinya.
  Foto yang belum difolder muncul di bagian "unsorted" di bawah daftar.
- Folder dibuat dari sheet "Add to folder" di layar hasil — tidak ada layar
  manajemen folder terpisah, supaya alurnya tetap satu arah.
- Satu foto berada di paling banyak satu folder (`folderId`, `null` = unsorted).
- Setiap foto yang selesai di-develop diupload ke Supabase Storage (bucket privat
  `photos`, path `{user_id}/{photo_id}.{ext}`) dan dicatat di tabel `photos`;
  folder dicatat di tabel `folders`. RLS membatasi setiap row/objek hanya bisa
  diakses oleh `auth.uid()` pemiliknya — lihat §7 Storage.
- Gallery dimuat ulang dari Supabase setiap `/camera` mount, jadi bertahan lintas
  refresh, sesi, maupun device — sign in dari device lain menampilkan library
  yang sama karena disimpan per-akun, bukan per-browser.
- Tampilan memakai rotasi ringan ±2 derajat (semangat Film Stack dari design system), tapi tanpa bingkai kertas.

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
  jumlah foto & folder tersimpan, sisa kuota foto (`profiles.photo_quota`, atau `∞`
  kalau `is_pro`), kartu Upgrade to Pro (disembunyikan kalau sudah Pro), lalu menu —
  Admin (khusus admin, lihat §5.9), Change password (nyambung ke §5.8), Billing &
  invoices, Privacy & data, Sign out (nyambung), **Delete account**.
- **Delete account** — merah, di paling bawah. Tap membuka sub-layar konfirmasi
  ("This deletes your account, every photo in your library, and every folder —
  permanently. There's no way to undo this.") dengan tombol Cancel dan tombol merah
  "Yes, delete my account" — tidak ada cara menghapus akun dalam satu tap. Alurnya:
  hapus semua object storage milik user lewat Storage API (bukan SQL langsung —
  `storage.objects` punya trigger yang menolak `DELETE` langsung), lalu panggil RPC
  `delete_own_account()` yang men-drop baris `auth.users` (dan cascade ke
  `profiles`/`folders`/`photos`), lalu sign out dan redirect ke `/`.
- Sub-layar **Plans**: dua tier (Free / Pro) beserta daftar fiturnya.
- **Billing masih placeholder** — belum ada payment provider, jadi upgrade ke Pro
  dan penambahan kuota sekarang manual lewat admin dashboard (§5.9), bukan self-serve.
  Angka harga di Plans adalah sketsa, bukan penawaran — tapi kuotanya dihitung dari
  biaya nyata $0,06/foto: Free 10 foto (biaya $0,60), Pro $9/bulan untuk 100 develop
  (biaya $6, margin ~33% saat dipakai penuh).
- **Tier "unlimited" tidak bisa ditawarkan ke Free.** Satu user berat akan
  menghabiskan nilai langganannya sendiri dalam hitungan hari. Di produk ini kuota
  adalah produknya, bukan sekadar pembatas — makanya benar-benar di-enforce di
  `/api/develop` (§5.9), bukan cuma angka dekoratif.
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

### 5.9 Admin dashboard & kuota foto
- **Admin cuma satu akun**, hardcoded ke email `nicholasprawiratan@gmail.com`
  (`ADMIN_EMAIL` di `src/lib/admin.ts`). Tidak ada role system — sengaja, ini
  personal project dengan satu operator.
- Setiap akun punya row di tabel `profiles` (dibuat otomatis lewat trigger
  `on_auth_user_created` saat sign up): `is_pro` (boolean) dan `photo_quota`
  (integer, default 10 saat akun baru dibuat).
- `/admin` — halaman yang cuma bisa diakses admin — menampilkan semua akun dengan
  dua kontrol per akun: toggle **Pro/Free**, dan form **tambah foto** (angka bebas,
  ditambahkan ke `photo_quota` yang ada, bukan menggantinya).
- **Enforcement nyata, bukan dekoratif:** `/api/develop` memanggil fungsi Postgres
  `consume_photo_quota()` sebelum request ke OpenRouter — kalau `is_pro` true,
  selalu lolos tanpa mengurangi kuota; kalau bukan dan `photo_quota <= 0`, request
  ditolak (403) sebelum uang keluar ke OpenRouter. Kalau lolos, `photo_quota`
  dikurangi 1 secara atomik di database yang sama (`select ... for update`), supaya
  request bersamaan tidak bisa dua-duanya lolos dari satu sisa kuota.
- **Keamanan berlapis, tapi RLS yang sebenarnya menegakkan:**
  1. `src/proxy.ts` — belum login diarahkan ke `/login`; sudah login tapi bukan
     admin diarahkan ke `/camera`, supaya non-admin bahkan tidak melihat halamannya.
  2. `src/app/admin/page.tsx` — cek ulang email dari `getClaims()` sebelum render.
  3. `src/app/admin/actions.ts` — tiap Server Action (`setPro`, `addPhotoQuota`)
     cek ulang admin sebelum jalan, karena Server Action adalah endpoint publik
     sendiri, terlepas dari halaman mana yang memanggilnya.
  4. **Baris terakhir yang sebenarnya tidak bisa ditembus**: RLS policy di tabel
     `profiles` (`profiles_select_admin`, `profiles_update_admin`) memakai fungsi
     `private.is_admin()` yang membaca email langsung dari JWT — jadi walau
     tiga lapis di atas somehow gagal, database sendiri tetap menolak baca/tulis
     profil orang lain dari akun non-admin.
- Tidak ada UI untuk admin membuat/menghapus akun — itu tetap lewat `/signup`
  biasa. Admin cuma mengatur `is_pro` dan `photo_quota` akun yang sudah ada.

## 6. User Flow

1. User buka app → diminta izin akses kamera.
2. User lihat live preview kamera → tekan tombol capture.
3. Foto diambil → preview sebentar → user konfirmasi (pakai foto ini / retake).
4. Foto dikirim ke proses AI generation di background **dan animasi reveal langsung mulai bersamaan**.
5. Layar processing (tema gelap) menampilkan foto yang develop bertahap + countdown. User bisa Cancel.
6. Hasil AI datang → animasi diselesaikan → hasil akhir foto ditampilkan penuh.
7. User bisa save/download atau capture ulang.
8. Foto diupload ke library milik user dan tetap ada setelah refresh (§5.5).

## 7. Technical Considerations

- **Camera capture:** browser API (getUserMedia) untuk web, atau native camera API kalau dibuat sebagai app.
- **AI processing:** model image-to-image lewat OpenRouter Image API (`input_references` + prompt) untuk transformasi foto capture jadi gaya disposable.
- **Animasi reveal:** dibuat pakai CSS (kemungkinan dibantu beberapa library animasi), **dijalankan bersamaan dengan request AI** dan ditahan di ~85% sampai hasil datang. Ini menggantikan pendekatan "jalankan setelah hasil diterima" yang sempat ditulis di draft awal.
- **Frame:** tidak ada bingkai. Foto ditampilkan full-bleed dengan sudut membulat.
- **Latency:** AI generation butuh ~10–40 detik. Loading state harus tetap immersive — animasi develop + countdown jujur, dengan opsi Cancel.
- **Camera constraint:** `getUserMedia` hanya memberi video stream. Metadata kamera (shutter/aperture/ISO) tidak tersedia — lihat §5.1a, HUD sepenuhnya dekoratif.
- **HTTPS:** `getUserMedia` hanya jalan di secure context. Di local pakai `localhost`; di production Vercel sudah HTTPS by default.
- **Platform:** web app biasa (bukan PWA/native), dibuka lewat browser di HP.
- **Storage:** Supabase Postgres (tabel `photos`, `folders`) + Supabase Storage (bucket privat `photos`). Foto diproses, diupload ke storage dengan path `{user_id}/{photo_id}.{ext}`, dan dibacakan lewat signed URL yang di-generate ulang tiap load — RLS di kedua layer membatasi akses ke `auth.uid()` pemiliknya (§5.5).
- **API key:** `OPENROUTER_API_KEY` hanya dipakai di server (API Route), tidak pernah dikirim ke client.

## 8. Tech Stack

- **Full-stack framework:** Next.js (frontend UI + camera capture, dan API Routes buat handle request ke AI).
- **AI Gateway:** OpenRouter Image API (`POST /api/v1/images/generations`), dipanggil dari API Route Next.js. Foto capture dikirim sebagai `input_references`, hasil dikembalikan ke frontend.
- **Model:** `x-ai/grok-imagine-image-quality` (default, via env `OPENROUTER_IMAGE_MODEL`). Alternatif: `google/gemini-3.1-flash-lite-image`, `google/gemini-3.1-flash-image`, `google/gemini-3-pro-image`, `openai/gpt-5.4-image-2`. Daftar lengkap model image-output: `https://openrouter.ai/api/v1/models?output_modalities=image` — perlu filter `output_modalities`, karena `/api/v1/models` polos tidak menampilkan model image-only.
- **Styling:** Tailwind CSS, dengan token dari `designsystem.md` di-map ke theme config.
- **Fonts:** Inter (UI) + Courier Prime (timestamp/metadata), via `next/font/google`.
- **Hosting:** Vercel (deploy satu Next.js app, frontend + API routes jalan bareng — gak ada backend service terpisah).
- **Storage/Database:** Supabase (Postgres + Storage + Auth). `folders`/`photos`/`profiles` tables dan bucket `photos` diakses lewat `@supabase/ssr` (`src/lib/supabase/client.ts`, `server.ts`), dengan RLS policy per-`user_id` di semua tabel, plus policy khusus admin di `profiles` lewat `private.is_admin()` (§5.9). Tidak pakai service role key sama sekali — admin dashboard jalan murni lewat RLS atas session admin sendiri.

## 9. Success Metrics (untuk personal project)

- Tool berhasil dipakai end-to-end tanpa bug besar (capture → generate → reveal → save).
- Hasil fotonya terlihat estetik dan konsisten kualitasnya.
- Waktu proses (capture sampai hasil jadi) terasa cepat/nyaman, bukan lama menunggu.

## 10. Future Considerations

- Multi-style frame/filter selection.
- Fitur share langsung ke social media dari dalam app.
- Kemungkinan dikembangkan jadi produk publik/kecil kalau responnya bagus.
- Integrasi cetak fisik (printer foto mini) kalau mau dijadikan produk nyata.