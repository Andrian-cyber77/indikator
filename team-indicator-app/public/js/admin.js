// Client logic for Admin Dashboard

let currentUser = null;
let currentStatus = null;
let selectedCode = 'AMAN'; // 'AMAN' or 'TIDAK_AMAN'

// Elements
const btnSetSafe = document.getElementById('btnSetSafe');
const btnSetDanger = document.getElementById('btnSetDanger');
const statusNoteInput = document.getElementById('statusNoteInput');
const btnSaveStatus = document.getElementById('btnSaveStatus');
const saveMessage = document.getElementById('saveMessage');

// Preview Elements
const previewOrb = document.getElementById('previewOrb');
const previewBadge = document.getElementById('previewBadge');
const previewTitle = document.getElementById('previewTitle');
const previewNote = document.getElementById('previewNote');
const previewUpdated = document.getElementById('previewUpdated');

// History Table
const historyTableBody = document.getElementById('historyTableBody');

// User Management
const userListBody = document.getElementById('userListBody');
const addUserForm = document.getElementById('addUserForm');
const addUserMsg = document.getElementById('addUserMsg');

async function initAdmin() {
  // Hanya admin yang boleh masuk ke sini
  currentUser = await checkAuth('admin');
  if (!currentUser) return;

  document.getElementById('adminNameDisplay').innerText = currentUser.name || currentUser.username;

  // Load status awal
  await loadCurrentStatus();
  await loadHistory();
  await loadUsers();

  // Setup Event Listeners
  btnSetSafe.addEventListener('click', () => selectMode('AMAN'));
  btnSetDanger.addEventListener('click', () => selectMode('TIDAK_AMAN'));
  btnSaveStatus.addEventListener('click', saveStatusChanges);

  // Form Tambah User
  if (addUserForm) {
    addUserForm.addEventListener('submit', handleAddUser);
  }

  // Connect SSE agar jika ada admin lain mengubah status, halaman ini juga terupdate
  connectAdminSSE();
}

function selectMode(code) {
  selectedCode = code;
  if (code === 'AMAN') {
    // Tombol Aman aktif
    btnSetSafe.className = 'flex-1 py-4 px-6 rounded-2xl border-2 border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 transition-all scale-[1.02] ring-2 ring-emerald-400';
    btnSetDanger.className = 'flex-1 py-4 px-6 rounded-2xl border border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold flex items-center justify-center gap-3 transition-all';
  } else {
    // Tombol Tidak Aman aktif
    btnSetSafe.className = 'flex-1 py-4 px-6 rounded-2xl border border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold flex items-center justify-center gap-3 transition-all';
    btnSetDanger.className = 'flex-1 py-4 px-6 rounded-2xl border-2 border-rose-500 bg-rose-500/20 text-rose-300 font-bold flex items-center justify-center gap-3 shadow-lg shadow-rose-500/20 transition-all scale-[1.02] ring-2 ring-rose-400';
  }
}

async function loadCurrentStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Gagal memuat status');
    const data = await res.json();
    currentStatus = data;
    selectedCode = data.code;
    selectMode(data.code);
    statusNoteInput.value = data.note || '';
    updatePreview(data);
  } catch (err) {
    console.error(err);
  }
}

function updatePreview(status) {
  const isSafe = status.code === 'AMAN';

  previewTitle.innerText = status.title || (isSafe ? 'AMAN' : 'TIDAK AMAN');
  previewNote.innerText = status.note || '-';
  previewUpdated.innerText = `${formatTanggalWaktu(status.updatedAt)} (${timeAgo(status.updatedAt)})`;

  if (isSafe) {
    previewOrb.className = 'w-24 h-24 rounded-full glow-green flex items-center justify-center relative shadow-lg';
    previewOrb.innerHTML = `<i data-lucide="shield-check" class="w-12 h-12 text-emerald-950/80"></i>`;
    previewBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold';
    previewBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> KODE HIJAU`;
    previewTitle.className = 'text-2xl font-black text-emerald-400';
  } else {
    previewOrb.className = 'w-24 h-24 rounded-full glow-red flex items-center justify-center relative shadow-lg';
    previewOrb.innerHTML = `<i data-lucide="alert-triangle" class="w-12 h-12 text-rose-950/90"></i>`;
    previewBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold';
    previewBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span> KODE MERAH`;
    previewTitle.className = 'text-2xl font-black text-rose-500';
  }
  lucide.createIcons();
}

