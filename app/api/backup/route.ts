import { env } from "cloudflare:workers";
import { authorize, isAuthorizationResponse } from "../../workspace";

type QueryDefinition = {
  key: string;
  sql: string;
};

const BUSINESS_TABLES: QueryDefinition[] = [
  { key: "profile", sql: "SELECT * FROM business_profile WHERE business_id = ?" },
  { key: "categories", sql: "SELECT * FROM categories WHERE business_id = ? ORDER BY name" },
  { key: "inventoryItems", sql: "SELECT * FROM inventory_items WHERE business_id = ? ORDER BY id" },
  { key: "itemPhotos", sql: "SELECT id, business_id, item_id, url, sort_order, created_at FROM item_photos WHERE business_id = ? ORDER BY item_id, sort_order" },
  { key: "inventoryMovements", sql: "SELECT * FROM inventory_movements WHERE business_id = ? ORDER BY created_at" },
  { key: "maintenanceRecords", sql: "SELECT * FROM maintenance_records WHERE business_id = ? ORDER BY created_at" },
  { key: "kits", sql: "SELECT * FROM kits WHERE business_id = ? ORDER BY id" },
  { key: "kitItems", sql: "SELECT * FROM kit_items WHERE business_id = ? ORDER BY kit_id, id" },
  { key: "clients", sql: "SELECT * FROM clients WHERE business_id = ? ORDER BY id" },
  { key: "events", sql: "SELECT * FROM events WHERE business_id = ? ORDER BY id" },
  { key: "reservations", sql: "SELECT * FROM reservations WHERE business_id = ? ORDER BY id" },
  { key: "reservationItems", sql: "SELECT * FROM reservation_items WHERE business_id = ? ORDER BY reservation_id, id" },
  { key: "memberships", sql: "SELECT m.business_id, m.user_id, m.role, m.status, m.created_at, u.email, u.display_name FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.business_id = ? ORDER BY m.user_id" },
  { key: "invitations", sql: "SELECT id, business_id, email, role, status, created_at, expires_at, accepted_at, revoked_at FROM collaborators WHERE business_id = ? ORDER BY id" },
  { key: "notifications", sql: "SELECT * FROM notifications WHERE business_id = ? ORDER BY created_at" },
  { key: "auditLogs", sql: "SELECT * FROM audit_logs WHERE business_id = ? ORDER BY created_at" },
  { key: "marketplaceListings", sql: "SELECT * FROM marketplace_listings WHERE business_id = ? ORDER BY id" },
  { key: "rentalRequestsOwned", sql: "SELECT * FROM rental_requests WHERE owner_business_id = ? ORDER BY id" },
  { key: "rentalRequestsMade", sql: "SELECT * FROM rental_requests WHERE requester_business_id = ? ORDER BY id" },
  { key: "rentalReviewsWritten", sql: "SELECT * FROM rental_reviews WHERE reviewer_business_id = ? ORDER BY id" },
  { key: "rentalReviewsReceived", sql: "SELECT * FROM rental_reviews WHERE reviewed_business_id = ? ORDER BY id" },
  { key: "subscriptions", sql: "SELECT * FROM subscriptions WHERE business_id = ? ORDER BY id" },
  { key: "payments", sql: "SELECT * FROM payments WHERE business_id = ? ORDER BY id" },
  { key: "publicEnquiries", sql: "SELECT id, business_id, name, email, phone, event_date, message, status, created_at FROM public_enquiries WHERE business_id = ? ORDER BY created_at" },
  { key: "emailDeliveries", sql: "SELECT id, business_id, recipient, template, provider, provider_message_id, status, error, created_at, updated_at FROM email_deliveries WHERE business_id = ? ORDER BY created_at" },
  { key: "betaFeedback", sql: "SELECT * FROM beta_feedback WHERE business_id = ? ORDER BY created_at" },
];

export async function GET(request: Request) {
  const context = await authorize(request, "manageBilling");
  if (isAuthorizationResponse(context)) return context;
  const business = await env.DB.prepare(
    "SELECT id, name, handle, plan, created_at AS createdAt FROM businesses WHERE id = ?",
  ).bind(context.businessId).first();
  const results = await Promise.all(
    BUSINESS_TABLES.map((definition) =>
      env.DB.prepare(definition.sql).bind(context.businessId).all(),
    ),
  );
  const exportedAt = new Date().toISOString();
  const data = Object.fromEntries(
    BUSINESS_TABLES.map((definition, index) => [
      definition.key,
      results[index].results,
    ]),
  );
  await env.DB.prepare(
    "INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, 'exportBackup', 'workspace', ?, 'Cópia integral exportada', ?)",
  ).bind(context.businessId, context.userId, String(context.businessId), exportedAt).run();
  const filename = `trove-${context.businessHandle}-backup-${exportedAt.slice(0, 10)}.json`;
  return new Response(JSON.stringify({
    format: "trove-workspace-backup",
    version: 1,
    exportedAt,
    business,
    data,
    media: {
      note: "As fotografias permanecem no armazenamento e são referenciadas pelos respectivos URLs.",
    },
  }, null, 2), {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "application/json; charset=utf-8",
    },
  });
}
