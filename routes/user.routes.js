/* مدیریت کاربران */
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// دریافت لیست کاربران
// action: list
router.get('/', verifyToken, isAdmin, userController.getAllUsers);

// ایجاد کاربر جدید
// action: create
router.post('/', verifyToken, isAdmin, userController.createUser);

// دریافت اطلاعات یک کاربر با شناسه
// action: read
router.get('/:id', verifyToken, isAdmin, userController.getUserById);

// بروزرسانی اطلاعات کاربر
// action: update
router.put('/:id', verifyToken, isAdmin, userController.updateUser);

// حذف کاربر
// action: delete
router.delete('/:id', verifyToken, isAdmin, userController.deleteUser);

// غیرفعال/فعال کردن کاربر
// action: toggle-status
router.patch('/:id/toggle-status', verifyToken, isAdmin, userController.toggleUserStatus);

module.exports = router;
