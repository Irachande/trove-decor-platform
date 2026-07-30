import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

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

const health = await json("/api/health");
assert.equal(health.status, "ok");
assert.equal(health.database, "available");

await json("/api/push", {}, 401);
await json("/api/operations", {}, 401);

const ownerEmail = `phase7-owner-${stamp}@trove.test`;
const ownerHeaders = session(ownerEmail, "Phase 7 Owner");
const workspace = await json("/api/data", { headers: ownerHeaders });
const headers = session(ownerEmail, "Phase 7 Owner", workspace.workspace.id);

const pushConfiguration = await json("/api/push", { headers });
assert.equal(typeof pushConfiguration.configured, "boolean");
assert.equal(pushConfiguration.subscribed, false);

const p256dh = Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString("base64url");
const auth = randomBytes(16).toString("base64url");
await json("/api/push", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "subscribe",
    endpoint: `https://push.example.test/subscriptions/${stamp}`,
    keys: { p256dh, auth },
  }),
});
assert.equal((await json("/api/push", { headers })).subscribed, true);

await json("/api/operations", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "clientError",
    source: "phase7-integration",
    message: "Synthetic client error used to verify monitoring",
    route: "/tests/phase7",
  }),
});

await json("/api/operations", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "feedback",
    category: "inventory",
    rating: 5,
    message: "O modo móvel torna a conferência no armazém muito mais prática.",
  }),
});

const operations = await json("/api/operations", { headers });
assert.equal(operations.status, "operational");
assert.ok(operations.clientErrors24h >= 1);
assert.equal(operations.pushDevices, 1);
assert.ok(operations.feedbackEntries >= 1);

await json("/api/push", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "unsubscribe",
    endpoint: `https://push.example.test/subscriptions/${stamp}`,
  }),
});
assert.equal((await json("/api/push", { headers })).subscribed, false);

console.log("Phase 7 mobile and launch integration passed");
