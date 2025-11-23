const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { adminSchema} = require('../validations/auth.validation');

// ثبت ادمین جدید
exports.registerAdmin = async (req, res) => {
  try {
    // اعتبارسنجی داده‌ها با Joi
    const { error, value } = adminSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: "خطا در اعتبارسنجی اطلاعات",
        details: error.details.map(d => d.message)
      });
    }

    const { firstName, lastName, email, phone, nationalId, password } = value;

    // بررسی وجود ایمیل یا کد ملی تکراری
    const existingUser = await User.findOne({
      $or: [{ email }, { nationalId }]
    });
    if (existingUser) {
      return res.status(400).json({ message: "کاربری با این ایمیل یا کد ملی وجود دارد" });
    }

    // هش کردن پسورد
    const hashedPassword = await bcrypt.hash(password, 10);

    // ایجاد کاربر ادمین
    const adminUser = new User({
      firstName,
      lastName,
      email,
      phone,
      nationalId,
      password: hashedPassword,
      role: "admin",
      isActive: true
    });

    await adminUser.save();

    res.status(201).json({
      message: "ادمین جدید با موفقیت ثبت شد",
      admin: {
        id: adminUser._id,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        email: adminUser.email,
        phone: adminUser.phone,
        nationalId: adminUser.nationalId,
        role: adminUser.role
      }
    });

  } catch (error) {
    console.error("❌ خطا در ثبت ادمین:", error);
    res.status(500).json({ message: "خطای سرور", error: error.message });
  }
};

// ورود کاربر
exports.login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // جستجو بر اساس ایمیل یا موبایل
    let user = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email/phone or password" });
    }

    // بررسی رمز عبور
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email/phone or password" });
    }

    // بررسی فعال بودن حساب
    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated." });
    }

    // آماده‌سازی دیتا بدون password
    const safeUser = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      email: user.email,
      phone: user.phone,
      nationalId: user.nationalId
    };

    // ایجاد توکن JWT (فقط با داده‌های لازم)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Successful login",
      token,
      user: safeUser
    });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// دریافت اطلاعات کاربر فعلی
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// تغییر رمز عبور
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // یافتن کاربر
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // بررسی رمز عبور فعلی
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'The current password is incorrect.' });
    }
    
    // هش کردن رمز عبور جدید
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // بروزرسانی رمز عبور
    user.password = hashedPassword;
    await user.save();
    
    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
