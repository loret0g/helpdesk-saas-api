require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Category = require("../models/Category");
const Ticket = require("../models/Ticket");
const TicketMessage = require("../models/TicketMessage");
const KbArticle = require("../models/KbArticle");
const CounterTickets = require("../models/TicketsCounter");

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in .env");
  await mongoose.connect(uri);
}

async function upsertUser({ name, email, password, role }) {
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.findOneAndUpdate(
    { email: normalizedEmail },
    { $set: { name, email: normalizedEmail, role, isActive: true }, $setOnInsert: { passwordHash } },
    { new: true, upsert: true }
  );

  return user;
}

async function upsertCategory({ name, slug }) {
  const normalizedSlug = slug.toLowerCase().trim();

  return Category.findOneAndUpdate(
    { slug: normalizedSlug },
    { $set: { name: name.trim(), slug: normalizedSlug, isActive: true } },
    { new: true, upsert: true }
  );
}

async function upsertKbArticle({ title, slug, content, status, categoryId, authorId }) {
  const normalizedSlug = slug.toLowerCase().trim();
  const now = new Date();

  const update = {
    title: title.trim(),
    slug: normalizedSlug,
    content,
    status,
    categoryId,
    authorId,
    publishedAt: status === "PUBLISHED" ? now : null,
  };

  return KbArticle.findOneAndUpdate(
    { slug: normalizedSlug },
    { $set: update },
    { new: true, upsert: true }
  );
}

async function nextTicketCode() {
  const counter = await CounterTickets.findByIdAndUpdate(
    "ticket",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `TCK-${String(counter.seq).padStart(6, "0")}`;
}

async function createTicketWithMessages({
  subject,
  description,
  priority,
  categoryId,
  requesterId,
  assigneeId,
  messages,
}) {
  const code = await nextTicketCode();

  const ticket = await Ticket.create({
    code,
    subject,
    description,
    priority,
    categoryId,
    requesterId,
    assigneeId: assigneeId || null,
    status: "OPEN",
    lastMessageAt: new Date(),
  });

  // Crear mensajes
  let lastDate = new Date();
  for (const m of messages) {
    lastDate = new Date(); // cada mensaje: "ahora"
    await TicketMessage.create({
      ticketId: ticket._id,
      authorId: m.authorId,
      body: m.body,
      isInternal: false,
    });
  }

  // Actualizar lastMessageAt con el "último mensaje"
  await Ticket.findByIdAndUpdate(ticket._id, { $set: { lastMessageAt: lastDate } });

  return ticket;
}

async function runSeed() {
  if (process.env.ALLOW_SEED !== "true") {
    console.log("❌ ALLOW_SEED is not true. Aborting seed.");
    process.exit(1);
  }

  console.log("🌱 Seeding database...");

  // 1) Users demo
  const admin = await upsertUser({
    name: "Demo Admin",
    email: "admin@demo.com",
    password: "Admin123!",
    role: "ADMIN",
  });

  const agent = await upsertUser({
    name: "Demo Agent",
    email: "agent@demo.com",
    password: "Agent123!",
    role: "AGENT",
  });

  const customer = await upsertUser({
    name: "Demo Customer",
    email: "customer@demo.com",
    password: "Customer123!",
    role: "CUSTOMER",
  });

  console.log("✅ Users:", { admin: admin.email, agent: agent.email, customer: customer.email });

  // 2) Categories
  const catTech = await upsertCategory({ name: "Soporte técnico", slug: "technical-support" });
  const catBilling = await upsertCategory({ name: "Facturación", slug: "billing" });

  console.log("✅ Categories:", [catTech.slug, catBilling.slug]);

  // 3) KB Articles
  const kb1 = await upsertKbArticle({
    title: "No puedo iniciar sesión",
    slug: "no-puedo-iniciar-sesion",
    content:
      "Si no puedes iniciar sesión:\n\n1) Revisa email/contraseña.\n2) Prueba a restablecer tu contraseña.\n3) Borra caché o prueba otro navegador.\n",
    status: "PUBLISHED",
    categoryId: catTech._id,
    authorId: admin._id,
  });

  const kb2 = await upsertKbArticle({
    title: "No me aparece la factura",
    slug: "no-me-aparece-la-factura",
    content:
      "Si no te aparece la factura:\n\n1) Comprueba el email de compra.\n2) Revisa spam.\n3) Si sigue igual, abre un ticket en Facturación.\n",
    status: "PUBLISHED",
    categoryId: catBilling._id,
    authorId: admin._id,
  });

  console.log("✅ KB:", [kb1.slug, kb2.slug]);

  // 4) Tickets + messages
  const t1 = await createTicketWithMessages({
    subject: "No puedo iniciar sesión",
    description: "Me sale error al entrar desde el móvil.",
    priority: "HIGH",
    categoryId: catTech._id,
    requesterId: customer._id,
    assigneeId: null, // sin asignar
    messages: [
      { authorId: customer._id, body: "Hola, no puedo iniciar sesión desde el móvil." },
      { authorId: agent._id, body: "Gracias. ¿Qué error te aparece exactamente?" },
    ],
  });

  const t2 = await createTicketWithMessages({
    subject: "No me aparece la factura",
    description: "Hice una compra y no encuentro la factura.",
    priority: "NORMAL",
    categoryId: catBilling._id,
    requesterId: customer._id,
    assigneeId: agent._id, // asignado
    messages: [
      { authorId: customer._id, body: "No encuentro la factura de mi compra." },
      { authorId: agent._id, body: "¿Puedes confirmar el email con el que compraste?" },
      { authorId: customer._id, body: "Sí, es customer@demo.com" },
    ],
  });

  console.log("✅ Tickets created:", [t1.code, t2.code]);

  console.log("🌱 Seed completed!");
}

(async () => {
  try {
    await connect();
    await runSeed();
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();