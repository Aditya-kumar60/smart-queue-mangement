const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  getQueue, 
  nextPatient, 
  completeConsultation,
  getPastConsultations,
  getSchedule,
  updateSchedule
} = require('../controllers/doctorController');

router.get('/queue', protect, getQueue);
router.post('/next', protect, nextPatient);
router.post('/complete', protect, completeConsultation);
router.get('/consultations', protect, getPastConsultations);
router.get('/schedule', protect, getSchedule);
router.put('/schedule', protect, updateSchedule);

module.exports = router;