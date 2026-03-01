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

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function normalizeSlug(slug) {
  return String(slug || "").toLowerCase().trim();
}

async function upsertUser({ name, email, password, role }) {
  const normalizedEmail = normalizeEmail(email);
  const existing = await User.findOne({ email: normalizedEmail });

  // Si ya existe, no pisamos passwordHash
  if (existing) {
    existing.name = name;
    existing.role = role;
    existing.isActive = true;
    await existing.save();
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  return User.create({
    name,
    email: normalizedEmail,
    role,
    isActive: true,
    passwordHash,
  });
}

async function upsertCategory({ name, slug }) {
  const normalizedSlug = normalizeSlug(slug);

  return Category.findOneAndUpdate(
    { slug: normalizedSlug },
    {
      $set: {
        name: String(name || "").trim(),
        slug: normalizedSlug,
        isActive: true,
      },
    },
    { new: true, upsert: true }
  );
}

async function upsertKbArticle({
  title,
  slug,
  content,
  status,
  categoryId,
  authorId,
}) {
  const normalizedSlug = normalizeSlug(slug);
  const now = new Date();

  const update = {
    title: String(title || "").trim(),
    slug: normalizedSlug,
    content: String(content || ""),
    status,
    categoryId,
    authorId,
    publishedAt: status === "PUBLISHED" ? now : null,
    isActive: true,
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
  seedTag,
}) {
  // Evita duplicados: si ya existe este ticket demo, no lo vuelve a crear
  if (seedTag) {
    const existing = await Ticket.findOne({ seedTag });
    if (existing) {
      console.log(`⏭ Ticket "${seedTag}" already exists -> ${existing.code}`);
      return existing;
    }
  }

  const code = await nextTicketCode();
  const now = new Date();

  const ticket = await Ticket.create({
    code,
    subject: String(subject || "").trim(),
    description: String(description || "").trim(),
    priority,
    categoryId,
    requesterId,
    assigneeId: assigneeId || null,
    status: "OPEN",
    lastMessageAt: now,
    seedTag: seedTag || null,
  });

  let lastDate = now;

  for (const m of Array.isArray(messages) ? messages : []) {
    lastDate = new Date();
    await TicketMessage.create({
      ticketId: ticket._id,
      authorId: m.authorId,
      body: String(m.body || "").trim(),
      isInternal: false,
      createdAt: lastDate,
      updatedAt: lastDate,
    });
  }

  await Ticket.findByIdAndUpdate(ticket._id, {
    $set: { lastMessageAt: lastDate },
  });

  console.log(`✅ Ticket created: ${ticket.code} (${seedTag || "without seedTag"})`);
  return ticket;
}

async function runSeed() {
  if (process.env.ALLOW_SEED !== "true") {
    console.log("❌ ALLOW_SEED is not set to 'true'. Aborting seed.");
    process.exit(1);
  }

  console.log("🌱 Seeding database...");

  // 1) Usuarios demo
  const admin = await upsertUser({
    name: "Demo Admin",
    email: "admin@demo.com",
    password: "Admin123!",
    role: "ADMIN",
  });

  const agentA = await upsertUser({
    name: "Demo Agent A",
    email: "agent@demo.com",
    password: "Agent123!",
    role: "AGENT",
  });

  const agentB = await upsertUser({
    name: "Demo Agent B",
    email: "agent2@demo.com",
    password: "Agent123!",
    role: "AGENT",
  });

  const customer = await upsertUser({
    name: "Demo Customer",
    email: "customer@demo.com",
    password: "Customer123!",
    role: "CUSTOMER",
  });

  console.log("✅ Users:", {
    admin: admin.email,
    agentA: agentA.email,
    agentB: agentB.email,
    customer: customer.email,
  });

  // 2) Categorías
  const catTech = await upsertCategory({
    name: "Technical Support",
    slug: "technical-support",
  });

  const catBilling = await upsertCategory({
    name: "Billing",
    slug: "billing",
  });

  console.log("✅ Categories:", [catTech.slug, catBilling.slug]);

  // 3) KB Articles
  const kb1 = await upsertKbArticle({
    title: "I can't log in",
    slug: "i-cant-log-in",
    content:
      "If you can't log in:\n\n1) Double-check your email and password.\n2) Try resetting your password.\n3) Clear cache/cookies or try another browser.\n",
    status: "PUBLISHED",
    categoryId: catTech._id,
    authorId: admin._id,
  });

  const kb2 = await upsertKbArticle({
    title: "I can't find my invoice",
    slug: "i-cant-find-my-invoice",
    content:
      "If you can't find your invoice:\n\n1) Verify the email used for the purchase.\n2) Check your spam/junk folder.\n3) If it's still missing, open a Billing ticket.\n",
    status: "PUBLISHED",
    categoryId: catBilling._id,
    authorId: admin._id,
  });

  console.log("✅ KB:", [kb1.slug, kb2.slug]);

  // 4) Tickets
  const t1 = await createTicketWithMessages({
    subject: "I can't log in",
    description: "I get an error when trying to log in on mobile.",
    priority: "HIGH",
    categoryId: catTech._id,
    requesterId: customer._id,
    assigneeId: null,
    seedTag: "demo-ticket-1",
    messages: [
      {
        authorId: customer._id,
        body: "Hi, I can't log in from my phone.",
      },
    ],
  });

  const t2 = await createTicketWithMessages({
    subject: "I can't find my invoice",
    description: "I made a purchase but I can't find the invoice.",
    priority: "NORMAL",
    categoryId: catBilling._id,
    requesterId: customer._id,
    assigneeId: agentB._id,
    seedTag: "demo-ticket-2",
    messages: [
      { authorId: customer._id, body: "I can't find the invoice for my purchase." },
      { authorId: agentB._id, body: "Can you confirm the email you used to purchase?" },
      { authorId: customer._id, body: "Yes, it's customer@demo.com" },
    ],
  });

  console.log("✅ Tickets demo:", [t1.code, t2.code]);

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