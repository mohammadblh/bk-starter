'use strict';

/**
 * قبل از لود شدن هر ماژولی اجرا می‌شود.
 *
 * server.js در زمان require تابع getConfig() را صدا می‌زند و اگر
 * secret ها ناقص باشند fail-fast می‌کند — پس باید اینجا ست شوند.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = require('crypto').randomBytes(32).toString('hex');
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/placeholder-replaced-at-runtime';
process.env.CORS_ORIGINS = 'http://localhost:3000';

// پنل ادمین برای تست‌های مربوط به آن روشن است
process.env.ADMIN_PANEL_ENABLED = 'true';
process.env.ADMIN_COOKIE_SECURE = 'false';

// cost پایین تا تست‌ها کند نشوند (در production مقدار واقعی ۱۲ است)
process.env.BCRYPT_ROUNDS = '4';

// سقف‌ها صریح ست می‌شوند تا تست rate limit قابل پیش‌بینی باشد
process.env.RATE_LIMIT_MAX = '1000';
process.env.AUTH_RATE_LIMIT_MAX = '5';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
