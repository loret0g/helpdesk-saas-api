const mongoose = require('mongoose');

const USER_ROLES = ['ADMIN', 'AGENT', 'CUSTOMER'];

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80,
  },
  email: {
    type: String,
    required: true,
    unique: true, // clave para seed (upsert por email)
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false, // por defecto NO devuelve el hash en queries
  },
  role: {
    type: String,
    enum: USER_ROLES,
    default: "CUSTOMER",
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
},
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.USER_ROLES = USER_ROLES;