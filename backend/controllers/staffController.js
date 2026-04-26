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

// ─── GET ANALYTICS ────────────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    // 1. Patients per day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const patientsPerDay = await Appointment.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing days with 0
    const dayLabels = [];
    const dayCounts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      dayLabels.push(dayName);
      const found = patientsPerDay.find(p => p._id === key);
      dayCounts.push(found ? found.count : 0);
    }

    // 2. Peak hours distribution (all time)
    const peakHours = await Appointment.aggregate([
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill all 24 hours
    const hourLabels = [];
    const hourCounts = [];
    for (let h = 0; h < 24; h++) {
      const label = `${h.toString().padStart(2, '0')}:00`;
      hourLabels.push(label);
      const found = peakHours.find(p => p._id === h);
      hourCounts.push(found ? found.count : 0);
    }

    // 3. Doctor-wise load (all appointments)
    const doctorLoad = await Appointment.aggregate([
      {
        $group: {
          _id: '$doctorId',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      { $unwind: '$doctor' },
      {
        $project: {
          doctorName: '$doctor.name',
          count: 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    const doctorNames = doctorLoad.map(d => d.doctorName);
    const doctorCounts = doctorLoad.map(d => d.count);

    // 4. Average consultation time per doctor
    const avgConsultation = await Appointment.aggregate([
      {
        $match: {
          status: 'completed',
          startedAt: { $ne: null },
          completedAt: { $ne: null }
        }
      },
      {
        $project: {
          doctorId: 1,
          duration: {
            $divide: [
              { $subtract: ['$completedAt', '$startedAt'] },
              60000 // convert ms to minutes
            ]
          }
        }
      },
      {
        $group: {
          _id: '$doctorId',
          avgMinutes: { $avg: '$duration' },
          totalConsultations: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      { $unwind: '$doctor' },
      {
        $project: {
          doctorName: '$doctor.name',
          avgMinutes: { $round: ['$avgMinutes', 1] },
          totalConsultations: 1
        }
      },
      { $sort: { avgMinutes: -1 } }
    ]);

    const avgDoctorNames = avgConsultation.map(d => d.doctorName);
    const avgDoctorMinutes = avgConsultation.map(d => d.avgMinutes);

    // 5. Summary stats
    const totalToday = await Appointment.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    const totalCompleted = await Appointment.countDocuments({ status: 'completed' });
    const totalActive = await Appointment.countDocuments({ 
      status: { $in: ['waiting', 'in-progress'] } 
    });

    res.status(200).json({
      patientsPerDay: { labels: dayLabels, data: dayCounts },
      peakHours: { labels: hourLabels, data: hourCounts },
      doctorLoad: { labels: doctorNames, data: doctorCounts },
      avgConsultationTime: { labels: avgDoctorNames, data: avgDoctorMinutes },
      summary: {
        totalToday,
        totalCompleted,
        totalActive
      }
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
  getStats,
  getAnalytics
};