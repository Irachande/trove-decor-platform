import assert from "node:assert/strict";

const baseUrl = process.env.TROVE_BASE_URL || "http://localhost:3000";
const stamp = Date.now();
const headers = {
  "content-type": "application/json",
  "oai-authenticated-user-email": `phase3-${stamp}@trove.test`,
  "oai-authenticated-user-full-name": "Phase%203%20Test",
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};

async function getData() {
  const response = await fetch(`${baseUrl}/api/data`, { headers });
  assert.equal(response.status, 200);
  return response.json();
}

async function action(name, payload, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}/api/data`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: name, payload }),
  });
  const result = await response.json();
  assert.equal(
    response.status,
    expectedStatus,
    `${name}: ${JSON.stringify(result)}`,
  );
  return result;
}

const itemA = {
  id: stamp + 10,
  name: "Cadeira teste",
  category: "Mobiliário",
  quantity: 5,
  available: 5,
  status: "Available",
  tone: "clay",
  symbol: "CT",
  price: 500,
  currency: "MZN",
  storageLocation: "Teste",
  condition: "Bom",
  description: "",
  sku: "TEST-A",
  replacementValue: 1000,
  minStock: 0,
};
const itemB = {
  ...itemA,
  id: stamp + 11,
  name: "Mesa teste",
  symbol: "MT",
  sku: "TEST-B",
  quantity: 3,
  available: 3,
  price: 800,
};
await action("addItem", itemA);
await action("addItem", itemB);

const reservationId = stamp + 20;
const clientId = stamp + 21;
const eventId = stamp + 22;
const reservation = {
  id: reservationId,
  clientId,
  clientName: "Cliente Teste",
  clientEmail: "cliente@teste.co.mz",
  clientPhone: "+258840000000",
  eventId,
  eventName: "Evento Teste",
  venue: "Maputo",
  date: "2026-10-10",
  endDate: "2026-10-12",
  setupTime: "08:00",
  pickupTime: "18:00",
  eventNotes: "Teste de integração",
  notes: "",
  logistics: "Viatura A",
  discount: 100,
  deliveryFee: 250,
  deposit: 1000,
  paymentStatus: "Partial",
  color: "#b75d3f",
  items: [
    { itemId: itemA.id, quantity: 3 },
    { itemId: itemB.id, quantity: 2 },
  ],
};
await action("addReservation", reservation);

const afterCreate = await getData();
const created = afterCreate.reservations.find(
  (entry) => entry.id === reservationId,
);
assert.equal(created.items.length, 2);
assert.equal(created.subtotal, 3100);
assert.equal(created.total, 3250);
assert.equal(afterCreate.clients.some((entry) => entry.id === clientId), true);
assert.equal(afterCreate.events.some((entry) => entry.id === eventId), true);

await action(
  "addReservation",
  {
    ...reservation,
    id: stamp + 30,
    eventId: stamp + 31,
    eventName: "Evento em conflito",
    items: [{ itemId: itemA.id, quantity: 3 }],
  },
  400,
);

await action("updateReservation", {
  ...reservation,
  discount: 200,
  items: [
    { itemId: itemA.id, quantity: 2 },
    { itemId: itemB.id, quantity: 1 },
  ],
});
const afterUpdate = await getData();
assert.equal(
  afterUpdate.reservations.find((entry) => entry.id === reservationId).total,
  1850,
);

await action("transitionEvent", {
  id: eventId,
  status: "Confirmed",
});
await action("transitionReservation", {
  id: reservationId,
  status: "CheckedOut",
});
const afterCheckout = await getData();
assert.equal(
  afterCheckout.reservations.find((entry) => entry.id === reservationId).status,
  "CheckedOut",
);
assert.equal(
  afterCheckout.items.find((entry) => entry.id === itemA.id).available,
  3,
);

await action("transitionReservation", {
  id: reservationId,
  status: "Returned",
});
const afterReturn = await getData();
assert.equal(
  afterReturn.reservations.find((entry) => entry.id === reservationId).status,
  "Returned",
);
assert.equal(
  afterReturn.items.find((entry) => entry.id === itemA.id).available,
  5,
);

const cancellable = {
  ...reservation,
  id: stamp + 40,
  eventId: stamp + 41,
  eventName: "Evento cancelável",
  date: "2026-11-10",
  endDate: "2026-11-11",
  items: [{ itemId: itemB.id, quantity: 1 }],
};
await action("addReservation", cancellable);
await action("transitionReservation", {
  id: cancellable.id,
  status: "Cancelled",
});
const finalData = await getData();
assert.equal(
  finalData.reservations.find((entry) => entry.id === cancellable.id).status,
  "Cancelled",
);

console.log("Phase 3 API integration passed");
