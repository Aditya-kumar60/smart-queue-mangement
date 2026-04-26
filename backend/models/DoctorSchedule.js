const mongoose = require('mongoose');

const doctorScheduleSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dayOfWeek: {
    type: Number,
    required: true,
    min: 0,
    max: 6
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  },
  startTime: {
    type: String,
    required: true,
    default: '09:00'
  },
  endTime: {
    type: String,
    required: true,
    default: '17:00'
  },
  slotDurationMinutes: {
    type: Number,
    default: 15
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Ensure one schedule entry per doctor per day
doctorScheduleSchema.index({ doctorId: 1, dayOfWeek: 1 }, { unique: true });

module.exports = mongoose.model('DoctorSchedule', doctorScheduleSchema);
