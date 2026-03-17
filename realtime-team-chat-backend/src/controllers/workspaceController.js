const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Channel = require('../models/Channel');
const asyncHandler = require('../middleware/asyncHandler');
const createError = require('http-errors');

// @desc    Get all workspaces for user
// @route   GET /api/workspaces
// @access  Private
exports.getWorkspaces = asyncHandler(async (req, res, next) => {
    const workspaces = await Workspace.find({
        'members.user': req.user.id
    })
    .populate('owner', 'username avatar')
    .populate('members.user', 'username avatar status')
    .sort('-createdAt');
    
    res.status(200).json({
        success: true,
        count: workspaces.length,
        data: workspaces
    });
});

// @desc    Get single workspace
// @route   GET /api/workspaces/:id
// @access  Private
exports.getWorkspace = asyncHandler(async (req, res, next) => {
    const workspace = await Workspace.findById(req.params.id)
        .populate('owner', 'username avatar')
        .populate('members.user', 'username avatar status');
    
    if (!workspace) {
        return next(createError(404, 'Workspace not found'));
    }
    
    // Check if user is member
    if (!workspace.isMember(req.user.id)) {
        return next(createError(403, 'Not authorized to access this workspace'));
    }
    
    res.status(200).json({
        success: true,
        data: workspace
    });
});

// @desc    Create workspace
// @route   POST /api/workspaces
// @access  Private
exports.createWorkspace = asyncHandler(async (req, res, next) => {
    const { name, description, avatar } = req.body;
    
    const workspace = await Workspace.create({
        name,
        description,
        avatar,
        owner: req.user.id,
        members: [{
            user: req.user.id,
            role: 'admin'
        }]
    });
    
    // Add workspace to user's workspaces array
    await User.findByIdAndUpdate(req.user.id, {
        $push: { workspaces: workspace._id }
    });
    
    const populatedWorkspace = await Workspace.findById(workspace._id)
        .populate('owner', 'username avatar')
        .populate('members.user', 'username avatar');
    
    res.status(201).json({
        success: true,
        data: populatedWorkspace
    });
});

// @desc    Update workspace
// @route   PUT /api/workspaces/:id
// @access  Private/Admin
exports.updateWorkspace = asyncHandler(async (req, res, next) => {
    let workspace = await Workspace.findById(req.params.id);
    
    if (!workspace) {
        return next(createError(404, 'Workspace not found'));
    }
    
    // Check if user is admin
    if (!workspace.isAdmin(req.user.id)) {
        return next(createError(403, 'Not authorized to update workspace'));
    }
    
    workspace = await Workspace.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    ).populate('owner', 'username avatar')
     .populate('members.user', 'username avatar');
    
    res.status(200).json({
        success: true,
        data: workspace
    });
});

// @desc    Delete workspace
// @route   DELETE /api/workspaces/:id
// @access  Private/Admin
exports.deleteWorkspace = asyncHandler(async (req, res, next) => {
    const workspace = await Workspace.findById(req.params.id);
    
    if (!workspace) {
        return next(createError(404, 'Workspace not found'));
    }
    
    // Check if user is owner
    if (workspace.owner.toString() !== req.user.id) {
        return next(createError(403, 'Only owner can delete workspace'));
    }
    
    // Remove workspace from all members
    await User.updateMany(
        { workspaces: workspace._id },
        { $pull: { workspaces: workspace._id } }
    );
    
    // Delete all channels in workspace
    await Channel.deleteMany({ workspace: workspace._id });
    
    await workspace.deleteOne();
    
    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Add member to workspace
// @route   POST /api/workspaces/:id/members
// @access  Private/Admin
exports.addMember = asyncHandler(async (req, res, next) => {
    const { userId, role = 'member' } = req.body;
    
    const workspace = await Workspace.findById(req.params.id);
    const user = await User.findById(userId);
    
    if (!workspace) {
        return next(createError(404, 'Workspace not found'));
    }
    
    if (!user) {
        return next(createError(404, 'User not found'));
    }
    
    // Check if user is admin
    if (!workspace.isAdmin(req.user.id)) {
        return next(createError(403, 'Not authorized to add members'));
    }
    
    // Add member
    await workspace.addMember(userId, role);
    
    // Add workspace to user's workspaces
    await User.findByIdAndUpdate(userId, {
        $addToSet: { workspaces: workspace._id }
    });
    
    const updatedWorkspace = await Workspace.findById(workspace._id)
        .populate('members.user', 'username avatar status');
    
    res.status(200).json({
        success: true,
        data: updatedWorkspace
    });
});

// @desc    Remove member from workspace
// @route   DELETE /api/workspaces/:id/members/:userId
// @access  Private/Admin
exports.removeMember = asyncHandler(async (req, res, next) => {
    const workspace = await Workspace.findById(req.params.id);
    
    if (!workspace) {
        return next(createError(404, 'Workspace not found'));
    }
    
    // Check if user is admin or removing themselves
    if (!workspace.isAdmin(req.user.id) && req.user.id !== req.params.userId) {
        return next(createError(403, 'Not authorized to remove members'));
    }
    
    // Can't remove owner
    if (workspace.owner.toString() === req.params.userId) {
        return next(createError(400, 'Cannot remove workspace owner'));
    }
    
    // Remove member
    await workspace.removeMember(req.params.userId);
    
    // Remove workspace from user's workspaces
    await User.findByIdAndUpdate(req.params.userId, {
        $pull: { workspaces: workspace._id }
    });
    
    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Generate invitation code
// @route   POST /api/workspaces/:id/invite
// @access  Private/Admin
exports.generateInvite = asyncHandler(async (req, res, next) => {
    const workspace = await Workspace.findById(req.params.id);
    
    if (!workspace) {
        return next(createError(404, 'Workspace not found'));
    }
    
    if (!workspace.isAdmin(req.user.id)) {
        return next(createError(403, 'Not authorized to generate invites'));
    }
    
    await workspace.generateInvitationCode(req.body.days || 7);
    
    res.status(200).json({
        success: true,
        data: {
            invitationCode: workspace.invitationCode,
            invitationExpires: workspace.invitationExpires,
            invitationUrl: `${req.protocol}://${req.get('host')}/invite/${workspace.invitationCode}`
        }
    });
});

// @desc    Join workspace via invitation
// @route   POST /api/workspaces/join/:code
// @access  Private
exports.joinViaInvite = asyncHandler(async (req, res, next) => {
    const workspace = await Workspace.findOne({
        invitationCode: req.params.code,
        invitationExpires: { $gt: Date.now() }
    });
    
    if (!workspace) {
        return next(createError(400, 'Invalid or expired invitation code'));
    }
    
    // Check if already member
    if (workspace.isMember(req.user.id)) {
        return next(createError(400, 'Already a member of this workspace'));
    }
    
    // Add member
    await workspace.addMember(req.user.id);
    
    // Add workspace to user's workspaces
    await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { workspaces: workspace._id }
    });
    
    const updatedWorkspace = await Workspace.findById(workspace._id)
        .populate('owner', 'username avatar')
        .populate('members.user', 'username avatar');
    
    res.status(200).json({
        success: true,
        data: updatedWorkspace
    });
});