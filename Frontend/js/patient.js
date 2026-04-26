const BASE_URL = '';
const token = localStorage.getItem('token');
const userName = localStorage.getItem('name');
const currentUserId = localStorage.getItem('userId');

// Redirect if not logged in or wrong role
if (!token || localStorage.getItem('role') !== 'patient') {
  window.location.href = '/login.html';
}

// Set patient name
document.getElementById('patientName').textContent = `Welcome, ${userName}`;

// ─── LOAD DOCTORS ──────────────────────────────────────
const loadDoctors = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/patient/doctors`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const doctors = await res.json();

    const select = document.getElementById('doctorSelect');
    select.innerHTML = '<option value="">Select Doctor</option>';
    doctors.forEach(doc => {
      select.innerHTML += `<option value="${doc._id}">${doc.name}</option>`;
    });
  } catch (error) {
    console.error('Error loading doctors:', error);
  }
};

// ─── LOAD MY APPOINTMENTS ──────────────────────────────
const loadAppointments = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/patient/appointments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const appointments = await res.json();

    const tbody = document.getElementById('historyTable');
    tbody.innerHTML = '';

    if (appointments.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4">No appointments found</td></tr>';
      document.getElementById('patientToken').textContent = '--';
      document.getElementById('myToken').textContent = '--';
      document.getElementById('currentToken').textContent = '--';
      return;
    }

    // Only show token if active appointment exists
    const activeAppointment = appointments.find(
      a => a.status === 'waiting' || a.status === 'in-progress'
    );

    if (activeAppointment) {
      document.getElementById('patientToken').textContent =
        activeAppointment.token;
      document.getElementById('myToken').textContent =
        activeAppointment.token;
      if (activeAppointment.doctorId && activeAppointment.doctorId._id) {
        loadQueueStatus(activeAppointment.doctorId._id);
      }
    } else {
      document.getElementById('patientToken').textContent = '--';
      document.getElementById('myToken').textContent = '--';
      document.getElementById('currentToken').textContent = '--';
    }

    appointments.forEach(app => {
      tbody.innerHTML += `
        <tr>
          <td>${new Date(app.createdAt).toLocaleDateString()}</td>
          <td>${app.doctorId ? app.doctorId.name : '--'}</td>
          <td>${app.token}</td>
          <td>${app.status}</td>
        </tr>
      `;
    });

  } catch (error) {
    console.error('Error loading appointments:', error);
  }
};

// ─── LOAD QUEUE STATUS ─────────────────────────────────
const loadQueueStatus = async (doctorId) => {
  try {
    const res = await fetch(
      `${BASE_URL}/api/patient/queue-status/${doctorId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    document.getElementById('currentToken').textContent = data.currentToken;
  } catch (error) {
    console.error('Error loading queue status:', error);
  }
};

// ─── LOAD MEDICAL HISTORY ──────────────────────────────
const loadMedicalHistory = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/patient/medical-history`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const history = await res.json();

    const tbody = document.getElementById('medicalHistoryTable');
    tbody.innerHTML = '';

    if (history.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5">No medical history found</td></tr>';
      return;
    }

    history.forEach(record => {
      tbody.innerHTML += `
        <tr>
          <td>${new Date(record.createdAt).toLocaleDateString()}</td>
          <td>${record.doctorId ? record.doctorId.name : '--'}</td>
          <td>${record.appointmentId ? record.appointmentId.token : '--'}</td>
          <td>${record.diagnosis}</td>
          <td>${record.prescription}</td>
        </tr>
      `;
    });

  } catch (error) {
    console.error('Error loading medical history:', error);
  }
};

// ─── BOOK APPOINTMENT — WITH VALIDATION ───────────────
const appointmentForm = document.getElementById('appointmentForm');

if (appointmentForm) {

  // Clear red border on change
  document.getElementById('doctorSelect')
    .addEventListener('change', () => {
      document.getElementById('doctorSelect').style.border = 
        '1px solid #ccc';
    });

  document.getElementById('appointmentDate')
    .addEventListener('change', () => {
      document.getElementById('appointmentDate').style.border = 
        '1px solid #ccc';
    });

  document.getElementById('appointmentTime')
    .addEventListener('change', () => {
      document.getElementById('appointmentTime').style.border = 
        '1px solid #ccc';
    });

  appointmentForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const doctorId = document.getElementById('doctorSelect').value;
    const date = document.getElementById('appointmentDate').value;
    const time = document.getElementById('appointmentTime').value;

    // ─── Validate ───────────────────────────────────
    let hasError = false;

    if (!doctorId) {
      document.getElementById('doctorSelect').style.border =
        '1.5px solid #e74c3c';
      hasError = true;
    }

    if (!date) {
      document.getElementById('appointmentDate').style.border =
        '1.5px solid #e74c3c';
      hasError = true;
    }

    if (!time) {
      document.getElementById('appointmentTime').style.border =
        '1.5px solid #e74c3c';
      hasError = true;
    }

    if (hasError) {
      alert('Please fill all fields before booking');
      return;
    }
    // ────────────────────────────────────────────────

    try {
      const res = await fetch(`${BASE_URL}/api/patient/appointment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ doctorId, symptoms: '' })
      });

      const data = await res.json();

      if (res.ok) {
        alert(`Appointment booked! Your token is: ${data.appointment.token}`);
        appointmentForm.reset();
        loadAppointments();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
    }
  });
}

// ─── LOGOUT ────────────────────────────────────────────
const logoutBtn = document.querySelector('.logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/login.html';
  });
}

// ─── SOCKET.IO REAL TIME ───────────────────────────────
const socket = io(BASE_URL);

socket.on('queueUpdated', () => {
  loadAppointments();
});

socket.on('consultationCompleted', (data) => {
  if (data.patientId === currentUserId) {
    loadAppointments();
    loadMedicalHistory();
  }
});

// ─── INIT ──────────────────────────────────────────────
loadDoctors();
loadAppointments();
loadMedicalHistory();