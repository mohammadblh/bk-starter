const express = require('express');
const router = express.Router();
// const userController = require('../controllers/user.controller');
// const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// دریافت لیست کاربران (فقط برای ادمین)
// router.get('/', verifyToken, isAdmin, userController.getAllUsers);

// // دریافت اطلاعات یک کاربر با شناسه
// router.get('/:id', verifyToken, userController.getUserById);

// // بروزرسانی اطلاعات کاربر
// router.put('/:id', verifyToken, userController.updateUser);

// // غیرفعال/فعال کردن کاربر (فقط ادمین)
// router.patch('/:id/toggle-status', verifyToken, isAdmin, userController.toggleUserStatus);

// // تغییر نقش کاربر (فقط ادمین)
// router.patch('/:id/change-role', verifyToken, isAdmin, userController.changeUserRole);

module.exports = router;