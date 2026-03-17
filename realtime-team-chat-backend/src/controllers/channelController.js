const Channel = require('../models/Channel');
const Workspace = require('../models/Workspace');
const Message = require('../models/Message');
const asyncHandler = require('../middleware/asyncHandler');
const createError = require('http-errors');

// @desc    Get all channels in workspace
// @route   GET /api/workspaces/:workspaceId/channels
// @access  Private
exports.getChannels = asyncHandler(async (req, res, next) => {
    const workspace = await Workspace.findById(req.params.workspaceId);
    
    if (!workspace) {
        return next(createError(404, 'Workspace not found'));
    }
    
    if (!workspace.isMember(req.user.id)) {
        return next(createError(403, 'Not authorized to access this workspace'));
    }
    
    const channels = await Channel.find({
        workspace: req.params.workspaceId,
        $or: [
            { type: 'public' },
            { members: req.user.id }
        ]
    })
    .populate('createdBy', 'username avatar')
    .populate('members', 'username avatar status')
    .sort('name');
    
    res.status(200).json({
        success: true,
        count: channels.length,
        data: channels
    });
});

// @desc    Get single channel
// @route   GET /api/channels/:id
// @access  Private
exports.getChannel = asyncHandler(async (req, res, next) => {
    const channel = await Channel.findById(req.params.id)
        .populate('workspace', 'name')
        .populate('createdBy', 'username avatar')
        .populate('members', 'username avatar status');
    
    if (!channel) {
        return next(createError(404, 'Channel not found'));
    }
    
    // Check if user has access to workspace
    const workspace = await Workspace.findById(channel.workspace);
    if (!workspace || !workspace.isMember(req.user.id)) {
        return next(createError(403, 'Not authorized to access this channel'));
    }
    
    // Check if user can access channel
    if (!channel.isMember(req.user.id)) {
        return next(createError(403, 'Not authorized to access this channel'));
    }
    
    res.status(200).json({
        success: true,
        data: channel
    });
});

// @desc    Create channel
// @route   POST /api/channels
// @access  Private
exports.createChannel = asyncHandler(async (req, res, next) => {
    const { name, description, workspaceId, type = 'public', members = [] } = req.body;
    
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
        return next(createError(404, 'Workspace not found'));
    }
    
    if (!workspace.isMember(req.user.id)) {
        return next(createError(403, 'Not authorized to create channel in this workspace'));
    }
    
    // For private channels, user must be admin
    if (type === 'private' && !workspace.isAdmin(req.user.id)) {
        return next(createError(403, 'Only admins can create private channels'));
    }
    
    const channel = await Channel.create({
        name,
        description,
        workspace: workspaceId,
        type,
        createdBy: req.user.id,
        members: type === 'public' ? [] : [...new Set([req.user.id, ...members])]
    });
    
    const populatedChannel = await Channel.findById(channel._id)
        .populate('createdBy', 'username avatar')
        .populate('members', 'username avatar');
    
    res.status(201).json({
        success: true,
        data: populatedChannel
    });
});

// @desc    Update channel
// @route   PUT /api/channels/:id
// @access  Private/Admin
exports.updateChannel = asyncHandler(async (req, res, next) => {
    let channel = await Channel.findById(req.params.id);
    
    if (!channel) {
        return next(createError(404, 'Channel not found'));
    }
    
    const workspace = await Workspace.findById(channel.workspace);
    
    // Check if user is workspace admin or channel creator
    if (!workspace.isAdmin(req.user.id) && channel.createdBy.toString() !== req.user.id) {
        return next(createError(403, 'Not authorized to update channel'));
    }
    
    channel = await Channel.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    ).populate('createdBy', 'username avatar')
     .populate('members', 'username avatar');
    
    res.status(200).json({
        success: true,
        data: channel
    });
});

// @desc    Delete channel
// @route   DELETE /api/channels/:id
// @access  Private/Admin
exports.deleteChannel = asyncHandler(async (req, res, next) => {
    const channel = await Channel.findById(req.params.id);
    
    if (!channel) {
        return next(createError(404, 'Channel not found'));
    }
    
    const workspace = await Workspace.findById(channel.workspace);
    
    // Check if user is workspace admin or channel creator
    if (!workspace.isAdmin(req.user.id) && channel.createdBy.toString() !== req.user.id) {
        return next(createError(403, 'Not authorized to delete channel'));
    }
    
    // Delete all messages in channel
    await Message.deleteMany({ channel: channel._id });
    
    await channel.deleteOne();
    
    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Join channel
// @route   POST /api/channels/:id/join
// @access  Private
exports.joinChannel = asyncHandler(async (req, res, next) => {
    const channel = await Channel.findById(req.params.id);
    
    if (!channel) {
        return next(createError(404, 'Channel not found'));
    }
    
    if (channel.type !== 'public') {
        return next(createError(400, 'Cannot join private channel'));
    }
    
    const workspace = await Workspace.findById(channel.workspace);
    
    if (!workspace || !workspace.isMember(req.user.id)) {
        return next(createError(403, 'Not authorized to join channel'));
    }
    
    await channel.addMember(req.user.id);
    
    const updatedChannel = await Channel.findById(channel._id)
        .populate('members', 'username avatar');
    
    res.status(200).json({
        success: true,
        data: updatedChannel
    });
});

// @desc    Leave channel
// @route   POST /api/channels/:id/leave
// @access  Private
exports.leaveChannel = asyncHandler(async (req, res, next) => {
    const channel = await Channel.findById(req.params.id);
    
    if (!channel) {
        return next(createError(404, 'Channel not found'));
    }
    
    // Can't leave if you're the only member
    if (channel.members.length === 1 && channel.members[0].toString() === req.user.id) {
        return next(createError(400, 'Cannot leave channel as the only member'));
    }
    
    await channel.removeMember(req.user.id);
    
    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Add member to channel
// @route   POST /api/channels/:id/members
// @access  Private/Admin
exports.addChannelMember = asyncHandler(async (req, res, next) => {
    const { userId } = req.body;
    const channel = await Channel.findById(req.params.id);
    
    if (!channel) {
        return next(createError(404, 'Channel not found'));
    }
    
    if (channel.type === 'public') {
        return next(createError(400, 'Cannot add members to public channel'));
    }
    
    const workspace = await Workspace.findById(channel.workspace);
    
    // Check if user is workspace admin or channel creator
    if (!workspace.isAdmin(req.user.id) && channel.createdBy.toString() !== req.user.id) {
        return next(createError(403, 'Not authorized to add members'));
    }
    
    // Check if user is workspace member
    if (!workspace.isMember(userId)) {
        return next(createError(400, 'User is not a member of the workspace'));
    }
    
    await channel.addMember(userId);
    
    const updatedChannel = await Channel.findById(channel._id)
        .populate('members', 'username avatar');
    
    res.status(200).json({
        success: true,
        data: updatedChannel
    });
});