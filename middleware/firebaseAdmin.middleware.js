const admin = require('firebase-admin');
const serviceAccount = require('../commented-b455f-firebase-adminsdk-fbsvc-f5ccbdd568.json'); // مسیر فایل کلید

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
//   databaseURL: 'https://your-project-id.firebaseio.com' // اختیاری
});

module.exports = admin;