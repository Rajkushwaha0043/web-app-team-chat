const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const createError = require('http-errors');

// @desc    Get all users
// @route   GET /api/users
// @access  Private
exports.getUsers = asyncHandler(async (req, res, next) => {
    const users = await User.find().select('-password');
    
    res.status(200).json({
        success: true,
        count: users.length,
        data: users
    });
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
exports.getUser = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
        return next(createError(404, `User not found with id ${req.params.id}`));
    }
    
    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
exports.updateUser = asyncHandler(async (req, res, next) => {
    const fieldsToUpdate = {
        username: req.body.username,
        avatar: req.body.avatar,
        status: req.body.status,
        settings: req.body.settings
    };
    
    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(key => 
        fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );
    
    const user = await User.findByIdAndUpdate(
        req.params.id,
        fieldsToUpdate,
        {
            new: true,
            runValidators: true
        }
    ).select('-password');
    
    if (!user) {
        return next(createError(404, `User not found with id ${req.params.id}`));
    }
    
    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id);
    
    if (!user) {
        return next(createError(404, `User not found with id ${req.params.id}`));
    }
    
    await user.deleteOne();
    
    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Search users
// @route   GET /api/users/search
// @access  Private
exports.searchUsers = asyncHandler(async (req, res, next) => {
    const { q } = req.query;
    
    if (!q) {
        return next(createError(400, 'Please provide a search query'));
    }
    
    const users = await User.find({
        $or: [
            { username: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } }
        ]
    }).select('-password').limit(20);
    
    res.status(200).json({
        success: true,
        count: users.length,
        data: users
    });
});

// @desc    Update user status
// @route   PUT /api/users/status
// @access  Private
exports.updateStatus = asyncHandler(async (req, res, next) => {
    const { status } = req.body;
    
    if (!['online', 'offline', 'away', 'busy'].includes(status)) {
        return next(createError(400, 'Invalid status'));
    }
    
    const user = await User.findByIdAndUpdate(
        req.user.id,
        { 
            status,
            lastSeen: Date.now()
        },
        { new: true }
    ).select('-password');
    
    // Emit status change via Socket.IO
    const io = req.app.get('io');
    io.emit('user_status_changed', { userId: user._id, status });
    
    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Get user's workspaces
// @route   GET /api/users/workspaces
// @access  Private
exports.getUserWorkspaces = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id).populate({
        path: 'workspaces',
        populate: {
            path: 'owner',
            select: 'username avatar'
        }
    });
    
    res.status(200).json({
        success: true,
        count: user.workspaces.length,
        data: user.workspaces
    });
});