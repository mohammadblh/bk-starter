const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },

    password: { type: String, required: true },

    role: { 
      type: String, 
      enum: ["admin", "user"], 
      required: true 
    },
    
    status: { type: Boolean, default: true }, // فعال یا غیرفعال
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
