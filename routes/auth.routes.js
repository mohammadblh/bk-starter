const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// ثبت‌نام کاربر جدید
router.post('/register/admin', authController.registerAdmin);

// ورود کاربر
router.post('/login', authController.login);

module.exports = router;