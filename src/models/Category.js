const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
},
  { timestamps: true }
);

// índice para búsquedas
categorySchema.index({ name: 1 });

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;