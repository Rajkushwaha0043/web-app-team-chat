const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a channel name'],
        trim: true,
        maxlength: [100, 'Channel name cannot exceed 100 characters']
    },
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true
    },
    type: {
        type: String,
        enum: ['public', 'private', 'direct'],
        default: 'public'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    settings: {
        topic: String,
        isArchived: {
            type: Boolean,
            default: false
        },
        allowThreads: {
            type: Boolean,
            default: true
        },
        slowMode: {
            type: Number,
            default: 0
        }
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    unreadCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for message count
ChannelSchema.virtual('messageCount', {
    ref: 'Message',
    localField: '_id',
    foreignField: 'channel',
    count: true
});

// Check if user is member
ChannelSchema.methods.isMember = function(userId) {
    if (this.type === 'public') return true;
    return this.members.some(member => 
        member.toString() === userId.toString()
    );
};

// Add member to channel
ChannelSchema.methods.addMember = function(userId) {
    if (!this.isMember(userId)) {
        this.members.push(userId);
        return this.save();
    }
    return Promise.resolve(this);
};

// Remove member from channel
ChannelSchema.methods.removeMember = function(userId) {
    this.members = this.members.filter(member => 
        member.toString() !== userId.toString()
    );
    return this.save();
};

// Indexes
ChannelSchema.index({ workspace: 1 });
ChannelSchema.index({ type: 1 });
ChannelSchema.index({ 'members': 1 });
ChannelSchema.index({ lastMessage: -1 });
ChannelSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Channel', ChannelSchema);