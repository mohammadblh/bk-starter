'use strict';

/**
 * SCN-051 / SCN-052 — Firebase Admin SDK (سمت سرور)
 *
 * service account را هرگز در کد یا در HTML عمومی قرار ندهید.
 * از محیط‌های cloud از FIREBASE_SERVICE_ACCOUNT_JSON استفاده کنید.
 */

const admin  = require('firebase-admin');
const path   = require('path');
const fs     = require('fs');
const { getConfig } = require('./env.config');

let _app = null;

function getFirebaseAdmin() {
  if (_app) return _app;

  const { firebase } = getConfig();
  let credential;

  if (firebase.serviceAccountJson) {
    // روش اول: JSON string در env var (مناسب برای Docker/Kubernetes/CI)
    try {
      const parsed = JSON.parse(firebase.serviceAccountJson);
      credential = admin.credential.cert(parsed);
    } catch {
      throw new Error('[SCN-051] FIREBASE_SERVICE_ACCOUNT_JSON فرمت JSON معتبری ندارد');
    }

  } else if (firebase.serviceAccountPath) {
    // روش دوم: مسیر فایل (مناسب برای development)
    const absPath = path.resolve(firebase.serviceAccountPath);

    if (!absPath.includes(process.cwd())) {
      // Path traversal guard
      throw new Error('[SCN-051] مسیر service account خارج از پوشه پروژه است');
    }
    if (!fs.existsSync(absPath)) {
      throw new Error(`[SCN-051] فایل service account پیدا نشد: ${absPath}`);
    }

    credential = admin.credential.cert(absPath);

  } else {
    throw new Error(
      '[SCN-051] Firebase Admin نیاز به یکی از این متغیرها دارد:\n' +
      '  FIREBASE_SERVICE_ACCOUNT_JSON  یا  FIREBASE_SERVICE_ACCOUNT_PATH'
    );
  }

  _app = admin.initializeApp({ credential });
  return _app;
}

module.exports = { getFirebaseAdmin };