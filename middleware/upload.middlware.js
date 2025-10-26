const fs = require('fs');
// const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.params.userId;
    const dir = `uploads/${userId}`;

    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true });

    cb(null, dir);
  },
  filename: function (req, file, cb) {
    let fileName;

    switch (file.fieldname) {
    //   case 'img':
    //     fileName = 'profile.jpg';
    //     break;
      default:
        fileName = Date.now() + '-' + file.originalname;
    }

    cb(null, fileName);
  }
});

const upload = multer({ storage: storage });

module.exports = upload;