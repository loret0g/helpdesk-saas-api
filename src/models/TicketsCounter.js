const mongoose = require("mongoose");

const TicketsCounterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true, // "ticket"
  },
  seq: {
    type: Number,
    default: 0,
  },
});

const TicketsCounter = mongoose.model("TicketsCounter", TicketsCounterSchema);

module.exports = TicketsCounter;