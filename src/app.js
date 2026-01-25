const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");

const app = express();

// ===== Middlewares globales =====
app.use(cors());              // Permite llamadas desde el frontend
app.use(express.json());      // Permite leer JSON del body
app.use(morgan("dev"));       // Logs de peticiones en consola

// ===== Rutas =====
app.use("/api/auth", authRoutes);


module.exports = app;