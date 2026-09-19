'use strict';

const request = require('supertest');
const app = require('../server');
const User = require('../models/user.model');
const { connect, disconnect, reset, makeUser, makeAdmin } = require('./helpers');

beforeAll(connect);
afterAll(disconnect);
beforeEach(reset);

describe('POST /api/auth/login', () => {
  it('با ایمیل و رمز درست توکن می‌دهد', async () => {
    const { user, plainPassword } = await makeUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: plainPassword });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('با شماره موبایل هم کار می‌کند', async () => {
    const { user, plainPassword } = await makeUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: user.phone, password: plainPassword });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('حساب غیرفعال نمی‌تواند وارد شود', async () => {
    const { user, plainPassword } = await makeUser({ status: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: plainPassword });

    expect(res.statusCode).toBe(403);
  });

  it('بدون ایمیل و موبایل → ۴۰۰', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'Password123!' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('اطلاعات کاربر فعلی را برمی‌گرداند', async () => {
    const { user, token } = await makeUser();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.username).toBe(user.username);
  });

  it('بدون توکن → ۴۰۱', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  it('با رمز فعلی درست تغییر می‌کند و رمز جدید کار می‌کند', async () => {
    const { user, plainPassword, token } = await makeUser();

    const change = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: plainPassword, newPassword: 'NewPassword456!' });
    expect(change.statusCode).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'NewPassword456!' });
    expect(login.statusCode).toBe(200);
  });

  it('رمز جدید کوتاه‌تر از ۸ کاراکتر رد می‌شود', async () => {
    const { plainPassword, token } = await makeUser();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: plainPassword, newPassword: 'short' });

    expect(res.statusCode).toBe(400);
  });
});

describe('CRUD کاربران (فقط ادمین)', () => {
  it('ادمین کاربر می‌سازد و رمز hash می‌شود', async () => {
    const { token } = await makeAdmin();

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'New', lastName: 'Person', username: 'newperson',
        email: 'newperson@example.com', phone: '09121112233',
        password: 'Password123!', role: 'user',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.user).not.toHaveProperty('password');

    const stored = await User.findById(res.body.user.id).select('+password');
    expect(stored.password).not.toBe('Password123!');
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  it('نقش خارج از enum رد می‌شود', async () => {
    const { token } = await makeAdmin();

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'New', lastName: 'Person', username: 'superuser',
        password: 'Password123!', role: 'superadmin',
      });

    expect(res.statusCode).toBe(400);
  });

  it('کاربر عادی به لیست کاربران دسترسی ندارد', async () => {
    const { token } = await makeUser();
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(403);
  });

  it('صفحه‌بندی و جستجو کار می‌کند', async () => {
    const { token } = await makeAdmin();
    await makeUser({ firstName: 'Zahra', username: 'zahra1' });
    await makeUser({ firstName: 'Reza',  username: 'reza1' });

    const res = await request(app)
      .get('/api/users?page=1&limit=10&search=Zahra')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].firstName).toBe('Zahra');
  });
});
