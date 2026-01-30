const router = require("express").Router();
const requireAuth = require("../middlewares/requireAuth");
const { getKbById, listKb, getKbBySlug, createKb, updateKb, archiveKb } = require("../controllers/kb.controller");

router.use(requireAuth);

router.get("/", listKb);
router.get("/id/:id", getKbById);
router.get("/:slug", getKbBySlug);

// CRUD staff
router.post("/", createKb);
router.patch("/:id", updateKb);
router.delete("/:id", archiveKb);

module.exports = router;