import assert from "node:assert/strict";

const baseUrl = process.env.TROVE_BASE_URL || "http://localhost:3001";
const stamp = Date.now();

function session(email, name, businessId) {
  return {
    "content-type": "application/json",
    "oai-authenticated-user-email": email,
    "oai-authenticated-user-full-name": encodeURIComponent(name),
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
    ...(businessId ? { "x-trove-business-id": String(businessId) } : {}),
  };
}

async function json(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const result = await response.json();
  assert.equal(response.status, expectedStatus, `${path}: ${JSON.stringify(result)}`);
  return result;
}

const ownerEmail = `phase9-owner-${stamp}@trove.test`;
const first = await json("/api/data", {
  headers: session(ownerEmail, "Phase 9 Owner"),
});
const headers = session(ownerEmail, "Phase 9 Owner", first.workspace.id);
const ownerId = first.members.find((member) => member.email === ownerEmail)?.id;
assert.ok(ownerId);

const clientId = stamp + 910;
const eventId = stamp + 920;
const duplicateId = stamp + 930;
const setupTaskId = stamp + 940;
const pickupTaskId = stamp + 950;
const supplierId = stamp + 960;
const expenseId = stamp + 970;
const itemId = stamp + 980;
const reservationId = stamp + 990;
const cancelledReservationId = stamp + 995;

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "addClient",
    payload: {
      id: clientId,
      name: "Cliente Evento",
      email: "cliente-evento@example.test",
      phone: "+258 84 111 2222",
      notes: "Cliente criado pelo teste da Fase 9.",
    },
  }),
});

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "addEvent",
    payload: {
      id: eventId,
      clientId,
      ownerUserId: ownerId,
      name: "Casamento Maputo",
      eventType: "Wedding",
      venue: "Jardim dos Namorados",
      address: "Avenida da Marginal, Maputo",
      startDate: "2026-11-14",
      endDate: "2026-11-15",
      setupTime: "08:00",
      pickupTime: "18:30",
      guestCount: 180,
      budget: 350000,
      currency: "MZN",
      onSiteContact: "Celina · +258 82 000 1111",
      color: "#78836a",
      notes: "Montagem exterior.",
      status: "Planned",
    },
  }),
});

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "addEventTask",
    payload: {
      id: setupTaskId,
      eventId,
      assigneeUserId: ownerId,
      title: "Confirmar plano de montagem",
      description: "Validar acessos e sequência com a equipa.",
      category: "Setup",
      priority: "High",
      dueDate: "2026-11-13",
      dueTime: "15:00",
      sortOrder: 0,
    },
  }),
});

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "addItem",
    payload: {
      id: itemId,
      name: "Cadeira cerimónia",
      category: "Mobiliário",
      quantity: 4,
      available: 4,
      status: "Available",
      tone: "clay",
      symbol: "CC",
      price: 600,
      currency: "MZN",
      storageLocation: "A1",
      condition: "Bom",
      description: "",
      sku: `EVENT-${stamp}`,
      replacementValue: 1200,
      minStock: 0,
    },
  }),
});

const reservationPayload = {
  id: reservationId,
  clientId,
  clientName: "Cliente Evento",
  clientEmail: "cliente-evento@example.test",
  clientPhone: "+258 84 111 2222",
  eventId,
  eventName: "Casamento Maputo",
  venue: "Jardim dos Namorados",
  date: "2026-11-14",
  endDate: "2026-11-15",
  setupTime: "08:00",
  pickupTime: "18:30",
  eventNotes: "Montagem exterior.",
  notes: "Reserva agregada ao evento.",
  logistics: "Viatura 1",
  discount: 0,
  deliveryFee: 2000,
  deposit: 10000,
  paymentStatus: "Partial",
  color: "#78836a",
  items: [{ itemId, quantity: 2 }],
};
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "addReservation", payload: reservationPayload }),
});
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "addEventTask",
    payload: {
      id: pickupTaskId,
      eventId,
      title: "Preparar checklist de recolha",
      description: "",
      category: "Pickup",
      priority: "Normal",
      dueDate: "2026-11-15",
      dueTime: "17:00",
      sortOrder: 1,
    },
  }),
});

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "addSupplier",
    payload: {
      id: supplierId,
      name: "Flores de Maputo",
      serviceType: "Flowers",
      contactName: "Ana",
      email: "ana@flores.example.test",
      phone: "+258 84 333 4444",
      notes: "Fornecedor recorrente.",
      active: true,
    },
  }),
});

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "addEventExpense",
    payload: {
      id: expenseId,
      eventId,
      supplierId,
      category: "Flowers",
      description: "Arranjos florais",
      amount: 45000,
      currency: "MZN",
      paymentStatus: "Pending",
      incurredDate: "2026-11-10",
      notes: "50% na adjudicação.",
    },
  }),
});

