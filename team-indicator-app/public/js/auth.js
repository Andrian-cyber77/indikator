// Auth Helper functions

async function checkAuth(requiredRole = null) {
  try {
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '/login';

    const res = await fetch('/api/me');
    if (!res.ok) {
      // Tidak terotentikasi, alihkan ke login jika bukan di halaman login
      if (!isLoginPage) {
        window.location.href = '/index.html';
      }
      return null;
    }

    const data = await res.json();
    const user = data.user;

    // Jika sudah di halaman login dan user sudah login, redirect ke halaman sesuai role
    if (isLoginPage) {
      if (user.role === 'admin') {
        window.location.href = '/admin.html';
      } else {
        window.location.href = '/indicator.html';
      }
      return user;
    }

    // Jika halaman butuh role tertentu (misal admin.html butuh role admin)
    if (requiredRole && user.role !== requiredRole) {
      if (user.role === 'user') {
        window.location.href = '/indicator.html';
      } else {
        window.location.href = '/index.html';
      }
      return null;
    }

    return user;
  } catch (err) {
    console.error('Error checking auth:', err);
    return null;
  }
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (e) {
    console.error(e);
  }
  window.location.href = '/index.html';
}

function formatTanggalWaktu(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  });
}

function timeAgo(isoString) {
  if (!isoString) return '';
  const diffSec = Math.floor((new Date() - new Date(isoString)) / 1000);
  if (diffSec < 5) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} detik yang lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit yang lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam yang lalu`;
  return `${Math.floor(diffHour / 24)} hari yang lalu`;
}
