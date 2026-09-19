'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getConfig } = require('../config/env.config');

let _dummyHash = null;

/**
 * یک bcrypt hash واقعی از یک رشته‌ی تصادفی، با همان cost factor.
 *
 * وقتی کاربر پیدا نمی‌شود، لاگین به جای بازگشت فوری این hash را
 * مقایسه می‌کند تا زمان پاسخ یکسان بماند؛ در غیر این صورت اختلاف
 * زمانی لو می‌دهد که کدام ایمیل‌ها در سیستم ثبت شده‌اند.
 *
 * hash نامعتبر به این درد نمی‌خورد چون bcrypt بلافاصله false برمی‌گرداند.
 */
function getDummyPasswordHash() {
  if (!_dummyHash) {
    const { security } = getConfig();
    _dummyHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), security.bcryptRounds);
  }
  return _dummyHash;
}

/**
 * صدور توکن دسترسی. payload عمداً حداقلی است —
 * هر چیزی که در توکن باشد برای دارنده‌ی توکن قابل خواندن است.
 */
function signAccessToken(user) {
  const { jwt: jwtConfig } = getConfig();

  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn, algorithm: 'HS256' }
  );
}

/**
 * نمایش امن کاربر برای پاسخ API — هرگز password.
 */
function toSafeUser(user) {
  return {
    id:        user._id,
    firstName: user.firstName,
    lastName:  user.lastName,
    username:  user.username,
    email:     user.email,
    phone:     user.phone,
    role:      user.role,
    status:    user.status,
  };
}

module.exports = { signAccessToken, toSafeUser, getDummyPasswordHash };
