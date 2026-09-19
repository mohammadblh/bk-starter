'use strict';

const { rateLimit, MemoryStore } = require('express-rate-limit');
const { getConfig } = require('../config/env.config');

// این ماژول همیشه بعد از getConfig() در server.js لود می‌شود،
// بنابراین ساخت limiter ها در زمان لود ماژول امن است.
const { security } = getConfig();

// Store ها صریح ساخته می‌شوند تا تست‌ها بتوانند بین case ها reset کنند.
const generalStore = new MemoryStore();
const authStore    = new MemoryStore();

function build(store, limit) {
  return rateLimit({
    windowMs: security.rateLimitWindowMs,
    limit,
    store,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'تعداد درخواست بیش از حد مجاز است. بعداً تلاش کنید.' },
  });
}

/** محدودیت عمومی برای کل API */
const generalLimiter = build(generalStore, security.rateLimitMax);

/**
 * محدودیت سختگیرانه برای مسیرهای احراز هویت.
 * بدون این، brute force روی /api/auth/login نامحدود است.
 */
const authLimiter = build(authStore, security.authRateLimitMax);

/** فقط برای تست‌ها */
async function resetRateLimits() {
  await Promise.all([generalStore.resetAll(), authStore.resetAll()]);
}

module.exports = { generalLimiter, authLimiter, resetRateLimits };
