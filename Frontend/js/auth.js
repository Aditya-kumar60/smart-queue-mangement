const BASE_URL = '';

// ─── HELPERS ───────────────────────────────────────────
const showError = (inputId, message) => {
  const input = document.getElementById(inputId);
  input.style.border = '1.5px solid #e74c3c';

  // Remove existing error if any
  const existing = document.getElementById(`${inputId}-error`);
  if (existing) existing.remove();

  const error = document.createElement('small');
  error.id = `${inputId}-error`;
  error.style.color = '#e74c3c';
  error.style.fontSize = '12px';
  error.style.marginTop = '4px';
  error.style.display = 'block';
  error.textContent = message;
  input.parentNode.appendChild(error);
};

const clearError = (inputId) => {
  const input = document.getElementById(inputId);
  input.style.border = '1px solid #ccc';
  const existing = document.getElementById(`${inputId}-error`);
  if (existing) existing.remove();
};

const clearAllErrors = () => {
  document.querySelectorAll('small[id$="-error"]').forEach(e => e.remove());
  document.querySelectorAll('input, select').forEach(el => {
    el.style.border = '1px solid #ccc';
  });
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// ─── REGISTER ──────────────────────────────────────────
const registerForm = document.getElementById('registerForm');

if (registerForm) {

  // Clear errors on input
  ['name', 'email', 'password', 'role'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => clearError(id));
  });

  registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAllErrors();

    const name     = document.getElementById('name').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const role     = document.getElementById('role').value;

    // ─── Validate ───────────────────────────────────
    let hasError = false;

    if (!name) {
      showError('name', 'Name is required');
      hasError = true;
    } else if (name.length < 3) {
      showError('name', 'Name must be at least 3 characters');
      hasError = true;
    }

    if (!email) {
      showError('email', 'Email is required');
      hasError = true;
    } else if (!isValidEmail(email)) {
      showError('email', 'Please enter a valid email');
      hasError = true;
    }

    if (!password) {
      showError('password', 'Password is required');
      hasError = true;
    } else if (password.length < 6) {
      showError('password', 'Password must be at least 6 characters');
      hasError = true;
    }

    if (!role) {
      showError('role', 'Please select a role');
      hasError = true;
    }

    if (hasError) return;
    // ────────────────────────────────────────────────

    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Registration successful! You should login now.');
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 2000);
      } else {
        alert(data.message);
      }

    } catch (error) {
      alert('Cannot connect to server. Make sure backend is running.');
      console.error(error);
    }
  });
}

// ─── LOGIN ─────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');

if (loginForm) {

  // Clear errors on input
  ['loginEmail', 'loginPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => clearError(id));
  });

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAllErrors();

    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    // ─── Validate ───────────────────────────────────
    let hasError = false;

    if (!email) {
      showError('loginEmail', 'Email is required');
      hasError = true;
    } else if (!isValidEmail(email)) {
      showError('loginEmail', 'Please enter a valid email');
      hasError = true;
    }

    if (!password) {
      showError('loginPassword', 'Password is required');
      hasError = true;
    } else if (password.length < 6) {
      showError('loginPassword', 'Password must be at least 6 characters');
      hasError = true;
    }

    if (hasError) return;
    // ────────────────────────────────────────────────

    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.clear();
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.user.role);
        localStorage.setItem('name', data.user.name);
        localStorage.setItem('userId', data.user.id);
        redirectToDashboard(data.user.role);
      } else {
        alert(data.message);
      }

    } catch (error) {
      alert('Cannot connect to server. Make sure backend is running.');
      console.error(error);
    }
  });
}

// ─── REDIRECT HELPER ───────────────────────────────────
function redirectToDashboard(role) {
  if (role === 'patient') {
    window.location.href = '/dashboards/patient.html';
  } else if (role === 'doctor') {
    window.location.href = '/dashboards/doctor.html';
  } else if (role === 'staff') {
    window.location.href = '/dashboards/staff.html';
  }
}

// ─── GOOGLE CALLBACK — LOGIN (called by Google's rendered button) ───
async function handleGoogleCredentialResponse(response) {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.clear();
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.user.role);
      localStorage.setItem('name', data.user.name);
      localStorage.setItem('userId', data.user.id);
      redirectToDashboard(data.user.role);
    } else {
      alert(data.message || 'Google login failed');
    }
  } catch (error) {
    alert('Cannot connect to server. Make sure backend is running.');
    console.error(error);
  }
}

// ─── GOOGLE CALLBACK — REGISTER (called by Google's rendered button) ───
async function handleGoogleRegisterResponse(response) {
  try {
    // Get selected role from dropdown
    const roleSelect = document.getElementById('role');
    const role = roleSelect ? roleSelect.value : 'patient';

    if (!role) {
      alert('Please select a role before signing up with Google.');
      return;
    }

    const res = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential, role: role })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.clear();
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.user.role);
      localStorage.setItem('name', data.user.name);
      localStorage.setItem('userId', data.user.id);
      alert('Google sign-up successful!');
      redirectToDashboard(data.user.role);
    } else {
      alert(data.message || 'Google sign-up failed');
    }
  } catch (error) {
    alert('Cannot connect to server. Make sure backend is running.');
    console.error(error);
  }
}