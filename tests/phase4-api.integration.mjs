import assert from "node:assert/strict";

const baseUrl = process.env.TROVE_BASE_URL || "http://localhost:3000";
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

const ownerEmail = `phase4-owner-${stamp}@trove.test`;
const memberEmail = `phase4-member-${stamp}@trove.test`;
const ownerHeaders = session(ownerEmail, "Phase 4 Owner");
const memberHeaders = session(memberEmail, "Phase 4 Member");

async function getData(headers) {
  const response = await fetch(`${baseUrl}/api/data`, { headers });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}

async function action(headers, name, payload, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}/api/data`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: name, payload }),
  });
  const result = await response.json();
  assert.equal(response.status, expectedStatus, `${name}: ${JSON.stringify(result)}`);
  return result;
}

const ownerStart = await getData(ownerHeaders);
const businessId = ownerStart.workspace.id;
const invitationId = stamp + 10;
const invitation = await action(ownerHeaders, "inviteMember", {
  id: invitationId,
  email: memberEmail,
  role: "inventory",
});
assert.match(invitation.inviteUrl, new RegExp(`invitation=${invitationId}$`));
assert.ok(new Date(invitation.expiresAt) > new Date());

const ownerAfterInvite = await getData(ownerHeaders);
const pending = ownerAfterInvite.members.find((entry) => entry.id === invitationId);
assert.equal(pending.status, "Pending");
assert.ok(pending.expiresAt);

const memberStart = await getData(memberHeaders);
assert.equal(
  memberStart.invitations.some((entry) => entry.id === invitationId),
  true,
);
const acceptance = await action(memberHeaders, "acceptInvitation", { id: invitationId });
assert.equal(acceptance.workspaceId, businessId);

const memberBusinessHeaders = session(memberEmail, "Phase 4 Member", businessId);
const memberWorkspace = await getData(memberBusinessHeaders);
assert.equal(memberWorkspace.workspace.id, businessId);
assert.equal(memberWorkspace.workspace.role, "inventory");
assert.equal(memberWorkspace.invitations.length, 0);

const ownerAfterAcceptance = await getData(ownerHeaders);
const activeMember = ownerAfterAcceptance.members.find((entry) => entry.email === memberEmail);
assert.equal(activeMember.status, "Active");
assert.equal(
  ownerAfterAcceptance.notifications.some((entry) => entry.type === "team"),
  true,
);
assert.equal(
  ownerAfterAcceptance.auditLogs.some((entry) => entry.action === "acceptInvitation"),
  true,
);

const reminderItemId = stamp + 30;
await action(ownerHeaders, "addItem", {
  id: reminderItemId,
  name: "Reminder item",
  category: "Teste",
  quantity: 4,
  available: 4,
  status: "Available",
  tone: "clay",
  symbol: "RI",
  price: 100,
  currency: "MZN",
  storageLocation: "",
  condition: "Bom",
  description: "",
  sku: "",
  replacementValue: 0,
  minStock: 0,
});
const tomorrow = new Date();
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const reminderDate = tomorrow.toISOString().slice(0, 10);
await action(ownerHeaders, "addReservation", {
  id: stamp + 31,
  clientId: stamp + 32,
  clientName: "Reminder client",
  clientEmail: "",
  clientPhone: "",
  eventId: stamp + 33,
  eventName: "Reminder event",
  venue: "Maputo",
  date: reminderDate,
  endDate: reminderDate,
  setupTime: "",
  pickupTime: "",
  eventNotes: "",
  notes: "",
  logistics: "",
  discount: 0,
  deliveryFee: 0,
  deposit: 0,
  paymentStatus: "Pending",
  color: "#b75d3f",
  items: [{ itemId: reminderItemId, quantity: 1 }],
});
const reminderData = await getData(ownerHeaders);
assert.equal(
  reminderData.notifications.some((entry) => entry.type === "reminder"),
  true,
);

await action(ownerHeaders, "updateMemberRole", {
  memberId: activeMember.id,
  role: "viewer",
});
const memberAsViewer = await getData(memberBusinessHeaders);
assert.equal(memberAsViewer.workspace.role, "viewer");
await action(memberBusinessHeaders, "addItem", {
  id: stamp + 50,
  name: "Forbidden item",
  category: "Teste",
  quantity: 1,
  available: 1,
  status: "Available",
  tone: "clay",
  symbol: "FI",
  price: 0,
  currency: "MZN",
  storageLocation: "",
  condition: "Bom",
  description: "",
  sku: "",
  replacementValue: 0,
  minStock: 0,
}, 403);

const unread = ownerAfterAcceptance.notifications.find((entry) => !entry.readAt);
if (unread) {
  await action(ownerHeaders, "markNotificationRead", { id: unread.id });
  const afterRead = await getData(ownerHeaders);
  assert.ok(afterRead.notifications.find((entry) => entry.id === unread.id).readAt);
}

const declinedEmail = `phase4-declined-${stamp}@trove.test`;
const declinedHeaders = session(declinedEmail, "Declined Member");
const declinedId = stamp + 20;
await action(ownerHeaders, "inviteMember", {
  id: declinedId,
  email: declinedEmail,
  role: "reservations",
});
const declinedStart = await getData(declinedHeaders);
assert.equal(declinedStart.invitations[0].id, declinedId);
await action(declinedHeaders, "declineInvitation", { id: declinedId });
const declinedEnd = await getData(declinedHeaders);
assert.equal(declinedEnd.invitations.length, 0);

console.log("Phase 4 API integration passed");
