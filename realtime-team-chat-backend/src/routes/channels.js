const express = require('express');
const router = express.Router();
const {
    getChannels,
    getChannel,
    createChannel,
    updateChannel,
    deleteChannel,
    joinChannel,
    leaveChannel,
    addChannelMember
} = require('../controllers/channelController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Workspace-specific channels
router.get('/workspace/:workspaceId', getChannels);

// Channel CRUD
router.get('/:id', getChannel);
router.post('/', createChannel);
router.put('/:id', updateChannel);
router.delete('/:id', deleteChannel);

// Channel membership
router.post('/:id/join', joinChannel);
router.post('/:id/leave', leaveChannel);
router.post('/:id/members', addChannelMember);

module.exports = router;