const documentForm = new FormData();
documentForm.set("eventId", String(eventId));
documentForm.set("category", "Contract");
documentForm.set("notes", "Contrato assinado");
documentForm.set(
  "file",
  new File(["%PDF-1.4\nTrove phase 9"], "contrato-evento.pdf", {
    type: "application/pdf",
  }),
);
const documentUpload = await json("/api/event-document", {
  method: "POST",
  headers: Object.fromEntries(
    Object.entries(headers).filter(([key]) => key !== "content-type"),
  ),
  body: documentForm,
});
assert.ok(documentUpload.documentId);

let workspace = await json("/api/data", { headers });
let event = workspace.events.find((entry) => entry.id === eventId);
assert.equal(event.eventType, "Wedding");
assert.equal(event.ownerUserId, ownerId);
assert.equal(event.guestCount, 180);
assert.equal(event.budget, 350000);
assert.equal(event.currency, "MZN");
assert.equal(event.address, "Avenida da Marginal, Maputo");
assert.equal(event.status, "Planned");
assert.equal(workspace.suppliers.find((entry) => entry.id === supplierId).name, "Flores de Maputo");
assert.equal(workspace.eventExpenses.find((entry) => entry.id === expenseId).amount, 45000);
assert.equal(workspace.eventDocuments.find((entry) => entry.id === documentUpload.documentId).category, "Contract");

const downloadedDocument = await fetch(
  `${baseUrl}/api/event-document?id=${encodeURIComponent(documentUpload.documentId)}`,
  { headers },
);
assert.equal(downloadedDocument.status, 200);
assert.match(downloadedDocument.headers.get("content-disposition") || "", /contrato-evento\.pdf/);
assert.match(await downloadedDocument.text(), /Trove phase 9/);

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "updateEvent",
    payload: {
      ...event,
      venue: "Jardim dos Namorados · Pavilhão",
      guestCount: 200,
      status: "Planned",
    },
  }),
});

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "updateEvent", payload: { ...event, status: "Confirmed" } }),
}, 400);

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "transitionEvent", payload: { id: eventId, status: "Confirmed" } }),
});
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "transitionEvent", payload: { id: eventId, status: "Preparing" } }),
});
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "transitionEvent", payload: { id: eventId, status: "InProgress" } }),
}, 400);
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "transitionReservation", payload: { id: reservationId, status: "CheckedOut" } }),
});
workspace = await json("/api/data", { headers });
event = workspace.events.find((entry) => entry.id === eventId);
assert.equal(event.status, "InProgress");
assert.equal(workspace.items.find((entry) => entry.id === itemId).available, 2);
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "transitionEvent", payload: { id: eventId, status: "Completed" } }),
}, 400);

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "archiveEvent",
    payload: { id: eventId },
  }),
}, 400);

const duplication = await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "duplicateEvent",
    payload: { sourceId: eventId, id: duplicateId },
  }),
});
assert.equal(duplication.reservationsCopied, false);
assert.equal(duplication.tasksCopied, false);
assert.equal(duplication.expensesCopied, false);
assert.equal(duplication.documentsCopied, false);

