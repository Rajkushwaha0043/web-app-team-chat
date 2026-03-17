const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const sendEmail = async (options) => {
    try {
        // Create transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        // Email options
        const mailOptions = {
            from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html,
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Email sent: ${info.messageId}`);
        
        return info;
    } catch (error) {
        logger.error(`Email sending failed: ${error.message}`);
        throw error;
    }
};

module.exports = sendEmail;