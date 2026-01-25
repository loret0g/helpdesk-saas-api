const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// POST - /api/auth/register
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
        required: ["name", "email", "password"]
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "CUSTOMER"
    })

    return res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });

  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// Token
function signToken(user) {
  const payload = {
    sub: user._id.toString(),
    role: user.role,
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// POST - /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
        required: ["email", "password"]
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // passwordHash tiene select:false, hay que pedirlo explícitamente
    const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });


  } catch (err) {
    console.error("❌ login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/auth/me
async function me(req, res) {
  return res.json({
    user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
  });
}

module.exports = {
  register,
  login,
  me
};