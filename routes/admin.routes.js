/* پنل مدیریت */
'use strict';

const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const User = require('../models/user.model');
const { parseAdminRoutes } = require('../utils/adminParser');
const { getConfig } = require('../config/env.config');
const { serverError } = require('../utils/http.util');
const { signAccessToken, getDummyPasswordHash } = require('../utils/token.util');
const { requireAdminSession, hasValidAdminSession } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const { loginSchema } = require('../validations/auth.validation');

const VIEWS = path.join(__dirname, '..', 'views', 'admin');

/**
 * گزینه‌های cookie نشست ادمین.
 *
 *  httpOnly  → JavaScript (و در نتیجه یک XSS احتمالی) نمی‌تواند توکن را بخواند
 *  sameSite  → مرورگر cookie را در درخواست‌های cross-site ارسال نمی‌کند (CSRF)
 *  secure    → فقط روی HTTPS؛ در production اجباری است
 *  path      → cookie فقط برای مسیرهای همین اپ ارسال می‌شود
 */
function cookieOptions() {
  const { admin, jwt } = getConfig();
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: admin.cookieSecure,
    path: '/',
    maxAge: parseExpiry(jwt.expiresIn),
  };
}

function parseExpiry(expiresIn) {
  const match = /^(\d+)([smhd])$/.exec(String(expiresIn));
  if (!match) return 24 * 60 * 60 * 1000;
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return Number(match[1]) * mult[match[2]];
}

// ── صفحه ورود ────────────────────────────────────────────────────────────────

// exclude
router.get('/login', async (req, res) => {
  if (await hasValidAdminSession(req)) {
    return res.redirect('/admin');
  }
  return res.sendFile(path.join(VIEWS, 'login.html'));
});

/**
 * ورود به پنل.
 *
 * از همان مسیر لاگین عمومی جدا است تا بتواند نقش ادمین را اجبار کند
 * و توکن را به جای بدنه‌ی پاسخ در cookie بگذارد.
 */
// exclude
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    const or = [];
    if (email) or.push({ email });
    if (phone) or.push({ phone });

    const user = await User.findOne({ $or: or }).select('+password');

    // مقایسه همیشه انجام می‌شود تا تفاوت زمانی، وجود کاربر را لو ندهد
    const hash = user ? user.password : getDummyPasswordHash();
    const ok = await bcrypt.compare(password, hash);

    // پیام یکسان برای «کاربر نیست»، «رمز غلط» و «ادمین نیست»
    if (!user || !ok || user.role !== 'admin' || user.status === false) {
      return res.status(401).json({ message: 'اطلاعات ورود معتبر نیست.' });
    }

    res.cookie(getConfig().admin.cookieName, signAccessToken(user), cookieOptions());
    return res.json({ message: 'ورود موفق' });
  } catch (error) {
    return serverError(res, error, 'adminLogin');
  }
});

// exclude
router.post('/logout', (req, res) => {
  const opts = cookieOptions();
  delete opts.maxAge;
  res.clearCookie(getConfig().admin.cookieName, opts);
  return res.json({ message: 'خروج انجام شد' });
});

// ── مسیرهای محافظت‌شده ───────────────────────────────────────────────────────

// صفحه‌ی پنل
// exclude
router.get('/', async (req, res) => {
  if (!(await hasValidAdminSession(req))) {
    return res.redirect('/admin/login');
  }
  return res.sendFile(path.join(VIEWS, 'panel.html'));
});

// پیکربندی پویای بخش‌ها — فقط برای نشست ادمین معتبر
// exclude
router.get('/config-json', requireAdminSession, (req, res) => {
  try {
    return res.json(parseAdminRoutes());
  } catch (error) {
    return serverError(res, error, 'adminConfig');
  }
});

module.exports = router;
