const mongoose = require('mongoose');

const TICKET_STATUS = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "RESOLVED",
  "CLOSED",
];

const TICKET_PRIORITY = ["LOW", "NORMAL", "HIGH", "URGENT"];

const ticketSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: TICKET_STATUS,
      default: "OPEN",
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: TICKET_PRIORITY,
      default: "NORMAL",
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Para ordenar bandeja por actividad
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    resolvedAt: {
      type: Date,
      default: null,
      index: true,
    },
    closedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Índices compuestos útiles para inbox y listados
ticketSchema.index({ requesterId: 1, updatedAt: -1 });
ticketSchema.index({ assigneeId: 1, status: 1, lastMessageAt: -1 });
ticketSchema.index({ status: 1, lastMessageAt: -1 });

const Ticket = mongoose.model("Ticket", ticketSchema);

module.exports = Ticket;
module.exports.TICKET_STATUS = TICKET_STATUS;
module.exports.TICKET_PRIORITY = TICKET_PRIORITY;