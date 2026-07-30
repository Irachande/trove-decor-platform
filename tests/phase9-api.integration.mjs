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
      status: "Confirmed",
    },
  }),
});

let workspace = await json("/api/data", { headers });
let event = workspace.events.find((entry) => entry.id === eventId);
assert.equal(event.eventType, "Wedding");
assert.equal(event.ownerUserId, ownerId);
assert.equal(event.guestCount, 180);
assert.equal(event.budget, 350000);
assert.equal(event.currency, "MZN");
assert.equal(event.address, "Avenida da Marginal, Maputo");

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "updateEvent",
    payload: {
      ...event,
      venue: "Jardim dos Namorados · Pavilhão",
      guestCount: 200,
      status: "Preparing",
    },
  }),
});

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

workspace = await json("/api/data", { headers });
event = workspace.events.find((entry) => entry.id === eventId);
const duplicate = workspace.events.find((entry) => entry.id === duplicateId);
assert.equal(event.venue, "Jardim dos Namorados · Pavilhão");
assert.equal(event.guestCount, 200);
assert.equal(duplicate.status, "Planned");
assert.match(duplicate.name, /Cópia/);
assert.equal(duplicate.clientId, clientId);
assert.equal(
  workspace.reservations.filter((entry) => entry.eventId === duplicateId).length,
  0,
);

await json("/api/data", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "updateEvent",
    payload: { ...event, status: "Completed" },
  }),
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

console.log("Phase 9 event records integration passed");
