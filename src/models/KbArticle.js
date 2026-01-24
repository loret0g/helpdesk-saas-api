const mongoose = require("mongoose");

const KB_STATUS = ["DRAFT", "PUBLISHED", "ARCHIVED"];

const kbArticleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true, // clave para seed y URLs
      lowercase: true,
      trim: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 20000,
    },
    status: {
      type: String,
      enum: KB_STATUS,
      default: "DRAFT",
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Índices
kbArticleSchema.index({ status: 1, publishedAt: -1 });
kbArticleSchema.index({ categoryId: 1, status: 1 });

const KbArticle = mongoose.model("KbArticle", kbArticleSchema);

module.exports = KbArticle;
module.exports.KB_STATUS = KB_STATUS;