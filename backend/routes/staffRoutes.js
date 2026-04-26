const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getDoctors,
  getAppointments,
  addWalkin,
  cancelAppointment,
  getStats
} = require('../controllers/staffController');

router.get('/doctors', protect, getDoctors);
router.get('/appointments', protect, getAppointments);
router.post('/walkin', protect, addWalkin);
router.delete('/appointments/:id', protect, cancelAppointment);
router.get('/stats', protect, getStats);

module.exports = router;