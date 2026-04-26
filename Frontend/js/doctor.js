const BASE_URL = '';
const token = localStorage.getItem('token');
const userName = localStorage.getItem('name');

// Redirect if not logged in or wrong role
if (!token || localStorage.getItem('role') !== 'doctor') {
  window.location.href = '/login.html';
}

// Set doctor name
document.getElementById('doctorName').textContent = userName || 'Doctor';

// ─── LOAD QUEUE ────────────────────────────────────────
const loadQueue = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/queue`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    document.getElementById('currentToken').textContent = 
      data.currentToken || '--';
    document.getElementById('waitingCount').textContent = 
      data.waitingCount || 0;

    const tbody = document.getElementById('queueBody');
    tbody.innerHTML = '';

    if (!data.queue || data.queue.length === 0) {
      tbody.innerHTML = 
        '<tr><td colspan="4">No patients in queue</td></tr>';
      return;
    }

    data.queue.forEach(p => {
      tbody.innerHTML += `
        <tr>
          <td>${p.token}</td>
          <td>${p.patientName}</td>
          <td>${p.symptoms || '--'}</td>
          <td>${p.status}</td>
        </tr>
      `;
    });

  } catch (error) {
    console.error('Error loading queue:', error);
  }
};

// ─── NEXT PATIENT ──────────────────────────────────────
document.getElementById('nextBtn').addEventListener('click', async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/next`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok) {
      if (data.currentToken === '--') {
        alert('No more patients in queue');
      } else {
        alert(`Now serving token: ${data.currentToken}`);
      }
      loadQueue();
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

// ─── COMPLETE CONSULTATION ─────────────────────────────
document.getElementById('completeBtn').addEventListener('click', async () => {
  const diagnosis = document.getElementById('diagnosis').value.trim();
  const prescription = document.getElementById('prescription').value.trim();

  if (!diagnosis || !prescription) {
    alert('Please enter both diagnosis and prescription');
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/doctor/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ diagnosis, prescription })
    });

    const data = await res.json();

    if (res.ok) {
      alert('Consultation completed successfully!');
      document.getElementById('diagnosis').value = '';
      document.getElementById('prescription').value = '';
      loadQueue();
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

// ─── LOAD PAST CONSULTATIONS ───────────────────────────
const loadPastConsultations = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/consultations`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const consultations = await res.json();

    const tbody = document.getElementById('consultationsTable');
    tbody.innerHTML = '';

    if (consultations.length === 0) {
      tbody.innerHTML = 
        '<tr><td colspan="5">No past consultations found</td></tr>';
      return;
    }

    consultations.forEach(c => {
      tbody.innerHTML += `
        <tr>
          <td>${new Date(c.createdAt).toLocaleDateString()}</td>
          <td>${c.patientId ? c.patientId.name : '--'}</td>
          <td>${c.appointmentId ? c.appointmentId.token : '--'}</td>
          <td>${c.diagnosis}</td>
          <td>${c.prescription}</td>
        </tr>
      `;
    });

  } catch (error) {
    console.error('Error loading consultations:', error);
  }
};

// ─── LOGOUT ────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/login.html';
});

// ─── SOCKET.IO REAL TIME ───────────────────────────────
const socket = io(BASE_URL);
socket.on('queueUpdated', () => {
  loadQueue();
  loadPastConsultations(); 
});

// ─── INIT ──────────────────────────────────────────────
loadQueue();
loadPastConsultations(); 