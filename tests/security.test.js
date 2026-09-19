'use strict';

/**
 * تست‌های رگرسیون امنیتی.
 *
 * هر تست اینجا به یک رخنه‌ی واقعی که در بررسی امنیتی پیدا شد گره خورده است.
 * اگر یکی از این‌ها قرمز شد، یعنی آن رخنه برگشته.
 */

const request = require('supertest');
const app = require('../server');
const User = require('../models/user.model');
const { connect, disconnect, reset, makeUser, makeAdmin } = require('./helpers');

beforeAll(connect);
afterAll(disconnect);
beforeEach(reset);

// ── C1: دور زدن احراز هویت با API key ثابت ───────────────────────────────────
describe('C1 — بدون bypass با x-api-key', () => {
  it('هدر x-api-key نباید دسترسی ادمین بدهد', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('x-api-key', 'super-secret-admin');
    expect(res.statusCode).toBe(401);
  });

  it('query string api_key نباید دسترسی ادمین بدهد', async () => {
    const res = await request(app).get('/api/users?api_key=super-secret-admin');
    expect(res.statusCode).toBe(401);
  });

  it('بدون هیچ توکنی دسترسی ممنوع است', async () => {
    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(401);
  });
});

// ── C2: ثبت‌نام ادمین عمومی ──────────────────────────────────────────────────
describe('C2 — ثبت ادمین فقط برای ادمین', () => {
  const payload = {
    firstName: 'Mal', lastName: 'Actor', username: 'malactor',
    email: 'mal@example.com', phone: '09120000000', password: 'Password123!',
  };

  it('بدون توکن → ۴۰۱ و هیچ کاربری ساخته نمی‌شود', async () => {
    const res = await request(app).post('/api/auth/register/admin').send(payload);
    expect(res.statusCode).toBe(401);
    expect(await User.countDocuments()).toBe(0);
  });

  it('با توکن کاربر عادی → ۴۰۳', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post('/api/auth/register/admin')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(res.statusCode).toBe(403);
  });

  it('با توکن ادمین → ۲۰۱', async () => {
    const { token } = await makeAdmin();
    const res = await request(app)
      .post('/api/auth/register/admin')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.admin).not.toHaveProperty('password');
  });
});

// ── C3: JWT secret پیش‌فرض ───────────────────────────────────────────────────
describe('C3 — توکن جعلی با secret پیش‌فرض رد می‌شود', () => {
  it('توکن امضا شده با your-secret-key معتبر نیست', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ id: '507f1f77bcf86cd799439011', role: 'admin' }, 'your-secret-key');
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${forged}`);
    expect(res.statusCode).toBe(401);
  });

  it('الگوریتم none پذیرفته نمی‌شود', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ id: '507f1f77bcf86cd799439011', role: 'admin' })).toString('base64url');
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${header}.${body}.`);
    expect(res.statusCode).toBe(401);
  });
});

