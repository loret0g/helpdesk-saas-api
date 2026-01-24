const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");

// PRUEBAS DEV (temporales)
const Ticket = require("./models/Ticket");
const User = require("./models/User");
const Category = require("./models/Category");
const TicketsCounter = require("./models/TicketsCounter");
const TicketMessage = require("./models/TicketMessage");


const app = express();

// ===== Middlewares globales =====
app.use(cors());              // Permite llamadas desde el frontend
app.use(express.json());      // Permite leer JSON del body
app.use(morgan("dev"));       // Logs de peticiones en consola

// ===== Ruta de prueba =====
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Helpdesk API running",
  });
});

// ===== Rutas de la API =====
app.use("/api/auth", authRoutes);

// ============================================
//* PRUEBAS DEV (TEMPORALES)
// ============================================

// Crear categoría (dev)
app.post("/api/dev/categories", async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["name", "slug"],
      });
    }

    const normalizedSlug = slug.toLowerCase().trim();
    const existing = await Category.findOne({ slug: normalizedSlug });

    if (existing) {
      return res.status(409).json({ message: "Category already exists" });
    }

    const category = await Category.create({
      name: name.trim(),
      slug: normalizedSlug,
    });

    return res.status(201).json(category);
  } catch (err) {
    console.error("❌ create category error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Crear ticket (dev) con code autogenerado
app.post("/api/dev/tickets", async (req, res) => {
  try {
    const {
      subject,
      description,
      categorySlug,
      requesterEmail,
      assigneeEmail,
      priority,
    } = req.body;

    if (!subject || !description || !categorySlug || !requesterEmail) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["subject", "description", "categorySlug", "requesterEmail"],
      });
    }

    // Buscar categoría
    const category = await Category.findOne({
      slug: categorySlug.toLowerCase().trim(),
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Buscar requester (customer)
    const requester = await User.findOne({
      email: requesterEmail.toLowerCase().trim(),
    });

    if (!requester) {
      return res.status(404).json({ message: "Requester user not found" });
    }

    // Buscar assignee (opcional)
    let assignee = null;
    if (assigneeEmail) {
      assignee = await User.findOne({
        email: assigneeEmail.toLowerCase().trim(),
      });

      if (!assignee) {
        return res.status(404).json({ message: "Assignee user not found" });
      }
    }

    // Generar code secuencial tipo TCK-000001
    const counter = await TicketsCounter.findByIdAndUpdate(
      "ticket",
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const code = `TCK-${String(counter.seq).padStart(6, "0")}`;

    // Crear ticket
    const ticket = await Ticket.create({
      code,
      subject: subject.trim(),
      description: description.trim(),
      categoryId: category._id,
      requesterId: requester._id,
      assigneeId: assignee ? assignee._id : null,
      priority: priority || "NORMAL",
      status: "OPEN",
      lastMessageAt: new Date(),
    });

    return res.status(201).json(ticket);
  } catch (err) {
    console.error("❌ create ticket error:", err);

    // Si es error de índice único, lo mostramos bonito
    if (err.code === 11000) {
      return res.status(409).json({
        message: "Duplicate key error",
        details: err.keyValue,
      });
    }

    return res.status(500).json({ message: "Server error" });
  }
});

// Crear mensaje en ticket (dev)
app.post("/api/dev/tickets/:ticketId/messages", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { authorEmail, body } = req.body;

    if (!authorEmail || !body) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["authorEmail", "body"],
      });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const author = await User.findOne({ email: authorEmail.toLowerCase().trim() });
    if (!author) {
      return res.status(404).json({ message: "Author user not found" });
    }

    const msg = await TicketMessage.create({
      ticketId: ticket._id,
      authorId: author._id,
      body: body.trim(),
      isInternal: false,
    });

    // ✅ Actualización robusta (sin depender de save())
    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticket._id,
      { $set: { lastMessageAt: new Date() } },
      { new: true }
    );

    return res.status(201).json({
      message: msg,
      ticket: updatedTicket,
    });
  } catch (err) {
    console.error("❌ create ticket message error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});



module.exports = app;