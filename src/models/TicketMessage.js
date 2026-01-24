const mongoose = require("mongoose");

const ticketMessageSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5000,
    },
    isInternal: {
      type: Boolean,
      default: false, // para el MVP
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Índice para cargar rápido el hilo del ticket en orden
ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

const TicketMessage = mongoose.model("TicketMessage", ticketMessageSchema);

module.exports = TicketMessage;