const router = require('express').Router({ mergeParams: true });
const requireAuth = require('../middlewares/requireAuth');
const { listMessages, createMessage } = require('../controllers/messages.controller');

router.use(requireAuth);

router.get('/', listMessages);
router.post('/', createMessage);

module.exports = router;