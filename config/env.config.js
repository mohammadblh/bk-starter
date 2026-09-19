'use strict';

/**
 * Centralized Environment & Secret Management
 *
 * تمام متغیرهای محیطی در این ماژول validate و export می‌شوند.
 * هیچ جای دیگری در کد نباید مستقیم به process.env دسترسی داشته باشد.
 *
 * اپ در صورت نبود یا ضعیف بودن secret های حیاتی fail-fast می‌کند —
 * هرگز با مقدار fallback ناامن بالا نمی‌آید.
 */

// ── Validation helpers ───────────────────────────────────────────────────────

function required(key) {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(
      `[config] Missing required environment variable: "${key}"\n` +
      `  → فایل .env را بررسی کنید. نمونه: .env.example`
    );
  }
  return val.trim();
}

function optional(key, defaultValue = null) {
  const val = process.env[key];
  return val && val.trim() !== '' ? val.trim() : defaultValue;
}

function optionalBool(key, defaultValue = false) {
  const val = optional(key);
  if (val === null) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(val.toLowerCase());
}

function optionalInt(key, defaultValue) {
  const val = optional(key);
  if (val === null) return defaultValue;
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) {
    throw new Error(`[config] "${key}" باید عدد باشد (مقدار فعلی: "${val}")`);
  }
  return n;
}

