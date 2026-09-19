/* آپلود فایل */
'use strict';

const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload.middlware');
const { handleUploadError } = require('../middleware/upload.middlware');
const uploadController = require('../controllers/upload.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// همه‌ی مسیرها نیاز به احراز هویت دارند — مسیر فایل از req.userId
// ساخته می‌شود، نه از ورودی کاربر
router.use(verifyToken);

// آپلود فایل
// exclude
router.post('/', upload.single('file'), handleUploadError, uploadController.uploadFile);

// دریافت URL موقت
// exclude
router.get('/:key', uploadController.getFileUrl);

// حذف فایل
// exclude
router.delete('/:key', uploadController.deleteFile);

module.exports = router;
