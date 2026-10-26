const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'database.json');

// Pastikan direktori data tersedia
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inisialisasi Database JSON bawaan
function initDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    const defaultData = {
      status: {
        code: 'AMAN', // 'AMAN' atau 'TIDAK_AMAN'
        color: 'green', // 'green' atau 'red'
        title: 'AMAN',
        note: 'Sistem operasional terpantau normal dan kondusif.',
        updatedBy: 'admin',
        updatedAt: new Date().toISOString()
      },
      users: [
        {
          id: '1',
          username: 'admin',
          // SHA-256 dari 'admin123'
          passwordHash: hashPassword('admin123'),
          role: 'admin',
          name: 'Administrator'
        },
        {
          id: '2',
          username: 'user',
          // SHA-256 dari 'user123'
          passwordHash: hashPassword('user123'),
          role: 'user',
          name: 'Anggota Tim'
        }
      ],
      history: [
        {
          code: 'AMAN',
          note: 'Inisialisasi sistem',
          updatedBy: 'System',
          timestamp: new Date().toISOString()
        }
      ]
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (err) {
    console.error('Gagal membaca database.json, mengembalikan struktur default.', err);
    return null;
  }
}

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (err) {
    return initDatabase();
  }
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_salt_indicator_app').digest('hex');
}

// Memory session store sederhana (token -> user)
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// SSE Clients pool
let sseClients = [];

function broadcastStatus(statusPayload) {
  const data = JSON.stringify(statusPayload);
  sseClients.forEach(client => {
    client.res.write(`data: ${data}\n\n`);
  });
}

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Friendly HTML routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/indicator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'indicator.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware Autentikasi
function authMiddleware(req, res, next) {
  const token = req.cookies.auth_token || req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
  }
  req.user = sessions.get(token);
  next();
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Fitur ini hanya untuk Admin.' });
  }
  next();
}

// API Routes

// 1. Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  const db = readDb();
  const pwdHash = hashPassword(password);
  const user = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase() && u.passwordHash === pwdHash);

  if (!user) {
    return res.status(401).json({ error: 'Username atau password salah!' });
  }

  const token = generateToken();
  const sessionUser = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name
  };

  sessions.set(token, sessionUser);

  // Set cookie (valid 7 hari)
  res.cookie('auth_token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  res.json({
    message: 'Login berhasil',
    token,
    user: sessionUser
  });
});

// 2. Info sesi saat ini
app.get('/api/me', (req, res) => {
  const token = req.cookies.auth_token || req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Belum login' });
  }
  res.json({ user: sessions.get(token) });
});

// 3. Logout
app.post('/api/logout', (req, res) => {
  const token = req.cookies.auth_token || req.headers['authorization']?.replace('Bearer ', '');
  if (token) {
    sessions.delete(token);
  }
  res.clearCookie('auth_token');
  res.json({ message: 'Logout berhasil' });
});

// 4. Ambil Status Terkini (Bisa diakses user & admin yang sudah login)
app.get('/api/status', authMiddleware, (req, res) => {
  const db = readDb();
  res.json(db.status);
});

// 5. Update Status (Hanya Admin)
app.post('/api/status', authMiddleware, adminOnly, (req, res) => {
  const { code, note } = req.body; // 'AMAN' atau 'TIDAK_AMAN'

  if (code !== 'AMAN' && code !== 'TIDAK_AMAN') {
    return res.status(400).json({ error: 'Kode status harus "AMAN" atau "TIDAK_AMAN"' });
  }

  const db = readDb();
  const newStatus = {
    code: code,
    color: code === 'AMAN' ? 'green' : 'red',
    title: code === 'AMAN' ? 'AMAN' : 'TIDAK AMAN',
    note: (note && note.trim()) ? note.trim() : (code === 'AMAN' ? 'Semua kondisi aman dan normal.' : 'Peringatan: Kondisi terindikasi tidak aman! Harap waspada.'),
    updatedBy: req.user.name || req.user.username,
    updatedAt: new Date().toISOString()
  };

  db.status = newStatus;

  // Catat riwayat perubahan
  if (!db.history) db.history = [];
  db.history.unshift({
    code: newStatus.code,
    note: newStatus.note,
    updatedBy: newStatus.updatedBy,
    timestamp: newStatus.updatedAt
  });

  // Simpan maksimal 50 riwayat
  if (db.history.length > 50) {
    db.history = db.history.slice(0, 50);
  }

  saveDb(db);

  // Kirim sinyal real-time ke semua user & viewer yang sedang terhubung
  broadcastStatus(newStatus);

  res.json({
    message: 'Status berhasil diperbarui',
    status: newStatus
  });
});

// 6. Ambil Riwayat Perubahan (Hanya Admin)
app.get('/api/history', authMiddleware, adminOnly, (req, res) => {
  const db = readDb();
  res.json(db.history || []);
});

// 7. Ambil daftar user & tambah user (Hanya Admin)
app.get('/api/users', authMiddleware, adminOnly, (req, res) => {
  const db = readDb();
  const sanitized = db.users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role
  }));
  res.json(sanitized);
});

app.post('/api/users', authMiddleware, adminOnly, (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, dan role harus diisi.' });
  }

  const db = readDb();
  if (db.users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Username sudah digunakan.' });
  }

  const newUser = {
    id: Date.now().toString(),
    username: username.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    role: role === 'admin' ? 'admin' : 'user',
    name: (name && name.trim()) ? name.trim() : username.trim()
  };

  db.users.push(newUser);
  saveDb(db);

  res.json({
    message: 'User berhasil dibuat',
    user: { id: newUser.id, username: newUser.username, name: newUser.name, role: newUser.role }
  });
});

// 8. Server-Sent Events (SSE) untuk realtime indicator updates
app.get('/api/stream', (req, res) => {
  // Verifikasi token via query parameter atau cookie
  const token = req.query.token || req.cookies.auth_token;
  if (!token || !sessions.has(token)) {
    return res.status(401).send('Unauthorized');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = Date.now() + Math.random().toString(36).substring(2);
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Kirim status awal saat pertama kali koneksi terbuka
  const db = readDb();
  res.write(`data: ${JSON.stringify(db.status)}\n\n`);

  // Heartbeat setiap 25 detik agar koneksi tetap hidup
  const keepAliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// Helper untuk menampilkan IP Komputer di jaringan lokal (WiFi / LAN)
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

// Inisialisasi awal
initDatabase();

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log('🚀 APLIKASI KODE INDIKATOR TIM BERJALAN');
  console.log(`📡 Local:            http://localhost:${PORT}`);
  const ips = getLocalIpAddresses();
  if (ips.length > 0) {
    ips.forEach(ip => {
      console.log(`🌐 Jaringan Tim/LAN: http://${ip}:${PORT}`);
    });
  } else {
    console.log(`🌐 Jaringan Tim/LAN: http://0.0.0.0:${PORT}`);
  }
  console.log('--------------------------------------------------------');
  console.log('Akun Default:');
  console.log('👉 Admin: username = admin  | password = admin123');
  console.log('👉 User:  username = user   | password = user123');
  console.log('========================================================');
});
