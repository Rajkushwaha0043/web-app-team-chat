const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Please provide a username'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [30, 'Username cannot exceed 30 characters']
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    avatar: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['online', 'offline', 'away', 'busy'],
        default: 'offline'
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    workspaces: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace'
    }],
    settings: {
        notifications: {
            type: Boolean,
            default: true
        },
        theme: {
            type: String,
            enum: ['light', 'dark', 'auto'],
            default: 'auto'
        },
        locationSharing: {
            type: Boolean,
            default: false
        },
        emailNotifications: {
            type: Boolean,
            default: true
        },
        soundEnabled: {
            type: Boolean,
            default: true
        }
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    googleId: String,
    lastActiveAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
    return jwt.sign(
        { id: this._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
    );
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Update last seen timestamp
UserSchema.methods.updateLastSeen = function() {
    this.lastSeen = Date.now();
    return this.save();
};

// Update status
UserSchema.methods.updateStatus = function(status) {
    this.status = status;
    return this.save();
};

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
    return this.username;
});

// Indexes for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ lastSeen: -1 });

module.exports = mongoose.model('User', UserSchema);