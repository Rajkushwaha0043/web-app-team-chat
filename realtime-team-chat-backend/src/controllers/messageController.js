const Message = require('../models/Message');
const Channel = require('../models/Channel');
const Workspace = require('../models/Workspace');
const asyncHandler = require('../middleware/asyncHandler');
const createError = require('http-errors');

// @desc    Get messages in channel
// @route   GET /api/channels/:channelId/messages
// @access  Private
exports.getMessages = asyncHandler(async (req, res, next) => {
    const { limit = 50, before, after } = req.query;
    
    const channel = await Channel.findById(req.params.channelId);
    
    if (!channel) {
        return next(createError(404, 'Channel not found'));
    }
    
    // Check if user has access
    const workspace = await Workspace.findById(channel.workspace);
    if (!workspace || !workspace.isMember(req.user.id) || !channel.isMember(req.user.id)) {
        return next(createError(403, 'Not authorized to access messages'));
    }
    
    let query = { 
        channel: req.params.channelId,
        deleted: false 
    };
    
    // Pagination
    if (before) {
        query.createdAt = { $lt: new Date(before) };
    } else if (after) {
        query.createdAt = { $gt: new Date(after) };
    }
    
    const messages = await Message.find(query)
        .populate('sender', 'username avatar')
        .populate('replyTo', 'content sender')
        .populate('replyTo.sender', 'username avatar')
        .sort('-createdAt')
        .limit(parseInt(limit));
    
    // Mark messages as read
    await Message.updateMany(
        {
            _id: { $in: messages.map(m => m._id) },
            'readBy.user': { $ne: req.user.id },
            sender: { $ne: req.user.id }
        },
        {
            $push: {
                readBy: {
                    user: req.user.id,
                    readAt: Date.now()
                }
            }
        }
    );
    
    res.status(200).json({
        success: true,
        count: messages.length,
        data: messages.reverse() // Return in chronological order
    });
});

// @desc    Send message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = asyncHandler(async (req, res, next) => {
    const { channelId, content, type = 'text', fileUrl, fileName, fileSize, fileType, location, replyTo } = req.body;
    
    const channel = await Channel.findById(channelId);
    
    if (!channel) {
        return next(createError(404, 'Channel not found'));
    }
    
    // Check if user has access
    const workspace = await Workspace.findById(channel.workspace);
    if (!workspace || !workspace.isMember(req.user.id) || !channel.isMember(req.user.id)) {
        return next(createError(403, 'Not authorized to send messages'));
    }
    
    // Check slow mode
    if (channel.settings.slowMode > 0) {
        const lastMessage = await Message.findOne({
            channel: channelId,
            sender: req.user.id
        }).sort('-createdAt');
        
        if (lastMessage) {
            const timeDiff = Date.now() - lastMessage.createdAt;
            if (timeDiff < channel.settings.slowMode * 1000) {
                return next(createError(429, `Slow mode active. Please wait ${Math.ceil((channel.settings.slowMode * 1000 - timeDiff) / 1000)} seconds`));
            }
        }
    }
    
    const messageData = {
        content,
        sender: req.user.id,
        channel: channelId,
        type
    };
    
    if (fileUrl) {
        messageData.fileUrl = fileUrl;
        messageData.fileName = fileName;
        messageData.fileSize = fileSize;
        messageData.fileType = fileType;
    }
    
    if (location) {
        messageData.location = {
            lat: location.lat,
            lng: location.lng,
            address: location.address,
            expiresAt: location.expiresAt ? new Date(location.expiresAt) : Date.now() + 24 * 60 * 60 * 1000
        };
    }
    
    if (replyTo) {
        const parentMessage = await Message.findById(replyTo);
        if (parentMessage) {
            messageData.replyTo = replyTo;
        }
    }
    
    const message = await Message.create(messageData);
    
    // Update channel's last message
    await Channel.findByIdAndUpdate(channelId, {
        lastMessage: message._id
    });
    
    const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username avatar')
        .populate('replyTo', 'content sender')
        .populate('replyTo.sender', 'username avatar');
    
    // Emit via Socket.IO
    const io = req.app.get('io');
    io.to(`channel:${channelId}`).emit('new_message', populatedMessage);
    
    res.status(201).json({
        success: true,
        data: populatedMessage
    });
});

