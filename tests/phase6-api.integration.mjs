import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const baseUrl = process.env.TROVE_BASE_URL || "http://localhost:3001";
const providerPort = Number(process.env.TROVE_PAYMENT_MOCK_PORT || 31338);
const webhookSecret = process.env.TROVE_WEBHOOK_SECRET || "phase6-webhook-secret";
const stamp = Date.now();
let paymentCounter = 0;

const provider = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/api/v1/payments") {
    response.writeHead(404).end();
    return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const payment = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  paymentCounter += 1;
  response.writeHead(201, { "content-type": "application/json" });
  response.end(JSON.stringify({
    status: "success",
    data: {
      id: `network_payment_${stamp}_${paymentCounter}`,
      amount: payment.amount,
      reference: payment.reference,
      status: "pending",
      checkout_url: `http://127.0.0.1:${providerPort}/checkout/${paymentCounter}`,
    },
  }));
});
await new Promise((resolve) => provider.listen(providerPort, "127.0.0.1", resolve));

function session(email, name, businessId) {
  return {
    "content-type": "application/json",
    "oai-authenticated-user-email": email,
    "oai-authenticated-user-full-name": encodeURIComponent(name),
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
    ...(businessId ? { "x-trove-business-id": String(businessId) } : {}),
  };
}

async function getData(headers) {
  const response = await fetch(`${baseUrl}/api/data`, { headers });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}

async function dataAction(headers, action, payload, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}/api/data`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  assert.equal(response.status, expectedStatus, `${action}: ${JSON.stringify(result)}`);
  return result;
}

async function networkGet(headers, query = "") {
  const response = await fetch(`${baseUrl}/api/network${query}`, { headers });
  const result = await response.json();
  return { response, result };
}

async function networkAction(headers, action, payload, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}/api/network`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  assert.equal(response.status, expectedStatus, `${action}: ${JSON.stringify(result)}`);
  return result;
}

async function activateNetwork(headers) {
  const checkoutResponse = await fetch(`${baseUrl}/api/billing/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ plan: "Network" }),
  });
  const checkout = await checkoutResponse.json();
  assert.equal(checkoutResponse.status, 200, JSON.stringify(checkout));
  const data = await getData(headers);
  const payment = data.payments.find((entry) => entry.id === checkout.paymentId);
  assert.ok(payment);
  const raw = JSON.stringify({
    event: "payment.success",
    request_id: `phase6_webhook_${payment.id}_${stamp}`,
    data: {
      id: payment.providerPaymentId,
      amount: 3100,
      reference: payment.reference,
      transaction: {
        id: `phase6_txn_${payment.id}_${stamp}`,
        method: "mpesa",
        paid_at: new Date().toISOString(),
      },
    },
  });
  const signature = createHmac("sha256", webhookSecret).update(raw).digest("hex");
  const webhookResponse = await fetch(`${baseUrl}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": signature,
    },
    body: raw,
  });
  assert.equal(webhookResponse.status, 200, await webhookResponse.text());
  const active = await getData(headers);
  assert.equal(active.workspace.plan, "Network");
  return active;
}

const ownerEmail = `phase6-owner-${stamp}@trove.test`;
const requesterEmail = `phase6-requester-${stamp}@trove.test`;
const ownerInitialHeaders = session(ownerEmail, "Phase 6 Owner");
const requesterInitialHeaders = session(requesterEmail, "Phase 6 Requester");

