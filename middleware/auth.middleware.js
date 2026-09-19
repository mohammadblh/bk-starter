'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { getConfig } = require('../config/env.config');

/**
 * فیلدهایی که در req.user قرار می‌گیرند — هرگز password.
 */
const SAFE_USER_FIELDS = 'firstName lastName username email phone role status';

/**
 * استخراج توکن فقط از هدر Authorization.
 *
 * عمداً از query string خوانده نمی‌شود: توکن در query در لاگ سرور،
 * در Referer و در history مرورگر ذخیره می‌شود.
 */
function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers['x-access-token'];
  if (!header || typeof header !== 'string') return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (match) return match[1].trim();

  // پشتیبانی از x-access-token که معمولاً بدون پیشوند Bearer ارسال می‌شود
  if (req.headers['x-access-token'] === header) return header.trim();

  return null;
}

/**
 * تأیید توکن و بارگذاری کاربر فعال.
 * در صورت موفقیت req.user (سند mongoose) و req.userId ست می‌شوند.
 */
async function resolveUserFromToken(token) {
  const { jwt: jwtConfig } = getConfig();

  const decoded = jwt.verify(token, jwtConfig.secret, { algorithms: ['HS256'] });
  if (!decoded || !decoded.id) return null;

  const user = await User.findById(decoded.id).select(SAFE_USER_FIELDS);

  // کاربر حذف شده یا غیرفعال شده — توکن قدیمی نباید کار کند
  if (!user || user.status === false) return null;

  return user;
}

/**
 * توکن از هدر Authorization یا — برای پنل ادمین — از httpOnly cookie.
 *
 * وقتی توکن از cookie می‌آید، هدر X-Requested-With اجباری است.
 * دلیل: cookie ها را مرورگر خودکار ارسال می‌کند (CSRF)، اما یک سایت
 * دیگر نمی‌تواند هدر سفارشی ست کند بدون اینکه preflight توسط CORS
 * ما رد شود. همراه با SameSite=Strict روی cookie، این CSRF را می‌بندد.
 */
function extractToken(req) {
  const bearer = extractBearerToken(req);
  if (bearer) return { token: bearer, fromCookie: false };

  const { admin } = getConfig();
  const cookieToken = req.cookies && req.cookies[admin.cookieName];
  if (cookieToken) return { token: cookieToken, fromCookie: true };

  return null;
}

/**
 * میدلور احراز هویت برای API.
 */
const verifyToken = async (req, res, next) => {
  const found = extractToken(req);

  if (!found) {
    return res.status(401).json({ message: 'Authentication token not provided.' });
  }

  // دفاع CSRF برای احراز هویت مبتنی بر cookie
  if (found.fromCookie && req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(401).json({ message: 'Authentication token not provided.' });
  }

  const token = found.token;

  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      return res.status(401).json({ message: 'The token is invalid.' });
    }

    req.user   = user;
    req.userId = user._id.toString();
    return next();
  } catch (error) {
    // JsonWebTokenError / TokenExpiredError — جزئیات فقط در لاگ سرور
    if (!(error instanceof jwt.JsonWebTokenError)) {
      return next(error);
    }
    return res.status(401).json({ message: 'The token is invalid.' });
  }
};

/**
 * میدلور بررسی نقش ادمین. همیشه بعد از verifyToken استفاده شود.
 */
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access is restricted. Requires admin role.' });
  }
  return next();
};

/**
 * میدلور پنل ادمین — توکن را از httpOnly cookie می‌خواند.
 *
 * cookie به جای localStorage یا متغیر JS استفاده می‌شود تا یک XSS
 * احتمالی نتواند توکن را استخراج کند.
 */
const requireAdminSession = async (req, res, next) => {
  const { admin } = getConfig();
  const token = req.cookies && req.cookies[admin.cookieName];

  if (!token) {
    return res.status(401).json({ message: 'ورود لازم است.' });
  }

  try {
    const user = await resolveUserFromToken(token);
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ message: 'ورود لازم است.' });
    }

    req.user   = user;
    req.userId = user._id.toString();
    return next();
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError)) {
      return next(error);
    }
    return res.status(401).json({ message: 'ورود لازم است.' });
  }
};

/**
 * بررسی بی‌صدای session ادمین — برای تصمیم‌گیری بین صفحه لاگین و پنل.
 * هرگز خطا پرتاب نمی‌کند.
 */
async function hasValidAdminSession(req) {
  const { admin } = getConfig();
  const token = req.cookies && req.cookies[admin.cookieName];
  if (!token) return false;

  try {
    const user = await resolveUserFromToken(token);
    return Boolean(user && user.role === 'admin');
  } catch {
    return false;
  }
}

module.exports = {
  verifyToken,
  isAdmin,
  requireAdminSession,
  hasValidAdminSession,
  SAFE_USER_FIELDS,
};
