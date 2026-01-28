const Ticket = require('../models/Ticket');
const Category = require('../models/Category');
const TicketsCounter = require('../models/TicketsCounter');

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
    console.error("❌ createTicket error:", err);
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

    // CUSTOMER: solo sus tickets (sin filtros de assigned)
    if (user.role === "CUSTOMER") {
      filter.requesterId = user._id;
    } else {
      // AGENT / ADMIN

      // assigned filter
      if (assigned === "me") {
        filter.assigneeId = user._id;
      } else if (assigned === "unassigned") {
        filter.assigneeId = null;
      }

      // status filter
      if (status) {
        filter.status = status;
      } else {
        // por defecto, no mostrar CLOSED
        filter.status = { $ne: "CLOSED" };
      }

      // búsqueda simple
      if (q && q.trim()) {
        const text = q.trim();

        // si parece un code, regex
        filter.$or = [
          { code: { $regex: text, $options: "i" } },
          { subject: { $regex: text, $options: "i" } },
        ];
      }
    }

    const tickets = await Ticket.find(filter)
      .populate("categoryId", "name slug")
      .populate("requesterId", "name email")
      .populate("assigneeId", "name email")
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

    // Validar ObjetId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findById(id)
    .populate("categoryId", "name slug")
    .populate("requesterId", "name email role")
    .populate("assigneeId", "name email role");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Permisos: customer solo ve sus tickets
    if (user.role === "CUSTOMER") {
      const isOwner = ticket.requesterId?._id.toString() === user._id.toString();
      if (!isOwner) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    return res.json(ticket);

  } catch (error) {
    console.error("❌ getTicketById error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

//* Asignación y cambio de estado de tickets (AGENT / ADMIN)
const ALLOWED_STATUS = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];

// PATCH /api/tickets/:id/assign
async function assignTicketToMe(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role !== "AGENT" && user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only agents/admins can assign tickets" });
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
      return res.status(403).json({ message: "Only agents/admins can change ticket status" });
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

    // Si se pone IN_PROGRESS y no está asignado, se auto-asigna
    if (status === "IN_PROGRESS" && !ticket.assigneeId) {
      ticket.assigneeId = user._id;
    }

    ticket.status = status;
    await ticket.save();

    const populated = await Ticket.findById(ticket._id)
      .populate("categoryId", "name slug")
      .populate("requesterId", "name email")
      .populate("assigneeId", "name email");

    return res.json(populated);
  } catch (err) {
    console.error("❌ updateTicketStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}


module.exports = {
  createTicket,
  listTickets,
  getTicketById,
  assignTicketToMe,
  updateTicketStatus,
};