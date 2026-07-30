import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("the application has an explicit authenticated entry gate", async () => {
  const [page, auth] = await Promise.all([
    source("app/page.tsx"),
    source("app/chatgpt-auth.ts"),
  ]);

  assert.match(page, /getChatGPTUser/);
  assert.match(page, /chatGPTSignInPath/);
  assert.match(page, /Entrar com ChatGPT/);
  assert.match(page, /force-dynamic/);
  assert.match(auth, /getUserFromHeaders/);
  assert.match(auth, /oai-authenticated-user-email/);
});

test("data and upload routes enforce server-side authorization", async () => {
  const [data, itemImage, profileImage, workspace] = await Promise.all([
    source("app/api/data/route.ts"),
    source("app/api/item-image/route.ts"),
    source("app/api/profile-image/route.ts"),
    source("app/workspace.ts"),
  ]);

  assert.match(data, /ACTION_PERMISSIONS/);
  assert.match(data, /authorize\(request, permission\)/);
  assert.match(itemImage, /authorize\(request, "manageInventory"\)/);
  assert.match(profileImage, /authorize\(request, "manageProfile"\)/);
  assert.match(workspace, /UNAUTHENTICATED/);
  assert.match(workspace, /FORBIDDEN/);
  assert.match(workspace, /PERMISSIONS/);
});

test("tenant ownership is represented in schema, migration and queries", async () => {
  const [schema, migration, workspace, api] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0002_free_caretaker.sql"),
    source("app/workspace.ts"),
    source("app/api/data/route.ts"),
  ]);

  assert.match(schema, /export const businesses/);
  assert.match(schema, /export const memberships/);
  assert.ok((schema.match(/businessId:/g) ?? []).length >= 6);
  assert.match(migration, /CREATE TABLE `memberships`/);
  assert.match(migration, /ADD `business_id`/);
  assert.match(workspace, /createBusinessForUser/);
  assert.ok((api.match(/business_id = \?/g) ?? []).length >= 12);
});

test("real accounts start without client-side demo inventory", async () => {
  const app = await source("app/DecorApp.tsx");

  assert.match(app, /useState<Item\[]>\(\[\]\)/);
  assert.match(app, /useState<Reservation\[]>\(\[\]\)/);
  assert.doesNotMatch(app, /const seedItems/);
  assert.doesNotMatch(app, /const seedReservations/);
});

test("phase 2 inventory entities are durable and tenant scoped", async () => {
  const [schema, migration, workspace, api] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0003_sleepy_wolfpack.sql"),
    source("app/workspace.ts"),
    source("app/api/data/route.ts"),
  ]);

  for (const entity of [
    "itemPhotos",
    "inventoryMovements",
    "maintenanceRecords",
    "kits",
    "kitItems",
  ]) {
    assert.match(schema, new RegExp(`export const ${entity}`));
  }
  assert.match(migration, /CREATE TABLE `inventory_movements`/);
  assert.match(migration, /CREATE TABLE `maintenance_records`/);
  assert.match(workspace, /item_photos_business_item_idx/);
  assert.match(api, /addItemPhotos: "manageInventory"/);
  assert.match(api, /adjustStock: "manageInventory"/);
  assert.match(api, /createKit: "manageInventory"/);
  assert.ok((api.match(/context\.businessId/g) ?? []).length >= 60);
});

test("phase 2 interface supports complete records and validated Excel imports", async () => {
  const [app, styles, manifest] = await Promise.all([
    source("app/DecorApp.tsx"),
    source("app/globals.css"),
    source("package.json"),
  ]);

  assert.match(app, /function ItemManager/);
  assert.match(app, /function KitManager/);
  assert.match(app, /read-excel-file/);
  assert.match(app, /Nenhum artigo foi gravado/);
  assert.match(app, /multiple accept="image\/png,image\/jpeg"/);
  assert.match(styles, /\.photo-gallery/);
  assert.match(styles, /\.history-list/);
  assert.match(styles, /\.kit-manager/);
  assert.match(manifest, /"read-excel-file": "5\.8\.8"/);
});

