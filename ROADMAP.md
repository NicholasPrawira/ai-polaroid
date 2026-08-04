# Roadmap: dari kamera iseng → app album memori

Status: draft untuk didiskusikan. Belum ada yang dikerjakan.

Konsepnya: foto dijepret lewat kamera, dikasih look disposable oleh AI, lalu
disimpan ke dalam **album bernama** — "Japan 2026", "Nico Wedding", "Bali Trip".

---

## 0. Perubahan premis

Yang ada sekarang dibangun di atas tiga keputusan yang semuanya harus dibalik:

| PRD sekarang | Yang dibutuhkan |
| --- | --- |
| Tidak ada penyimpanan foto | Foto harus abadi — itu inti produknya |
| Tidak ada akun/login | Memori itu personal, butuh pemilik |
| Gallery hilang saat refresh | Album adalah produknya |

Yang **tetap terpakai**: `useCamera`, prompt disposable beserta guard-nya,
animasi develop, sistem theming, `PhotoCard`, dan API route develop. Kira-kira
70% kode UI bertahan. Yang dibangun ulang adalah lapisan data.

---

## 1. Album, bukan trip

Unit utamanya adalah album yang **user beri nama sendiri**. Ini keputusan penting
karena dua contohmu berbeda sifat:

- **"Japan 2026"** — perjalanan. Berhari-hari, berpindah tempat, satu orang.
- **"Nico Wedding"** — acara. Satu hari, satu tempat, **banyak orang**.

Kalau unitnya "trip", kasus kedua tidak muat. Kalau unitnya album bernama,
dua-duanya muat tanpa logika tambahan. Jadi tidak perlu deteksi otomatis
berdasarkan jarak atau tanggal — user bikin album, lalu memotret ke dalamnya.

Struktur minimalnya:

- Album punya nama, rentang tanggal (dihitung dari isinya), dan cover
- Saat kamera dibuka, ada album aktif; hasil jepretan masuk ke situ
- Bisa pindah foto antar album, dan bisa punya foto tanpa album ("Unsorted")

### Konsekuensi: berbagi naik prioritas

Ini pergeseran terpenting dari rencana sebelumnya. Album acara **pada dasarnya
melibatkan banyak orang** — kalau "Nico Wedding" cuma berisi foto dari HP kamu
sendiri, itu bukan album pernikahan, itu galeri pribadi.

Berbagi tadinya saya taruh di P3. Untuk kasusmu, itu terlalu belakang. Nilai
terbesar album acara justru muncul saat beberapa orang mengisi album yang sama.

Bentuk paling sederhana yang sudah berguna: **link undangan.** Buka link → boleh
menambah foto ke album itu. Tidak perlu akun untuk kontributor di versi awal
(walau nanti tetap perlu, untuk kontrol hapus).

---

## 2. Fondasi (P0) — tanpa ini tidak ada yang jalan

### Stack

| Kebutuhan | Pilihan | Alasan |
| --- | --- | --- |
| Database | Supabase (Postgres) | Auth + Storage + DB satu layanan, cocok dengan Next.js/Vercel |
| Object storage | Supabase Storage | Foto tidak boleh masuk Postgres sebagai base64 |
| Auth | Supabase Auth | Magic link cukup; jangan bikin sistem password sendiri |
| Antrian develop | Vercel Cron + tabel `jobs` | Cukup untuk skala ini; jangan pasang Redis dulu |

### Skema awal

```sql
users          -- dari Supabase Auth
albums         id, owner_id, name, cover_photo_id, created_at
album_members  album_id, user_id, role            -- owner | contributor
photos         id, album_id, uploader_id,
               raw_path,        -- capture mentah di storage
               developed_path,  -- hasil AI, null kalau belum dicuci
               status,          -- queued | developing | done | failed
               taken_at,        -- waktu jepret di device, BUKAN waktu upload
               note,
               lat, lng, place_label,   -- opsional
               created_at
```

Dua kolom yang gampang terlewat tapi penting:

- **`taken_at` terpisah dari `created_at`.** Foto bisa dijepret offline hari Selasa
  dan baru ter-upload hari Kamis. Urutan cerita harus mengikuti kapan difoto.
  Untuk album acara ini makin krusial — foto dari beberapa orang harus tersusun
  menurut waktu kejadian, bukan waktu upload.
- **`raw_path` disimpan, bukan cuma hasil AI.** Kalau develop gagal, atau nanti mau
  ganti prompt/model, aslinya masih ada. Tanpa ini, satu bug di prompt bisa
  merusak memori orang secara permanen.

### Yang harus dikerjakan

1. Setup Supabase, migrasi skema, Row Level Security (wajib, bukan opsional)
2. Ganti data URL dengan upload ke storage; komponen menerima URL, bukan base64
3. Auth magic link + proteksi route
4. Migrasi gallery dari React state ke query database
5. CRUD album + album aktif di layar kamera

