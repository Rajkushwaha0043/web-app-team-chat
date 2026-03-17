const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const createError = require('http-errors');
const sendEmail = require('../utils/email');
const { generateVerificationToken } = require('../utils/helpers');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
    const { username, email, password } = req.body;

    // Create user
    const user = await User.create({
        username,
        email,
        password
    });

    // Generate verification token
    const verificationToken = generateVerificationToken();
    user.verificationToken = verificationToken;
    await user.save();

    // Send verification email (optional)
    // const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify/${verificationToken}`;
    // await sendEmail({
    //     email: user.email,
    //     subject: 'Verify your email',
    //     message: `Please verify your email by clicking: ${verificationUrl}`
    // });

    // Create token
    const token = user.getSignedJwtToken();

    res.status(201).json({
        success: true,
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            status: user.status
        }
    });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
        return next(createError(400, 'Please provide email and password'));
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        return next(createError(401, 'Invalid credentials'));
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        return next(createError(401, 'Invalid credentials'));
    }

    // Update last seen and status
    user.lastSeen = Date.now();
    user.status = 'online';
    await user.save();

    // Create token
    const token = user.getSignedJwtToken();

    res.status(200).json({
        success: true,
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            status: user.status,
            settings: user.settings
        }
    });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
    // Update user status
    const user = await User.findById(req.user.id);
    user.status = 'offline';
    user.lastSeen = Date.now();
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
});

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        return next(createError(404, 'User not found'));
    }

    // Get reset token
    const resetToken = generateVerificationToken();

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // Create reset url
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/resetpassword/${resetToken}`;

    const message = `You are receiving this email because you requested a password reset. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
        await sendEmail({
            email: user.email,
            subject: 'Password reset token',
            message
        });

        res.status(200).json({ success: true, data: 'Email sent' });
    } catch (err) {
        console.log(err);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        return next(createError(500, 'Email could not be sent'));
    }
});

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
    // Get hashed token
    const resetPasswordToken = req.params.resettoken;

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
        return next(createError(400, 'Invalid token'));
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Create token
    const token = user.getSignedJwtToken();

    res.status(200).json({
        success: true,
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar
        }
    });
});