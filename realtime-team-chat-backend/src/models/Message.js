const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    content: {
        type: String,
        required: function() {
            return !this.fileUrl && !this.location;
        },
        maxlength: [5000, 'Message cannot exceed 5000 characters']
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    channel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Channel',
        required: true
    },
    type: {
        type: String,
        enum: ['text', 'image', 'file', 'location', 'voice', 'system'],
        default: 'text'
    },
    fileUrl: {
        type: String
    },
    fileName: {
        type: String
    },
    fileSize: {
        type: Number
    },
    fileType: {
        type: String
    },
    thumbnailUrl: {
        type: String
    },
    location: {
        lat: {
            type: Number,
            min: -90,
            max: 90
        },
        lng: {
            type: Number,
            min: -180,
            max: 180
        },
        address: String,
        expiresAt: Date
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    pinnedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    pinnedAt: {
        type: Date
    },
    reactions: [{
        emoji: String,
        users: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        count: {
            type: Number,
            default: 0
        }
    }],
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    thread: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    deleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for reaction count
MessageSchema.virtual('reactionCount').get(function() {
    return this.reactions.reduce((total, reaction) => total + reaction.count, 0);
});

// Virtual for thread messages
MessageSchema.virtual('threadMessages', {
    ref: 'Message',
    localField: '_id',
    foreignField: 'thread',
    justOne: false
});

// Add reaction
MessageSchema.methods.addReaction = function(userId, emoji) {
    const reactionIndex = this.reactions.findIndex(r => r.emoji === emoji);
    
    if (reactionIndex > -1) {
        const userIndex = this.reactions[reactionIndex].users.findIndex(
            u => u.toString() === userId.toString()
        );
        if (userIndex === -1) {
            this.reactions[reactionIndex].users.push(userId);
            this.reactions[reactionIndex].count += 1;
        }
    } else {
        this.reactions.push({
            emoji,
            users: [userId],
            count: 1
        });
    }
    
    return this.save();
};

// Remove reaction
MessageSchema.methods.removeReaction = function(userId, emoji) {
    const reactionIndex = this.reactions.findIndex(r => r.emoji === emoji);
    
    if (reactionIndex > -1) {
        const userIndex = this.reactions[reactionIndex].users.findIndex(
            u => u.toString() === userId.toString()
        );
        
        if (userIndex > -1) {
            this.reactions[reactionIndex].users.splice(userIndex, 1);
            this.reactions[reactionIndex].count -= 1;
            
            if (this.reactions[reactionIndex].count === 0) {
                this.reactions.splice(reactionIndex, 1);
            }
        }
    }
    
    return this.save();
};

// Mark as read
MessageSchema.methods.markAsRead = function(userId) {
    const alreadyRead = this.readBy.some(reader => 
        reader.user.toString() === userId.toString()
    );
    
    if (!alreadyRead) {
        this.readBy.push({
            user: userId,
            readAt: Date.now()
        });
        return this.save();
    }
    
    return Promise.resolve(this);
};

// Indexes
MessageSchema.index({ channel: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ 'reactions.emoji': 1 });
MessageSchema.index({ isPinned: 1 });
MessageSchema.index({ thread: 1 });

module.exports = mongoose.model('Message', MessageSchema);