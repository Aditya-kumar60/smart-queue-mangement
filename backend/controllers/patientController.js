const User = require('../models/user');
const Appointment = require('../models/Appointment');
const Medical = require('../models/Medical');
const DoctorSchedule = require('../models/DoctorSchedule');
const { sendAppointmentBookedEmail } = require('../utils/emailService');

// GET all doctors list
const getDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' }).select('-password');
    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST book appointment
const bookAppointment = async (req, res) => {
  try {
    const { doctorId, symptoms, appointmentDate, timeSlot } = req.body;
    const patientId = req.user.id;

    if (!doctorId) {
      return res.status(400).json({ message: 'Please select a doctor' });
    }

    // Check if patient already has active appointment with THIS doctor
    const existing = await Appointment.findOne({
      patientId,
      doctorId,
      status: { $in: ['waiting', 'in-progress'] }
    });

    if (existing) {
      return res.status(400).json({
        message: `You already have an active appointment with this doctor. Your token is ${existing.token}`
      });
    }

    // Get patient name
    const patient = await User.findById(patientId);

    // Check if there are any active appointments for this doctor
    const activeAppointments = await Appointment.find({
      doctorId: doctorId,
      status: { $in: ['waiting', 'in-progress'] }
    });

    let token;

    if (activeAppointments.length === 0) {
      // No active queue → start fresh from 1
      token = 1;
    } else {
      // Queue exists → get highest token and add 1
      const lastAppointment = await Appointment.findOne({
        doctorId: doctorId,
        status: { $in: ['waiting', 'in-progress'] }
      }).sort({ token: -1 });
      token = lastAppointment.token + 1;
    }

    // Create appointment with date and time slot
    const appointment = await Appointment.create({
      patientId,
      patientName: patient.name,
      doctorId,
      symptoms: symptoms || '',
      token,
      status: 'waiting',
      appointmentDate: appointmentDate || null,
      timeSlot: timeSlot || null
    });

    // Notify doctor via email (non-blocking)
    const doctor = await User.findById(doctorId);
    if (doctor) {
      sendAppointmentBookedEmail(doctor.email, doctor.name, patient.name, token, symptoms || '');
    }

    // Emit socket event
    const io = req.app.get('io');
    io.emit('queueUpdated', { doctorId });

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment
    });

  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

// GET my appointments
const getMyAppointments = async (req, res) => {
  try {
    const patientId = req.user.id;

    const appointments = await Appointment.find({ patientId })
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET current queue status for a doctor
const getQueueStatus = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const current = await Appointment.findOne({
      doctorId,
      status: 'in-progress'
    });

    res.status(200).json({
      currentToken: current ? current.token : '--'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET patient medical history
const getMedicalHistory = async (req, res) => {
  try {
    const patientId = req.user.id;

    const history = await Medical.find({ patientId })
      .populate('doctorId', 'name')
      .populate('appointmentId', 'token')
      .sort({ createdAt: -1 });

    res.status(200).json(history);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GET ESTIMATED WAIT TIME ──────────────────────────────
const getEstimatedWaitTime = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const patientId = req.user.id;

    // 1. Get average consultation duration from last 20 completed appointments
    const completedAppointments = await Appointment.find({
      doctorId,
      status: 'completed',
      startedAt: { $ne: null },
      completedAt: { $ne: null }
    })
    .sort({ completedAt: -1 })
    .limit(20);

    let avgConsultationMinutes = 10; // default 10 min if no data

    if (completedAppointments.length > 0) {
      const totalMinutes = completedAppointments.reduce((sum, apt) => {
        const duration = (new Date(apt.completedAt) - new Date(apt.startedAt)) / 60000;
        return sum + Math.max(duration, 1); // minimum 1 min
      }, 0);
      avgConsultationMinutes = Math.round(totalMinutes / completedAppointments.length);
    }

    // 2. Find THIS patient's active appointment to get their token
    const myAppointment = await Appointment.findOne({
      patientId,
      doctorId,
      status: { $in: ['waiting', 'in-progress'] }
    });

    const myToken = myAppointment ? myAppointment.token : Infinity;

    // 3. Count patients ahead — only those with a LOWER token AND still waiting/in-progress
    const patientsAhead = await Appointment.countDocuments({
      doctorId,
      token: { $lt: myToken },
      status: { $in: ['waiting', 'in-progress'] }
    });

    // 4. Check if someone is currently in-progress
    const inProgress = await Appointment.findOne({
      doctorId,
      status: 'in-progress'
    });

    let currentWaitMinutes = 0;
    if (inProgress && inProgress.startedAt) {
      // Time already spent on current patient
      const elapsed = (new Date() - new Date(inProgress.startedAt)) / 60000;
      const remaining = Math.max(avgConsultationMinutes - elapsed, 0);
      currentWaitMinutes = Math.round(remaining);
    }

    // 5. Calculate total estimated wait
    const estimatedMinutes = currentWaitMinutes + (patientsAhead * avgConsultationMinutes);

    res.status(200).json({
      estimatedMinutes,
      patientsAhead,
      avgConsultationMinutes,
      dataPoints: completedAppointments.length
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GET AVAILABLE SLOTS ──────────────────────────────────
const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.params; // date = "2026-04-27"

    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay(); // 0-6

    // 1. Get doctor's schedule for this day
    const schedule = await DoctorSchedule.findOne({
      doctorId,
      dayOfWeek,
      isAvailable: true
    });

    if (!schedule) {
      return res.status(200).json({
        available: false,
        message: 'Doctor is not available on this day',
        slots: []
      });
    }

    // 2. Generate all possible slots
    const slots = [];
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const duration = schedule.slotDurationMinutes;

    for (let t = startMinutes; t + duration <= endMinutes; t += duration) {
      const h = Math.floor(t / 60).toString().padStart(2, '0');
      const m = (t % 60).toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }

    // 3. Get already booked slots for this doctor on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await Appointment.find({
      doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['waiting', 'in-progress'] }
    });

    const bookedSlots = bookedAppointments
      .map(a => a.timeSlot)
      .filter(Boolean);

    // 4. Filter out booked slots
    const availableSlots = slots.filter(s => !bookedSlots.includes(s));

    res.status(200).json({
      available: true,
      slots: availableSlots,
      bookedSlots,
      totalSlots: slots.length,
      schedule: {
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        slotDuration: schedule.slotDurationMinutes
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getDoctors,
  bookAppointment,
  getMyAppointments,
  getQueueStatus,
  getMedicalHistory,
  getEstimatedWaitTime,
  getAvailableSlots
};