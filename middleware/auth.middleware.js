const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const blhLog = require('./logger.middleware');

// میدلور بررسی توکن احراز هویت
const verifyToken = async (req, res, next) => {
  const token = req.headers['x-access-token'] || req.headers['authorization'];
  
  if (!token) {
    return res.status(403).json({ message: 'Authentication token not provided.' });
  }

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'your-secret-key');
    // blhLog("decoded", decoded)
    req.user =  await User.findById(decoded.id, 'username fullName email role profileImage isActive');
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'The token is invalid.' });
  }
};

// میدلور بررسی نقش ادمین
const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access is restricted. Requires admin role.' });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


module.exports = {
  verifyToken,
  isAdmin,
};