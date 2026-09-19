'use strict';

const Joi = require('joi');

const PHONE_PATTERN = /^09\d{9}$/;
const OBJECT_ID     = /^[0-9a-fA-F]{24}$/;

const createUserSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName:  Joi.string().trim().min(2).max(50).required(),
  username:  Joi.string().trim().alphanum().min(3).max(50).required(),
  email:     Joi.string().trim().lowercase().email().allow(''),
  phone:     Joi.string().trim().pattern(PHONE_PATTERN).allow('').messages({
    'string.pattern.base': 'شماره موبایل باید معتبر باشد (مثل 09XXXXXXXXX)',
  }),
  password:  Joi.string().min(8).max(128).required(),
  // به enum مدل محدود است — مقدار دلخواه پذیرفته نمی‌شود
  role:      Joi.string().valid('admin', 'user').required(),
  status:    Joi.boolean(),
});

const updateUserSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50),
  lastName:  Joi.string().trim().min(2).max(50),
  username:  Joi.string().trim().alphanum().min(3).max(50),
  email:     Joi.string().trim().lowercase().email().allow(''),
  phone:     Joi.string().trim().pattern(PHONE_PATTERN).allow(''),
  password:  Joi.string().min(8).max(128),
  role:      Joi.string().valid('admin', 'user'),
  status:    Joi.boolean(),
}).min(1);

/**
 * limit سقف‌دار است تا `?limit=999999` نتواند کل کالکشن را بکشد.
 */
const listQuerySchema = Joi.object({
  page:   Joi.number().integer().min(1).max(100000).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).allow('').default(''),
});

const idParamSchema = Joi.object({
  id: Joi.string().pattern(OBJECT_ID).required().messages({
    'string.pattern.base': 'شناسه معتبر نیست',
  }),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  listQuerySchema,
  idParamSchema,
};
