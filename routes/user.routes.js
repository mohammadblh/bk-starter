/* مدیریت کاربران */
'use strict';

const express = require('express');
const router = express.Router();

const userController = require('../controllers/user.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const V = require('../validations/user.validation');

const withId = validate(V.idParamSchema, 'params');

// همه‌ی مسیرهای این بخش نیاز به احراز هویت و نقش ادمین دارند
router.use(verifyToken, isAdmin);

// دریافت لیست کاربران
// action: list
router.get('/', validate(V.listQuerySchema, 'query'), userController.getAllUsers);

// ایجاد کاربر جدید
// action: create
router.post('/', validate(V.createUserSchema), userController.createUser);

// دریافت اطلاعات یک کاربر با شناسه
// action: read
router.get('/:id', withId, userController.getUserById);

// بروزرسانی اطلاعات کاربر
// action: update
router.put('/:id', withId, validate(V.updateUserSchema), userController.updateUser);

// حذف کاربر
// action: delete
router.delete('/:id', withId, userController.deleteUser);

// غیرفعال/فعال کردن کاربر
// action: toggle-status
router.patch('/:id/toggle-status', withId, userController.toggleUserStatus);

module.exports = router;
