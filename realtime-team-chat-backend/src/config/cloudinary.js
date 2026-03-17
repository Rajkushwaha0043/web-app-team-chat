const cloudinary = require('cloudinary').v2;
const winston = require('winston');

const setupCloudinary = () => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });

    winston.info('✅ Cloudinary configured');
    return cloudinary;
};

module.exports = setupCloudinary;