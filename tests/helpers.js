'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/user.model');
const { signAccessToken } = require('../utils/token.util');
const { resetRateLimits } = require('../middleware/rateLimit.middleware');

let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

async function disconnect() {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

async function reset() {
  await User.deleteMany({});
  await resetRateLimits();
}

async function makeUser(overrides = {}) {
  const base = {
    firstName: 'Test',
    lastName:  'User',
    username:  'testuser' + Math.floor(Math.random() * 1e6),
    email:     'user' + Math.floor(Math.random() * 1e6) + '@example.com',
    phone:     '09' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'),
    role:      'user',
    status:    true,
  };
  const plainPassword = overrides.password || 'Password123!';
  const data = { ...base, ...overrides, password: await bcrypt.hash(plainPassword, 4) };

  const user = await User.create(data);
  return { user, plainPassword, token: signAccessToken(user) };
}

const makeAdmin = (overrides = {}) => makeUser({ ...overrides, role: 'admin' });

module.exports = { connect, disconnect, reset, makeUser, makeAdmin };
