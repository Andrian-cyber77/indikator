// Client logic for Team Indicator Viewer

let currentUser = null;
let currentStatus = null;
let eventSource = null;

// DOM Elements
const bodyEl = document.getElementById('mainBody');
const ambientGlow = document.getElementById('ambientGlow');
const indicatorOrb = document.getElementById('indicatorOrb');
const radarRing = document.getElementById('radarRing');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const statusNote = document.getElementById('statusNote');
const lastUpdatedTime = document.getElementById('lastUpdatedTime');
const updatedByEl = document.getElementById('updatedBy');
const liveDot = document.getElementById('liveDot');
const liveStatusText = document.getElementById('liveStatusText');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundIcon = document.getElementById('soundIcon');
const soundLabel = document.getElementById('soundLabel');
const fullscreenBtn = document.getElementById('fullscreenBtn');

async function initViewer() {
  // Verifikasi auth (bisa diakses user maupun admin)
  currentUser = await checkAuth();
  if (!currentUser) return;

  document.getElementById('userNameDisplay').innerText = currentUser.name || currentUser.username;
  document.getElementById('userRoleDisplay').innerText = currentUser.role === 'admin' ? 'Administrator' : 'Anggota Tim';

  // Inisialisasi SSE stream untuk update realtime
  connectSSE();

  // Tombol Audio
  soundToggleBtn.addEventListener('click', () => {
    const isEnabled = window.soundFx.toggleSound();
    if (isEnabled) {
      soundLabel.innerText = 'Suara Aktif';
      soundToggleBtn.classList.remove('opacity-60');
      soundIcon.setAttribute('data-lucide', 'volume-2');
      window.soundFx.playSafe(); // Demo ring
    } else {
      soundLabel.innerText = 'Suara Bisu';
      soundToggleBtn.classList.add('opacity-60');
      soundIcon.setAttribute('data-lucide', 'volume-x');
    }
    lucide.createIcons();
  });

  // Tombol Layar Penuh
  fullscreenBtn.addEventListener('click', toggleFullScreen);
}

function updateUI(status) {
  const isSafe = status.code === 'AMAN';
  const isChanged = currentStatus && currentStatus.code !== status.code;

  currentStatus = status;

  // Bunyikan suara jika ada perubahan status
  if (isChanged) {
    if (isSafe) {
      window.soundFx.playSafe();
    } else {
      window.soundFx.playDanger();
    }
  }

  // Update Teks
  statusText.innerText = status.title || (isSafe ? 'AMAN' : 'TIDAK AMAN');
  statusNote.innerText = status.note || (isSafe ? 'Kondisi operasional normal' : 'Peringatan: Kondisi tidak aman!');
  lastUpdatedTime.innerText = `${formatTanggalWaktu(status.updatedAt)} (${timeAgo(status.updatedAt)})`;
  if (updatedByEl) {
    updatedByEl.innerText = status.updatedBy ? `Oleh: ${status.updatedBy}` : '';
  }

  // Update Tampilan Warna (Hijau vs Merah)
  if (isSafe) {
    // AMAN (HIJAU)
    ambientGlow.className = 'absolute inset-0 ambient-bg-green transition-status duration-1000 pointer-events-none';
    
    // Orb
    indicatorOrb.className = 'w-48 h-48 sm:w-64 sm:h-64 rounded-full glow-green flex items-center justify-center transition-all duration-700 shadow-2xl relative';
    radarRing.className = 'radar-ring radar-ring-green';
    
    // Status Badge
    statusBadge.className = 'inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-sm tracking-widest uppercase shadow-lg shadow-emerald-500/10 mb-4 transition-all duration-500';
    statusBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span> KONDISI KODE HIJAU`;

    // Title color
    statusText.className = 'text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-emerald-400 drop-shadow-[0_0_35px_rgba(52,211,153,0.4)] transition-all duration-500';
    
    // Note border accent
    document.getElementById('noteCard').className = 'glass-panel p-5 sm:p-6 rounded-2xl border-l-4 border-l-emerald-500 border-t border-r border-b border-slate-800/80 max-w-xl mx-auto shadow-xl transition-all duration-500';
    document.getElementById('statusIconInsideOrb').innerHTML = `<i data-lucide="shield-check" class="w-24 h-24 sm:w-32 sm:h-32 text-emerald-950/80 drop-shadow"></i>`;
  } else {
    // TIDAK AMAN (MERAH)
    ambientGlow.className = 'absolute inset-0 ambient-bg-red transition-status duration-1000 pointer-events-none';
    
    // Orb
    indicatorOrb.className = 'w-48 h-48 sm:w-64 sm:h-64 rounded-full glow-red flex items-center justify-center transition-all duration-700 shadow-2xl relative';
    radarRing.className = 'radar-ring radar-ring-red';

    // Status Badge
    statusBadge.className = 'inline-flex items-center gap-2 px-5 py-2 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold text-sm tracking-widest uppercase shadow-lg shadow-rose-500/20 mb-4 transition-all duration-500 animate-pulse';
    statusBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> KONDISI KODE MERAH`;

    // Title color
    statusText.className = 'text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-rose-500 drop-shadow-[0_0_40px_rgba(244,63,94,0.6)] transition-all duration-500 animate-pulse';

    // Note border accent
    document.getElementById('noteCard').className = 'glass-panel p-5 sm:p-6 rounded-2xl border-l-4 border-l-rose-500 border-t border-r border-b border-slate-800/80 max-w-xl mx-auto shadow-xl transition-all duration-500';
    document.getElementById('statusIconInsideOrb').innerHTML = `<i data-lucide="alert-triangle" class="w-24 h-24 sm:w-32 sm:h-32 text-rose-950/90 drop-shadow"></i>`;
  }

  lucide.createIcons();
}

function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/stream');

  eventSource.onopen = () => {
    liveDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-ping';
    liveStatusText.innerText = 'TERHUBUNG REAL-TIME';
    liveStatusText.className = 'text-[11px] font-semibold text-emerald-400 tracking-wider';
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      updateUI(data);
    } catch (e) {
      console.error('Failed to parse SSE data', e);
    }
  };

  eventSource.onerror = (err) => {
    console.warn('SSE connection error, attempting reconnect...', err);
    liveDot.className = 'w-2 h-2 rounded-full bg-amber-400';
    liveStatusText.innerText = 'MENYAMBUNGKAN KEMBALI...';
    liveStatusText.className = 'text-[11px] font-semibold text-amber-400 tracking-wider';
  };
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      alert(`Error entering fullscreen: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

// Refresh time ago counter setiap 15 detik
setInterval(() => {
  if (currentStatus && currentStatus.updatedAt) {
    lastUpdatedTime.innerText = `${formatTanggalWaktu(currentStatus.updatedAt)} (${timeAgo(currentStatus.updatedAt)})`;
  }
}, 15000);

document.addEventListener('DOMContentLoaded', initViewer);
