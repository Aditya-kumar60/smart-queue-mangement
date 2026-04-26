const BASE_URL = '';
const token = localStorage.getItem('token');
const userName = localStorage.getItem('name');

// Redirect if not logged in or wrong role
if (!token || localStorage.getItem('role') !== 'doctor') {
  window.location.href = '/login.html';
}

// Set doctor name
document.getElementById('doctorName').textContent = userName || 'Doctor';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
        '<tr><td colspan="5">No patients in queue</td></tr>';
      return;
    }

    data.queue.forEach(p => {
      const slotDisplay = p.timeSlot ? formatTime(p.timeSlot) : '--';
      tbody.innerHTML += `
        <tr>
          <td>${p.token}</td>
          <td>${p.patientName}</td>
          <td>${p.symptoms || '--'}</td>
          <td>${slotDisplay}</td>
          <td><span class="status-badge-doc status-${p.status}">${p.status}</span></td>
        </tr>
      `;
    });

  } catch (error) {
    console.error('Error loading queue:', error);
  }
};

// Format time "09:00" → "9:00 AM"
const formatTime = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
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

// ─── LOAD SCHEDULE ─────────────────────────────────────
const loadSchedule = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/schedule`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const schedule = await res.json();

    const grid = document.getElementById('scheduleGrid');
    grid.innerHTML = '';

    schedule.forEach(s => {
      const dayCard = document.createElement('div');
      dayCard.className = `schedule-day-card ${s.isAvailable ? 'schedule-available' : 'schedule-unavailable'}`;
      dayCard.innerHTML = `
        <div class="schedule-day-header">
          <label class="schedule-toggle">
            <input type="checkbox" class="schedule-checkbox" data-day="${s.dayOfWeek}" ${s.isAvailable ? 'checked' : ''}>
            <span class="schedule-toggle-slider"></span>
          </label>
          <span class="schedule-day-name">${DAY_NAMES[s.dayOfWeek]}</span>
        </div>
        <div class="schedule-day-times">
          <div class="schedule-time-row">
            <label>Start</label>
            <input type="time" class="schedule-time-input" data-day="${s.dayOfWeek}" data-field="start" value="${s.startTime}" ${!s.isAvailable ? 'disabled' : ''}>
          </div>
          <div class="schedule-time-row">
            <label>End</label>
            <input type="time" class="schedule-time-input" data-day="${s.dayOfWeek}" data-field="end" value="${s.endTime}" ${!s.isAvailable ? 'disabled' : ''}>
          </div>
          <div class="schedule-time-row">
            <label>Slot (min)</label>
            <select class="schedule-slot-select" data-day="${s.dayOfWeek}" ${!s.isAvailable ? 'disabled' : ''}>
              <option value="10" ${s.slotDurationMinutes === 10 ? 'selected' : ''}>10</option>
              <option value="15" ${s.slotDurationMinutes === 15 ? 'selected' : ''}>15</option>
              <option value="20" ${s.slotDurationMinutes === 20 ? 'selected' : ''}>20</option>
              <option value="30" ${s.slotDurationMinutes === 30 ? 'selected' : ''}>30</option>
              <option value="45" ${s.slotDurationMinutes === 45 ? 'selected' : ''}>45</option>
              <option value="60" ${s.slotDurationMinutes === 60 ? 'selected' : ''}>60</option>
            </select>
          </div>
        </div>
      `;
      grid.appendChild(dayCard);

      // Toggle enable/disable on checkbox change
      const checkbox = dayCard.querySelector('.schedule-checkbox');
      checkbox.addEventListener('change', () => {
        const times = dayCard.querySelectorAll('.schedule-time-input, .schedule-slot-select');
        times.forEach(t => t.disabled = !checkbox.checked);
        dayCard.className = `schedule-day-card ${checkbox.checked ? 'schedule-available' : 'schedule-unavailable'}`;
      });
    });

  } catch (error) {
    console.error('Error loading schedule:', error);
  }
};

// ─── SAVE SCHEDULE ─────────────────────────────────────
document.getElementById('saveScheduleBtn').addEventListener('click', async () => {
  const scheduleData = [];

  for (let day = 0; day <= 6; day++) {
    const checkbox = document.querySelector(`.schedule-checkbox[data-day="${day}"]`);
    const startInput = document.querySelector(`.schedule-time-input[data-day="${day}"][data-field="start"]`);
    const endInput = document.querySelector(`.schedule-time-input[data-day="${day}"][data-field="end"]`);
    const slotSelect = document.querySelector(`.schedule-slot-select[data-day="${day}"]`);

    if (checkbox && startInput && endInput && slotSelect) {
      scheduleData.push({
        dayOfWeek: day,
        startTime: startInput.value,
        endTime: endInput.value,
        slotDurationMinutes: parseInt(slotSelect.value),
        isAvailable: checkbox.checked
      });
    }
  }

  try {
    const res = await fetch(`${BASE_URL}/api/doctor/schedule`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ schedule: scheduleData })
    });

    const data = await res.json();

    if (res.ok) {
      alert('Schedule updated successfully!');
      loadSchedule();
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error saving schedule:', error);
  }
});

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
loadSchedule();