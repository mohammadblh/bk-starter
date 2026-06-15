'use strict';

/**
 * SCN-052 — Firebase Client Config (سمت سرور → ارسال به Frontend)
 *
 * BEFORE (ناامن — در testOTP.html):
 * ───────────────────────────────────────────────────────────────
 *   const firebaseConfig = {
 *     apiKey: "AIzaSyD-REAL-KEY-HERE",          ← در HTML عمومی!
 *     authDomain: "myapp.firebaseapp.com",
 *     projectId: "myapp-12345",
 *     storageBucket: "myapp.appspot.com",
 *     messagingSenderId: "123456789",
 *     appId: "1:123456789:web:abcdef"
 *   };
 *
 * WHY IT MATTERS:
 * ───────────────────────────────────────────────────────────────
 * Firebase API key به تنهایی فقط پروژه را شناسایی می‌کند.
 * اما بدون محدودیت‌های صحیح در Firebase Console:
 *   → می‌توان API را مستقیم صدا زد
 *   → می‌توان OTP را بدون rate limit درخواست داد (SCN-026)
 *   → می‌توان هزینه Firebase را افزایش داد (billing attack)
 *
 * SOLUTION:
 * ───────────────────────────────────────────────────────────────
 * ۱. API key در env var نگه داشته می‌شود
 * ۲. سرور فقط config را به کاربران authenticated می‌دهد
 * ۳. در Firebase Console، key را به دامنه‌های مشخص محدود کنید
 */

const { getConfig } = require('../config/env.config');

/**
 * یک endpoint در server می‌سازید که این را برمی‌گرداند
 * فقط برای کاربران authenticated یا با rate limit
 */
function getPublicFirebaseConfig() {
  const { firebase } = getConfig();

  // فقط فیلدهایی که frontend واقعاً نیاز دارد
  // هرگز service account یا admin credentials اینجا نیایند
  return {
    apiKey:            firebase.apiKey,
    authDomain:        firebase.authDomain,
    projectId:         firebase.projectId,
    storageBucket:     firebase.storageBucket,
    messagingSenderId: firebase.messagingSenderId,
    appId:             firebase.appId,
    // measurementId فقط اگر analytics فعال است
    ...(firebase.measurementId ? { measurementId: firebase.measurementId } : {}),
  };
}

/**
 * Express route handler — config را به client می‌دهد
 *
 * استفاده:
 *   router.get('/firebase-config', authMiddleware, getFirebaseConfigHandler);
 *
 * یا اگر config باید public باشد، rate limit اضافه کنید:
 *   router.get('/firebase-config', rateLimiter, getFirebaseConfigHandler);
 */
function getFirebaseConfigHandler(req, res) {
  try {
    const config = getPublicFirebaseConfig();

    // Cache-Control: جلوگیری از cache شدن در browser و proxy
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma':        'no-cache',
    });

    return res.json(config);

  } catch (err) {
    console.error('[FirebaseConfig] Error:', err.message);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = { getPublicFirebaseConfig, getFirebaseConfigHandler };