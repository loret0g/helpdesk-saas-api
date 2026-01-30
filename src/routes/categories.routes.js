const router = require("express").Router();
const requireAuth = require("../middlewares/requireAuth");
const { listCategories } = require("../controllers/categories.controller");

router.get("/", requireAuth, listCategories);

module.exports = router;