import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const baseUrl = process.env.TROVE_BASE_URL || "http://localhost:3001";
const providerPort = Number(process.env.TROVE_PAYMENT_MOCK_PORT || 31337);
const webhookSecret = process.env.TROVE_WEBHOOK_SECRET || "phase5-webhook-secret";
const stamp = Date.now();
const providerPaymentId = `pay_${stamp}`;
let paymentRequest;

const provider = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/api/v1/payments") {
    response.writeHead(404).end();
    return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  paymentRequest = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  response.writeHead(201, { "content-type": "application/json" });
  response.end(JSON.stringify({
    status: "success",
    data: {
      id: providerPaymentId,
      amount: paymentRequest.amount,
      reference: paymentRequest.reference,
      status: "pending",
      checkout_url: `http://127.0.0.1:${providerPort}/checkout/${providerPaymentId}`,
    },
  }));
});
await new Promise((resolve) => provider.listen(providerPort, "127.0.0.1", resolve));

const headers = {
  "content-type": "application/json",
  "oai-authenticated-user-email": `phase5-${stamp}@trove.test`,
  "oai-authenticated-user-full-name": "Phase%205%20Owner",
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};

async function getData() {
  const response = await fetch(`${baseUrl}/api/data`, { headers });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}

async function dataAction(action, payload, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}/api/data`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  assert.equal(response.status, expectedStatus, `${action}: ${JSON.stringify(result)}`);
  return result;
}

try {
  const initial = await getData();
  assert.equal(initial.subscription.plan, "Basic");
  assert.equal(initial.subscription.status, "Trialing");
  assert.equal(initial.subscription.currency, "MZN");
  assert.equal(initial.billing.configured, true);
  assert.equal(initial.billing.catalog.Network.amount, 3100);

  for (let index = 0; index < 3; index += 1) {
    await dataAction("inviteMember", {
      id: stamp + 100 + index,
      email: `phase5-collaborator-${index}-${stamp}@trove.test`,
      role: "viewer",
    });
  }
  await dataAction("inviteMember", {
    id: stamp + 200,
    email: `phase5-collaborator-extra-${stamp}@trove.test`,
    role: "viewer",
  }, 400);

  const checkoutResponse = await fetch(`${baseUrl}/api/billing/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ plan: "Network" }),
  });
  const checkout = await checkoutResponse.json();
  assert.equal(checkoutResponse.status, 200, JSON.stringify(checkout));
  assert.match(checkout.checkoutUrl, new RegExp(`/checkout/${providerPaymentId}$`));
  assert.equal(paymentRequest.amount, 3100);
  assert.equal(paymentRequest.description, "Trove Network — 1 mês");

  const pending = await getData();
  const payment = pending.payments.find((entry) => entry.id === checkout.paymentId);
  assert.equal(payment.status, "Pending");
  assert.equal(payment.plan, "Network");

  const webhook = {
    event: "payment.success",
    data: {
      id: providerPaymentId,
      amount: 3100,
      reference: payment.reference,
      transaction: {
        id: `txn_${stamp}`,
        method: "mpesa",
        paid_at: new Date().toISOString(),
      },
    },
    created_at: Math.floor(Date.now() / 1000),
    request_id: `request_${stamp}`,
  };
  const raw = JSON.stringify(webhook);
  const signature = createHmac("sha256", webhookSecret).update(raw).digest("hex");
  const forgedResponse = await fetch(`${baseUrl}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": "00".repeat(32),
    },
    body: raw,
  });
  assert.equal(forgedResponse.status, 401);
  const webhookResponse = await fetch(`${baseUrl}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": signature,
    },
    body: raw,
  });
  assert.equal(webhookResponse.status, 200, await webhookResponse.text());

  const duplicateResponse = await fetch(`${baseUrl}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": signature,
    },
    body: raw,
  });
  const duplicate = await duplicateResponse.json();
  assert.equal(duplicate.duplicate, true);

  const active = await getData();
  assert.equal(active.workspace.plan, "Network");
  assert.equal(active.subscription.status, "Active");
  assert.equal(active.subscription.cancelAtPeriodEnd, false);
  const paid = active.payments.find((entry) => entry.id === checkout.paymentId);
  assert.equal(paid.status, "Paid");
  assert.equal(paid.method, "mpesa");
  assert.match(paid.receiptNumber, /^TRV-\d{4}-\d{6}$/);

  await dataAction("cancelSubscription", {});
  assert.equal((await getData()).subscription.cancelAtPeriodEnd, true);
  await dataAction("resumeSubscription", {});
  assert.equal((await getData()).subscription.cancelAtPeriodEnd, false);

  // Network has no collaborator cap after the signed payment webhook.
  await dataAction("inviteMember", {
    id: stamp + 200,
    email: `phase5-collaborator-extra-${stamp}@trove.test`,
    role: "viewer",
  });

  console.log("Phase 5 billing integration passed");
} finally {
  await new Promise((resolve) => provider.close(resolve));
}
