const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return next(createError(401, 'Not authorized to access this route'));
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            return next(createError(401, 'User no longer exists'));
        }

        next();
    } catch (error) {
        return next(createError(401, 'Not authorized to access this route'));
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(
                createError(403, `User role ${req.user.role} is not authorized to access this route`)
            );
        }
        next();
    };
};

module.exports = { protect, authorize };