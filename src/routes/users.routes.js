const router = require("express").Router();
const requireAuth = require("../middlewares/requireAuth");
const { listAgents } = require("../controllers/users.controller");

router.use(requireAuth);

// GET /api/users/agents
router.get("/agents", listAgents);

module.exports = router;