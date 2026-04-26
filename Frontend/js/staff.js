const BASE_URL = '';
const token = localStorage.getItem('token');
const userName = localStorage.getItem('name');

// Redirect if not logged in or wrong role
if (!token || localStorage.getItem('role') !== 'staff') {
  window.location.href = '/login.html';
}

// Set staff name
document.getElementById('staffName').textContent = userName || 'Staff';

// ─── LOAD STATS ────────────────────────────────────────
const loadStats = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/staff/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    document.getElementById('totalAppointments').textContent =
      data.totalAppointments || 0;
    document.getElementById('patientsWaiting').textContent =
      data.patientsWaiting || 0;
    document.getElementById('doctorsAvailable').textContent =
      data.doctorsAvailable || 0;

  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

// ─── LOAD DOCTORS ──────────────────────────────────────
const loadDoctors = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/staff/doctors`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const doctors = await res.json();

    const select = document.getElementById('doctorSelect');
    select.innerHTML = '<option value="">Select Doctor</option>';
    doctors.forEach(doc => {
      select.innerHTML += 
        `<option value="${doc._id}">${doc.name}</option>`;
    });

  } catch (error) {
    console.error('Error loading doctors:', error);
  }
};

// ─── LOAD APPOINTMENTS ─────────────────────────────────
const loadAppointments = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/staff/appointments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const appointments = await res.json();

    const tbody = document.getElementById('appointmentsTable');
    tbody.innerHTML = '';

    if (appointments.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5">No appointments found</td></tr>';
      return;
    }

    appointments.forEach(a => {
      // Status badge color
      let statusColor = '#f39c12'; // waiting = orange
      if (a.status === 'in-progress') statusColor = '#2c6ed5'; // blue
      if (a.status === 'completed') statusColor = '#27ae60';   // green

      tbody.innerHTML += `
        <tr>
          <td>${a.token}</td>
          <td>${a.patientName}</td>
          <td>${a.doctorId ? a.doctorId.name : '--'}</td>
          <td>
            <span style="
              background:${statusColor};
              color:white;
              padding:4px 10px;
              border-radius:12px;
              font-size:12px;
              font-weight:600;
            ">${a.status}</span>
          </td>
          <td>
            ${a.status !== 'completed' ? 
              `<button class="cancelBtn" 
                onclick="cancelAppointment('${a._id}')">
                Cancel
              </button>` 
              : '--'
            }
          </td>
        </tr>
      `;
    });

  } catch (error) {
    console.error('Error loading appointments:', error);
  }
};

// ─── ADD WALK-IN PATIENT ───────────────────────────────
document.getElementById('walkinForm').addEventListener('submit', 
  async (e) => {
    e.preventDefault();

    const patientName = 
      document.getElementById('patientName').value.trim();
    const symptoms = 
      document.getElementById('symptoms').value.trim();
    const doctorId = 
      document.getElementById('doctorSelect').value;

    if (!patientName) {
      alert('Please enter patient name');
      return;
    }
    if (!doctorId) {
      alert('Please select a doctor');
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/staff/walkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ patientName, symptoms, doctorId })
      });

      const data = await res.json();

      if (res.ok) {
        alert(`Walk-in patient added!\nToken: ${data.appointment.token}\nDoctor: ${data.appointment.doctorId.name}`);
        document.getElementById('walkinForm').reset();
        loadAppointments();
        loadStats();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error adding walk-in:', error);
    }
  }
);

// ─── CANCEL APPOINTMENT ────────────────────────────────
const cancelAppointment = async (id) => {
  if (!confirm('Are you sure you want to cancel this appointment?')) 
    return;

  try {
    const res = await fetch(
      `${BASE_URL}/api/staff/appointments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    if (res.ok) {
      alert('Appointment cancelled successfully');
      loadAppointments();
      loadStats();
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error cancelling:', error);
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
  loadAppointments();
  loadStats();
});

// ─── INIT ──────────────────────────────────────────────
loadStats();
loadDoctors();
loadAppointments();