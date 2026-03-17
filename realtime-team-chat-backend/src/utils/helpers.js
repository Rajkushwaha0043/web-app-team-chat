const crypto = require('crypto');

// Generate random string
const generateRandomString = (length = 10) => {
    return crypto.randomBytes(length).toString('hex');
};

// Generate verification token
const generateVerificationToken = () => {
    return crypto.randomBytes(20).toString('hex');
};

// Sanitize data
const sanitizeData = (data) => {
    if (typeof data === 'string') {
        return data.trim();
    }
    if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item));
    }
    if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const key in data) {
            sanitized[key] = sanitizeData(data[key]);
        }
        return sanitized;
    }
    return data;
};

// Format response
const formatResponse = (success, data = null, message = '', statusCode = 200) => {
    return {
        success,
        data,
        message,
        statusCode
    };
};

// Pagination helper
const paginate = (query, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    return query.skip(skip).limit(limit);
};

module.exports = {
    generateRandomString,
    generateVerificationToken,
    sanitizeData,
    formatResponse,
    paginate
};