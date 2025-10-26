const User = require('../models/user.model');

// دریافت لیست کاربران (فقط برای ادمین)
// exports.getAllUsers = async (req, res) => {
//   try {
//     const { page = 1, limit = 10, search } = req.query;
    
//     // ایجاد کوئری جستجو
//     const query = {};
//     if (search) {
//       query.$or = [
//         { username: { $regex: search, $options: 'i' } },
//         { email: { $regex: search, $options: 'i' } },
//         { fullName: { $regex: search, $options: 'i' } }
//       ];
//     }
    
//     // شمارش کل کاربران
//     const total = await User.countDocuments(query);
    
//     // دریافت کاربران با صفحه‌بندی
//     const users = await User.find(query)
//       .select('-password')
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(parseInt(limit));
    
//     res.status(200).json({
//       users,
//       totalPages: Math.ceil(total / limit),
//       currentPage: parseInt(page),
//       totalUsers: total
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// دریافت اطلاعات یک کاربر با شناسه
// exports.getUserById = async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id).select('-password');
    
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }
    
//     // فقط ادمین یا خود کاربر می‌تواند اطلاعات کامل را ببیند
//     if (req.userId !== req.params.id && req.userRole !== 'admin') {
//       // برای سایر کاربران، فقط اطلاعات عمومی را برگردان
//       return res.status(200).json({
//         _id: user._id,
//         username: user.username,
//         fullName: user.fullName,
//         profileImage: user.profileImage,
//         bio: user.bio
//       });
//     }
    
//     res.status(200).json(user);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// بروزرسانی اطلاعات کاربر
// exports.updateUser = async (req, res) => {
//   try {
//     // بررسی دسترسی (فقط خود کاربر یا ادمین)
//     const user = await User.findById(req.params.id);
    
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }
    
//     const currentUser = await User.findById(req.userId);
    
//     if (req.params.id !== req.userId && currentUser.role !== 'admin') {
//       return res.status(403).json({ message: 'You do not have permission to edit this user.' });
//     }
    
//     // فیلدهای قابل بروزرسانی
//     const { fullName, profileImage, bio } = req.body;
    
//     // بروزرسانی فیلدها
//     if (fullName) user.fullName = fullName;
//     if (profileImage) user.profileImage = profileImage;
//     if (bio) user.bio = bio;
    
//     // ذخیره تغییرات
//     await user.save();
    
//     res.status(200).json({
//       message: 'User information was successfully updated.',
//       user: {
//         _id: user._id,
//         username: user.username,
//         email: user.email,
//         fullName: user.fullName,
//         profileImage: user.profileImage,
//         bio: user.bio,
//         role: user.role,
//         isActive: user.isActive
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// غیرفعال/فعال کردن کاربر (فقط ادمین)
// exports.toggleUserStatus = async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id);
    
//     if (!user) {
//       return res.status(404).json({ message: 'User not found.' });
//     }
    
//     // تغییر وضعیت فعال بودن
//     user.isActive = !user.isActive;
//     await user.save();
    
//     res.status(200).json({
//       message: `User successfully ${user.isActive ? 'activated' : 'deactivated'}.`,
//       isActive: user.isActive
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// تغییر نقش کاربر (فقط ادمین)
// exports.changeUserRole = async (req, res) => {
//   try {
//     const { role } = req.body;
    
//     if (!role || !['user', 'company_manager', 'admin'].includes(role)) {
//       return res.status(400).json({ message: 'The role is invalid.' });
//     }
    
//     const user = await User.findById(req.params.id);
    
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }
    
//     // تغییر نقش کاربر
//     user.role = role;
//     await user.save();
    
//     res.status(200).json({
//       message: 'User role successfully changed.',
//       role: user.role
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };