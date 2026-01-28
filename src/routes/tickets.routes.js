const router = require("express").Router();
const requireAuth = require("../middlewares/requireAuth");
const { createTicket, listTickets, getTicketById, assignTicketToMe, updateTicketStatus } = require("../controllers/tickets.controller");
const messagesRoutes = require("./messages.routes");


router.use(requireAuth);

router.post("/", createTicket);
router.get("/", listTickets);
router.get("/:id", getTicketById);

router.patch("/:id/assign", assignTicketToMe);
router.patch("/:id/status", updateTicketStatus);

// subruta mensajes
router.use("/:id/messages", messagesRoutes);




module.exports = router;