const User = require('../models/user');
const Appointment = require('../models/Appointment');
const Medical = require('../models/Medical');
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
    const { doctorId, symptoms } = req.body;
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

    // Create appointment
    const appointment = await Appointment.create({
      patientId,
      patientName: patient.name,
      doctorId,
      symptoms: symptoms || '',
      token,
      status: 'waiting'
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

module.exports = {
  getDoctors,
  bookAppointment,
  getMyAppointments,
  getQueueStatus,
  getMedicalHistory
};