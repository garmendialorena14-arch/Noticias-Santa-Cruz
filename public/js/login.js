import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

// Si el usuario ya tiene sesión activa, redirigir a index.html
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace('index.html');
  }
});

const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberInput = document.getElementById('remember');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const errorBox = document.getElementById('errorBox');
const errorMessage = document.getElementById('errorMessage');
const togglePasswordBtn = document.getElementById('togglePassword');

// Alternar visibilidad de contraseña
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Ver contraseña');
  });
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorBox.classList.remove('hidden');
}

function clearError() {
  errorMessage.textContent = '';
  errorBox.classList.add('hidden');
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  if (isLoading) {
    btnText.textContent = 'Iniciando sesión…';
    btnSpinner.classList.remove('hidden');
  } else {
    btnText.textContent = 'Iniciar Sesión';
    btnSpinner.classList.add('hidden');
  }
}

function translateFirebaseError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Correo electrónico o contraseña incorrectos.';
    case 'auth/invalid-email':
      return 'El correo electrónico ingresado no tiene un formato válido.';
    case 'auth/user-disabled':
      return 'Esta cuenta de usuario ha sido inhabilitada.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Por seguridad, intente de nuevo más tarde.';
    case 'auth/network-request-failed':
      return 'No se pudo conectar con el servidor. Verifique su conexión a internet.';
    default:
      return 'Ocurrió un error al iniciar sesión. Inténtelo nuevamente.';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError('Por favor complete todos los campos.');
    return;
  }

  setLoading(true);

  try {
    const persistenceMode = rememberInput?.checked
      ? browserLocalPersistence
      : browserSessionPersistence;
    await setPersistence(auth, persistenceMode);

    await signInWithEmailAndPassword(auth, email, password);
    // Redirige al panel principal
    window.location.replace('index.html');
  } catch (err) {
    console.error('Error de autenticación:', err);
    showError(translateFirebaseError(err.code));
    setLoading(false);
  }
});
