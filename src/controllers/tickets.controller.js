const Ticket = require('../models/Ticket');
const Category = require('../models/Category');
const User = require("../models/User");
const TicketsCounter = require('../models/TicketsCounter');

const ALLOWED_STATUS = Ticket.TICKET_STATUS;

const mongoose = require('mongoose');

// POST - /api/tickets
// Customer crea un nuevo ticket
async function createTicket(req, res) {
  try {
    const { subject, description, categorySlug, priority } = req.body;
    const user = req.user;

    if (user.role !== 'CUSTOMER') {
      return res.status(403).json({ message: "Only customers can create tickets" });
    }

    if (!subject || !description || !categorySlug) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["subject", "description", "categorySlug"]
      });
    }

    const category = await Category.findOne({
      slug: categorySlug.toLowerCase().trim(),
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Generar ticketNumber secuencial
    const counter = await TicketsCounter.findByIdAndUpdate(
      "ticket",
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const code = `TCKT-${String(counter.seq).padStart(6, '0')}`;

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
    return res.status(500).json({ message: "Server error" });
  }
}

// GET - /api/tickets
// Tickets según rol del usuario
async function listTickets(req, res) {
  try {
    const user = req.user;
    const { assigned, status, q } = req.query;

    const filter = {};

    if (user.role === "CUSTOMER") {
      filter.requesterId = user._id;

    } else if (user.role === "ADMIN") {
      if (assigned === "unassigned") {
        filter.assigneeId = null;
      }

    } else if (user.role === "AGENT") {
      // El agente, por defecto, ve su "Inbox":
      // tickets asignados a él + tickets sin asignar.
      if (assigned === "me") {
        filter.assigneeId = user._id;

      } else if (assigned === "unassigned") {
        filter.assigneeId = null;

      } else {
        // Vista por defecto (inbox)
        filter.$or = [
          { assigneeId: user._id },
          { assigneeId: null }
        ];
      }

    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    // --- Filtro por estado ---
    if (status && String(status).trim()) {
      filter.status = String(status).trim();
    }

    // --- Búsqueda por código o asunto ---
    if (q && String(q).trim()) {
      const text = String(q).trim();

      // Se usa $and para no interferir con el $or del inbox del agente
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { code: { $regex: text, $options: "i" } },
          { subject: { $regex: text, $options: "i" } },
        ],
      });
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

    // Buscar SIN populate para validar permisos con ObjectIds puros
    const ticketRaw = await Ticket.findById(id).select(
      "categoryId requesterId assigneeId status priority subject description code lastMessageAt resolvedAt closedAt createdAt updatedAt"
    );

    if (!ticketRaw) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Autorización por rol
    if (user.role === "CUSTOMER") {
      const isOwner = String(ticketRaw.requesterId) === String(user._id);
      if (!isOwner) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    if (user.role === "AGENT") {
      const isAssignedToMe =
        ticketRaw.assigneeId && String(ticketRaw.assigneeId) === String(user._id);

      const isUnassigned = !ticketRaw.assigneeId;

      if (!isAssignedToMe && !isUnassigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // ADMIN: acceso total (no hace falta condición)

    // Si pasa permisos, devolver con populate
    const ticket = await Ticket.findById(id)
      .populate("categoryId", "name slug")
      .populate("requesterId", "name email role")
      .populate("assigneeId", "name email role");

    return res.json(ticket);
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
      .populate("requesterId", "name email")
      .populate("assigneeId", "name email");

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
      return res
        .status(403)
        .json({ message: "Only agents/admins can change ticket status" });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    if (!status || !ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
        allowed: ALLOWED_STATUS,
      });
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
      .populate("requesterId", "name email")
      .populate("assigneeId", "name email");

    return res.json(populated);
  } catch (err) {
    console.error("❌ updateTicketStatus error:", err);

    // Si es ValidationError (enum etc), mejor 400 que 500
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    return res.status(500).json({ message: "Server error" });
  }
}

// PATCH /api/tickets/:id/assignee
// ADMIN asigna ticket a un AGENT (o lo deja unassigned con null)
async function setTicketAssignee(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;
    const { assigneeId } = req.body; // string o null

    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can reassign tickets" });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    // Normalizamos: "", undefined -> null (unassigned)
    const normalizedAssigneeId =
      assigneeId && String(assigneeId).trim() ? String(assigneeId).trim() : null;

    // Si viene assigneeId, validar que existe y es AGENT
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

    ticket.assigneeId = normalizedAssigneeId; // null o ObjectId string
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