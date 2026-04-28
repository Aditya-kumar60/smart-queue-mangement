const BASE_URL = '';
const token = localStorage.getItem('token');
const userName = localStorage.getItem('name');

// Redirect if not logged in or wrong role
if (!token || localStorage.getItem('role') !== 'staff') {
  window.location.href = '/login.html';
}

// Set staff name
document.getElementById('staffName').textContent = userName || 'Staff';

// Chart instances (to destroy before re-creating)
let chartInstances = {};

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
        '<tr><td colspan="6">No appointments found</td></tr>';
      return;
    }

    appointments.forEach(a => {
      // Status badge color
      let statusColor = '#f39c12'; // waiting = orange
      if (a.status === 'in-progress') statusColor = '#2c6ed5'; // blue
      if (a.status === 'completed') statusColor = '#27ae60';   // green

      const slotDisplay = a.timeSlot ? formatTime(a.timeSlot) : '--';

      tbody.innerHTML += `
        <tr>
          <td>${a.token}</td>
          <td>${a.patientName}</td>
          <td>${a.doctorId ? a.doctorId.name : '--'}</td>
          <td>${slotDisplay}</td>
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

// Format time "09:00" → "9:00 AM"
const formatTime = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
};

// ─── LOAD ANALYTICS ───────────────────────────────────
const loadAnalytics = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/staff/analytics`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    // Update summary cards
    document.getElementById('analyticsToday').textContent = data.summary.totalToday;
    document.getElementById('analyticsCompleted').textContent = data.summary.totalCompleted;
    document.getElementById('analyticsActive').textContent = data.summary.totalActive;

    // Destroy existing charts
    Object.values(chartInstances).forEach(c => c.destroy());
    chartInstances = {};

    // Chart colors
    const gradientBlue = 'rgba(79, 172, 254, 0.8)';
    const gradientGreen = 'rgba(67, 233, 123, 0.8)';
    const gradientPink = 'rgba(250, 112, 154, 0.8)';
    const gradientPurple = 'rgba(102, 126, 234, 0.8)';

    // 1. Patients Per Day (Bar Chart)
    chartInstances.perDay = new Chart(
      document.getElementById('patientsPerDayChart'),
      {
        type: 'bar',
        data: {
          labels: data.patientsPerDay.labels,
          datasets: [{
            label: 'Patients',
            data: data.patientsPerDay.data,
            backgroundColor: [
              'rgba(79, 172, 254, 0.7)',
              'rgba(67, 233, 123, 0.7)',
              'rgba(250, 112, 154, 0.7)',
              'rgba(102, 126, 234, 0.7)',
              'rgba(254, 225, 64, 0.7)',
              'rgba(0, 242, 254, 0.7)',
              'rgba(248, 80, 50, 0.7)'
            ],
            borderColor: [
              'rgba(79, 172, 254, 1)',
              'rgba(67, 233, 123, 1)',
              'rgba(250, 112, 154, 1)',
              'rgba(102, 126, 234, 1)',
              'rgba(254, 225, 64, 1)',
              'rgba(0, 242, 254, 1)',
              'rgba(248, 80, 50, 1)'
            ],
            borderWidth: 2,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      }
    );

    // 2. Peak Hours (Bar Chart)
    const peakData = data.peakHours.data;
    const maxPeak = Math.max(...peakData);
    const peakColors = peakData.map(v => {
      const intensity = maxPeak > 0 ? v / maxPeak : 0;
      return `rgba(250, 112, 154, ${0.3 + intensity * 0.7})`;
    });

    chartInstances.peakHours = new Chart(
      document.getElementById('peakHoursChart'),
      {
        type: 'bar',
        data: {
          labels: data.peakHours.labels,
          datasets: [{
            label: 'Appointments',
            data: peakData,
            backgroundColor: peakColors,
            borderColor: gradientPink,
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } },
            x: { ticks: { maxRotation: 45, font: { size: 10 } } }
          }
        }
      }
    );

    // 3. Doctor Load (Doughnut Chart)
    const doughnutColors = [
      'rgba(79, 172, 254, 0.85)',
      'rgba(67, 233, 123, 0.85)',
      'rgba(250, 112, 154, 0.85)',
      'rgba(102, 126, 234, 0.85)',
      'rgba(254, 225, 64, 0.85)',
      'rgba(0, 242, 254, 0.85)',
      'rgba(248, 80, 50, 0.85)',
      'rgba(118, 75, 162, 0.85)'
    ];

    chartInstances.doctorLoad = new Chart(
      document.getElementById('doctorLoadChart'),
      {
        type: 'doughnut',
        data: {
          labels: data.doctorLoad.labels,
          datasets: [{
            data: data.doctorLoad.data,
            backgroundColor: doughnutColors.slice(0, data.doctorLoad.labels.length),
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 15, font: { size: 12 } }
            }
          }
        }
      }
    );

    // 4. Avg Consultation Time (Horizontal Bar)
    chartInstances.avgConsultation = new Chart(
      document.getElementById('avgConsultationChart'),
      {
        type: 'bar',
        data: {
          labels: data.avgConsultationTime.labels,
          datasets: [{
            label: 'Avg Minutes',
            data: data.avgConsultationTime.data,
            backgroundColor: gradientPurple,
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 2,
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, title: { display: true, text: 'Minutes' } }
          }
        }
      }
    );

  } catch (error) {
    console.error('Error loading analytics:', error);
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
        loadAnalytics();
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
  const isConfirmed = await window.showConfirm('Are you sure you want to cancel this appointment?');
  if (!isConfirmed) return;

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
      loadAnalytics();
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
  loadAnalytics();
});

// ─── INIT ──────────────────────────────────────────────
loadStats();
loadDoctors();
loadAppointments();
loadAnalytics();