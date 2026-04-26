const User = require('../models/user');
const Appointment = require('../models/Appointment');
const bcrypt = require('bcryptjs');
const { sendWalkinBookedEmail, sendAppointmentCancelledEmail } = require('../utils/emailService');

// GET all doctors
const getDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' }).select('-password');
    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET all appointments
const getAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST add walk-in patient
const addWalkin = async (req, res) => {
  try {
    const { patientName, symptoms, doctorId } = req.body;

    if (!patientName || !doctorId) {
      return res.status(400).json({
        message: 'Patient name and doctor are required'
      });
    }

    // Check active appointments for this doctor
    const activeAppointments = await Appointment.find({
      doctorId,
      status: { $in: ['waiting', 'in-progress'] }
    });

    let token;
    if (activeAppointments.length === 0) {
      token = 1;
    } else {
      const last = await Appointment.findOne({
        doctorId,
        status: { $in: ['waiting', 'in-progress'] }
      }).sort({ token: -1 });
      token = last.token + 1;
    }

    // ─── Find or create walk-in patient ───────────────
    let walkinPatient = await User.findOne({
      name: patientName,
      role: 'patient'
    });

    if (!walkinPatient) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('walkin123', salt);

      walkinPatient = await User.create({
        name: patientName,
        email: `walkin_${Date.now()}@smartqueue.com`,
        password: hashedPassword,
        role: 'patient'
      });
    }
    // ──────────────────────────────────────────────────

    const appointment = await Appointment.create({
      patientId: walkinPatient._id, // ✅ correct patient id
      patientName,                   // ✅ correct patient name
      doctorId,
      symptoms: symptoms || '',
      token,
      status: 'waiting',
      isWalkin: true
    });

    // Populate doctorId before sending response
    const populated = await Appointment.findById(appointment._id)
      .populate('doctorId', 'name');

    // Notify doctor via email about walk-in patient (non-blocking)
    const doctor = await User.findById(doctorId);
    if (doctor) {
      sendWalkinBookedEmail(doctor.email, doctor.name, patientName, token, symptoms || '');
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('queueUpdated', { doctorId });

    res.status(201).json({
      message: 'Walk-in patient added successfully',
      appointment: populated
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE cancel appointment
const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id)
      .populate('patientId', 'email name')
      .populate('doctorId', 'name');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    await Appointment.findByIdAndDelete(id);

    // Notify Patient via email about cancellation
    if (!appointment.isWalkin && appointment.patientId && appointment.patientId.email) {
      sendAppointmentCancelledEmail(
        appointment.patientId.email,
        appointment.patientName,
        appointment.token,
        appointment.doctorId.name
      );
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('queueUpdated', { doctorId: appointment.doctorId._id });

    res.status(200).json({ message: 'Appointment cancelled successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET dashboard stats
const getStats = async (req, res) => {
  try {
    const totalAppointments = await Appointment.countDocuments();
    const waiting = await Appointment.countDocuments({ status: 'waiting' });
    const doctors = await User.countDocuments({ role: 'doctor' });

    res.status(200).json({
      totalAppointments,
      patientsWaiting: waiting,
      doctorsAvailable: doctors
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getDoctors,
  getAppointments,
  addWalkin,
  cancelAppointment,
  getStats
};