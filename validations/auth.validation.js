'use strict';

const Joi = require('joi');

const PHONE_PATTERN = /^09\d{9}$/;

const password = Joi.string().min(8).max(128).required().messages({
  'string.min': 'رمز عبور باید حداقل ۸ کاراکتر باشد',
});

const registerAdminSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName:  Joi.string().trim().min(2).max(50).required(),
  username:  Joi.string().trim().alphanum().min(3).max(50).required(),
  email:     Joi.string().trim().lowercase().email().required(),
  phone:     Joi.string().trim().pattern(PHONE_PATTERN).required().messages({
    'string.pattern.base': 'شماره موبایل باید معتبر باشد (مثل 09XXXXXXXXX)',
  }),
  password,
});

/**
 * ولیدیشن لاگین — خط اول دفاع در برابر NoSQL operator injection.
 * Joi.string() هر شیئی مثل {"$gt": ""} را رد می‌کند.
 */
const loginSchema = Joi.object({
  email:    Joi.string().trim().lowercase().email(),
  phone:    Joi.string().trim().pattern(PHONE_PATTERN),
  password: Joi.string().min(1).max(128).required(),
})
  .or('email', 'phone')
  .messages({
    'object.missing': 'ایمیل یا شماره موبایل الزامی است',
  });

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required(),
  newPassword:     password,
});

module.exports = {
  registerAdminSchema,
  // alias برای سازگاری با کد قبلی
  adminSchema: registerAdminSchema,
  loginSchema,
  changePasswordSchema,
};