async function saveStatusChanges() {
  btnSaveStatus.disabled = true;
  btnSaveStatus.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>Menyiarkan...</span>`;
  lucide.createIcons();
  saveMessage.classList.add('hidden');

  const note = statusNoteInput.value.trim();

  try {
    const res = await fetch('/api/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: selectedCode,
        note: note
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');

    currentStatus = data.status;
    updatePreview(data.status);
    await loadHistory();

    saveMessage.className = 'mt-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2';
    saveMessage.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 shrink-0"></i><span>Status berhasil diperbarui dan disiarkan ke semua layar tim!</span>`;
    saveMessage.classList.remove('hidden');

    // Bunyikan preview suara
    if (selectedCode === 'AMAN') {
      window.soundFx.playSafe();
    } else {
      window.soundFx.playDanger();
    }
  } catch (err) {
    saveMessage.className = 'mt-3 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2';
    saveMessage.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 shrink-0"></i><span>${err.message}</span>`;
    saveMessage.classList.remove('hidden');
  } finally {
    btnSaveStatus.disabled = false;
    btnSaveStatus.innerHTML = `<i data-lucide="radio" class="w-4 h-4"></i><span>Terapkan &amp; Siarkan Status Sekarang</span>`;
    lucide.createIcons();
  }
}

// Preset catatan cepat
function setQuickNote(text) {
  statusNoteInput.value = text;
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) return;
    const history = await res.json();

    if (!history || history.length === 0) {
      historyTableBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-500 text-xs">Belum ada riwayat perubahan.</td></tr>`;
      return;
    }

    historyTableBody.innerHTML = history.map(item => {
      const isSafe = item.code === 'AMAN';
      return `
        <tr class="border-b border-slate-800/60 hover:bg-slate-900/40 text-xs">
          <td class="py-3 px-3">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold ${
              isSafe ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }">
              <span class="w-1.5 h-1.5 rounded-full ${isSafe ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
              ${item.code === 'AMAN' ? 'AMAN (Hijau)' : 'TIDAK AMAN (Merah)'}
            </span>
          </td>
          <td class="py-3 px-3 text-slate-300">${item.note || '-'}</td>
          <td class="py-3 px-3 text-slate-400">${item.updatedBy || 'admin'}</td>
          <td class="py-3 px-3 text-slate-400 whitespace-nowrap">${formatTanggalWaktu(item.timestamp)}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load history', err);
  }
}

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) return;
    const users = await res.json();

    userListBody.innerHTML = users.map(u => `
      <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs">
        <div>
          <div class="font-semibold text-slate-200">${u.name} <span class="text-slate-400 font-normal">(@${u.username})</span></div>
          <div class="text-[11px] text-slate-500 capitalize">Role: ${u.role === 'admin' ? 'Administrator' : 'User (Viewer)'}</div>
        </div>
        <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold ${
          u.role === 'admin' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
        }">
          ${u.role.toUpperCase()}
        </span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load users', err);
  }
}

async function handleAddUser(e) {
  e.preventDefault();
  const name = document.getElementById('newUserName').value.trim();
  const username = document.getElementById('newUserUsername').value.trim();
  const password = document.getElementById('newUserPassword').value;
  const role = document.getElementById('newUserRole').value;

  addUserMsg.classList.add('hidden');

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password, role })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal membuat user');

    addUserMsg.className = 'p-2.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-500/30 mb-3';
    addUserMsg.innerText = 'Akun baru berhasil didaftarkan!';
    addUserMsg.classList.remove('hidden');

    addUserForm.reset();
    await loadUsers();
  } catch (err) {
    addUserMsg.className = 'p-2.5 rounded-lg bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30 mb-3';
    addUserMsg.innerText = err.message;
    addUserMsg.classList.remove('hidden');
  }
}

function connectAdminSSE() {
  const eventSource = new EventSource('/api/stream');
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      currentStatus = data;
      updatePreview(data);
    } catch (e) {
      console.error(e);
    }
  };
}

document.addEventListener('DOMContentLoaded', initAdmin);
