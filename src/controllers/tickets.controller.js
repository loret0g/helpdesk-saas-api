const Ticket = require("../models/Ticket");
const Category = require("../models/Category");
const User = require("../models/User");
const TicketsCounter = require("../models/TicketsCounter");
const mongoose = require("mongoose");

const ALLOWED_STATUS = Ticket.TICKET_STATUS;

const { canAccessTicket, buildTicketsListFilter } = require("../utils/ticketAccess");

// POST - /api/tickets
async function createTicket(req, res) {
  try {
    const { subject, description, categorySlug, priority } = req.body;
    const user = req.user;

    if (user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Only customers can create tickets" });
    }

    if (!subject || !description || !categorySlug) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["subject", "description", "categorySlug"],
      });
    }

    const category = await Category.findOne({
      slug: categorySlug.toLowerCase().trim(),
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const counter = await TicketsCounter.findByIdAndUpdate(
      "ticket",
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const code = `TCKT-${String(counter.seq).padStart(6, "0")}`;

    const ticket = await Ticket.create({
      code,
      subject: subject.trim(),
      description: description.trim(),
      priority: priority || "NORMAL",
      categoryId: category._id,
      requesterId: user._id,
      assigneeId: null,
      status: "OPEN",
      lastMessageAt: new Date(),
    });

    return res.status(201).json(ticket);
  } catch (error) {
    console.error("❌ createTicket error:", error);

    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "Server error" });
  }
}

// GET - /api/tickets
async function listTickets(req, res) {
  try {
    const user = req.user;

    // Construye el filtro base aplicando las reglas de acceso por rol
    const filter = buildTicketsListFilter(user, req.query);

    // Rol no permitido / user inválido
    if (!filter) {
      return res.status(403).json({ message: "Access denied" });
    }

    const tickets = await Ticket.find(filter)
      .populate("categoryId", "name slug")
      .populate("requesterId", "name email role")
      .populate("assigneeId", "name email role")
      .sort({ lastMessageAt: -1 });

    return res.json(tickets);
  } catch (err) {
    console.error("❌ listTickets error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET - /api/tickets/:id
async function getTicketById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    // 1) Buscar ticket sin populate (para decidir permisos rápido)
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // 2) Validar acceso
    if (!canAccessTicket(user, ticket)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // 3) Ya con acceso OK: devolver ticket populado
    const populated = await Ticket.findById(id)
      .populate("categoryId", "name slug")
      .populate("requesterId", "name email role")
      .populate("assigneeId", "name email role");

    return res.json(populated);
  } catch (error) {
    console.error("❌ getTicketById error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

// PATCH /api/tickets/:id/assign
async function assignTicketToMe(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role !== "AGENT") {
      return res.status(403).json({ message: "Only agents can assign tickets to themselves" });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (ticket.assigneeId) {
      return res.status(409).json({ message: "Ticket is already assigned" });
    }

    ticket.assigneeId = user._id;
    ticket.status = "IN_PROGRESS";
    await ticket.save();

    const populated = await Ticket.findById(ticket._id)
      .populate("categoryId", "name slug")
      .populate("requesterId", "name email role")
      .populate("assigneeId", "name email role");

    return res.json(populated);
  } catch (err) {
    console.error("❌ assignTicketToMe error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// PATCH /api/tickets/:id/status
async function updateTicketStatus(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;
    const { status } = req.body;

    if (user.role !== "AGENT" && user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only agents/admins can change ticket status" });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    if (!status || !ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: "Invalid status", allowed: ALLOWED_STATUS });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Si se pone IN_PROGRESS y no está asignado, se auto-asigna SOLO si es AGENT
    if (status === "IN_PROGRESS" && !ticket.assigneeId && user.role === "AGENT") {
      ticket.assigneeId = user._id;
    }

    ticket.status = status;

    if (status === "RESOLVED") ticket.resolvedAt = new Date();
    else ticket.resolvedAt = null;

    if (status === "CLOSED") ticket.closedAt = new Date();
    else ticket.closedAt = null;

    await ticket.save();

    const populated = await Ticket.findById(ticket._id)
      .populate("categoryId", "name slug")
      .populate("requesterId", "name email role")
      .populate("assigneeId", "name email role");

    return res.json(populated);
  } catch (err) {
    console.error("❌ updateTicketStatus error:", err);
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: "Server error" });
  }
}

// PATCH /api/tickets/:id/assignee
async function setTicketAssignee(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;
    const { assigneeId } = req.body;

    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can reassign tickets" });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    const normalizedAssigneeId =
      assigneeId && String(assigneeId).trim() ? String(assigneeId).trim() : null;

    if (normalizedAssigneeId) {
      if (!mongoose.isValidObjectId(normalizedAssigneeId)) {
        return res.status(400).json({ message: "Invalid assignee id" });
      }

      const assigneeUser = await User.findById(normalizedAssigneeId).select("role name email");
      if (!assigneeUser) {
        return res.status(404).json({ message: "Assignee user not found" });
      }

      if (assigneeUser.role !== "AGENT") {
        return res.status(400).json({ message: "Assignee must be an AGENT" });
      }
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    ticket.assigneeId = normalizedAssigneeId;
    await ticket.save();

    const populated = await Ticket.findById(ticket._id)
      .populate("categoryId", "name slug")
      .populate("requesterId", "name email role")
      .populate("assigneeId", "name email role");

    return res.json(populated);
  } catch (err) {
    console.error("❌ setTicketAssignee error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  createTicket,
  listTickets,
  getTicketById,
  assignTicketToMe,
  updateTicketStatus,
  setTicketAssignee,
};