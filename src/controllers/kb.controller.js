const mongoose = require("mongoose");
const KbArticle = require("../models/KbArticle");
const Category = require("../models/Category");

const KB_STATUS = ["DRAFT", "PUBLISHED", "ARCHIVED"];

function isStaff(user) {
  return user.role === "AGENT" || user.role === "ADMIN";
}

// GET - /api/kb?status=&categorySlug=&q=
async function listKb(req, res) {
  try {
    const user = req.user;
    const { status, categorySlug, q } = req.query;

    const filter = {};

    if (!isStaff(user)) {
      filter.status = "PUBLISHED";
    } else {
      if (status) filter.status = status;
    }

    if (categorySlug) {
      const cat = await Category.findOne({ slug: categorySlug.toLowerCase().trim() });
      if (!cat) return res.status(404).json({ message: "Category not found" });
      filter.categoryId = cat._id;
    }

    if (q && q.trim()) {
      const text = q.trim();
      filter.$or = [
        { title: { $regex: text, $options: "i" } },
        { slug: { $regex: text, $options: "i" } },
      ];
    }

    const articles = await KbArticle.find(filter)
      .populate("categoryId", "name slug")
      .populate("authorId", "name email")
      .sort({ publishedAt: -1, createdAt: -1 });

    return res.json(articles);
  } catch (err) {
    console.error("❌ listKb error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET - /api/kb/:slug
async function getKbBySlug(req, res) {
  try {
    const user = req.user;
    const { slug } = req.params;

    const article = await KbArticle.findOne({ slug: slug.toLowerCase().trim() })
      .populate("categoryId", "name slug")
      .populate("authorId", "name email");

    if (!article) return res.status(404).json({ message: "Article not found" });

    if (!isStaff(user) && article.status !== "PUBLISHED") {
      return res.status(403).json({ message: "You are not allowed to view this article" });
    }

    return res.json(article);
  } catch (err) {
    console.error("❌ getKbBySlug error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// POST - /api/kb
async function createKb(req, res) {
  try {
    const user = req.user;
    if (!isStaff(user)) return res.status(403).json({ message: "Only agents/admins can create articles" });

    const { title, slug, content, status, categorySlug } = req.body;

    if (!title || !slug || !content || !categorySlug) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["title", "slug", "content", "categorySlug"],
      });
    }

    const category = await Category.findOne({ slug: categorySlug.toLowerCase().trim() });
    if (!category) return res.status(404).json({ message: "Category not found" });

    const normalizedSlug = slug.toLowerCase().trim();
    const finalStatus = status && KB_STATUS.includes(status) ? status : "DRAFT";

    const article = await KbArticle.create({
      title: title.trim(),
      slug: normalizedSlug,
      content,
      status: finalStatus,
      categoryId: category._id,
      authorId: user._id,
      publishedAt: finalStatus === "PUBLISHED" ? new Date() : null,
    });

    const populated = await KbArticle.findById(article._id)
      .populate("categoryId", "name slug")
      .populate("authorId", "name email");

    return res.status(201).json(populated);
  } catch (err) {
    console.error("❌ createKb error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ message: "Slug already exists" });
    }
    return res.status(500).json({ message: "Server error" });
  }
}

// PATCH - /api/kb/:id
async function updateKb(req, res) {
  try {
    const user = req.user;
    if (!isStaff(user)) return res.status(403).json({ message: "Only agents/admins can update articles" });

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid article id" });

    const { title, content, status, categorySlug } = req.body;

    const article = await KbArticle.findById(id);
    if (!article) return res.status(404).json({ message: "Article not found" });

    const update = {};

    if (title) update.title = title.trim();
    if (content) update.content = content;
    if (status) {
      if (!KB_STATUS.includes(status)) {
        return res.status(400).json({ message: "Invalid status", allowed: KB_STATUS });
      }
      update.status = status;

      if (status === "PUBLISHED" && !article.publishedAt) {
        update.publishedAt = new Date();
      }
      if (status !== "PUBLISHED") {
        update.publishedAt = null;
      }
    }

    if (categorySlug) {
      const category = await Category.findOne({ slug: categorySlug.toLowerCase().trim() });
      if (!category) return res.status(404).json({ message: "Category not found" });
      update.categoryId = category._id;
    }

    const updated = await KbArticle.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate("categoryId", "name slug")
      .populate("authorId", "name email");

    return res.json(updated);
  } catch (err) {
    console.error("❌ updateKb error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// "DELETE" - /api/kb/:id (soft delete -> ARCHIVED)
async function archiveKb(req, res) {
  try {
    const user = req.user;
    if (!isStaff(user)) return res.status(403).json({ message: "Only agents/admins can archive articles" });

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid article id" });

    const updated = await KbArticle.findByIdAndUpdate(
      id,
      { $set: { status: "ARCHIVED", publishedAt: null } },
      { new: true }
    )
      .populate("categoryId", "name slug")
      .populate("authorId", "name email");

    if (!updated) return res.status(404).json({ message: "Article not found" });

    return res.json(updated);
  } catch (err) {
    console.error("❌ archiveKb error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = { listKb, getKbBySlug, createKb, updateKb, archiveKb };