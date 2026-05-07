const { query } = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const {
  sendPasswordResetCode,
  sendPasswordChangeCode,
  sendPasswordChangedConfirmation,
  sendPasswordResetConfirmation
} = require('../utils/emailService');

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }

  return null;
}

async function forgotPassword(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email required.'
      });
    }

    const userResult = await query(
      `SELECT id, first_name, last_name, email
       FROM users
       WHERE LOWER(email) = $1
         AND status = 'active'
       LIMIT 1`,
      [email]
    );

    // Security: do not reveal whether email exists
    if (!userResult.rows.length) {
      return res.json({
        success: true,
        message: 'If this email exists, a reset code has been sent.'
      });
    }

    const user = userResult.rows[0];
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await query(
      `UPDATE verification_codes
       SET used = TRUE
       WHERE user_id = $1
         AND type = 'password_reset'
         AND used = FALSE`,
      [user.id]
    );

    await query(
      `INSERT INTO verification_codes
       (user_id, code, type, expires_at, used)
       VALUES ($1, $2, 'password_reset', $3, FALSE)`,
      [user.id, otp, expiresAt]
    );

    await sendPasswordResetCode(user, otp);

    return res.json({
      success: true,
      message: 'If this email exists, a reset code has been sent.'
    });
  } catch (error) {
    console.error('forgotPassword error:', error);
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    const newPassword = String(req.body.new_password || '');

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, code, and new password required.'
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code must be 6 digits.'
      });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError
      });
    }

    const userResult = await query(
      `SELECT id, first_name, last_name, email
       FROM users
       WHERE LOWER(email) = $1
         AND status = 'active'
       LIMIT 1`,
      [email]
    );

    if (!userResult.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request.'
      });
    }

    const user = userResult.rows[0];

    const codeResult = await query(
      `SELECT id
       FROM verification_codes
       WHERE user_id = $1
         AND code = $2
         AND type = 'password_reset'
         AND used = FALSE
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id, code]
    );

    if (!codeResult.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired code. Please request a new one.'
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await query('BEGIN');

    try {
      await query(
        `UPDATE users
         SET password_hash = $1,
             refresh_token = NULL,
             updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, user.id]
      );

      await query(
        `UPDATE verification_codes
         SET used = TRUE
         WHERE id = $1`,
        [codeResult.rows[0].id]
      );

      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

    await sendPasswordResetConfirmation(user);

    return res.json({
      success: true,
      message: 'Password reset successfully. You can now log in.'
    });
  } catch (error) {
    console.error('resetPassword error:', error);
    next(error);
  }
}

async function requestPasswordChange(req, res, next) {
  try {
    const userId = req.user.id;
    const currentPassword = String(req.body.current_password || '');

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password required.'
      });
    }

    const userResult = await query(
      `SELECT id, first_name, last_name, email, password_hash
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const user = userResult.rows[0];

    const valid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await query(
      `UPDATE verification_codes
       SET used = TRUE
       WHERE user_id = $1
         AND type = 'password_change_2fa'
         AND used = FALSE`,
      [user.id]
    );

    await query(
      `INSERT INTO verification_codes
       (user_id, code, type, expires_at, used)
       VALUES ($1, $2, 'password_change_2fa', $3, FALSE)`,
      [user.id, otp, expiresAt]
    );

    await sendPasswordChangeCode(user, otp);

    return res.json({
      success: true,
      message: 'Verification code sent to your email.'
    });
  } catch (error) {
    console.error('requestPasswordChange error:', error);
    next(error);
  }
}

async function confirmPasswordChange(req, res, next) {
  try {
    const userId = req.user.id;
    const code = String(req.body.code || '').trim();
    const newPassword = String(req.body.new_password || '');

    if (!code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Code and new password required.'
      });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError
      });
    }

    const codeResult = await query(
      `SELECT id
       FROM verification_codes
       WHERE user_id = $1
         AND code = $2
         AND type = 'password_change_2fa'
         AND used = FALSE
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, code]
    );

    if (!codeResult.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired code.'
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await query('BEGIN');

    try {
      await query(
        `UPDATE users
         SET password_hash = $1,
             refresh_token = NULL,
             updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, userId]
      );

      await query(
        `UPDATE verification_codes
         SET used = TRUE
         WHERE id = $1`,
        [codeResult.rows[0].id]
      );

      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

    const userResult = await query(
      `SELECT first_name, last_name, email
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows[0]) {
      await sendPasswordChangedConfirmation(userResult.rows[0]);
    }

    return res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    console.error('confirmPasswordChange error:', error);
    next(error);
  }
}

module.exports = {
  forgotPassword,
  resetPassword,
  requestPasswordChange,
  confirmPasswordChange
};