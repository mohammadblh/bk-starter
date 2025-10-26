const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload.middlware');
const uploadController = require('../controllers/upload.controller');

router.post("/img", upload.single('img'), uploadController.uploadImage);

module.exports = router;
