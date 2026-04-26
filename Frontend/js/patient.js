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

// ─── LOAD AVAILABLE SLOTS ─────────────────────────────
const loadAvailableSlots = async (doctorId, date) => {
  const container = document.getElementById('slotPickerContainer');
  const grid = document.getElementById('slotGrid');
  const noSlotsMsg = document.getElementById('noSlotsMsg');
  const hiddenInput = document.getElementById('selectedTimeSlot');

  // Reset
  grid.innerHTML = '';
  hiddenInput.value = '';
  noSlotsMsg.style.display = 'none';

  if (!doctorId || !date) {
    container.style.display = 'none';
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/patient/available-slots/${doctorId}/${date}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    container.style.display = 'block';

    if (!data.available || data.slots.length === 0) {
      noSlotsMsg.style.display = 'block';
      noSlotsMsg.textContent = data.message || 'No available slots for this date';
      return;
    }

    data.slots.forEach(slot => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn';
      btn.textContent = formatTime(slot);
      btn.dataset.slot = slot;

      btn.addEventListener('click', () => {
        // Remove active from all
        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('slot-active'));
        btn.classList.add('slot-active');
        hiddenInput.value = slot;
      });

      grid.appendChild(btn);
    });

  } catch (error) {
    console.error('Error loading slots:', error);
    container.style.display = 'none';
  }
};

// Format time "09:00" → "9:00 AM"
const formatTime = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
};

// Listen for doctor + date changes to load slots
document.getElementById('doctorSelect').addEventListener('change', () => {
  const doctorId = document.getElementById('doctorSelect').value;
  const date = document.getElementById('appointmentDate').value;
  if (doctorId && date) loadAvailableSlots(doctorId, date);
});

document.getElementById('appointmentDate').addEventListener('change', () => {
  const doctorId = document.getElementById('doctorSelect').value;
  const date = document.getElementById('appointmentDate').value;
  if (doctorId && date) loadAvailableSlots(doctorId, date);
});

// Set min date to today
document.getElementById('appointmentDate').min = new Date().toISOString().split('T')[0];

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
        '<tr><td colspan="5">No appointments found</td></tr>';
      document.getElementById('patientToken').textContent = '--';
      document.getElementById('myToken').textContent = '--';
      document.getElementById('currentToken').textContent = '--';
      document.getElementById('estimatedWait').textContent = '--';
      document.getElementById('patientsAhead').textContent = '--';
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
        loadEstimatedWait(activeAppointment.doctorId._id);
      }
    } else {
      document.getElementById('patientToken').textContent = '--';
      document.getElementById('myToken').textContent = '--';
      document.getElementById('currentToken').textContent = '--';
      document.getElementById('estimatedWait').textContent = '--';
      document.getElementById('patientsAhead').textContent = '--';
    }

    appointments.forEach(app => {
      const slotDisplay = app.timeSlot ? formatTime(app.timeSlot) : '--';
      tbody.innerHTML += `
        <tr>
          <td>${new Date(app.createdAt).toLocaleDateString()}</td>
          <td>${app.doctorId ? app.doctorId.name : '--'}</td>
          <td>${app.token}</td>
          <td>${slotDisplay}</td>
          <td><span class="status-badge status-${app.status}">${app.status}</span></td>
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

// ─── LOAD ESTIMATED WAIT TIME ─────────────────────────
const loadEstimatedWait = async (doctorId) => {
  try {
    const res = await fetch(
      `${BASE_URL}/api/patient/wait-time/${doctorId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();

    const waitEl = document.getElementById('estimatedWait');
    const aheadEl = document.getElementById('patientsAhead');

    if (data.estimatedMinutes === 0) {
      waitEl.textContent = 'Your turn!';
      waitEl.style.color = '#27ae60';
    } else if (data.estimatedMinutes < 60) {
      waitEl.textContent = `~${data.estimatedMinutes} min`;
    } else {
      const hrs = Math.floor(data.estimatedMinutes / 60);
      const mins = data.estimatedMinutes % 60;
      waitEl.textContent = `~${hrs}h ${mins}m`;
    }

    aheadEl.textContent = data.patientsAhead;

  } catch (error) {
    console.error('Error loading wait time:', error);
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
  appointmentForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const doctorId = document.getElementById('doctorSelect').value;
    const date = document.getElementById('appointmentDate').value;
    const timeSlot = document.getElementById('selectedTimeSlot').value;
    const symptoms = document.getElementById('symptomsInput').value.trim();

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

    if (!timeSlot) {
      alert('Please select a time slot');
      hasError = true;
    }

    if (hasError) {
      if (!timeSlot) return;
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
        body: JSON.stringify({ 
          doctorId, 
          symptoms,
          appointmentDate: date,
          timeSlot
        })
      });

      const data = await res.json();

      if (res.ok) {
        alert(`Appointment booked! Your token is: ${data.appointment.token}\nTime Slot: ${formatTime(timeSlot)}`);
        appointmentForm.reset();
        document.getElementById('slotPickerContainer').style.display = 'none';
        document.getElementById('selectedTimeSlot').value = '';
        loadAppointments();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
    }
  });
}

// Clear red borders on change
document.getElementById('doctorSelect').addEventListener('change', () => {
  document.getElementById('doctorSelect').style.border = '1px solid #ccc';
});
document.getElementById('appointmentDate').addEventListener('change', () => {
  document.getElementById('appointmentDate').style.border = '1px solid #ccc';
});

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