'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');

// fail-fast: اگر secret ای ناقص یا ضعیف باشد اپ اینجا متوقف می‌شود.
// هیچ مقدار fallback ناامنی در کد وجود ندارد.
const { getConfig } = require('./config/env.config');
const config = getConfig();

const { generalLimiter } = require('./middleware/rateLimit.middleware');
const { serverError } = require('./utils/http.util');

const app = express();

// ── Proxy ────────────────────────────────────────────────────────────────────
// پشت nginx/ALB، بدون این تنظیم req.ip آدرس پراکسی است و rate limiting
// همه‌ی کاربران را یک نفر می‌بیند.
app.set('trust proxy', config.security.trustProxy);
app.disable('x-powered-by');

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // نه 'unsafe-inline' و نه 'unsafe-eval': تمام JavaScript پنل در
      // فایل‌های جدا است و هیچ inline handler ای وجود ندارد.
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      // Tailwind در زمان اجرا یک <style> تزریق می‌کند و به این نیاز دارد.
      // CSS injection در مقایسه با script injection خطر به‌مراتب کمتری دارد.
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      ...(config.isProd ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'same-origin' },
  hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
// لیست سفید صریح — هرگز "*"، مخصوصاً چون credentials فعال است.
app.use(cors({
  origin(origin, callback) {
    // درخواست‌های بدون Origin (curl، اپ موبایل، same-origin) مجازند
    if (!origin) return callback(null, true);
    if (config.cors.origins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Access-Token'],
}));

// ── Body & cookies ───────────────────────────────────────────────────────────
app.use(express.json({ limit: config.security.jsonBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: config.security.jsonBodyLimit }));
app.use(cookieParser());

// حذف کلیدهای شروع‌شونده با $ و شامل نقطه — لایه‌ی دوم دفاع در برابر
// NoSQL operator injection (لایه‌ی اول ولیدیشن Joi در هر مسیر است).
app.use(mongoSanitize({ replaceWith: '_' }));

// جلوگیری از HTTP Parameter Pollution (?role=user&role=admin)
app.use(hpp());

app.use(compression());

// ── Logging ──────────────────────────────────────────────────────────────────
if (!config.isTest) {
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
}

// ── Static assets ────────────────────────────────────────────────────────────
// قبل از rate limiter: لود شدن دارایی‌های پنل (چند فایل در هر بازدید)
// نباید سهم درخواست‌های API کاربر را مصرف کند. این فایل‌ها cache می‌شوند
// و پشت reverse proxy سرو خواهند شد.
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), {
  dotfiles: 'ignore',
  maxAge: config.isProd ? '7d' : 0,
  index: false,
}));

// ── Rate limiting ────────────────────────────────────────────────────────────
app.use(generalLimiter);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
// app.use('/api/uploader', require('./routes/uploader.routes'));

// پنل مدیریت — به صورت پیش‌فرض خاموش است.
// مسیر ثابت /admin است و با لاگین واقعی + نقش ادمین محافظت می‌شود؛
// «مخفی بودن مسیر» هیچ‌وقت یک مکانیزم احراز هویت نبوده است.
if (config.admin.panelEnabled) {
  app.use('/admin', require('./routes/admin.routes'));
  console.log('✅ Admin panel enabled at /admin');
} else {
  console.log('⛔ Admin panel is disabled (ADMIN_PANEL_ENABLED=false)');
}

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Starter API' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' });
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// ── Error handler ────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'حجم درخواست بیش از حد مجاز است' });
  }
  if (err && (err instanceof SyntaxError) && 'body' in err) {
    return res.status(400).json({ message: 'بدنه‌ی درخواست JSON معتبر نیست' });
  }
  // جزئیات فقط در لاگ سرور — هرگز به کلاینت
  return serverError(res, err, 'unhandled');
});

// ── Startup ──────────────────────────────────────────────────────────────────

async function connectDB() {
  await mongoose.connect(config.mongodb.uri);
  console.log('Connected to MongoDB');
}

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`HTTP server running on port ${config.port} [${config.NODE_ENV}]`);
  });
}

// TLS توسط reverse proxy (nginx / Caddy / ALB) انجام می‌شود —
// اپ هرگز نباید مسیر گواهی را hardcode کند.
if (require.main === module) {
  start();
}

module.exports = app;
