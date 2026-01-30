const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const ticketRoutes = require("./routes/tickets.routes");
const kbRoutes = require("./routes/kb.routes");
const categoriesRoutes = require("./routes/categories.routes");

const app = express();

// ===== Middlewares globales =====
app.use(cors());              // Permite llamadas desde el frontend
app.use(express.json());      // Permite leer JSON del body
app.use(morgan("dev"));       // Logs de peticiones en consola

// ===== Rutas =====
app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/kb", kbRoutes);
app.use("/api/categories", categoriesRoutes);

module.exports = app;