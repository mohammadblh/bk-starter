'use strict';

/**
 * آپلود فایل روی S3.
 *
 * اعتبارنامه‌ها از config/env.config می‌آیند — هرگز hardcode نمی‌شوند.
 */

const path   = require('path');
const crypto = require('crypto');
const {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const { getS3Client } = require('../config/aws.config');
const { requireAwsConfig } = require('../config/env.config');
const { serverError } = require('../utils/http.util');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../middleware/upload.middlware');

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx']);
const SIGNED_URL_TTL = 900; // ۱۵ دقیقه

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeUserId(userId) {
  const safe = String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe || safe.length > 64) {
    throw new Error('شناسه کاربر نامعتبر است');
  }
  return safe;
}

/**
 * ساخت کلید امن S3.
 *
 * نام فایل کاربر هرگز در کلید استفاده نمی‌شود — فقط یک UUID و پسوندی
 * که در لیست سفید باشد. بنابراین path traversal و پسوند اجرایی ممکن نیست.
 */
function buildS3Key(userId, originalName) {
  const safeId = safeUserId(userId);

  const ext = path.extname(String(originalName || ''))
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .replace(/^\./, '');

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error('پسوند فایل مجاز نیست');
  }

  return `uploads/${safeId}/${crypto.randomUUID()}.${ext}`;
}

/**
 * بررسی مالکیت روی کلید.
 *
 * نسخه‌ی قبلی کلیدِ خام را چک می‌کرد ولی نسخه‌ی decode شده را به S3
 * می‌داد؛ `uploads/<id>/%2e%2e/%2e%2e/x` از چک عبور می‌کرد.
 * اینجا اول decode می‌شود، بعد چک — و `..` صریحاً رد می‌شود.
 */
function resolveOwnedKey(rawKey, userId) {
  let key;
  try {
    key = decodeURIComponent(String(rawKey || ''));
  } catch (err) {
    return null;
  }

  // هیچ segment ای نباید traversal باشد
  const segments = key.split('/');
  if (segments.some(s => s === '..' || s === '.' || s === '')) return null;
  if (key.includes('\\') || key.includes('\0')) return null;

  const safeId = safeUserId(userId);
  if (segments.length !== 3 || segments[0] !== 'uploads' || segments[1] !== safeId) {
    return null;
  }

  return key;
}

// ── Controller ───────────────────────────────────────────────────────────────

async function uploadFile(req, res) {
  try {
    const file   = req.file;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'احراز هویت الزامی است' });
    }
    if (!file) {
      return res.status(400).json({ message: 'فایلی انتخاب نشده' });
    }
    // لایه‌ی دوم — multer fileFilter لایه‌ی اول است
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return res.status(415).json({ message: 'نوع فایل مجاز نیست' });
    }
    if (file.size > MAX_FILE_SIZE) {
      return res.status(413).json({ message: 'حجم فایل بیش از حد مجاز است (حداکثر ۱۰ مگابایت)' });
    }

    const aws   = requireAwsConfig();
    const s3Key = buildS3Key(userId, file.originalname);

    await getS3Client().send(new PutObjectCommand({
      Bucket:      aws.s3Bucket,
      Key:         s3Key,
      Body:        file.buffer,
      ContentType: file.mimetype,
      // مرورگر فایل را دانلود می‌کند به جای رندر کردن (جلوگیری از XSS از طریق فایل آپلودی)
      ContentDisposition: 'attachment',
      Metadata: {
        uploadedBy: safeUserId(userId),
        uploadedAt: new Date().toISOString(),
      },
      ACL: 'private',
      ServerSideEncryption: 'AES256',
    }));

    return res.status(201).json({
      message: 'فایل با موفقیت آپلود شد',
      key: s3Key,
      // URL مستقیم S3 برنمی‌گردد — دسترسی فقط از طریق signed URL
    });
  } catch (err) {
    if (err.message === 'پسوند فایل مجاز نیست' || err.message === 'شناسه کاربر نامعتبر است') {
      return res.status(400).json({ message: err.message });
    }
    return serverError(res, err, 'uploadFile');
  }
}

/**
 * URL موقت برای دسترسی به فایل — به جای عمومی کردن bucket.
 */
async function getFileUrl(req, res) {
  try {
    const key = resolveOwnedKey(req.params.key, req.userId);
    if (!key) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }

    const aws = requireAwsConfig();
    const url = await getSignedUrl(
      getS3Client(),
      new GetObjectCommand({ Bucket: aws.s3Bucket, Key: key }),
      { expiresIn: SIGNED_URL_TTL }
    );

    return res.json({ url, expiresIn: SIGNED_URL_TTL });
  } catch (err) {
    return serverError(res, err, 'getFileUrl');
  }
}

async function deleteFile(req, res) {
  try {
    const key = resolveOwnedKey(req.params.key, req.userId);
    if (!key) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }

    const aws = requireAwsConfig();
    await getS3Client().send(new DeleteObjectCommand({ Bucket: aws.s3Bucket, Key: key }));

    return res.json({ message: 'فایل حذف شد' });
  } catch (err) {
    return serverError(res, err, 'deleteFile');
  }
}

module.exports = { uploadFile, getFileUrl, deleteFile, buildS3Key, resolveOwnedKey };
