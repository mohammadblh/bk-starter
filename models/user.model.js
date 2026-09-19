'use strict';

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName:  { type: String, required: true, trim: true, maxlength: 50 },

    // unique در سطح دیتابیس — بررسی دستی در controller از race condition
    // جلوگیری نمی‌کند
    username:  { type: String, required: true, unique: true, trim: true, maxlength: 50 },
    email:     { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone:     { type: String, unique: true, sparse: true, trim: true },

    // select: false تا رمز به صورت تصادفی در هیچ کوئری‌ای برنگردد.
    // برای مقایسه باید صریحاً .select('+password') زده شود.
    password:  { type: String, required: true, select: false },

    role: {
      type: String,
      enum: ['admin', 'user'],
      required: true,
      default: 'user',
    },

    status: { type: Boolean, default: true }, // فعال یا غیرفعال
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', UserSchema);
