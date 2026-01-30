const Category = require("../models/Category");

// GET - /api/categories
async function listCategories(req, res) {
  try {
    const categories = await Category.find({}, "name slug").sort({ name: 1 });
    return res.json({ categories });
  } catch (err) {
    console.error("❌ list categories error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = { listCategories };