try {
  await getData(ownerInitialHeaders);
  const basicNetwork = await networkGet(ownerInitialHeaders);
  assert.equal(basicNetwork.response.status, 403);
  assert.equal(basicNetwork.result.code, "NETWORK_PLAN_REQUIRED");

  const ownerActive = await activateNetwork(ownerInitialHeaders);
  const requesterActive = await activateNetwork(requesterInitialHeaders);
  const ownerHeaders = session(ownerEmail, "Phase 6 Owner", ownerActive.workspace.id);
  const requesterHeaders = session(requesterEmail, "Phase 6 Requester", requesterActive.workspace.id);

  const itemId = stamp + 100;
  await dataAction(ownerHeaders, "addItem", {
    id: itemId,
    name: "Phase 6 ghost chairs",
    category: "Cadeiras",
    quantity: 10,
    available: 10,
    status: "Available",
    tone: "mist",
    symbol: "GC",
    price: 400,
    currency: "MZN",
    storageLocation: "Armazém Network",
    condition: "Excelente",
    description: "Cadeiras transparentes para eventos.",
    sku: `P6-${stamp}`,
    replacementValue: 1800,
    minStock: 0,
  });

  const listingId = stamp + 101;
  await networkAction(ownerHeaders, "publishListing", {
    id: listingId,
    itemId,
    dailyPrice: 400,
    deposit: 1000,
    minimumQuantity: 1,
    maximumQuantity: 8,
    location: "Maputo",
    latitude: "-25.9692",
    longitude: "32.5732",
    deliveryOptions: "Pickup or delivery",
    terms: "Devolver limpo e embalado.",
  });

  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 10);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 2);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const search = await networkGet(
    requesterHeaders,
    `?q=ghost&start=${startDate}&end=${endDate}&quantity=4&distance=25&latitude=-25.97&longitude=32.58`,
  );
  assert.equal(search.response.status, 200, JSON.stringify(search.result));
  const found = search.result.listings.find((entry) => entry.id === listingId);
  assert.equal(found.available, 10);
  assert.ok(found.distanceKm < 5);
  assert.equal(found.currency, "MZN");

  const requestId = stamp + 102;
  await networkAction(requesterHeaders, "createRentalRequest", {
    id: requestId,
    listingId,
    quantity: 4,
    startDate,
    endDate,
    deliveryMethod: "Pickup",
    note: "Casamento em Maputo.",
  });
  let ownerNetwork = await networkGet(ownerHeaders, `?start=${startDate}&end=${endDate}`);
  assert.equal(ownerNetwork.result.requests.find((entry) => entry.id === requestId).status, "Pending");

  await networkAction(ownerHeaders, "counterRentalRequest", {
    id: requestId,
    quantity: 3,
    startDate,
    endDate,
    unitPrice: 450,
    deposit: 1200,
    note: "Disponíveis três unidades nestas condições.",
  });
  let requesterNetwork = await networkGet(requesterHeaders, `?start=${startDate}&end=${endDate}`);
  const countered = requesterNetwork.result.requests.find((entry) => entry.id === requestId);
  assert.equal(countered.status, "Countered");
  assert.equal(countered.total, 4050);

  await networkAction(requesterHeaders, "acceptRentalRequest", { id: requestId });
  const afterAcceptance = await networkGet(
    requesterHeaders,
    `?start=${startDate}&end=${endDate}&quantity=1`,
  );
  assert.equal(afterAcceptance.result.listings.find((entry) => entry.id === listingId).available, 7);

  await networkAction(ownerHeaders, "updateRentalFinancials", {
    id: requestId,
    paymentStatus: "Confirmed",
    depositStatus: "Held",
  });
  await networkAction(ownerHeaders, "transitionRentalRequest", {
    id: requestId,
    status: "CheckedOut",
  });
  assert.equal((await getData(ownerHeaders)).items.find((entry) => entry.id === itemId).available, 7);

  const disputeId = stamp + 103;
  await networkAction(requesterHeaders, "openRentalDispute", {
    id: requestId,
    disputeId,
    reason: "A hora de recolha precisa de ser revista.",
  });
  await networkAction(ownerHeaders, "proposeDisputeResolution", {
    id: requestId,
    resolution: "Recolha reagendada sem custo adicional.",
  });
  await networkAction(requesterHeaders, "acceptDisputeResolution", { id: requestId });

  await networkAction(ownerHeaders, "transitionRentalRequest", {
    id: requestId,
    status: "Returned",
  });
  assert.equal((await getData(ownerHeaders)).items.find((entry) => entry.id === itemId).available, 10);
  await networkAction(ownerHeaders, "updateRentalFinancials", {
    id: requestId,
    paymentStatus: "Confirmed",
    depositStatus: "Returned",
  });
  await networkAction(ownerHeaders, "transitionRentalRequest", {
    id: requestId,
    status: "Completed",
  });

  await networkAction(requesterHeaders, "reviewRental", {
    id: requestId,
    reviewId: stamp + 104,
    rating: 5,
    comment: "Boa comunicação e material em excelente estado.",
  });
  requesterNetwork = await networkGet(requesterHeaders, `?start=${startDate}&end=${endDate}`);
  const completed = requesterNetwork.result.requests.find((entry) => entry.id === requestId);
  assert.equal(completed.status, "Completed");
  assert.equal(completed.disputeStatus, "Resolved");
  assert.equal(completed.myRating, 5);
  assert.equal(requesterNetwork.result.listings.find((entry) => entry.id === listingId).rating, 5);

  console.log("Phase 6 Trove Network integration passed");
} finally {
  await new Promise((resolve) => provider.close(resolve));
}
