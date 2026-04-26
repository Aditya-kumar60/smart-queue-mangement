const mongoose = require('mongoose');

const medicalSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  diagnosis: {
    type: String,
    required: true
  },
  prescription: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Medical', medicalSchema);