workspace = await json("/api/data", { headers });
event = workspace.events.find((entry) => entry.id === eventId);
const duplicate = workspace.events.find((entry) => entry.id === duplicateId);
let setupTask = workspace.eventTasks.find((entry) => entry.id === setupTaskId);
assert.equal(event.venue, "Jardim dos Namorados · Pavilhão");
assert.equal(event.guestCount, 200);
assert.equal(duplicate.status, "Planned");
assert.match(duplicate.name, /Cópia/);
assert.equal(duplicate.clientId, clientId);
assert.equal(
  workspace.reservations.filter((entry) => entry.eventId === duplicateId).length,
  0,
);
assert.equal(workspace.eventTasks.filter((entry) => entry.eventId === duplicateId).length, 0);
assert.equal(workspace.eventExpenses.filter((entry) => entry.eventId === duplicateId).length, 0);
assert.equal(workspace.eventDocuments.filter((entry) => entry.eventId === duplicateId).length, 0);
assert.equal(setupTask.assigneeUserId, ownerId);
assert.equal(setupTask.priority, "High");

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "addReservation",
    payload: {
      ...reservationPayload,
      id: cancelledReservationId,
      eventId: duplicateId,
      eventName: duplicate.name,
      date: "2026-12-10",
      endDate: "2026-12-11",
      items: [{ itemId, quantity: 1 }],
    },
  }),
});
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "transitionEvent", payload: { id: duplicateId, status: "Confirmed" } }),
});
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "transitionEvent", payload: { id: duplicateId, status: "Cancelled" } }),
}, 400);
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "transitionEvent", payload: { id: duplicateId, status: "Cancelled", cancelReservations: true } }),
});

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "updateEventTask",
    payload: { ...setupTask, priority: "Urgent", dueTime: "14:30" },
  }),
});

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "updateEventExpense",
    payload: {
      ...workspace.eventExpenses.find((entry) => entry.id === expenseId),
      paymentStatus: "Paid",
    },
  }),
});

await json(`/api/event-document?id=${encodeURIComponent(documentUpload.documentId)}`, {
  method: "DELETE",
  headers,
});

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "transitionReservation", payload: { id: reservationId, status: "Returned" } }),
});
workspace = await json("/api/data", { headers });
event = workspace.events.find((entry) => entry.id === eventId);
assert.equal(event.status, "InProgress");
assert.equal(workspace.items.find((entry) => entry.id === itemId).available, 4);
assert.equal(workspace.events.find((entry) => entry.id === duplicateId).status, "Cancelled");
assert.equal(workspace.reservations.find((entry) => entry.id === cancelledReservationId).status, "Cancelled");
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "archiveEvent",
    payload: { id: eventId },
  }),
}, 400);

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "transitionEventTask",
    payload: { id: setupTaskId, status: "Completed" },
  }),
});
workspace = await json("/api/data", { headers });
setupTask = workspace.eventTasks.find((entry) => entry.id === setupTaskId);
assert.equal(setupTask.status, "Completed");
assert.ok(setupTask.completedAt);
assert.equal(setupTask.completedByUserId, ownerId);
assert.equal(setupTask.priority, "Urgent");

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "transitionEventTask",
    payload: { id: setupTaskId, status: "Pending" },
  }),
});
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "transitionEventTask",
    payload: { id: setupTaskId, status: "Completed" },
  }),
});
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "transitionEventTask",
    payload: { id: pickupTaskId, status: "Completed" },
  }),
});
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "transitionEvent", payload: { id: eventId, status: "Completed" } }),
});
await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "archiveEvent",
    payload: { id: eventId },
  }),
});

workspace = await json("/api/data", { headers });
event = workspace.events.find((entry) => entry.id === eventId);
assert.equal(event.status, "Archived");
assert.ok(event.archivedAt);
assert.ok(workspace.auditLogs.some((entry) => entry.action === "duplicateEvent"));
assert.ok(workspace.auditLogs.some((entry) => entry.action === "archiveEvent"));
assert.ok(workspace.auditLogs.some((entry) => entry.action === "addEventTask"));
assert.ok(workspace.auditLogs.some((entry) => entry.action === "transitionEventTask"));
assert.ok(workspace.auditLogs.some((entry) => entry.action === "addSupplier"));
assert.ok(workspace.auditLogs.some((entry) => entry.action === "addEventExpense"));
assert.ok(workspace.auditLogs.some((entry) => entry.action === "deleteEventDocument"));
assert.ok(workspace.auditLogs.some((entry) => entry.action === "transitionEvent"));

console.log("Phase 9 event lifecycle, operations, finance, suppliers, and documents integration passed");