function optionalList(key, defaultValue = []) {
  const val = optional(key);
  if (val === null) return defaultValue;
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

const WEAK_PLACEHOLDERS = [
  'your-secret-key', 'your_secret_key', 'super-secret-admin',
  'secret', 'password', '12345', 'changeme',
  'replace_with', 'your_key', 'your_secret', 'example',
];

function assertStrongSecret(key, val, minLen) {
  if (val.length < minLen) {
    throw new Error(
      `[config] Secret "${key}" is too short (${val.length} chars). Minimum: ${minLen}.\n` +
      `  → برای تولید: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  const lower = val.toLowerCase();
  const hit = WEAK_PLACEHOLDERS.find(p => lower.includes(p));
  if (hit) {
    throw new Error(
      `[config] Secret "${key}" شبیه placeholder است (شامل "${hit}"). ` +
      `لطفاً مقدار تصادفی واقعی تنظیم کنید.`
    );
  }
  return val;
}

function requireStrongSecret(key, minLen = 32) {
  return assertStrongSecret(key, required(key), minLen);
}

function optionalStrongSecret(key, minLen = 32) {
  const val = optional(key);
  return val === null ? null : assertStrongSecret(key, val, minLen);
}

function requireNodeEnv() {
  const env = optional('NODE_ENV', 'development');
  const valid = ['development', 'test', 'staging', 'production'];
  if (!valid.includes(env)) {
    throw new Error(`[config] Invalid NODE_ENV: "${env}". Must be one of: ${valid.join(', ')}`);
  }
  return env;
}

// ── Production guard ─────────────────────────────────────────────────────────

function productionGuard(config) {
  if (!config.isProd) return;

  const checks = [
    [!/^mongodb(\+srv)?:\/\//.test(config.mongodb.uri),
      'MONGODB_URI معتبر نیست'],
    [config.cors.origins.length === 0,
      'CORS_ORIGINS در production الزامی است (لیست دامنه‌های مجاز، کاما-جدا)'],
    [config.cors.origins.includes('*'),
      'CORS_ORIGINS نباید در production برابر "*" باشد'],
    [config.admin.panelEnabled && !config.admin.cookieSecure,
      'وقتی پنل ادمین در production فعال است ADMIN_COOKIE_SECURE نباید خاموش باشد'],
  ];

  const failures = checks.filter(([cond]) => cond).map(([, msg]) => msg);
  if (failures.length > 0) {
    throw new Error(
      '[config] Production security checks failed:\n' +
      failures.map(f => `  ✗ ${f}`).join('\n')
    );
  }
}

// ── Config object ────────────────────────────────────────────────────────────

function buildConfig() {
  const NODE_ENV = requireNodeEnv();
  const isProd   = NODE_ENV === 'production';
  const isTest   = NODE_ENV === 'test';

  const config = {
    NODE_ENV,
    isProd,
    isTest,
    port: optionalInt('PORT', 3000),

    jwt: {
      secret:         requireStrongSecret('JWT_SECRET', isProd ? 64 : 32),
      expiresIn:      optional('JWT_EXPIRES_IN', '24h'),
      // فقط اگر جریان refresh token پیاده شود لازم است
      refreshSecret:  optionalStrongSecret('JWT_REFRESH_SECRET', isProd ? 64 : 32),
      refreshExpires: optional('JWT_REFRESH_EXPIRES_IN', '30d'),
    },

    mongodb: {
      uri: required('MONGODB_URI'),
    },

    cors: {
      // در dev پیش‌فرض localhost — هرگز "*"
      origins: optionalList('CORS_ORIGINS', isProd ? [] : ['http://localhost:3000']),
      credentials: true,
    },

    admin: {
      // پنل ادمین به صورت پیش‌فرض خاموش است — باید صریحاً روشن شود
      panelEnabled: optionalBool('ADMIN_PANEL_ENABLED', false),
      cookieName:   optional('ADMIN_COOKIE_NAME', 'admin_session'),
      cookieSecure: optionalBool('ADMIN_COOKIE_SECURE', isProd),
    },

    security: {
      jsonBodyLimit:    optional('JSON_BODY_LIMIT', '100kb'),
      trustProxy:       optionalInt('TRUST_PROXY_HOPS', 1),
      rateLimitWindowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
      rateLimitMax:      optionalInt('RATE_LIMIT_MAX', 100),
      authRateLimitMax:  optionalInt('AUTH_RATE_LIMIT_MAX', 5),
      bcryptRounds:      optionalInt('BCRYPT_ROUNDS', 12),
      maxPageSize:       optionalInt('MAX_PAGE_SIZE', 100),
    },

    // AWS و Firebase اختیاری هستند — استارتر بدون آن‌ها هم باید بالا بیاید.
    // اعتبارسنجی به صورت lazy و فقط هنگام استفاده انجام می‌شود.
    aws: {
      accessKeyId:     optional('AWS_ACCESS_KEY_ID'),
      secretAccessKey: optional('AWS_SECRET_ACCESS_KEY'),
      region:          optional('AWS_REGION', 'us-east-1'),
      s3Bucket:        optional('AWS_S3_BUCKET'),
    },

    firebase: {
      apiKey:            optional('FIREBASE_API_KEY'),
      authDomain:        optional('FIREBASE_AUTH_DOMAIN'),
      projectId:         optional('FIREBASE_PROJECT_ID'),
      storageBucket:     optional('FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: optional('FIREBASE_MESSAGING_SENDER_ID'),
      appId:             optional('FIREBASE_APP_ID'),
      measurementId:     optional('FIREBASE_MEASUREMENT_ID'),

      serviceAccountPath: optional('FIREBASE_SERVICE_ACCOUNT_PATH'),
      serviceAccountJson: optional('FIREBASE_SERVICE_ACCOUNT_JSON'),
    },

    email: {
      host: optional('SMTP_HOST'),
      port: optionalInt('SMTP_PORT', 587),
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

// ── Lazy validators برای سرویس‌های اختیاری ──────────────────────────────────

/**
 * فقط زمانی صدا زده می‌شود که کد واقعاً می‌خواهد از S3 استفاده کند.
 * توجه: اگر روی EC2/ECS با IAM Role اجرا می‌شود، access key لازم نیست —
 * در آن حالت فقط bucket باید ست باشد و SDK خودش credential را پیدا می‌کند.
 */
function requireAwsConfig() {
  const { aws } = getConfig();
  const missing = [];
  if (!aws.s3Bucket) missing.push('AWS_S3_BUCKET');
  if (!aws.region)   missing.push('AWS_REGION');
  if (missing.length) {
    throw new Error(
      `[config] برای استفاده از S3 این متغیرها لازم‌اند: ${missing.join(', ')}`
    );
  }
  // اگر یکی از دو کلید ست شده، هر دو باید ست باشند
  if (Boolean(aws.accessKeyId) !== Boolean(aws.secretAccessKey)) {
    throw new Error(
      '[config] AWS_ACCESS_KEY_ID و AWS_SECRET_ACCESS_KEY باید با هم ست شوند ' +
      '(یا هر دو خالی بمانند تا از IAM Role استفاده شود)'
    );
  }
  return aws;
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _config = null;

function getConfig() {
  if (!_config) {
    _config = buildConfig();
  }
  return _config;
}

// فقط برای تست‌ها
function _resetConfigForTests() {
  _config = null;
}

module.exports = { getConfig, requireAwsConfig, _resetConfigForTests };
