const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const TicketMessage = require('../models/TicketMessage');

async function assertCanAccessTicket(user, ticket) {
  if (!ticket) return false;

  if (user.role === "CUSTOMER") {
    return ticket.requesterId.toString() === user._id.toString();
  }

  //* AGENT / ADMIN: permito por ahora. MVP
  return true;
}

// GET - api/tickets/:id/messages
async function listMessages(req, res) {
  try {
    const { id } = req.params; // ticket id
    const user = req.user;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const allowed = await assertCanAccessTicket(user, ticket);
    if (!allowed) {
      return res.status(403).json({ message: "You are not allowed to view these messages" });
    }

    const messages = await TicketMessage.find({ ticketId: id })
      .populate("authorId", "name email role")
      .sort({ createdAt: 1 });

    return res.json(messages);
  } catch (err) {
    console.error("❌ listMessages error:", err);
    return res.status(500).json({ message: "Server error" });
  }



}

// POST /api/tickets/:id/messages
async function createMessage(req, res) {
  try {
    const { id } = req.params; // ticket id
    const user = req.user;
    const { body } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({ message: "Message body is required" });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const allowed = await assertCanAccessTicket(user, ticket);
    if (!allowed) {
      return res.status(403).json({ message: "You are not allowed to post in this ticket" });
    }

    // 1) Crear mensaje
    const msg = await TicketMessage.create({
      ticketId: ticket._id,
      authorId: user._id,
      body: body.trim(),
      isInternal: false,
    });

    // 2) Flujo automático de status + lastMessageAt
    const now = new Date();
    const update = { lastMessageAt: now };

    const isAgent = user.role === "AGENT";
    const isCustomer = user.role === "CUSTOMER";

    if (isAgent) {
      // Si el ticket estaba sin asignar, al responder se asigna al agente
      if (!ticket.assigneeId) {
        update.assigneeId = user._id;
      }

      // Cambiar status cuando responde un agente (si está cerrado, no lo reabrimos por respuesta del agente)
      if (ticket.status !== "CLOSED") {
        update.status = "WAITING_ON_CUSTOMER";
      }
    }

    if (isCustomer) {
      // Si estaba cerrado/resuelto y el customer escribe, reabrimos
      if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
        update.status = ticket.assigneeId ? "IN_PROGRESS" : "OPEN";
      } else {
        // Si no estaba cerrado, lo dejamos como IN_PROGRESS si hay agente, OPEN si no
        update.status = ticket.assigneeId ? "IN_PROGRESS" : "OPEN";
      }
    }

    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticket._id,
      { $set: update },
      { new: true }
    )
      .populate("categoryId", "name slug")
      .populate("requesterId", "name email")
      .populate("assigneeId", "name email");

    const populatedMsg = await TicketMessage.findById(msg._id).populate(
      "authorId",
      "name email role"
    );

    return res.status(201).json({
      message: populatedMsg,
      ticket: updatedTicket,
    });
  } catch (err) {
    console.error("❌ createMessage error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}


module.exports = {
  listMessages,
  createMessage,
};