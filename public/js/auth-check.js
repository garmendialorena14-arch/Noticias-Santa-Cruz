import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

// Oculta el contenido inmediatamente mientras se valida la sesión para evitar parpadeos (FOUC)
document.documentElement.style.visibility = 'hidden';

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Si no hay usuario autenticado, redirigir inmediatamente a login.html
    window.location.replace('login.html');
    return;
  }

  // Usuario autenticado con éxito: restaurar la visibilidad de la página
  document.documentElement.style.visibility = '';
  const cloak = document.getElementById('auth-cloak');
  if (cloak) cloak.remove();

  // Guardar referencia global por si otros scripts la necesitan
  window.currentUser = user;

  // Si existe un elemento para mostrar el email del usuario en la barra
  const userEmailEl = document.getElementById('currentUserEmail');
  if (userEmailEl) {
    userEmailEl.textContent = user.email || 'Usuario';
  }

  // Vincular botón de cerrar sesión si existe en la interfaz
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = 'true';
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await signOut(auth);
        window.location.replace('login.html');
      } catch (err) {
        console.error('Error al cerrar sesión:', err);
      }
    });
  }
});
