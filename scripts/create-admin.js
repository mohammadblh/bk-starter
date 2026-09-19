#!/usr/bin/env node
'use strict';

/**
 * ساخت اولین ادمین.
 *
 * مسیر عمومی ثبت ادمین یک رخنه‌ی بحرانی بود (هر کسی می‌توانست برای
 * خودش حساب ادمین بسازد). الان آن مسیر پشت احراز هویت است و
 * bootstrap اولین ادمین از اینجا — با دسترسی مستقیم به سرور — انجام می‌شود.
 *
 * اجرا:
 *   npm run create-admin
 *   npm run create-admin -- --email admin@example.com --username admin
 */

require('dotenv').config();

const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { getConfig } = require('../config/env.config');
const User = require('../models/user.model');

const KEY_ENTER     = ['\r', '\n'];
const KEY_CTRL_C    = '\u0003';
const KEY_BACKSPACE = ['\u0008', '\u007f'];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const m = /^--([\w-]+)$/.exec(argv[i]);
    if (m && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      out[m[1].toLowerCase()] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

/**
 * خواندن رمز بدون echo روی ترمینال.
 */
function askSecret(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);

    if (!stdin.isTTY) {
      // محیط غیر تعاملی (CI) — از خواندن رمز صرف‌نظر می‌شود
      process.stdout.write('\n');
      return resolve('');
    }

    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();

    let value = '';
    const onData = (chunk) => {
      const ch = chunk.toString('utf8');

      if (KEY_ENTER.includes(ch)) {
        stdin.setRawMode(Boolean(wasRaw));
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        return resolve(value);
      }
      if (ch === KEY_CTRL_C) {
        stdin.setRawMode(Boolean(wasRaw));
        process.stdout.write('\n');
        return process.exit(1);
      }
      if (KEY_BACKSPACE.includes(ch)) {
        value = value.slice(0, -1);
        return undefined;
      }
      value += ch;
      return undefined;
    };

    stdin.on('data', onData);
    return undefined;
  });
}

function validateInput({ firstName, lastName, username, email, phone, password, confirm }) {
  const errors = [];
  if (!firstName || firstName.trim().length < 2) errors.push('نام باید حداقل ۲ کاراکتر باشد');
  if (!lastName  || lastName.trim().length  < 2) errors.push('نام خانوادگی باید حداقل ۲ کاراکتر باشد');
  if (!/^[a-zA-Z0-9]{3,50}$/.test(username || '')) errors.push('نام کاربری باید ۳ تا ۵۰ کاراکتر حرف/عدد باشد');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) errors.push('ایمیل معتبر نیست');
  if (!/^09\d{9}$/.test(phone || '')) errors.push('شماره موبایل معتبر نیست (مثل 09123456789)');
  if (!password || password.length < 8) errors.push('رمز عبور باید حداقل ۸ کاراکتر باشد');
  if (password !== confirm) errors.push('رمز عبور و تکرار آن یکسان نیستند');
  return errors;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = getConfig();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const firstName = args.firstname || await ask(rl, 'نام: ');
  const lastName  = args.lastname  || await ask(rl, 'نام خانوادگی: ');
  const username  = args.username  || await ask(rl, 'نام کاربری: ');
  const email     = args.email     || await ask(rl, 'ایمیل: ');
  const phone     = args.phone     || await ask(rl, 'موبایل (09XXXXXXXXX): ');
  rl.close();

  const password = await askSecret('رمز عبور (حداقل ۸ کاراکتر): ');
  const confirm  = await askSecret('تکرار رمز عبور: ');

  const errors = validateInput({ firstName, lastName, username, email, phone, password, confirm });
  if (errors.length) {
    console.error('\n❌ خطا:');
    errors.forEach(e => console.error('   ✗ ' + e));
    process.exit(1);
  }

  await mongoose.connect(config.mongodb.uri);

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { phone: phone.trim() }, { username: username.trim() }],
  });

  if (existing) {
    console.error('\n❌ کاربری با این ایمیل، موبایل یا نام کاربری از قبل وجود دارد.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const user = await User.create({
    firstName: firstName.trim(),
    lastName:  lastName.trim(),
    username:  username.trim(),
    email:     normalizedEmail,
    phone:     phone.trim(),
    password:  await bcrypt.hash(password, config.security.bcryptRounds),
    role:      'admin',
    status:    true,
  });

  console.log('\n✅ ادمین ساخته شد:', user.username, '(' + user.email + ')');
  console.log('   ورود به پنل: /admin/login');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\n❌', err.message);
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  process.exit(1);
});
