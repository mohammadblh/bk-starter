const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../serverReview');
const { User } = require('../models');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany(); // پاک کردن داده‌ها بعد از هر تست
});

describe('POST /api/register', () => {
  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/register') // مسیر واقعی ثبت‌نام
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
        role: 'user'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.username).toBe('testuser');
  });

  it('should not register user with existing email', async () => {
    await User.create({
      username: 'existing',
      email: 'exist@example.com',
      password: 'hashedPassword',
      fullName: 'Existing User'
    });

    const res = await request(app)
      .post('/api/register')
      .send({
        username: 'newuser',
        email: 'exist@example.com',
        password: 'password123',
        fullName: 'New User'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it('should return validation error for short password', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({
        username: 'shortpass',
        email: 'short@example.com',
        password: '123',
        fullName: 'Short Pass'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/password/i);
  });
});