test("phase 3 reservations use durable clients, events and line items", async () => {
  const [schema, migration, workspace, api] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0004_numerous_slyde.sql"),
    source("app/workspace.ts"),
    source("app/api/data/route.ts"),
  ]);

  assert.match(schema, /export const clients/);
  assert.match(schema, /export const events/);
  assert.match(schema, /export const reservationItems/);
  assert.match(migration, /CREATE TABLE `clients`/);
  assert.match(migration, /CREATE TABLE `events`/);
  assert.match(migration, /CREATE TABLE `reservation_items`/);
  assert.match(workspace, /reservation_items_availability_insert/);
  assert.match(workspace, /INSUFFICIENT_DATE_AVAILABILITY/);
  assert.match(workspace, /reservations_checkout_stock/);
  assert.match(api, /updateReservation: "manageReservations"/);
  assert.match(api, /transitionReservation: "manageReservations"/);
  assert.match(api, /env\.DB\.batch\(\[/);
});

test("phase 3 interface supports multi-item pricing and lifecycle actions", async () => {
  const [app, styles] = await Promise.all([
    source("app/DecorApp.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(app, /function ReservationComposer/);
  assert.match(app, /function RelationshipManager/);
  assert.match(app, /reservation-item-/);
  assert.match(app, /Registar saída/);
  assert.match(app, /Registar devolução/);
  assert.match(app, /Clientes e eventos/);
  assert.match(styles, /\.reservation-item-picker/);
  assert.match(styles, /\.reservation-totals/);
  assert.match(styles, /\.relationship-manager/);
});

test("phase 4 communication data is durable, scoped, and permissioned", async () => {
  const [schema, migration, workspace, api] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0005_reflective_exiles.sql"),
    source("app/workspace.ts"),
    source("app/api/data/route.ts"),
  ]);

  assert.match(schema, /export const notifications/);
  assert.match(schema, /export const auditLogs/);
  assert.match(migration, /CREATE TABLE `notifications`/);
  assert.match(migration, /CREATE TABLE `audit_logs`/);
  assert.match(migration, /ADD `expires_at`/);
  assert.match(workspace, /notifications_business_user_date_idx/);
  assert.match(workspace, /audit_logs_business_date_idx/);
  assert.match(api, /acceptInvitation: "read"/);
  assert.match(api, /revokeInvitation: "manageTeam"/);
  assert.match(api, /ensureReservationReminders/);
  assert.match(api, /writeAudit/);
});

test("phase 4 interface exposes invitations, notifications, roles, and activity", async () => {
  const [app, styles] = await Promise.all([
    source("app/DecorApp.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(app, /function NotificationCenter/);
  assert.match(app, /function ActivityLog/);
  assert.match(app, /acceptInvitation/);
  assert.match(app, /enableBrowserAlerts/);
  assert.match(app, /updateMemberRole/);
  assert.match(app, /trove-business-id/);
  assert.match(styles, /\.invitation-banner/);
  assert.match(styles, /\.notification-center/);
  assert.match(styles, /\.activity-log/);
  assert.match(styles, /\.phase-four-team/);
});

test("phase 5 billing entities and PaySuite boundaries are durable and verified", async () => {
  const [schema, migration, workspace, billing, checkout, webhook] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0006_confused_snowbird.sql"),
    source("app/workspace.ts"),
    source("app/billing.ts"),
    source("app/api/billing/checkout/route.ts"),
    source("app/api/billing/webhook/route.ts"),
  ]);

  assert.match(schema, /export const subscriptions/);
  assert.match(schema, /export const payments/);
  assert.match(schema, /export const paymentWebhookEvents/);
  assert.match(migration, /CREATE TABLE `subscriptions`/);
  assert.match(migration, /CREATE TABLE `payments`/);
  assert.match(workspace, /SUBSCRIPTION_REQUIRED/);
  assert.match(workspace, /subscriptionAllowsWrites/);
  assert.match(billing, /PLAN_CATALOG/);
  assert.match(billing, /verifyPaySuiteSignature/);
  assert.match(checkout, /createPaySuitePayment/);
  assert.match(webhook, /x-webhook-signature/);
  assert.match(webhook, /payment_webhook_events/);
});

test("phase 5 interface exposes live status, payment history and receipts", async () => {
  const [app, styles] = await Promise.all([
    source("app/DecorApp.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(app, /startSubscriptionCheckout/);
  assert.match(app, /function Receipt/);
  assert.match(app, /Pagamentos e recibos/);
  assert.match(app, /cancelSubscription/);
  assert.match(app, /PAYMENTS_NOT_CONFIGURED/);
  assert.match(styles, /\.subscription-status/);
  assert.match(styles, /\.payment-history/);
  assert.match(styles, /\.receipt/);
  assert.match(styles, /@media print/);
});

test("phase 6 network entities are durable and indexed by business", async () => {
  const [schema, migration, workspace] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0007_peaceful_moon_knight.sql"),
    source("app/workspace.ts"),
  ]);

  assert.match(schema, /export const marketplaceListings/);
  assert.match(schema, /export const rentalRequests/);
  assert.match(schema, /export const rentalReviews/);
  assert.match(schema, /export const rentalDisputes/);
  assert.match(migration, /CREATE TABLE `marketplace_listings`/);
  assert.match(migration, /CREATE TABLE `rental_requests`/);
  assert.match(migration, /CREATE TABLE `rental_reviews`/);
  assert.match(migration, /CREATE TABLE `rental_disputes`/);
  assert.match(workspace, /marketplace_listings_business_item_idx/);
  assert.match(workspace, /rental_requests_owner_status_dates_idx/);
  assert.match(workspace, /rental_requests_accept_availability/);
  assert.match(workspace, /INSUFFICIENT_NETWORK_AVAILABILITY/);
});

test("phase 6 API enforces Network entitlements, availability, and participant ownership", async () => {
  const [network, image] = await Promise.all([
    source("app/api/network/route.ts"),
    source("app/api/network-image/route.ts"),
  ]);

  assert.match(network, /NETWORK_PLAN_REQUIRED/);
  assert.match(network, /manageNetworkListings/);
  assert.match(network, /manageNetworkRentals/);
  assert.match(network, /listingAvailability/);
  assert.match(network, /assertParticipant/);
  assert.match(network, /createRentalRequest/);
  assert.match(network, /counterRentalRequest/);
  assert.match(network, /updateRentalFinancials/);
  assert.match(network, /acceptDisputeResolution/);
  assert.match(image, /marketplace_listings/);
  assert.match(image, /allowedPrefix/);
});

test("phase 6 interface replaces demo listings with the operational marketplace", async () => {
  const [app, styles, manifest] = await Promise.all([
    source("app/DecorApp.tsx"),
    source("app/globals.css"),
    source("package.json"),
  ]);

  assert.doesNotMatch(app, /const networkItems/);
  assert.match(app, /function NetworkListingForm/);
  assert.match(app, /function NetworkRentalForm/);
  assert.match(app, /function NetworkRequestManager/);
  assert.match(app, /Usar minha localização/);
  assert.match(app, /Confirmado manualmente/);
  assert.match(app, /RESOLUÇÃO DE DISPUTA/);
  assert.match(styles, /\.network-tabs/);
  assert.match(styles, /\.network-listing-table/);
  assert.match(styles, /\.network-request-manager/);
  assert.match(manifest, /"test:phase6-api"/);
});

test("phase 7 provides an installable and resilient PWA shell", async () => {
  const [layout, manifest, worker, offline, cache] = await Promise.all([
    source("app/layout.tsx"),
    source("public/manifest.webmanifest"),
    source("public/sw.js"),
    source("public/offline.html"),
    source("app/offline-cache.ts"),
  ]);

  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /icon-512\.png/);
  assert.match(worker, /self\.addEventListener\("push"/);
  assert.match(worker, /caches\.match\("\/offline\.html"\)/);
  assert.doesNotMatch(worker, /pathname\.startsWith\("\/api\/"\).*cache/i);
  assert.match(offline, /apenas para consulta/);
  assert.match(cache, /indexedDB\.open\("trove-offline"/);
});

test("phase 7 push, monitoring, and beta feedback are durable and tenant scoped", async () => {
  const [schema, migration, workspace, push, operations, health, webPush] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0008_lovely_fabian_cortez.sql"),
    source("app/workspace.ts"),
    source("app/api/push/route.ts"),
    source("app/api/operations/route.ts"),
    source("app/api/health/route.ts"),
    source("app/web-push.ts"),
  ]);

  assert.match(schema, /export const pushSubscriptions/);
  assert.match(schema, /export const operationalEvents/);
  assert.match(schema, /export const betaFeedback/);
  assert.match(migration, /CREATE TABLE `push_subscriptions`/);
  assert.match(workspace, /push_subscriptions_user_idx/);
  assert.match(push, /authorize\(request\)/);
  assert.match(push, /sendPushToUsers/);
  assert.match(operations, /authorize\(request, "manageTeam"\)/);
  assert.match(operations, /INSERT INTO beta_feedback/);
  assert.match(health, /SELECT 1 AS healthy/);
  assert.match(webPush, /Content-Encoding: aes128gcm/);
  assert.match(webPush, /ECDH/);
});

test("phase 7 interface exposes installation, push, feedback, and operational status", async () => {
  const [app, styles, manifest] = await Promise.all([
    source("app/DecorApp.tsx"),
    source("app/globals.css"),
    source("package.json"),
  ]);

  assert.match(app, /function LaunchTools/);
  assert.match(app, /beforeinstallprompt/);
  assert.match(app, /pushManager\.subscribe/);
  assert.match(app, /Feedback da fase beta/);
  assert.match(app, /Estado operacional/);
  assert.match(styles, /\.launch-tools/);
  assert.match(styles, /\.connection-status/);
  assert.match(styles, /\.operations-status/);
  assert.match(manifest, /"test:phase7-api"/);
});

test("phase 8 provides durable public profiles and protected enquiries", async () => {
  const [schema, migration, workspace, publicApi, publicPage] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0009_cheerful_bedlam.sql"),
    source("app/workspace.ts"),
    source("app/api/public-profile/route.ts"),
    source("app/p/[handle]/page.tsx"),
  ]);

  assert.match(schema, /export const publicEnquiries/);
  assert.match(schema, /export const emailDeliveries/);
  assert.match(migration, /CREATE TABLE `public_enquiries`/);
  assert.match(migration, /CREATE TABLE `email_deliveries`/);
  assert.match(workspace, /public_enquiries_rate_limit_idx/);
  assert.match(publicApi, /crypto\.subtle\.digest/);
  assert.match(publicApi, /Too many enquiries/);
  assert.match(publicApi, /sendTransactionalEmail/);
  assert.match(publicPage, /EnquiryForm/);
});

