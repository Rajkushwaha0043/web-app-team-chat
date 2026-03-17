// 🔥 LOAD ENV (FIXED PATH ISSUE)
// 🔥 LOAD ENV (FIXED PATH ISSUE)
const path2 = require("path");

require("dotenv").config({
  path: path2.join(__dirname, "../.env")  // ✅ only one level up: src/ -> root
});

console.log("ENV CHECK:", process.env.MONGODB_URI);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Import configurations
const connectDB = require('./config/database');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// ✅ Socket.io (UPDATED FOR PRODUCTION)
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*", // allow all for deployment
        credentials: true
    },
    pingTimeout: process.env.SOCKET_PING_TIMEOUT ? parseInt(process.env.SOCKET_PING_TIMEOUT) : 60000,
    pingInterval: process.env.SOCKET_PING_INTERVAL ? parseInt(process.env.SOCKET_PING_INTERVAL) : 25000
});

// Socket.io connection handler
require('./socket/socketHandler')(io);

// Connect to Database
connectDB();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Sanitize data
app.use(mongoSanitize());

// ✅ CORS FIX (important for deployment)
app.use(cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true
}));

// Compression
app.use(compression());

// Create uploads directory
const uploadsDir = path.join(__dirname, '../uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
const filesDir = path.join(uploadsDir, 'files');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir);
if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir);
if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir);

// Static folder
app.use('/uploads', express.static(uploadsDir));

// Logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl} - ${req.ip}`);
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is working!',
        version: '1.0.0'
    });
});

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workspaceRoutes = require('./routes/workspaces');
const channelRoutes = require('./routes/channels');
const messageRoutes = require('./routes/messages');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);

// ❌ REMOVE old 404 BEFORE serving frontend

// ✅ SERVE FRONTEND (IMPORTANT FOR SINGLE PLATFORM)
app.use(express.static(path.join(__dirname, '../../teamchat-frontend/build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../teamchat-frontend/build/index.html'));
});

// Error handler (LAST)
app.use(errorHandler);

// Attach socket
app.set('io', io);

// Port (Railway compatible)
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    logger.info(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    logger.info(`📡 Socket.IO server ready`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
});

module.exports = { app, server, io };