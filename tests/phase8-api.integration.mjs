import assert from "node:assert/strict";
import http from "node:http";

const baseUrl = process.env.TROVE_BASE_URL || "http://localhost:3001";
const stamp = Date.now();
const receivedEmails = [];
const emailServer = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  receivedEmails.push({
    url: request.url,
    authorization: request.headers.authorization,
    body: JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"),
  });
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ id: `phase8-email-${receivedEmails.length}` }));
});
await new Promise((resolve) => emailServer.listen(31339, "127.0.0.1", resolve));

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
  return { response, result };
}

try {
  await json("/api/backup", {}, 401);

  const ownerEmail = `phase8-owner-${stamp}@trove.test`;
  const first = await json("/api/data", {
    headers: session(ownerEmail, "Phase 8 Owner"),
  });
  const businessId = first.result.workspace.id;
  const headers = session(ownerEmail, "Phase 8 Owner", businessId);
  const handle = `phase8-${stamp}`;

  await json("/api/data", {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "updateProfile",
      payload: {
        businessName: "Phase 8 Decor",
        handle,
        bio: "Decoração contemporânea para eventos em Maputo.",
        location: "Maputo",
        phone: "+258 84 000 0000",
        email: ownerEmail,
        color: "#78836a",
        avatarUrl: "",
        website: "https://example.com",
        instagram: "phase8.decor",
        services: "Casamentos, Corporativo, Montagem",
        isPublic: true,
        acceptsEnquiries: true,
      },
    }),
  });

  const publicProfile = await json(`/api/public-profile?handle=${handle}`);
  assert.equal(publicProfile.result.businessName, "Phase 8 Decor");
  assert.equal(publicProfile.result.businessId, undefined);
  assert.equal(publicProfile.result.acceptsEnquiries, true);
  assert.equal(publicProfile.result.website, "https://example.com");

  const enquiry = await json("/api/public-profile", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": `phase8-integration-${stamp}`,
    },
    body: JSON.stringify({
      handle,
      name: "Cliente Fase 8",
      email: `client-${stamp}@example.test`,
      phone: "+258 82 000 0000",
      eventDate: "2026-12-15",
      message: "Preciso de decoração completa para um casamento com 120 convidados.",
    }),
  }, 201);
  assert.ok(enquiry.result.enquiryId);

  const invite = await json("/api/data", {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "inviteMember",
      payload: {
        id: stamp + 800,
        email: `collaborator-${stamp}@trove.test`,
        role: "manager",
      },
    }),
  });
  assert.equal(invite.result.emailConfigured, true);
  assert.equal(invite.result.emailSent, true);
  assert.match(invite.result.inviteUrl, /\?invitation=/);
  assert.ok(receivedEmails.length >= 2);
  assert.equal(receivedEmails.at(-1).authorization, "Bearer phase8-test-key");
  assert.equal(receivedEmails.at(-1).url, "/emails");

  const refreshed = await json("/api/data", { headers });
  assert.equal(refreshed.result.communication.configured, true);
  assert.equal(refreshed.result.publicEnquiries.length, 1);
  assert.ok(refreshed.result.emailDeliveries.some((delivery) => delivery.status === "Sent"));

  await json("/api/data", {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "updateEnquiryStatus",
      payload: { id: enquiry.result.enquiryId, status: "Contacted" },
    }),
  });
  const afterStatus = await json("/api/data", { headers });
  assert.equal(afterStatus.result.publicEnquiries[0].status, "Contacted");

  const backupResponse = await fetch(`${baseUrl}/api/backup`, { headers });
  assert.equal(backupResponse.status, 200);
  assert.match(backupResponse.headers.get("content-disposition") || "", /trove-phase8-/);
  const backup = await backupResponse.json();
  assert.equal(backup.format, "trove-workspace-backup");
  assert.equal(backup.business.id, businessId);
  assert.equal(backup.data.publicEnquiries.length, 1);
  assert.ok(Array.isArray(backup.data.inventoryItems));

  console.log("Phase 8 controlled launch integration passed");
} finally {
  await new Promise((resolve) => emailServer.close(resolve));
}