test("phase 8 includes transactional email, owner backup, and legal boundaries", async () => {
  const [email, data, backup, terms, privacy] = await Promise.all([
    source("app/email.ts"),
    source("app/api/data/route.ts"),
    source("app/api/backup/route.ts"),
    source("app/legal/terms/page.tsx"),
    source("app/legal/privacy/page.tsx"),
  ]);

  assert.match(email, /RESEND_API_KEY/);
  assert.match(email, /email_deliveries/);
  assert.match(data, /invitationEmail/);
  assert.match(backup, /authorize\(request, "manageBilling"\)/);
  assert.doesNotMatch(backup, /push_subscriptions/);
  assert.match(terms, /Versão beta/);
  assert.match(privacy, /não guardamos o endereço IP em claro/);
});

test("phase 8 interface exposes onboarding, enquiries, backup, and public controls", async () => {
  const [app, styles, manifest] = await Promise.all([
    source("app/DecorApp.tsx"),
    source("app/globals.css"),
    source("package.json"),
  ]);

  assert.match(app, /function OnboardingChecklist/);
  assert.match(app, /function EnquiryManager/);
  assert.match(app, /exportWorkspaceBackup/);
  assert.match(app, /acceptsEnquiries/);
  assert.match(styles, /\.onboarding-card/);
  assert.match(styles, /\.enquiry-manager/);
  assert.match(manifest, /"test:phase8-api"/);
});
