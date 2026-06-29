const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

// ============ CONFIGURATION ============
// ADMIN_PANEL_ENABLED: Set to false to completely disable the admin panel
const ADMIN_PANEL_ENABLED = true;
// =======================================

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
// const uploadRoutes = require('./routes/uploader.routes');

// Admin Panel (only if enabled)
let adminRoutes = null;
if (ADMIN_PANEL_ENABLED) {
  adminRoutes = require('./routes/admin.routes');
}

// Initialize express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(morgan('dev'));

// Serve static assets (for admin panel)
app.use('/assets', express.static('public/assets'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodbg:27017/starter', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Could not connect to MongoDB', err));

// Routes
app.use('/api/auth', authRoutes);
// app.use('/api/uploader', uploadRoutes);
app.use('/api/users', userRoutes);

// Admin Panel Routes (protected by API Key path)
if (ADMIN_PANEL_ENABLED) {
  const ADMIN_KEY = process.env.ADMIN_KEY || 'super-secret-admin';
  app.use(`/${ADMIN_KEY}`, adminRoutes);
  console.log(`✅ Admin Panel enabled at /${ADMIN_KEY}`);
} else {
  console.log('⛔ Admin Panel is disabled');
}

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to Starter API');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: 'Something went wrong!', error: err.message });
});

// Start server
const PORT = process.env.PORT || 3030;
const HTTPS_PORT = process.env.HTTPS_PORT || 3031;

// HTTP Server
app.listen(PORT, () => {
  console.log(`HTTP Server running on port ${PORT}`);
});

// HTTPS Server with SSL
!process.env.NODE_ENV && https.createServer({
  key: fs.readFileSync('/etc/letsencrypt/live/effiscope.space/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/effiscope.space/fullchain.pem'),
}, app).listen(HTTPS_PORT, (err) => {
  if (err) console.log(err);
  else console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
});

module.exports = app;
