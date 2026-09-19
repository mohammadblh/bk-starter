'use strict';

const { getConfig } = require('../config/env.config');

/**
 * پاسخ یکنواخت به خطای سرور.
 *
 * جزئیات خطا (stack، پیام mongoose، نام فیلدها) فقط در لاگ سرور می‌رود.
 * در production هیچ‌وقت به کلاینت داده نمی‌شود چون می‌تواند ساختار
 * دیتابیس و مسیر فایل‌ها را افشا کند.
 */
function serverError(res, err, context = 'app') {
  console.error(`[${context}]`, err && err.stack ? err.stack : err);

  // جزئیات فقط در development/test — staging و production هم باید
  // مثل هم بسته باشند
  const { NODE_ENV } = getConfig();
  const body = { message: 'خطای سرور' };

  if (NODE_ENV === 'development' || NODE_ENV === 'test') {
    body.error = err && err.message ? err.message : String(err);
  }

  return res.status(500).json(body);
}

/**
 * escape کاراکترهای خاص regex تا ورودی کاربر نتواند
 * الگوی جستجو را تغییر دهد یا باعث ReDoS شود.
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * escape کردن HTML برای جلوگیری از XSS در خروجی‌های رندر شده در سرور.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { serverError, escapeRegex, escapeHtml };
