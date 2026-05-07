const express = require('express');
const router = express.Router();

const {
  forgotPassword,
  resetPassword,
  requestPasswordChange,
  confirmPasswordChange
} = require('../controllers/authController_patch');

const { protect } = require('../middleware/auth');

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/request-password-change', protect, requestPasswordChange);
router.post('/confirm-password-change', protect, confirmPasswordChange);

module.exports = router;