// ── C4: پنل ادمین بدون احراز هویت ────────────────────────────────────────────
describe('C4 — پنل ادمین پشت نشست معتبر', () => {
  it('config-json بدون cookie → ۴۰۱', async () => {
    const res = await request(app).get('/admin/config-json');
    expect(res.statusCode).toBe(401);
  });

  it('صفحه پنل بدون نشست به لاگین redirect می‌شود', async () => {
    const res = await request(app).get('/admin');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/admin/login');
  });

  it('کاربر غیر ادمین نمی‌تواند وارد پنل شود', async () => {
    const { plainPassword, user } = await makeUser();
    const res = await request(app)
      .post('/admin/login')
      .send({ email: user.email, password: plainPassword });
    expect(res.statusCode).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('ادمین وارد می‌شود و cookie با httpOnly و SameSite=Strict ست می‌شود', async () => {
    const { plainPassword, user } = await makeAdmin();
    const res = await request(app)
      .post('/admin/login')
      .send({ email: user.email, password: plainPassword });

    expect(res.statusCode).toBe(200);
    // توکن هرگز در بدنه‌ی پاسخ برنمی‌گردد — فقط در cookie
    expect(res.body).not.toHaveProperty('token');

    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('با نشست معتبر، config-json در دسترس است', async () => {
    const { plainPassword, user } = await makeAdmin();
    const agent = request.agent(app);
    await agent.post('/admin/login').send({ email: user.email, password: plainPassword });

    const res = await agent.get('/admin/config-json').set('X-Requested-With', 'XMLHttpRequest');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('cookie بدون هدر X-Requested-With روی API کار نمی‌کند (CSRF)', async () => {
    const { plainPassword, user } = await makeAdmin();
    const agent = request.agent(app);
    await agent.post('/admin/login').send({ email: user.email, password: plainPassword });

    const noHeader = await agent.get('/api/users');
    expect(noHeader.statusCode).toBe(401);

    const withHeader = await agent.get('/api/users').set('X-Requested-With', 'XMLHttpRequest');
    expect(withHeader.statusCode).toBe(200);
  });
});

// ── H2: NoSQL operator injection ─────────────────────────────────────────────
describe('H2 — NoSQL injection در لاگین بسته است', () => {
  it('{"$gt":""} به جای ایمیل رد می‌شود', async () => {
    await makeAdmin({ email: 'admin@example.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: 'anything' });
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toHaveProperty('token');
  });

  it('{"$ne":null} به جای رمز رد می‌شود', async () => {
    await makeAdmin({ email: 'admin2@example.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin2@example.com', password: { $ne: null } });
    expect(res.statusCode).toBe(400);
  });

  it('regex injection در جستجوی کاربران به متن ساده تبدیل می‌شود', async () => {
    const { token } = await makeAdmin();
    await makeUser({ firstName: 'Ali' });

    const res = await request(app)
      .get('/api/users?search=' + encodeURIComponent('.*'))
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    // ".*" باید به صورت تحت‌اللفظی جستجو شود، نه به عنوان الگو
    expect(res.body.users.length).toBe(0);
  });
});

// ── H3: Rate limiting ────────────────────────────────────────────────────────
describe('H3 — brute force روی لاگین محدود است', () => {
  it('بعد از ۵ تلاش ناموفق، ۴۲۹ برمی‌گردد', async () => {
    await makeUser({ email: 'victim@example.com' });

    const codes = [];
    for (let i = 0; i < 7; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'victim@example.com', password: 'wrong-password' });
      codes.push(res.statusCode);
    }

    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes[5]).toBe(429);
    expect(codes[6]).toBe(429);
  });
});

// ── H4: CORS ─────────────────────────────────────────────────────────────────
describe('H4 — CORS فقط دامنه‌های لیست سفید', () => {
  it('دامنه‌ی مجاز پذیرفته می‌شود', async () => {
    const res = await request(app).get('/').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('دامنه‌ی مهاجم رد می‌شود و هرگز * برنمی‌گردد', async () => {
    const res = await request(app).get('/').set('Origin', 'https://evil.example.com');
    expect(res.statusCode).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

// ── H1 / M1: افشای اطلاعات ───────────────────────────────────────────────────
describe('M1 — جزئیات خطا و رمز افشا نمی‌شوند', () => {
  it('شناسه‌ی نامعتبر پیام mongoose برنمی‌گرداند', async () => {
    const { token } = await makeAdmin();
    const res = await request(app)
      .get('/api/users/not-a-valid-objectid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/Cast to ObjectId|mongoose|stack/i);
  });

  it('هیچ endpoint ای فیلد password برنمی‌گرداند', async () => {
    const { token } = await makeAdmin();
    await makeUser();

    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(JSON.stringify(list.body)).not.toMatch(/"password"/);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body).not.toHaveProperty('password');
  });

  it('پیام لاگین برای کاربر ناموجود و رمز غلط یکسان است', async () => {
    const { user } = await makeUser({ email: 'known@example.com' });

    const wrongPass = await request(app)
      .post('/api/auth/login').send({ email: user.email, password: 'nope-nope-nope' });
    const noUser = await request(app)
      .post('/api/auth/login').send({ email: 'unknown@example.com', password: 'nope-nope-nope' });

    expect(wrongPass.statusCode).toBe(noUser.statusCode);
    expect(wrongPass.body.message).toBe(noUser.body.message);
  });
});

// ── M4: سقف صفحه‌بندی ────────────────────────────────────────────────────────
describe('M4 — limit سقف دارد', () => {
  it('limit=999999 رد می‌شود', async () => {
    const { token } = await makeAdmin();
    const res = await request(app)
      .get('/api/users?limit=999999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(400);
  });
});

// ── M5: باطل شدن توکن ────────────────────────────────────────────────────────
describe('M5 — توکن کاربر غیرفعال یا حذف‌شده کار نمی‌کند', () => {
  it('کاربر غیرفعال شده با توکن قبلی رد می‌شود', async () => {
    const { user, token } = await makeAdmin();

    const before = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(before.statusCode).toBe(200);

    await User.findByIdAndUpdate(user._id, { status: false });

    const after = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(after.statusCode).toBe(401);
  });

  it('کاربر حذف شده ۴۰۱ می‌گیرد (نه ۵۰۰)', async () => {
    const { user, token } = await makeAdmin();
    await User.findByIdAndDelete(user._id);

    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(401);
  });
});

// ── هدرهای امنیتی ────────────────────────────────────────────────────────────
describe('هدرهای امنیتی', () => {
  it('CSP بدون unsafe-eval و بدون inline script', async () => {
    const res = await request(app).get('/');
    const csp = res.headers['content-security-policy'];

    expect(csp).toBeDefined();
    expect(csp).not.toMatch(/unsafe-eval/);
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).toMatch(/script-src-attr 'none'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
  });

  it('X-Powered-By افشا نمی‌شود', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

// ── مالکیت و قفل نشدن بیرون سیستم ────────────────────────────────────────────
describe('محافظت از حساب خود ادمین', () => {
  it('ادمین نمی‌تواند حساب خودش را حذف کند', async () => {
    const { user, token } = await makeAdmin();
    const res = await request(app)
      .delete(`/api/users/${user._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(400);
  });

  it('ادمین نمی‌تواند نقش خودش را پایین بیاورد', async () => {
    const { user, token } = await makeAdmin();
    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'user' });
    expect(res.statusCode).toBe(400);
  });
});