---

## 3. Upload dari camera roll (P1) — kemungkinan besar wajib

Ini bukan fitur tambahan, ini penentu apakah app-nya kepakai.

Untuk "Nico Wedding", tamu tidak akan memotret lewat app kamu — mereka sudah
memotret pakai kamera HP biasa. Untuk "Japan 2026", sebagian besar fotomu juga
sudah terlanjur ada di galeri sebelum app ini kamu buka.

Kalau app hanya menerima capture langsung, sebagian besar memori tidak akan
pernah masuk.

Yang dibutuhkan: pilih banyak foto sekaligus, jalankan lewat pipeline develop yang
sama, baca `taken_at` dari EXIF (bukan waktu upload), dan tangani foto non-square
(sekarang semuanya diasumsikan 1:1).

Ini menggeser posisi "kamera" dari pusat aplikasi menjadi salah satu cara masuk.
Perubahan konsep yang cukup besar, tapi menurut saya tidak terhindarkan.

---

## 4. Rol film yang dititipkan (P2)

Travelling berarti sinyal jelek. Alur sekarang mengharuskan request AI berhasil
saat itu juga — artinya app gagal justru di saat paling dibutuhkan.

Solusi membosankannya: retry + pesan error. Solusi yang lebih baik: **foto tidak
perlu langsung jadi.** Simpan capture mentah di device, cuci belakangan saat online.

Ini persis cara kerja kamera disposable sungguhan — memotret seharian, rolnya
dititipkan, hasilnya diambil besok. Keterbatasan teknisnya justru jadi fitur yang
paling otentik dengan konsep produknya:

- Foto masuk album dalam keadaan **belum dicuci**
- Saat online, antrian develop jalan di background
- Ada momen "cetakan sudah jadi" — album tiba-tiba hidup

Yang dibutuhkan: IndexedDB untuk capture, service worker + background sync,
PWA installable, dan UI yang jujur soal status (tersimpan → ter-upload → dicuci →
jadi).

Konsekuensinya `useDevelop` sekarang (progress bar sambil user menonton) bukan
lagi alur utama — berubah jadi antrian background.

---

## 5. Setelah itu (P3)

- Catatan per foto dan per album
- Lokasi opsional + peta
- Recap akhir album (berapa hari, berapa foto, berapa kontributor)
- Export album jadi zip/PDF
- "Setahun lalu hari ini"

### Soal teks — bertabrakan dengan keputusan terakhirmu

Judul foto baru saja dihapus, bingkai putih juga sudah dibuang. Untuk app memori,
konteks jadi penting lagi.

Saran: **jangan kembalikan teks ke atas fotonya.** Cetakannya tetap bersih.
Nama album, tanggal, dan catatan ditampilkan di UI *sekitar* foto. Estetika
disposable-nya utuh, konteksnya tidak hilang.

---

## 6. Tanggung jawab baru

**Biaya.** $0.01 per foto. Album pernikahan dengan 30 tamu × 20 foto = $6 untuk
satu album. Wajib ada batas dan pemantauan sebelum dibuka ke publik.

**Privasi.** Menyimpan wajah orang dan tanggalnya. Untuk album acara, kamu
menyimpan wajah orang yang **bukan user app-mu** dan tidak pernah menyetujui apa
pun. Minimal: hapus akun beserta seluruh datanya, dan kebijakan privasi yang jujur.

**Kegagalan develop.** Sekarang kalau gagal tinggal foto ulang. Nanti tidak bisa —
momennya sudah lewat. Karena itu `raw_path` wajib disimpan dan retry otomatis.

**Retensi.** Apa yang terjadi kalau user tidak buka app setahun? Putuskan sebelum
ada user, bukan sesudah.

---

## 7. Urutan yang disarankan

1. **P0 fondasi** — auth, storage, album. Tidak ada gunanya membangun apa pun
   sebelum foto berhenti hilang saat refresh.
2. **P1 upload camera roll** — tanpa ini sebagian besar memori tidak akan masuk.
3. **P2 offline** — sebelum dipakai orang lain.
4. **Berbagi** — waktunya tergantung §8 di bawah.

Saran: pakai sendiri dulu untuk satu album penuh sebelum menambah apa pun setelah
P1. Yang benar-benar dibutuhkan biasanya berbeda dari daftar mana pun.

---

## 8. Yang belum diputuskan

- **Berbagi album: perlu atau tidak?** Kalau "Nico Wedding" dimaksudkan diisi
  banyak orang, ini naik ke P1 dan mengubah banyak hal (auth kontributor, izin,
  moderasi). Kalau semua foto tetap dari HP-mu sendiri, ini bisa ditunda jauh.
- Ini untuk kamu sendiri, atau produk publik?
- Efek AI diterapkan ke semua foto, atau opsional per foto? (Untuk foto dari
  camera roll, mungkin tidak semua ingin diubah.)
