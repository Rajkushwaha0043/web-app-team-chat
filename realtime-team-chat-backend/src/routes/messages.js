const express = require('express');
const router = express.Router();
const {
    getMessages,
    sendMessage,
    updateMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    pinMessage,
    unpinMessage
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Channel messages
router.get('/channel/:channelId', getMessages);

// Message CRUD
router.post('/', sendMessage);
router.put('/:id', updateMessage);
router.delete('/:id', deleteMessage);

// Reactions
router.post('/:id/reactions', addReaction);
router.delete('/:id/reactions/:emoji', removeReaction);

// Pin/Unpin
router.post('/:id/pin', pinMessage);
router.delete('/:id/pin', unpinMessage);

module.exports = router;