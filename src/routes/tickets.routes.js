const router = require("express").Router();

const requireAuth = require("../middlewares/requireAuth");
const messagesRoutes = require("./messages.routes");

const {
  createTicket,
  listTickets,
  getTicketById,
  assignTicketToMe,
  updateTicketStatus,
  setTicketAssignee,
} = require("../controllers/tickets.controller");

// Todas las rutas de /api/tickets requieren auth
router.use(requireAuth);

router.post("/", createTicket);
router.get("/", listTickets);
router.get("/:id", getTicketById);

router.patch("/:id/assign", assignTicketToMe);
router.patch("/:id/status", updateTicketStatus);

router.patch("/:id/assignee", setTicketAssignee);

// subruta mensajes
router.use("/:id/messages", messagesRoutes);

module.exports = router;