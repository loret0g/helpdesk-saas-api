const router = require("express").Router();
const requireAuth = require("../middlewares/requireAuth");
const { register, login, me } = require("../controllers/auth.controller");

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);

module.exports = router;