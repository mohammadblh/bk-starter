'use strict';

/**
 * SCN-051 — Upload Controller (نسخه امن)
 *
 * AFTER (امن):
 * ─────────────────────────────────────────
 *   اعتبارنامه‌ها از env.config.js می‌آیند که خودش از .env می‌خواند
 */

const path   = require('path');
const crypto = require('crypto');
const {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const { getS3Client }   = require('../config/aws.config');
const { getConfig }     = require('../config/env.config');

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * SCN-020 — تولید کلید امن برای S3 (جلوگیری از Path Traversal)
 *
 * BEFORE (ناامن): `uploads/${userId}/${filename}`
 *   → مهاجم می‌تواند userId = "../../admin" بفرستد
 *
 * AFTER (امن): UUID + sanitize شده
 */
function buildS3Key(userId, originalName) {
  // فقط کاراکترهای امن در userId مجاز هستند
  const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeUserId || safeUserId.length > 64) {
    throw new Error('شناسه کاربر نامعتبر است');
  }

  // نام فایل به UUID تبدیل می‌شود تا path traversal ممکن نباشد
  const ext      = path.extname(originalName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeName = `${crypto.randomUUID()}.${ext}`;

  return `uploads/${safeUserId}/${safeName}`;
}

// ── Controller methods ───────────────────────────────────────────────────────

async function uploadFile(req, res) {
  try {
    const { file } = req;
    const userId   = req.user?.id; // از JWT middleware

    if (!file) {
      return res.status(400).json({ message: 'فایلی انتخاب نشده' });
    }
    if (!userId) {
      return res.status(401).json({ message: 'احراز هویت الزامی است' });
    }

    // اعتبارسنجی MIME type (از header فایل، نه extension)
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return res.status(400).json({ message: 'نوع فایل مجاز نیست' });
    }

    // اعتبارسنجی حجم
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ message: 'حجم فایل بیش از حد مجاز است (حداکثر ۱۰ مگابایت)' });
    }

    const { aws } = getConfig();
    const s3Key   = buildS3Key(userId, file.originalname);

    const command = new PutObjectCommand({
      Bucket:      aws.s3Bucket,
      Key:         s3Key,
      Body:        file.buffer,
      ContentType: file.mimetype,
      // جلوگیری از اجرای مستقیم فایل در S3
      ContentDisposition: 'attachment',
      // metadata بدون اطلاعات حساس
      Metadata: {
        uploadedBy: safeUserId(userId),
        uploadedAt: new Date().toISOString(),
      },
      // جلوگیری از دسترسی عمومی
      ACL: 'private',
      // رمزنگاری در سمت سرور
      ServerSideEncryption: 'AES256',
    });

    await getS3Client().send(command);

    return res.status(201).json({
      message: 'فایل با موفقیت آپلود شد',
      key: s3Key,
      // URL مستقیم S3 را برنگردان — از signed URL استفاده کن
    });

  } catch (err) {
    // SCN-092: هیچ جزئیاتی از خطا به client نمی‌رود
    console.error('[Upload] Error:', err.message);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

/**
 * دریافت Signed URL برای دسترسی موقت به فایل (به جای دسترسی عمومی)
 */
async function getFileUrl(req, res) {
  try {
    const { key }  = req.params;
    const userId   = req.user?.id;
    const { aws }  = getConfig();

    // بررسی ownership: فقط مالک فایل می‌تواند به آن دسترسی داشته باشد
    const safeId = safeUserId(userId);
    if (!key.startsWith(`uploads/${safeId}/`)) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }

    const command = new GetObjectCommand({
      Bucket: aws.s3Bucket,
      Key:    decodeURIComponent(key),
    });

    // URL موقت — فقط ۱۵ دقیقه معتبر است
    const url = await getSignedUrl(getS3Client(), command, { expiresIn: 900 });

    return res.json({ url });

  } catch (err) {
    console.error('[GetFile] Error:', err.message);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

async function deleteFile(req, res) {
  try {
    const { key } = req.params;
    const userId  = req.user?.id;
    const { aws } = getConfig();

    const safeId = safeUserId(userId);
    if (!key.startsWith(`uploads/${safeId}/`)) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }

    const command = new DeleteObjectCommand({
      Bucket: aws.s3Bucket,
      Key:    decodeURIComponent(key),
    });

    await getS3Client().send(command);
    return res.json({ message: 'فایل حذف شد' });

  } catch (err) {
    console.error('[DeleteFile] Error:', err.message);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ── Private helpers ──────────────────────────────────────────────────────────

function safeUserId(userId) {
  return String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
}

module.exports = { uploadFile, getFileUrl, deleteFile };