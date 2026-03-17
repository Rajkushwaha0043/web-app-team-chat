const express = require('express');
const router = express.Router();
const {
    getWorkspaces,
    getWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    addMember,
    removeMember,
    generateInvite,
    joinViaInvite
} = require('../controllers/workspaceController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/', getWorkspaces);
router.get('/:id', getWorkspace);
router.post('/', createWorkspace);
router.put('/:id', updateWorkspace);
router.delete('/:id', deleteWorkspace);
router.post('/:id/members', addMember);
router.delete('/:id/members/:userId', removeMember);
router.post('/:id/invite', generateInvite);
router.post('/join/:code', joinViaInvite);

module.exports = router;