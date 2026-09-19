'use strict';

const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { getConfig } = require('../config/env.config');
const { serverError } = require('../utils/http.util');
const { signAccessToken, toSafeUser, getDummyPasswordHash } = require('../utils/token.util');

/**
 * ثبت ادمین جدید.
 *
 * این مسیر در routes پشت verifyToken + isAdmin است — فقط یک ادمین
 * موجود می‌تواند ادمین جدید بسازد. برای ساخت اولین ادمین از
 * `npm run create-admin` استفاده کنید.
 */
exports.registerAdmin = async (req, res) => {
  try {
    // req.body توسط validate middleware اعتبارسنجی و پاک‌سازی شده است
    const { firstName, lastName, username, email, phone, password } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }, { username }],
    });
    if (existingUser) {
      return res.status(409).json({
        message: 'کاربری با این ایمیل، شماره موبایل یا نام کاربری وجود دارد',
      });
    }

    const { security } = getConfig();
    const hashedPassword = await bcrypt.hash(password, security.bcryptRounds);

    const adminUser = await User.create({
      firstName,
      lastName,
      username,
      email,
      phone,
      password: hashedPassword,
      role: 'admin',
      status: true,
    });

    return res.status(201).json({
      message: 'ادمین جدید با موفقیت ثبت شد',
      admin: toSafeUser(adminUser),
    });
  } catch (error) {
    // خطای unique index دیتابیس
    if (error && error.code === 11000) {
      return res.status(409).json({ message: 'این مقدار قبلاً ثبت شده است' });
    }
    return serverError(res, error, 'registerAdmin');
  }
};

/**
 * ورود کاربر.
 *
 * ورودی توسط Joi اعتبارسنجی شده، بنابراین email/phone حتماً string هستند
 * و اپراتورهای MongoDB به کوئری نشت نمی‌کنند.
 */
exports.login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    const or = [];
    if (email) or.push({ email });
    if (phone) or.push({ phone });

    // password با select: false تعریف شده — باید صریحاً درخواست شود
    const user = await User.findOne({ $or: or }).select('+password');

    // پیام یکسان برای «کاربر پیدا نشد» و «رمز غلط» تا user enumeration ممکن نباشد.
    // مقایسه حتی وقتی کاربر وجود ندارد انجام می‌شود تا تفاوت زمانی لو ندهد.
    const hash = user ? user.password : getDummyPasswordHash();
    const isPasswordValid = await bcrypt.compare(password, hash);

    if (!user || !isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email/phone or password' });
    }

    if (user.status === false) {
      return res.status(403).json({ message: 'Your account has been deactivated.' });
    }

    const token = signAccessToken(user);

    return res.status(200).json({
      message: 'Successful login',
      token,
      user: toSafeUser(user),
    });
  } catch (error) {
    return serverError(res, error, 'login');
  }
};

/**
 * دریافت اطلاعات کاربر فعلی.
 */
exports.getProfile = async (req, res) => {
  try {
    // verifyToken از قبل کاربر را بارگذاری کرده است
    return res.status(200).json(toSafeUser(req.user));
  } catch (error) {
    return serverError(res, error, 'getProfile');
  }
};

/**
 * تغییر رمز عبور کاربر فعلی.
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'The current password is incorrect.' });
    }

    const { security } = getConfig();
    user.password = await bcrypt.hash(newPassword, security.bcryptRounds);
    await user.save();

    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    return serverError(res, error, 'changePassword');
  }
};
