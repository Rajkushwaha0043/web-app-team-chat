const mongoose = require('mongoose');
const validator = require('validator');

const WorkspaceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a workspace name'],
        trim: true,
        maxlength: [100, 'Workspace name cannot exceed 100 characters']
    },
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['admin', 'member', 'guest'],
            default: 'member'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    avatar: {
        type: String,
        default: ''
    },
    settings: {
        isPublic: {
            type: Boolean,
            default: false
        },
        allowInvites: {
            type: Boolean,
            default: true
        },
        messageRetention: {
            type: Number,
            enum: [7, 30, 90, 365],
            default: 30
        }
    },
    invitationCode: {
        type: String,
        unique: true,
        sparse: true
    },
    invitationExpires: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for member count
WorkspaceSchema.virtual('memberCount').get(function() {
    return this.members.length;
});

// Virtual for channels
WorkspaceSchema.virtual('channels', {
    ref: 'Channel',
    localField: '_id',
    foreignField: 'workspace',
    justOne: false
});

// Create invitation code
WorkspaceSchema.methods.generateInvitationCode = function(days = 7) {
    const crypto = require('crypto');
    this.invitationCode = crypto.randomBytes(20).toString('hex');
    this.invitationExpires = Date.now() + days * 24 * 60 * 60 * 1000;
    return this.save();
};

// Check if user is member
WorkspaceSchema.methods.isMember = function(userId) {
    return this.members.some(member => 
        member.user.toString() === userId.toString()
    );
};

// Check if user is admin
WorkspaceSchema.methods.isAdmin = function(userId) {
    const member = this.members.find(m => 
        m.user.toString() === userId.toString()
    );
    return member && member.role === 'admin';
};

// Add member to workspace
WorkspaceSchema.methods.addMember = function(userId, role = 'member') {
    if (!this.isMember(userId)) {
        this.members.push({
            user: userId,
            role: role,
            joinedAt: Date.now()
        });
        return this.save();
    }
    return Promise.resolve(this);
};

// Remove member from workspace
WorkspaceSchema.methods.removeMember = function(userId) {
    this.members = this.members.filter(member => 
        member.user.toString() !== userId.toString()
    );
    return this.save();
};

// Indexes
WorkspaceSchema.index({ owner: 1 });
WorkspaceSchema.index({ 'members.user': 1 });
WorkspaceSchema.index({ invitationCode: 1 }, { sparse: true });
WorkspaceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Workspace', WorkspaceSchema);