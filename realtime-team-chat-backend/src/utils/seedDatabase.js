const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');
const Message = require('../models/Message');
require('dotenv').config();

const seedDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/team_chat_db');
        console.log('✅ Connected to MongoDB for seeding');

        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await User.deleteMany({});
        await Workspace.deleteMany({});
        await Channel.deleteMany({});
        await Message.deleteMany({});

        // 1. Create Admin User
        console.log('👑 Creating admin user...');
        const adminPassword = await bcrypt.hash('admin123', 10);
        const admin = await User.create({
            username: 'admin',
            email: 'admin@teamchat.com',
            password: adminPassword,
            role: 'admin',
            status: 'online',
            isVerified: true,
            avatar: 'https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff&bold=true'
        });

        // 2. Create Regular Users
        console.log('👥 Creating regular users...');
        const users = [];
        const userData = [
            { username: 'john_doe', email: 'john@teamchat.com' },
            { username: 'jane_smith', email: 'jane@teamchat.com' },
            { username: 'alex_wong', email: 'alex@teamchat.com' },
            { username: 'sarah_lee', email: 'sarah@teamchat.com' },
            { username: 'mike_brown', email: 'mike@teamchat.com' }
        ];

        for (const data of userData) {
            const password = await bcrypt.hash('password123', 10);
            const user = await User.create({
                ...data,
                password,
                status: 'online',
                isVerified: true,
                avatar: `https://ui-avatars.com/api/?name=${data.username}&background=10b981&color=fff`
            });
            users.push(user);
        }

        const allUsers = [admin, ...users];
        console.log(`✅ Created ${allUsers.length} users`);

        // 3. Create Workspace
        console.log('🏢 Creating workspace...');
        const workspace = await Workspace.create({
            name: 'Development Team',
            description: 'Team working on real-time chat application',
            owner: admin._id,
            avatar: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=400&fit=crop',
            settings: {
                isPublic: true,
                allowInvites: true,
                messageRetention: 30
            }
        });

        // 4. Add all users to workspace
        console.log('🤝 Adding users to workspace...');
        for (const user of allUsers) {
            await workspace.addMember(user._id, user._id.equals(admin._id) ? 'admin' : 'member');
            user.workspaces.push(workspace._id);
            await user.save();
        }

        // 5. Create Channels
        console.log('📢 Creating channels...');
        const generalChannel = await Channel.create({
            name: 'general',
            description: 'General discussions',
            workspace: workspace._id,
            createdBy: admin._id,
            type: 'public',
            members: allUsers.map(u => u._id)
        });

        const randomChannel = await Channel.create({
            name: 'random',
            description: 'Random talks and fun',
            workspace: workspace._id,
            createdBy: users[0]._id,
            type: 'public',
            members: allUsers.map(u => u._id)
        });

        const backendChannel = await Channel.create({
            name: 'backend',
            description: 'Backend development discussions',
            workspace: workspace._id,
            createdBy: admin._id,
            type: 'private',
            members: [admin._id, users[0]._id, users[1]._id]
        });

        // 6. Create Sample Messages
        console.log('💬 Creating sample messages...');
        const sampleMessages = [
            // General channel messages
            { channel: generalChannel._id, sender: admin._id, content: 'Welcome to our team chat! 🎉' },
            { channel: generalChannel._id, sender: users[0]._id, content: 'Hi everyone! Excited to be here! 👋' },
            { channel: generalChannel._id, sender: users[1]._id, content: 'Hello team! Looking forward to collaborating. 💪' },
            { channel: generalChannel._id, sender: users[2]._id, content: 'Thanks for the warm welcome! 🚀' },
            { channel: generalChannel._id, sender: admin._id, content: 'Remember to update your profiles with avatars!' },
            
            // Random channel messages
            { channel: randomChannel._id, sender: users[2]._id, content: 'Anyone up for a virtual coffee? ☕' },
            { channel: randomChannel._id, sender: users[3]._id, content: 'I found this interesting article about WebSockets: https://example.com' },
            { channel: randomChannel._id, sender: users[4]._id, content: 'Weekend plans anyone? 🎮' },
            
            // Backend channel messages
            { channel: backendChannel._id, sender: admin._id, content: 'Let\'s discuss the database schema for messages' },
            { channel: backendChannel._id, sender: users[0]._id, content: 'I\'ve implemented the message model with reactions support' },
            { channel: backendChannel._id, sender: users[1]._id, content: 'Working on the Socket.IO integration now' },
            
            // More general messages
            { channel: generalChannel._id, sender: users[4]._id, content: 'Can someone help me with Socket.IO configuration?' },
            { channel: generalChannel._id, sender: admin._id, content: 'Sure @mike_brown, I can help. What\'s the issue?' },
            { channel: generalChannel._id, sender: users[4]._id, content: 'Thanks @admin! I\'ll share my code in the backend channel' },
            
            // Location sharing example
            { 
                channel: generalChannel._id, 
                sender: users[3]._id, 
                type: 'location',
                location: {
                    lat: 40.7128,
                    lng: -74.0060,
                    address: 'New York, NY, USA'
                },
                content: 'Sharing my location for the meetup!'
            }
        ];

        // Create messages with timestamps
        for (let i = 0; i < sampleMessages.length; i++) {
            const msgData = sampleMessages[i];
            // Stagger messages over the last 7 days
            const daysAgo = Math.floor(Math.random() * 7);
            const hoursAgo = Math.floor(Math.random() * 24);
            const minutesAgo = Math.floor(Math.random() * 60);
            
            const createdAt = new Date();
            createdAt.setDate(createdAt.getDate() - daysAgo);
            createdAt.setHours(createdAt.getHours() - hoursAgo);
            createdAt.setMinutes(createdAt.getMinutes() - minutesAgo);
            
            await Message.create({
                ...msgData,
                createdAt,
                updatedAt: createdAt
            });
        }

        // 7. Update channel last messages
        console.log('🔄 Updating channel last messages...');
        const updateChannelLastMessage = async (channelId) => {
            const lastMessage = await Message.findOne({ channel: channelId })
                .sort({ createdAt: -1 })
                .select('_id');
            
            if (lastMessage) {
                await Channel.findByIdAndUpdate(channelId, {
                    lastMessage: lastMessage._id
                });
            }
        };

        await updateChannelLastMessage(generalChannel._id);
        await updateChannelLastMessage(randomChannel._id);
        await updateChannelLastMessage(backendChannel._id);

        console.log('\n🎉 Database seeding completed successfully!');
        console.log('==========================================');
        console.log('📋 Sample Data Created:');
        console.log('👑 Admin: admin@teamchat.com / admin123');
        console.log('👥 5 Users: All have password: password123');
        console.log('🏢 Workspace: Development Team');
        console.log('📢 3 Channels: general, random, backend');
        console.log('💬 15 Sample Messages with locations');
        console.log('==========================================');
        console.log('\n🚀 Server ready for development!');

        process.exit(0);

    } catch (error) {
        console.error('❌ Database seeding failed:', error);
        process.exit(1);
    }
};

// Run seeder if called directly
if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;