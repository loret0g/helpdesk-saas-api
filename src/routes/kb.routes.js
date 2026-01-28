const router = require("express").Router();
const requireAuth = require("../middlewares/requireAuth");
const { listKb, getKbBySlug, createKb, updateKb, archiveKb } = require("../controllers/kb.controller");

router.use(requireAuth);

router.get("/", listKb);
router.get("/:slug", getKbBySlug);

router.post("/", createKb);
router.patch("/:id", updateKb);
router.delete("/:id", archiveKb);

module.exports = router;