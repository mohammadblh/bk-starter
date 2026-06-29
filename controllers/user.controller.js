const User = require('../models/user.model');
const bcrypt = require('bcryptjs');

// دریافت لیست کاربران (فقط برای ادمین)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    // ایجاد کوئری جستجو
    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // شمارش کل کاربران
    const total = await User.countDocuments(query);
    
    // دریافت کاربران با صفحه‌بندی
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.status(200).json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      totalUsers: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// دریافت اطلاعات یک کاربر با شناسه
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ایجاد کاربر جدید (ادمین)
exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, username, email, phone, password, role, status } = req.body;

    if (!firstName || !lastName || !username || !password || !role) {
      return res.status(400).json({ message: 'All required fields must be provided.' });
    }

    // بررسی تکراری نبودن نام کاربری
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username is already taken.' });
    }

    // بررسی تکراری نبودن ایمیل
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email is already registered.' });
      }
    }

    // بررسی تکراری نبودن تلفن
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ message: 'Phone is already registered.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      username,
      email,
      phone,
      password: hashedPassword,
      role,
      status: status !== undefined ? status : true
    });

    await newUser.save();

    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: 'User successfully created.',
      user: userResponse
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// بروزرسانی اطلاعات کاربر
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const { firstName, lastName, username, email, phone, password, role, status } = req.body;
    
    if (username && username !== user.username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username is already taken.' });
      }
      user.username = username;
    }

    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email is already registered.' });
      }
      user.email = email;
    } else if (email === "") {
      user.email = undefined;
    }

    if (phone && phone !== user.phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ message: 'Phone is already registered.' });
      }
      user.phone = phone;
    } else if (phone === "") {
      user.phone = undefined;
    }
    
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (role) user.role = role;
    if (status !== undefined) user.status = status;
    
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }
    
    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(200).json({
      message: 'User information was successfully updated.',
      user: userResponse
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// حذف کاربر (فقط ادمین)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    res.status(200).json({
      message: 'User successfully deleted.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// غیرفعال/فعال کردن کاربر (فقط ادمین)
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    user.status = !user.status;
    await user.save();
    
    res.status(200).json({
      message: `User successfully ${user.status ? 'activated' : 'deactivated'}.`,
      status: user.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
