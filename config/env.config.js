'use strict';

/**
 * SCN-051 / SCN-052 — Centralized Environment & Secret Management
 *
 * این ماژول تمام متغیرهای محیطی را در یک جا validate و export می‌کند.
 * هیچ جای دیگری در کد نباید مستقیم به process.env دسترسی داشته باشد.
 */

const crypto = require('crypto');

// ── Validation helpers ───────────────────────────────────────────────────────

function required(key) {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(
      `[SCN-051] Missing required environment variable: "${key}"\n` +
      `  → فایل .env را بررسی کنید. نمونه: .env.example`
    );
  }
  return val.trim();
}

function optional(key, defaultValue = null) {
  const val = process.env[key];
  return val && val.trim() !== '' ? val.trim() : defaultValue;
}

function requireMinLength(key, minLen = 32) {
  const val = required(key);
  if (val.length < minLen) {
    throw new Error(
      `[SCN-051] Secret "${key}" is too short (${val.length} chars). ` +
      `Minimum: ${minLen} chars.\n` +
      `  → برای تولید: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
    );
  }
  // آگاه‌سازی از placeholder های رایج
  const WEAK_PLACEHOLDERS = [
    'your-secret-key', 'secret', 'password', '12345', 'changeme',
    'replace_with', 'your_key', 'your_secret',
  ];
  const lower = val.toLowerCase();
  if (WEAK_PLACEHOLDERS.some(p => lower.includes(p))) {
    throw new Error(
      `[SCN-051] Secret "${key}" looks like a placeholder ("${val.substring(0, 20)}..."). ` +
      `لطفاً مقدار واقعی تنظیم کنید.`
    );
  }
  return val;
}

function requireNodeEnv() {
  const env = optional('NODE_ENV', 'development');
  const valid = ['development', 'test', 'staging', 'production'];
  if (!valid.includes(env)) {
    throw new Error(`[SCN-051] Invalid NODE_ENV: "${env}". Must be one of: ${valid.join(', ')}`);
  }
  return env;
}

// ── در production، env vars ضعیف را رد کن ────────────────────────────────────

function productionGuard(config) {
  if (config.NODE_ENV !== 'production') return;

  const checks = [
    [!config.jwt.secret || config.jwt.secret.length < 64,
      'JWT_SECRET باید در production حداقل ۶۴ کاراکتر باشد'],
    [!config.mongodb.uri.startsWith('mongodb'),
      'MONGODB_URI معتبر نیست'],
    [!config.aws.accessKeyId.startsWith('AKIA'),
      'AWS_ACCESS_KEY_ID فرمت معتبر ندارد'],
  ];

  const failures = checks.filter(([cond]) => cond).map(([, msg]) => msg);
  if (failures.length > 0) {
    throw new Error(
      '[SCN-051] Production security checks failed:\n' +
      failures.map(f => `  ✗ ${f}`).join('\n')
    );
  }
}

// ── Config object ─────────────────────────────────────────────────────────────

function buildConfig() {
  const NODE_ENV = requireNodeEnv();
  const isProd   = NODE_ENV === 'production';

  const config = {
    NODE_ENV,
    isProd,
    port: parseInt(optional('PORT', '3000'), 10),

    jwt: {
      secret:         requireMinLength('JWT_SECRET', isProd ? 64 : 32),
      expiresIn:      optional('JWT_EXPIRES_IN', '7d'),
      refreshSecret:  requireMinLength('JWT_REFRESH_SECRET', isProd ? 64 : 32),
      refreshExpires: optional('JWT_REFRESH_EXPIRES_IN', '30d'),
    },

    mongodb: {
      uri: required('MONGODB_URI'),
    },

    aws: {
      accessKeyId:     required('AWS_ACCESS_KEY_ID'),
      secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
      region:          optional('AWS_REGION', 'us-east-1'),
      s3Bucket:        required('AWS_S3_BUCKET'),
    },

    firebase: {
      // Client-side — فقط اگه backend نیاز دارد به Firebase JS SDK
      apiKey:            optional('FIREBASE_API_KEY'),
      authDomain:        optional('FIREBASE_AUTH_DOMAIN'),
      projectId:         optional('FIREBASE_PROJECT_ID'),
      storageBucket:     optional('FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: optional('FIREBASE_MESSAGING_SENDER_ID'),
      appId:             optional('FIREBASE_APP_ID'),
      measurementId:     optional('FIREBASE_MEASUREMENT_ID'),

      // Admin SDK (سرور) — یکی از دو روش زیر
      serviceAccountPath: optional('FIREBASE_SERVICE_ACCOUNT_PATH'),
      serviceAccountJson: optional('FIREBASE_SERVICE_ACCOUNT_JSON'),
    },

    email: {
      host: optional('SMTP_HOST'),
      port: parseInt(optional('SMTP_PORT', '587'), 10),
      user: optional('SMTP_USER'),
      pass: optional('SMTP_PASS'),
    },

    sms: {
      apiKey: optional('SMS_API_KEY'),
      apiUrl: optional('SMS_API_URL'),
    },

    encryption: {
      key: optional('ENCRYPTION_KEY'),
    },
  };

  productionGuard(config);
  return config;
}

// ── Singleton — فقط یک بار ساخته و validate می‌شود ──────────────────────────

let _config = null;

function getConfig() {
  if (!_config) {
    _config = buildConfig();
  }
  return _config;
}

module.exports = { getConfig };