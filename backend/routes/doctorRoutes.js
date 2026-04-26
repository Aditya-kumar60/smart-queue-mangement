const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  getQueue, 
  nextPatient, 
  completeConsultation,
  getPastConsultations
} = require('../controllers/doctorController');

router.get('/queue', protect, getQueue);
router.post('/next', protect, nextPatient);
router.post('/complete', protect, completeConsultation);
router.get('/consultations', protect, getPastConsultations);

module.exports = router;