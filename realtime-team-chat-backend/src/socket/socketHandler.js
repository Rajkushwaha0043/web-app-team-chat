const logger = require('../config/logger');
const User = require('../models/User');

let onlineUsers = new Map(); // userId -> socketId
let userSockets = new Map(); // userId -> array of socketIds (multiple devices)

module.exports = (io) => {
    io.on('connection', (socket) => {
        logger.info(`New socket connection: ${socket.id}`);
        
        // User authentication
        socket.on('authenticate', async (token) => {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                
                const user = await User.findById(decoded.id);
                if (!user) {
                    socket.emit('auth_error', 'User not found');
                    return;
                }
                
                // Store user info
                socket.userId = user._id.toString();
                socket.username = user.username;
                
                // Update online users
                if (!userSockets.has(socket.userId)) {
                    userSockets.set(socket.userId, []);
                }
                userSockets.get(socket.userId).push(socket.id);
                onlineUsers.set(socket.userId, socket.id);
                
                // Update user status
                user.status = 'online';
                user.lastSeen = Date.now();
                await user.save();
                
                // Join user's personal room
                socket.join(`user:${socket.userId}`);
                
                // Join user's workspaces
                const workspaces = user.workspaces || [];
                workspaces.forEach(workspaceId => {
                    socket.join(`workspace:${workspaceId}`);
                });
                
                // Emit user online
                io.emit('user_online', {
                    userId: socket.userId,
                    username: socket.username,
                    timestamp: Date.now()
                });
                
                socket.emit('authenticated', {
                    userId: socket.userId,
                    username: socket.username,
                    workspaces: workspaces
                });
                
                logger.info(`User authenticated: ${socket.username} (${socket.userId})`);
                
            } catch (error) {
                logger.error(`Authentication error: ${error.message}`);
                socket.emit('auth_error', 'Invalid token');
            }
        });
        
        // Join workspace
        socket.on('join_workspace', (workspaceId) => {
            if (socket.userId) {
                socket.join(`workspace:${workspaceId}`);
                logger.info(`User ${socket.userId} joined workspace ${workspaceId}`);
            }
        });
        
        // Join channel
        socket.on('join_channel', (channelId) => {
            if (socket.userId) {
                socket.join(`channel:${channelId}`);
                logger.info(`User ${socket.userId} joined channel ${channelId}`);
            }
        });
        
        // Leave channel
        socket.on('leave_channel', (channelId) => {
            if (socket.userId) {
                socket.leave(`channel:${channelId}`);
                logger.info(`User ${socket.userId} left channel ${channelId}`);
            }
        });
        
        // Typing indicator
        socket.on('typing', (data) => {
            const { channelId, isTyping } = data;
            if (socket.userId) {
                socket.to(`channel:${channelId}`).emit('user_typing', {
                    userId: socket.userId,
                    username: socket.username,
                    channelId,
                    isTyping,
                    timestamp: Date.now()
                });
            }
        });
        
        // Send message (real-time)
        socket.on('send_message', async (messageData) => {
            try {
                const { channelId, content } = messageData;
                
                // Emit to channel
                io.to(`channel:${channelId}`).emit('new_message', {
                    ...messageData,
                    sender: {
                        _id: socket.userId,
                        username: socket.username
                    },
                    timestamp: Date.now(),
                    _id: Date.now().toString() // Temporary ID
                });
                
                logger.info(`Message sent to channel ${channelId} by ${socket.username}`);
                
            } catch (error) {
                logger.error(`Message sending error: ${error.message}`);
                socket.emit('message_error', error.message);
            }
        });
        
        // Location sharing
        socket.on('share_location', (data) => {
            const { channelId, location, expiresIn } = data;
            
            io.to(`channel:${channelId}`).emit('location_shared', {
                userId: socket.userId,
                username: socket.username,
                location,
                expiresAt: Date.now() + (expiresIn || 3600000), // 1 hour default
                timestamp: Date.now()
            });
            
            logger.info(`Location shared by ${socket.username} in channel ${channelId}`);
        });
        
        // Disconnect
        socket.on('disconnect', async () => {
            if (socket.userId) {
                // Remove socket from user's sockets
                const userSocketArray = userSockets.get(socket.userId);
                if (userSocketArray) {
                    const index = userSocketArray.indexOf(socket.id);
                    if (index > -1) {
                        userSocketArray.splice(index, 1);
                    }
                    
                    // If no more sockets for this user, mark as offline
                    if (userSocketArray.length === 0) {
                        userSockets.delete(socket.userId);
                        onlineUsers.delete(socket.userId);
                        
                        // Update user status
                        try {
                            const user = await User.findById(socket.userId);
                            if (user) {
                                user.status = 'offline';
                                user.lastSeen = Date.now();
                                await user.save();
                                
                                // Emit user offline
                                io.emit('user_offline', {
                                    userId: socket.userId,
                                    username: socket.username,
                                    timestamp: Date.now()
                                });
                            }
                        } catch (error) {
                            logger.error(`Error updating user status: ${error.message}`);
                        }
                    }
                }
                
                logger.info(`User ${socket.username} disconnected`);
            }
            
            logger.info(`Socket disconnected: ${socket.id}`);
        });
        
        // Error handling
        socket.on('error', (error) => {
            logger.error(`Socket error: ${error.message}`);
        });
    });
    
    // Helper function to get online users
    const getOnlineUsers = () => {
        return Array.from(onlineUsers.keys());
    };
    
    // Periodic cleanup
    setInterval(() => {
        io.emit('online_users', getOnlineUsers());
    }, 30000);
    
    return {
        getOnlineUsers
    };
};