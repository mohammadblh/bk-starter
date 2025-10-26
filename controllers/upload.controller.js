const path = require('path');
const sharp = require('sharp');
const fs = require('fs').promises;
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// AWS S3 configuration
const s3Client = new S3Client({
  region: "us-west-1",
  credentials: {
    accessKeyId: "ACCESS_KEY",
    secretAccessKey: "SECRET_KEY",
  },
});

exports.uploadImage = async (req, res) => {
    try {
        const { file } = req;
        if (!file) return res.status(400).send('No file uploaded');
        let processedFilePath;
        // let coverFilePath;
        let s3Key;
        // let coverS3Key;
        // let coverUrl;

        const mediaType = file.mimetype.split('/')[0];

        if (mediaType === 'image') {
            // Resize image
            processedFilePath = `./uploads/${file.filename.replace(/\.[^/.]+$/, '')}-resized.jpg`;
            await sharp(file.path)
                // .resize(null, 700, { fit: 'inside' })
                .resize(null, 400, { fit: 'cover' })
                .webp({ quality: 70 })
                // .jpeg({ quality: 60 })
                .toFile(processedFilePath);
            s3Key = `uploads/${file.filename.replace(/\.[^/.]+$/, '')}-resized.jpg`;
        } else {
            return res.status(400).send('Invalid media type');
        }


        // Upload to S3
        const fileContent = await fs.readFile(processedFilePath);
        const params = {
            Bucket: "doovshi-bucket",
            Key: s3Key,
            Body: fileContent,
            ContentType: "image/jpeg"
            // ContentType: mediaType === 'image' ? "image/jpeg" : "video/mp4"
        };

        const command = new PutObjectCommand(params);
        const data = await s3Client.send(command);

        // Delete temporary files
        try {
            await fs.unlink(file.path); // فایل اصلی
            await fs.unlink(processedFilePath); // فایل پردازش شده
            // if (mediaType === 'video') {
            //     await fs.unlink(coverFilePath); // فایل کاور
            // }
        } catch (error) {
            console.error('Error deleting files:', error);
        }

        // Send S3 URLs in response
        const s3Url = `https://doovshi-bucket.s3.us-west-1.amazonaws.com/${params.Key}`;
        
        // اگر ویدیو باشد، هم URL ویدیو و هم URL کاور را برمی‌گردانیم
        // if (mediaType === 'video') {
        //     res.json({ url: s3Url, cover: coverUrl });
        // } else {
            res.json({
                message: 'image upload successfully',
                url: s3Url
            });
        // }


        // res.json({ message: "Profile image uploaded and compressed", path: `${process.env.API_BASEURL}/${outputPath}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error uploading profile image" });
    }
}
