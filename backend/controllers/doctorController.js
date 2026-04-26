const Appointment = require('../models/Appointment');
const Medical = require('../models/Medical');
const User = require('../models/user');
const DoctorSchedule = require('../models/DoctorSchedule');
const { sendTokenCalledEmail, sendConsultationCompletedEmail } = require('../utils/emailService');

// GET doctor queue
const getQueue = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const queue = await Appointment.find({
      doctorId,
      status: { $in: ['waiting', 'in-progress'] }
    }).sort({ token: 1 });

    const current = queue.find(a => a.status === 'in-progress');
    const waiting = queue.filter(a => a.status === 'waiting');

    res.status(200).json({
      currentToken: current ? current.token : '--',
      waitingCount: waiting.length,
      queue
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST next patient
const nextPatient = async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Complete current in-progress if any
    const currentPatient = await Appointment.findOne({ doctorId, status: 'in-progress' });
    if (currentPatient) {
      currentPatient.status = 'completed';
      currentPatient.completedAt = new Date();
      await currentPatient.save();
    }

    // Get next waiting patient
    const next = await Appointment.findOne({
      doctorId,
      status: 'waiting'
    }).sort({ token: 1 });

    if (!next) {
      // Emit update so patients see queue is empty
      const io = req.app.get('io');
      io.emit('queueUpdated', { doctorId });

      return res.status(200).json({
        message: 'No more patients in queue',
        currentToken: '--'
      });
    }

    next.status = 'in-progress';
    next.startedAt = new Date();
    await next.save();

    // Send email to patient that their token is called (non-blocking)
    const patient = await User.findById(next.patientId);
    const doctor = await User.findById(doctorId);
    if (patient && doctor) {
      sendTokenCalledEmail(patient.email, patient.name, next.token, doctor.name);
    }

    // Emit real-time update to ALL clients
    const io = req.app.get('io');
    io.emit('queueUpdated', { doctorId });

    res.status(200).json({
      message: 'Next patient called',
      currentToken: next.token,
      patient: next
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST complete consultation
const completeConsultation = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { diagnosis, prescription } = req.body;

    if (!diagnosis || !prescription) {
      return res.status(400).json({
        message: 'Diagnosis and prescription are required'
      });
    }

    // Find current in-progress appointment
    const appointment = await Appointment.findOne({
      doctorId,
      status: 'in-progress'
    });

    if (!appointment) {
      return res.status(404).json({
        message: 'No active consultation found. Click Next Patient first.'
      });
    }

    // Mark appointment completed with timestamp
    appointment.status = 'completed';
    appointment.completedAt = new Date();
    await appointment.save();

    // Save medical record
    await Medical.create({
      patientId: appointment.patientId,
      doctorId,
      appointmentId: appointment._id,
      diagnosis,
      prescription
    });

    // Emit to ALL clients — patient gets medical history update
    const io = req.app.get('io');
    io.emit('consultationCompleted', {
      patientId: appointment.patientId.toString(),
      doctorId: doctorId.toString()
    });
    io.emit('queueUpdated', { doctorId });

    // Send consultation report email to patient (non-blocking)
    const patientUser = await User.findById(appointment.patientId);
    const doctorUser = await User.findById(doctorId);
    if (patientUser && doctorUser) {
      sendConsultationCompletedEmail(
        patientUser.email,
        patientUser.name,
        doctorUser.name,
        diagnosis,
        prescription,
        appointment.token
      );
    }

    res.status(200).json({ message: 'Consultation completed successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET doctor past consultations
const getPastConsultations = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const consultations = await Medical.find({ doctorId })
      .populate('patientId', 'name')
      .populate('appointmentId', 'token')
      .sort({ createdAt: -1 });

    res.status(200).json(consultations);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GET DOCTOR SCHEDULE ──────────────────────────────────
const getSchedule = async (req, res) => {
  try {
    const doctorId = req.user.id;

    let schedule = await DoctorSchedule.find({ doctorId }).sort({ dayOfWeek: 1 });

    // If no schedule exists, create a default one (Mon-Sat, 09:00-17:00)
    if (schedule.length === 0) {
      const defaults = [];
      for (let day = 0; day <= 6; day++) {
        defaults.push({
          doctorId,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          slotDurationMinutes: 15,
          isAvailable: day >= 1 && day <= 6 // Mon-Sat available, Sun off
        });
      }
      schedule = await DoctorSchedule.insertMany(defaults);
    }

    res.status(200).json(schedule);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── UPDATE DOCTOR SCHEDULE ───────────────────────────────
const updateSchedule = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { schedule } = req.body; // array of { dayOfWeek, startTime, endTime, slotDurationMinutes, isAvailable }

    if (!schedule || !Array.isArray(schedule)) {
      return res.status(400).json({ message: 'Schedule array is required' });
    }

    const operations = schedule.map(s => ({
      updateOne: {
        filter: { doctorId, dayOfWeek: s.dayOfWeek },
        update: {
          $set: {
            startTime: s.startTime,
            endTime: s.endTime,
            slotDurationMinutes: s.slotDurationMinutes || 15,
            isAvailable: s.isAvailable
          }
        },
        upsert: true
      }
    }));

    await DoctorSchedule.bulkWrite(operations);

    const updated = await DoctorSchedule.find({ doctorId }).sort({ dayOfWeek: 1 });
    res.status(200).json({ message: 'Schedule updated successfully', schedule: updated });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getQueue, nextPatient, completeConsultation, getPastConsultations, getSchedule, updateSchedule };