const User = require("../models/User");

// GET /api/users/agents
async function listAgents(req, res) {
  try {
    const user = req.user;

    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can list agents" });
    }

    const agents = await User.find({ role: "AGENT", isActive: true })
      .select("name email role")
      .sort({ name: 1 });

    return res.json({ agents });
  } catch (err) {
    console.error("❌ listAgents error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = { listAgents };