// @desc    Update message
// @route   PUT /api/messages/:id
// @access  Private
exports.updateMessage = asyncHandler(async (req, res, next) => {
    const { content } = req.body;
    
    let message = await Message.findById(req.params.id);
    
    if (!message) {
        return next(createError(404, 'Message not found'));
    }
    
    // Check if user is the sender
    if (message.sender.toString() !== req.user.id) {
        return next(createError(403, 'Not authorized to edit this message'));
    }
    
    // Check if message can be edited (within 15 minutes)
    const timeDiff = Date.now() - message.createdAt;
    if (timeDiff > 15 * 60 * 1000) {
        return next(createError(400, 'Message can only be edited within 15 minutes'));
    }
    
    message.content = content;
    message.isEdited = true;
    message.editedAt = Date.now();
    
    await message.save();
    
    const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username avatar');
    
    // Emit update via Socket.IO
    const io = req.app.get('io');
    io.to(`channel:${message.channel}`).emit('message_updated', populatedMessage);
    
    res.status(200).json({
        success: true,
        data: populatedMessage
    });
});

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private
exports.deleteMessage = asyncHandler(async (req, res, next) => {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
        return next(createError(404, 'Message not found'));
    }
    
    const channel = await Channel.findById(message.channel);
    const workspace = await Workspace.findById(channel.workspace);
    
    // Check if user is sender, channel admin, or workspace admin
    const isSender = message.sender.toString() === req.user.id;
    const isChannelAdmin = channel.createdBy.toString() === req.user.id;
    const isWorkspaceAdmin = workspace.isAdmin(req.user.id);
    
    if (!isSender && !isChannelAdmin && !isWorkspaceAdmin) {
        return next(createError(403, 'Not authorized to delete this message'));
    }
    
    // Soft delete
    message.deleted = true;
    message.deletedAt = Date.now();
    message.deletedBy = req.user.id;
    await message.save();
    
    // Emit delete via Socket.IO
    const io = req.app.get('io');
    io.to(`channel:${message.channel}`).emit('message_deleted', {
        messageId: message._id,
        deletedBy: req.user.id
    });
    
    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Add reaction to message
// @route   POST /api/messages/:id/reactions
// @access  Private
exports.addReaction = asyncHandler(async (req, res, next) => {
    const { emoji } = req.body;
    
    const message = await Message.findById(req.params.id);
    
    if (!message) {
        return next(createError(404, 'Message not found'));
    }
    
    // Check if user has access to channel
    const channel = await Channel.findById(message.channel);
    const workspace = await Workspace.findById(channel.workspace);
    if (!workspace || !workspace.isMember(req.user.id) || !channel.isMember(req.user.id)) {
        return next(createError(403, 'Not authorized to react to this message'));
    }
    
    await message.addReaction(req.user.id, emoji);
    
    const updatedMessage = await Message.findById(message._id)
        .populate('reactions.users', 'username avatar');
    
    // Emit reaction via Socket.IO
    const io = req.app.get('io');
    io.to(`channel:${message.channel}`).emit('reaction_added', {
        messageId: message._id,
        reaction: updatedMessage.reactions.find(r => r.emoji === emoji)
    });
    
    res.status(200).json({
        success: true,
        data: updatedMessage
    });
});

// @desc    Remove reaction from message
// @route   DELETE /api/messages/:id/reactions/:emoji
// @access  Private
exports.removeReaction = asyncHandler(async (req, res, next) => {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
        return next(createError(404, 'Message not found'));
    }
    
    // Check if user has access
    const channel = await Channel.findById(message.channel);
    const workspace = await Workspace.findById(channel.workspace);
    if (!workspace || !workspace.isMember(req.user.id) || !channel.isMember(req.user.id)) {
        return next(createError(403, 'Not authorized'));
    }
    
    await message.removeReaction(req.user.id, req.params.emoji);
    
    const updatedMessage = await Message.findById(message._id)
        .populate('reactions.users', 'username avatar');
    
    // Emit via Socket.IO
    const io = req.app.get('io');
    io.to(`channel:${message.channel}`).emit('reaction_removed', {
        messageId: message._id,
        emoji: req.params.emoji,
        userId: req.user.id
    });
    
    res.status(200).json({
        success: true,
        data: updatedMessage
    });
});

// @desc    Pin message
// @route   POST /api/messages/:id/pin
// @access  Private/Admin
exports.pinMessage = asyncHandler(async (req, res, next) => {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
        return next(createError(404, 'Message not found'));
    }
    
    const channel = await Channel.findById(message.channel);
    const workspace = await Workspace.findById(channel.workspace);
    
    // Check if user is admin
    if (!workspace.isAdmin(req.user.id) && channel.createdBy.toString() !== req.user.id) {
        return next(createError(403, 'Not authorized to pin messages'));
    }
    
    message.isPinned = true;
    message.pinnedBy = req.user.id;
    message.pinnedAt = Date.now();
    
    await message.save();
    
    const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username avatar')
        .populate('pinnedBy', 'username avatar');
    
    res.status(200).json({
        success: true,
        data: populatedMessage
    });
});

// @desc    Unpin message
// @route   DELETE /api/messages/:id/pin
// @access  Private/Admin
exports.unpinMessage = asyncHandler(async (req, res, next) => {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
        return next(createError(404, 'Message not found'));
    }
    
    const channel = await Channel.findById(message.channel);
    const workspace = await Workspace.findById(channel.workspace);
    
    // Check if user is admin or person who pinned
    if (!workspace.isAdmin(req.user.id) && 
        channel.createdBy.toString() !== req.user.id &&
        message.pinnedBy.toString() !== req.user.id) {
        return next(createError(403, 'Not authorized to unpin messages'));
    }
    
    message.isPinned = false;
    await message.save();
    
    res.status(200).json({
        success: true,
        data: {}
    });
});