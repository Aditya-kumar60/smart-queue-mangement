const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getDoctors,
  bookAppointment,
  getMyAppointments,
  getQueueStatus,
  getMedicalHistory
} = require('../controllers/patientController');

router.get('/doctors', protect, getDoctors);
router.post('/appointment', protect, bookAppointment);
router.get('/appointments', protect, getMyAppointments);
router.get('/queue-status/:doctorId', protect, getQueueStatus);
router.get('/medical-history', protect, getMedicalHistory);

module.exports = router;