const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth.routes');
// const userRoutes = require('./routes/user.routes');
// const uploadRoutes = require('./routes/uploader.routes');
// const companyRoutes = require('./routes/company.routes');
// const reviewRoutes = require('./routes/review.routes');
// const responseRoutes = require('./routes/response.routes');
// const categoryRoutes = require('./routes/category.routes');
// const tagRoutes = require('./routes/tag.routes');
// const reportRoutes = require('./routes/report.routes');
// const notificationRoutes = require('./routes/notification.routes');

// Initialize express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Connect to MongoDB
// mongoose.connect('mongodb://root:example@mongodbg:27022/admin?replicaSet=rs0', {
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodbg:27017/starter', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Could not connect to MongoDB', err));

// Routes
app.use('/api/auth', authRoutes);
// app.use('/api/uploader', uploadRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/companies', companyRoutes);
// app.use('/api/reviews', reviewRoutes);
// app.use('/api/responses', responseRoutes);
// app.use('/api/categories', categoryRoutes);
// app.use('/api/tags', tagRoutes);
// app.use('/api/reports', reportRoutes);
// app.use('/api/notifications', notificationRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to Company Review API');
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
!process.env.IS_DEVELOPMENT && https.createServer({
  key: fs.readFileSync('/etc/letsencrypt/live/effiscope.space/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/effiscope.space/fullchain.pem'),
}, app).listen(HTTPS_PORT, (err) => {
  if (err) console.log(err);
  else console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
});

module.exports = app;
