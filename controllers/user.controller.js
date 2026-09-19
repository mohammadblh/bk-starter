'use strict';

const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const { getConfig } = require('../config/env.config');
const { serverError, escapeRegex } = require('../utils/http.util');
const { toSafeUser } = require('../utils/token.util');

/**
 * لیست کاربران (فقط ادمین).
 * page/limit/search توسط listQuerySchema اعتبارسنجی و سقف‌دار شده‌اند.
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { page, limit, search } = req.validatedQuery;

    const query = {};
    if (search) {
      // escape اجباری: بدون آن ورودی کاربر یک regex دلخواه می‌شود
      // (نشت داده + ReDoS)
      const safe = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { username:  safe },
        { email:     safe },
        { firstName: safe },
        { lastName:  safe },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      users: users.map(u => ({ ...u, password: undefined, __v: undefined })),
      totalPages: Math.ceil(total / limit) || 1,
      currentPage: page,
      totalUsers: total,
    });
  } catch (error) {
    return serverError(res, error, 'getAllUsers');
  }
};

/**
 * دریافت یک کاربر با شناسه.
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json(toSafeUser(user));
  } catch (error) {
    return serverError(res, error, 'getUserById');
  }
};

/**
 * ایجاد کاربر جدید (ادمین).
 */
exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, username, email, phone, password, role, status } = req.body;

    const or = [{ username }];
    if (email) or.push({ email });
    if (phone) or.push({ phone });

    const existing = await User.findOne({ $or: or });
    if (existing) {
      return res.status(409).json({
        message: 'نام کاربری، ایمیل یا شماره موبایل قبلاً ثبت شده است.',
      });
    }

    const { security } = getConfig();
    const newUser = await User.create({
      firstName,
      lastName,
      username,
      email: email || undefined,
      phone: phone || undefined,
      password: await bcrypt.hash(password, security.bcryptRounds),
      role,
      status: status !== undefined ? status : true,
    });

    return res.status(201).json({
      message: 'User successfully created.',
      user: toSafeUser(newUser),
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: 'این مقدار قبلاً ثبت شده است' });
    }
    return serverError(res, error, 'createUser');
  }
};

/**
 * بروزرسانی کاربر (ادمین).
 */
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isSelf = req.userId === req.params.id;
    const { firstName, lastName, username, email, phone, password, role, status } = req.body;

    // جلوگیری از قفل شدن بیرون سیستم: ادمین نمی‌تواند نقش یا وضعیت
    // حساب خودش را پایین بیاورد
    if (isSelf && role && role !== user.role) {
      return res.status(400).json({ message: 'نمی‌توانید نقش حساب خودتان را تغییر دهید.' });
    }
    if (isSelf && status === false) {
      return res.status(400).json({ message: 'نمی‌توانید حساب خودتان را غیرفعال کنید.' });
    }

    if (username && username !== user.username) {
      if (await User.exists({ username })) {
        return res.status(409).json({ message: 'Username is already taken.' });
      }
      user.username = username;
    }

    if (email !== undefined) {
      if (email === '') {
        user.email = undefined;
      } else if (email !== user.email) {
        if (await User.exists({ email })) {
          return res.status(409).json({ message: 'Email is already registered.' });
        }
        user.email = email;
      }
    }

    if (phone !== undefined) {
      if (phone === '') {
        user.phone = undefined;
      } else if (phone !== user.phone) {
        if (await User.exists({ phone })) {
          return res.status(409).json({ message: 'Phone is already registered.' });
        }
        user.phone = phone;
      }
    }

    if (firstName) user.firstName = firstName;
    if (lastName)  user.lastName  = lastName;
    if (role)      user.role      = role;
    if (status !== undefined) user.status = status;

    if (password) {
      const { security } = getConfig();
      user.password = await bcrypt.hash(password, security.bcryptRounds);
    }

    await user.save();

    return res.status(200).json({
      message: 'User information was successfully updated.',
      user: toSafeUser(user),
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: 'این مقدار قبلاً ثبت شده است' });
    }
    return serverError(res, error, 'updateUser');
  }
};

/**
 * حذف کاربر (ادمین).
 */
exports.deleteUser = async (req, res) => {
  try {
    if (req.userId === req.params.id) {
      return res.status(400).json({ message: 'نمی‌توانید حساب خودتان را حذف کنید.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({ message: 'User successfully deleted.' });
  } catch (error) {
    return serverError(res, error, 'deleteUser');
  }
};

/**
 * فعال/غیرفعال کردن کاربر (ادمین).
 */
exports.toggleUserStatus = async (req, res) => {
  try {
    if (req.userId === req.params.id) {
      return res.status(400).json({ message: 'نمی‌توانید وضعیت حساب خودتان را تغییر دهید.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.status = !user.status;
    await user.save();

    return res.status(200).json({
      message: `User successfully ${user.status ? 'activated' : 'deactivated'}.`,
      status: user.status,
    });
  } catch (error) {
    return serverError(res, error, 'toggleUserStatus');
  }
};
