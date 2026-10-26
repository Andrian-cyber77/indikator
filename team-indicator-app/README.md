# Aplikasi Indikator Status Tim (Aman & Tidak Aman)

Aplikasi web real-time yang dirancang untuk memantau kode indikator status tim secara langsung:
- **Admin**: Memiliki panel kontrol khusus untuk mengatur status (**AMAN / KODE HIJAU** atau **TIDAK AMAN / KODE MERAH**), memberikan catatan keterangan, melihat riwayat perubahan, serta menambah akun tim baru.
- **User / Tim**: Hanya melihat warna indikator (layar hijau / merah dengan efek glowing radar, keterangan status, dan alarm suara real-time tanpa perlu refresh).

---

## 🚀 Cara Menjalankan Aplikasi

1. Buka folder aplikasi di Command Prompt atau PowerShell:
   ```bash
   cd C:\Users\User\team-indicator-app
   ```
2. Jalankan perintah:
   ```bash
   node server.js
   ```
   *(Atau cukup klik dua kali file `start.bat`)*

3. Buka browser:
   - Di komputer server: [http://localhost:3000](http://localhost:3000)
   - Untuk anggota tim di jaringan Wi-Fi/LAN yang sama: buka alamat IP yang muncul di konsol terminal (misal: `http://192.168.100.112:3000`).

---

## 🔑 Akun Default Bawaan

| Role | Username | Password | Keterangan |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | Memiliki kontrol penuh untuk mengubah status & menambah user. |
| **User (Tim)** | `user` | `user123` | Hanya dapat melihat layar indikator warna. |

*(Tersedia tombol satu-klik di halaman login untuk mengisi username & password bawaan secara instan)*

---

## 🌟 Fitur Utama

1. **Sistem Autentikasi Role-Based**:
   - Pemisahan hak akses yang ketat antara Admin dan User biasa.
   - User biasa diblokir di level backend jika mencoba mengubah status.
2. **Indikator Real-Time (Server-Sent Events)**:
   - Saat admin menekan tombol dan menyiarkan status, layar seluruh anggota tim langsung berganti warna seketika tanpa perlu menekan refresh.
3. **Efek Visual & Audio Modern**:
   - Efek orb bercahaya (*glowing pulse*) dan radar gelombang.
   - Suara nada ganda yang harmonis saat kondisi **AMAN** (Hijau).
   - Suara alarm beep peringatan saat kondisi **TIDAK AMAN** (Merah).
   - Tombol On/Off suara dan mode Layar Penuh (*Fullscreen/TV Mode*).
4. **Catatan & Keterangan**:
   - Admin dapat menuliskan instruksi singkat (misal: alasan kenapa kondisi tidak aman, atau instruksi darurat).
5. **Riwayat Perubahan (Audit Log)**:
   - Mencatat tanggal, waktu, nama pengubah, dan keterangan perubahan status.
6. **Manajemen Pengguna**:
   - Admin dapat mendaftarkan akun tim tambahan langsung melalui dasbor.
