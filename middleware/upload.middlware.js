'use strict';

const multer = require('multer');

/**
 * آپلود فایل.
 *
 * memoryStorage به جای diskStorage:
 *  ۱. نسخه‌ی قبلی مسیر را از `req.params.userId` می‌ساخت — کاربر می‌توانست
 *     `../../` بفرستد و هر جای فایل‌سیستم بنویسد.
 *  ۲. نام فایل از `file.originalname` می‌آمد که خودش حامل path traversal
 *     و پسوندهای اجرایی بود.
 *  ۳. کنترلر S3 به `file.buffer` نیاز دارد که فقط memoryStorage می‌دهد.
 *
 * مسیر نهایی در S3 توسط controller از روی شناسه‌ی کاربرِ احراز هویت شده
 * و یک UUID ساخته می‌شود — هیچ ورودی کاربری در مسیر دخالت ندارد.
 */

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10,
    // بدون این، یک نام فیلد بسیار طولانی می‌تواند حافظه مصرف کند
    fieldNameSize: 100,
  },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error('نوع فایل مجاز نیست');
      err.code = 'INVALID_FILE_TYPE';
      return cb(err);
    }
    return cb(null, true);
  },
});

/**
 * تبدیل خطاهای multer به پاسخ تمیز — بدون افشای مسیر فایل‌ها.
 */
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'حجم فایل بیش از حد مجاز است (حداکثر ۱۰ مگابایت)' });
    }
    return res.status(400).json({ message: 'خطا در آپلود فایل' });
  }
  if (err && err.code === 'INVALID_FILE_TYPE') {
    return res.status(415).json({ message: err.message });
  }
  return next(err);
}

module.exports = upload;
module.exports.upload = upload;
module.exports.handleUploadError = handleUploadError;
module.exports.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
