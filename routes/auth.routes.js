/* احراز هویت */
'use strict';

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const {
  registerAdminSchema,
  loginSchema,
  changePasswordSchema,
} = require('../validations/auth.validation');

// ثبت ادمین جدید — فقط توسط یک ادمین موجود.
// برای ساخت اولین ادمین: npm run create-admin
// exclude
router.post(
  '/register/admin',
  verifyToken,
  isAdmin,
  validate(registerAdminSchema),
  authController.registerAdmin
);

// ورود کاربر — با محدودیت سختگیرانه در برابر brute force
// exclude
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// اطلاعات کاربر فعلی
// exclude
router.get('/me', verifyToken, authController.getProfile);

// تغییر رمز عبور
// exclude
router.post(
  '/change-password',
  verifyToken,
  authLimiter,
  validate(changePasswordSchema),
  authController.changePassword
);

module.exports = router;
