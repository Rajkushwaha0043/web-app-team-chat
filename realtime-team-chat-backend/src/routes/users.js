const express = require('express');
const router = express.Router();
const {
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    searchUsers,
    updateStatus,
    getUserWorkspaces
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/', getUsers);
router.get('/search', searchUsers);
router.get('/workspaces', getUserWorkspaces);
router.put('/status', updateStatus);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

module.exports = router;