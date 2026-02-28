/**
 * Reglas de acceso a tickets por rol.
 *
 * CUSTOMER: solo puede acceder a sus tickets.
 * AGENT: puede acceder a tickets asignados a él o sin asignar (inbox).
 * ADMIN: acceso total.
 */

function isOwnerTicket(user, ticket) {
  const requesterId = ticket?.requesterId?._id || ticket?.requesterId;
  return requesterId && String(requesterId) === String(user._id);
}

function isAssignedToAgent(user, ticket) {
  const assigneeId = ticket?.assigneeId?._id || ticket?.assigneeId;
  return assigneeId && String(assigneeId) === String(user._id);
}

function isUnassigned(ticket) {
  const assigneeId = ticket?.assigneeId?._id || ticket?.assigneeId;
  return !assigneeId;
}

function canAccessTicket(user, ticket) {
  if (!user || !ticket) return false;

  if (user.role === "ADMIN") return true;

  if (user.role === "CUSTOMER") {
    return isOwnerTicket(user, ticket);
  }

  if (user.role === "AGENT") {
    return isAssignedToAgent(user, ticket) || isUnassigned(ticket);
  }

  return false;
}

/**
 * Filtro de listado de tickets según rol.
 * - CUSTOMER: solo sus tickets
 * - ADMIN: todos (y opcionalmente puede filtrar por unassigned)
 * - AGENT: por defecto inbox (míos + unassigned)
 */
function buildTicketsListFilter(user, query) {
  const { assigned, status, q, priority } = query || {};
  const filter = {};

  if (!user) return null;

  if (user.role === "CUSTOMER") {
    filter.requesterId = user._id;

  } else if (user.role === "ADMIN") {
    if (assigned === "unassigned") filter.assigneeId = null;

  } else if (user.role === "AGENT") {
    if (assigned === "me") filter.assigneeId = user._id;
    else if (assigned === "unassigned") filter.assigneeId = null;
    else filter.$or = [{ assigneeId: user._id }, { assigneeId: null }];

  } else {
    return null;
  }

  // Estado
  if (status && String(status).trim()) {
    const st = String(status).trim();
    if (st === "ALL") {
      // sin filtro
    } else if (st === "ALL_EXCEPT_CLOSED") {
      filter.status = { $ne: "CLOSED" };
    } else {
      filter.status = st;
    }
  }

  // Prioridad
  if (priority && String(priority).trim()) {
    const pr = String(priority).trim();
    if (pr !== "ALL") filter.priority = pr;
  }

  // Búsqueda (compatible con $or del inbox)
  if (q && String(q).trim()) {
    const text = String(q).trim();
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { code: { $regex: text, $options: "i" } },
        { subject: { $regex: text, $options: "i" } },
      ],
    });
  }

  return filter;
}

module.exports = {
  canAccessTicket,
  buildTicketsListFilter,
};