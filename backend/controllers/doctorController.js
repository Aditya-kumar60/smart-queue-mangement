const Appointment = require('../models/Appointment');
const Medical = require('../models/Medical');
const User = require('../models/user');
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
    const currentPatient = await Appointment.findOneAndUpdate(
      { doctorId, status: 'in-progress' },
      { status: 'completed' },
      { new: true }
    );

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

    // Mark appointment completed
    appointment.status = 'completed';
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

module.exports = { getQueue, nextPatient, completeConsultation, getPastConsultations  };