import { env } from "cloudflare:workers";
import { getUserFromHeaders, type ChatGPTUser } from "./chatgpt-auth";
import {
  paymentConfiguration,
  PLAN_CATALOG,
  subscriptionAllowsWrites,
  type SubscriptionStatus,
} from "./billing";

export type WorkspaceRole =
  | "owner"
  | "manager"
  | "inventory"
  | "reservations"
  | "viewer";

export type WorkspacePermission =
  | "read"
  | "manageInventory"
  | "manageReservations"
  | "manageNetworkListings"
  | "manageNetworkRentals"
  | "manageCategories"
  | "manageProfile"
  | "manageTeam"
  | "manageBilling";

export type WorkspaceContext = {
  user: ChatGPTUser;
  userId: number;
  businessId: number;
  businessName: string;
  businessHandle: string;
  plan: "Basic" | "Network";
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: string;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  role: WorkspaceRole;
};

const DEFAULT_CATEGORIES = [
  "Mobiliário",
  "Mesa",
  "Têxteis",
  "Iluminação",
  "Estruturas",
];

const PERMISSIONS: Record<WorkspacePermission, WorkspaceRole[]> = {
  read: ["owner", "manager", "inventory", "reservations", "viewer"],
  manageInventory: ["owner", "manager", "inventory"],
  manageReservations: ["owner", "manager", "reservations"],
  manageNetworkListings: ["owner", "manager", "inventory"],
  manageNetworkRentals: ["owner", "manager", "reservations"],
  manageCategories: ["owner", "manager", "inventory"],
  manageProfile: ["owner", "manager"],
  manageTeam: ["owner", "manager"],
  manageBilling: ["owner"],
};

function now() {
  return new Date().toISOString();
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "studio";
}

function normalizeRole(value: string): WorkspaceRole {
  const role = value.toLowerCase();
  if (role.includes("owner") || role.includes("propriet")) return "owner";
  if (role.includes("manager") || role.includes("gestor") && !role.includes("reserva")) return "manager";
  if (role.includes("reserv")) return "reservations";
  if (role.includes("invent") || role.includes("editor")) return "inventory";
  return "viewer";
}

async function addMissingColumns(
  table: string,
  columns: { name: string; sql: string }[],
) {
  const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{
    name: string;
  }>();
  const names = new Set(
    result.results.map((column: { name: string }) => column.name),
  );
  for (const column of columns) {
    if (!names.has(column.name)) {
      await env.DB.prepare(
        `ALTER TABLE ${table} ADD COLUMN ${column.sql}`,
      ).run();
    }
  }
}

async function migrateLegacyCategoriesConstraint() {
  const table = await env.DB.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'categories'",
  ).first<{ sql: string }>();
  if (!table?.sql || !/name\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(table.sql)) {
    return;
  }
  await env.DB.batch([
    env.DB.prepare("ALTER TABLE categories RENAME TO categories_legacy"),
    env.DB.prepare(
      "CREATE TABLE categories (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, UNIQUE (business_id, name))",
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO categories (id, business_id, name) SELECT id, business_id, name FROM categories_legacy",
    ),
    env.DB.prepare("DROP TABLE categories_legacy"),
  ]);
}

async function migrateLegacyReservations() {
  const legacy = await env.DB.prepare(
    "SELECT id, business_id AS businessId, item, client, date, end_date AS endDate, event_name AS eventName, contact, notes, quantity, status FROM reservations WHERE client_id IS NULL OR event_id IS NULL ORDER BY id",
  ).all<{
    id: number;
    businessId: number;
    item: string;
    client: string;
    date: string;
    endDate: string;
    eventName: string;
    contact: string;
    notes: string;
    quantity: number;
    status: string;
  }>();
  for (const reservation of legacy.results) {
    const clientId = reservation.id * 10 + 1;
    const eventId = reservation.id * 10 + 2;
    const reservationItemId = reservation.id * 10 + 3;
    const inventory = await env.DB.prepare(
      "SELECT id, name, price, currency FROM inventory_items WHERE business_id = ? ORDER BY length(name) DESC",
    ).bind(reservation.businessId).all<{ id: number; name: string; price: number; currency: string }>();
    const item = inventory.results.find(
      (candidate) =>
        reservation.item === candidate.name ||
        reservation.item.startsWith(`${candidate.name} ×`),
    );
    const subtotal = item ? item.price * Math.max(1, reservation.quantity) : 0;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO clients (id, business_id, name, email, phone, notes, created_at) VALUES (?, ?, ?, '', ?, '', ?)",
      ).bind(clientId, reservation.businessId, reservation.client || "Cliente", reservation.contact || "", now()),
      env.DB.prepare(
        "INSERT OR IGNORE INTO events (id, business_id, client_id, name, venue, start_date, end_date, setup_time, pickup_time, notes, status, created_at) VALUES (?, ?, ?, ?, '', ?, ?, '', '', ?, 'Planned', ?)",
      ).bind(eventId, reservation.businessId, clientId, reservation.eventName || reservation.client || "Evento", reservation.date, reservation.endDate, reservation.notes || "", now()),
      env.DB.prepare(
        "UPDATE reservations SET client_id = ?, event_id = ?, subtotal = ?, total = ?, currency = ?, logistics = CASE WHEN logistics = '' THEN notes ELSE logistics END, created_at = CASE WHEN created_at = '' THEN ? ELSE created_at END WHERE id = ? AND business_id = ?",
      ).bind(clientId, eventId, subtotal, subtotal, item?.currency || "MZN", now(), reservation.id, reservation.businessId),
      ...(item
        ? [env.DB.prepare(
          "INSERT OR IGNORE INTO reservation_items (id, business_id, reservation_id, item_id, item_name, quantity, unit_price, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(reservationItemId, reservation.businessId, reservation.id, item.id, item.name, Math.max(1, reservation.quantity), item.price, item.currency)]
        : []),
    ]);
  }
}

async function ensureBusinessSubscriptions() {
  const timestamp = now();
  const trialEnd = addDays(new Date(timestamp), 14).toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO subscriptions (
      business_id, plan, status, amount, currency, current_period_start,
      current_period_end, cancel_at_period_end, provider, created_at, updated_at
    )
    SELECT id, plan, 'Trialing',
      CASE WHEN plan = 'Network' THEN 3100 ELSE 1200 END,
      'MZN', ?, ?, 0, 'PaySuite', ?, ?
    FROM businesses`,
  ).bind(timestamp, trialEnd, timestamp, timestamp).run();
}

async function refreshSubscription(businessId: number) {
  const subscription = await env.DB.prepare(
    "SELECT id, status, current_period_end AS currentPeriodEnd, grace_until AS graceUntil, cancel_at_period_end AS cancelAtPeriodEnd FROM subscriptions WHERE business_id = ?",
  ).bind(businessId).first<{
    id: number;
    status: SubscriptionStatus;
    currentPeriodEnd: string;
    graceUntil: string | null;
    cancelAtPeriodEnd: number;
  }>();
  if (!subscription) return;
  const timestamp = now();
  if (
    subscription.cancelAtPeriodEnd &&
    subscription.currentPeriodEnd <= timestamp &&
    subscription.status !== "Cancelled"
  ) {
    await env.DB.prepare(
      "UPDATE subscriptions SET status = 'Cancelled', updated_at = ? WHERE id = ?",
    ).bind(timestamp, subscription.id).run();
    return;
  }
  if (
    subscription.status === "Trialing" &&
    !paymentConfiguration().apiToken
  ) {
    return;
  }
  if (
    ["Trialing", "Active"].includes(subscription.status) &&
    subscription.currentPeriodEnd <= timestamp
  ) {
    const graceUntil = addDays(new Date(subscription.currentPeriodEnd), 7).toISOString();
    await env.DB.prepare(
      "UPDATE subscriptions SET status = 'Grace', grace_until = ?, updated_at = ? WHERE id = ?",
    ).bind(graceUntil, timestamp, subscription.id).run();
    return;
  }
  if (
    subscription.status === "Grace" &&
    subscription.graceUntil &&
    subscription.graceUntil <= timestamp
  ) {
    await env.DB.prepare(
      "UPDATE subscriptions SET status = 'PastDue', updated_at = ? WHERE id = ?",
    ).bind(timestamp, subscription.id).run();
  }
}

export async function ensureWorkspaceDatabase() {
  const db = env.DB;
  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS businesses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, handle TEXT NOT NULL UNIQUE, plan TEXT NOT NULL DEFAULT 'Basic', created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS memberships (id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Active', created_at TEXT NOT NULL, UNIQUE (business_id, user_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL UNIQUE, plan TEXT NOT NULL DEFAULT 'Basic', pending_plan TEXT, status TEXT NOT NULL DEFAULT 'Trialing', amount INTEGER NOT NULL DEFAULT 1200, currency TEXT NOT NULL DEFAULT 'MZN', current_period_start TEXT NOT NULL, current_period_end TEXT NOT NULL, grace_until TEXT, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, provider TEXT NOT NULL DEFAULT 'PaySuite', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL, subscription_id INTEGER NOT NULL, provider TEXT NOT NULL DEFAULT 'PaySuite', provider_payment_id TEXT, reference TEXT NOT NULL UNIQUE, kind TEXT NOT NULL DEFAULT 'subscription', plan TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'MZN', status TEXT NOT NULL DEFAULT 'Pending', checkout_url TEXT, method TEXT, paid_at TEXT, failure_reason TEXT, receipt_number TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS payment_webhook_events (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, request_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL, payload_hash TEXT NOT NULL, status TEXT NOT NULL, processed_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS marketplace_listings (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, item_id INTEGER NOT NULL, daily_price INTEGER NOT NULL, deposit INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'MZN', minimum_quantity INTEGER NOT NULL DEFAULT 1, maximum_quantity INTEGER NOT NULL DEFAULT 1, location TEXT NOT NULL DEFAULT '', latitude TEXT, longitude TEXT, delivery_options TEXT NOT NULL DEFAULT 'Pickup', terms TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_by_user_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (business_id, item_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS rental_requests (id INTEGER PRIMARY KEY, listing_id INTEGER NOT NULL, owner_business_id INTEGER NOT NULL, requester_business_id INTEGER NOT NULL, quantity INTEGER NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', unit_price INTEGER NOT NULL, deposit INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'MZN', requester_note TEXT NOT NULL DEFAULT '', owner_note TEXT NOT NULL DEFAULT '', delivery_method TEXT NOT NULL DEFAULT 'Pickup', proposed_by_business_id INTEGER, payment_status TEXT NOT NULL DEFAULT 'Pending', deposit_status TEXT NOT NULL DEFAULT 'Pending', checked_out_at TEXT, returned_at TEXT, cancelled_at TEXT, created_by_user_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS rental_reviews (id INTEGER PRIMARY KEY, rental_request_id INTEGER NOT NULL, reviewer_business_id INTEGER NOT NULL, reviewed_business_id INTEGER NOT NULL, rating INTEGER NOT NULL, comment TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, UNIQUE (rental_request_id, reviewer_business_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS rental_disputes (id INTEGER PRIMARY KEY, rental_request_id INTEGER NOT NULL UNIQUE, opened_by_business_id INTEGER NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Open', proposed_resolution TEXT NOT NULL DEFAULT '', proposed_by_business_id INTEGER, resolved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, category TEXT NOT NULL, quantity INTEGER NOT NULL, available INTEGER NOT NULL, status TEXT NOT NULL, tone TEXT NOT NULL, symbol TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'MZN', photo_url TEXT, storage_location TEXT NOT NULL DEFAULT '', condition TEXT NOT NULL DEFAULT 'Bom')",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL DEFAULT 1, item TEXT NOT NULL, client TEXT NOT NULL, date TEXT NOT NULL, end_date TEXT NOT NULL, color TEXT NOT NULL, event_name TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'Confirmed')",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS business_profile (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL DEFAULT 1 UNIQUE, business_name TEXT NOT NULL, handle TEXT NOT NULL, bio TEXT NOT NULL, location TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, color TEXT NOT NULL, avatar_url TEXT)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, UNIQUE (business_id, name))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS collaborators (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL DEFAULT 1, email TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', invited_by_user_id INTEGER, created_at TEXT NOT NULL DEFAULT '')",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL, user_id INTEGER NOT NULL, type TEXT NOT NULL, title_pt TEXT NOT NULL, title_en TEXT NOT NULL, body_pt TEXT NOT NULL DEFAULT '', body_en TEXT NOT NULL DEFAULT '', link TEXT NOT NULL DEFAULT '', source_key TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL, UNIQUE (user_id, source_key))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL, user_id INTEGER, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL, created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS push_subscriptions (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, user_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS operational_events (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, user_id INTEGER NOT NULL, severity TEXT NOT NULL DEFAULT 'error', source TEXT NOT NULL, message TEXT NOT NULL, route TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS beta_feedback (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, user_id INTEGER NOT NULL, category TEXT NOT NULL, rating INTEGER NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'New', created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS public_enquiries (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', event_date TEXT NOT NULL DEFAULT '', message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'New', ip_hash TEXT NOT NULL, created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS email_deliveries (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, recipient TEXT NOT NULL, template TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'Resend', provider_message_id TEXT, status TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS item_photos (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, item_id INTEGER NOT NULL, url TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS inventory_movements (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, item_id INTEGER NOT NULL, type TEXT NOT NULL, quantity_delta INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', created_by_user_id INTEGER, created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS maintenance_records (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, item_id INTEGER NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', cost INTEGER NOT NULL DEFAULT 0, scheduled_date TEXT NOT NULL DEFAULT '', completed_at TEXT, created_by_user_id INTEGER, created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS kits (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'MZN', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS kit_items (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, kit_id INTEGER NOT NULL, item_id INTEGER NOT NULL, quantity INTEGER NOT NULL, UNIQUE (kit_id, item_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, client_id INTEGER NOT NULL, owner_user_id INTEGER, name TEXT NOT NULL, event_type TEXT NOT NULL DEFAULT 'Other', venue TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', start_date TEXT NOT NULL, end_date TEXT NOT NULL, setup_time TEXT NOT NULL DEFAULT '', pickup_time TEXT NOT NULL DEFAULT '', guest_count INTEGER NOT NULL DEFAULT 0, budget INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'MZN', on_site_contact TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#b75d3f', notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Planned', created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '', archived_at TEXT)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS event_tasks (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, event_id INTEGER NOT NULL, assignee_user_id INTEGER, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'General', priority TEXT NOT NULL DEFAULT 'Normal', status TEXT NOT NULL DEFAULT 'Pending', due_date TEXT NOT NULL DEFAULT '', due_time TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, completed_at TEXT, completed_by_user_id INTEGER, created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS reservation_items (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, reservation_id INTEGER NOT NULL, item_id INTEGER NOT NULL, item_name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'MZN', UNIQUE (reservation_id, item_id))",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS memberships_business_user_idx ON memberships (business_id, user_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id, status)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_business_idx ON subscriptions (business_id)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS payments_reference_idx ON payments (reference)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS payments_business_date_idx ON payments (business_id, created_at)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_request_idx ON payment_webhook_events (request_id)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS marketplace_listings_business_item_idx ON marketplace_listings (business_id, item_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS marketplace_listings_active_idx ON marketplace_listings (active, business_id, item_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS rental_requests_owner_status_dates_idx ON rental_requests (owner_business_id, status, start_date, end_date)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS rental_requests_requester_status_idx ON rental_requests (requester_business_id, status, updated_at)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS rental_reviews_request_reviewer_idx ON rental_reviews (rental_request_id, reviewer_business_id)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS rental_disputes_request_idx ON rental_disputes (rental_request_id)",
    ),
  ]);

  await addMissingColumns("inventory_items", [
    { name: "business_id", sql: "business_id INTEGER NOT NULL DEFAULT 1" },
    { name: "price", sql: "price INTEGER NOT NULL DEFAULT 0" },
    { name: "currency", sql: "currency TEXT NOT NULL DEFAULT 'MZN'" },
    { name: "photo_url", sql: "photo_url TEXT" },
    {
      name: "storage_location",
      sql: "storage_location TEXT NOT NULL DEFAULT ''",
    },
    { name: "condition", sql: "condition TEXT NOT NULL DEFAULT 'Bom'" },
    { name: "description", sql: "description TEXT NOT NULL DEFAULT ''" },
    { name: "sku", sql: "sku TEXT NOT NULL DEFAULT ''" },
    {
      name: "replacement_value",
      sql: "replacement_value INTEGER NOT NULL DEFAULT 0",
    },
    { name: "min_stock", sql: "min_stock INTEGER NOT NULL DEFAULT 0" },
  ]);
  await addMissingColumns("reservations", [
    { name: "business_id", sql: "business_id INTEGER NOT NULL DEFAULT 1" },
    { name: "event_name", sql: "event_name TEXT NOT NULL DEFAULT ''" },
    { name: "contact", sql: "contact TEXT NOT NULL DEFAULT ''" },
    { name: "notes", sql: "notes TEXT NOT NULL DEFAULT ''" },
    { name: "quantity", sql: "quantity INTEGER NOT NULL DEFAULT 1" },
    { name: "status", sql: "status TEXT NOT NULL DEFAULT 'Confirmed'" },
    { name: "client_id", sql: "client_id INTEGER" },
    { name: "event_id", sql: "event_id INTEGER" },
    { name: "subtotal", sql: "subtotal INTEGER NOT NULL DEFAULT 0" },
    { name: "discount", sql: "discount INTEGER NOT NULL DEFAULT 0" },
    {
      name: "delivery_fee",
      sql: "delivery_fee INTEGER NOT NULL DEFAULT 0",
    },
    { name: "total", sql: "total INTEGER NOT NULL DEFAULT 0" },
    { name: "deposit", sql: "deposit INTEGER NOT NULL DEFAULT 0" },
    { name: "currency", sql: "currency TEXT NOT NULL DEFAULT 'MZN'" },
    { name: "logistics", sql: "logistics TEXT NOT NULL DEFAULT ''" },
    {
      name: "payment_status",
      sql: "payment_status TEXT NOT NULL DEFAULT 'Pending'",
    },
    { name: "checked_out_at", sql: "checked_out_at TEXT" },
    { name: "returned_at", sql: "returned_at TEXT" },
    { name: "cancelled_at", sql: "cancelled_at TEXT" },
    { name: "created_by_user_id", sql: "created_by_user_id INTEGER" },
    { name: "created_at", sql: "created_at TEXT NOT NULL DEFAULT ''" },
  ]);
  await addMissingColumns("categories", [
    { name: "business_id", sql: "business_id INTEGER NOT NULL DEFAULT 1" },
  ]);
  await addMissingColumns("business_profile", [
    { name: "business_id", sql: "business_id INTEGER NOT NULL DEFAULT 1" },
    { name: "website", sql: "website TEXT NOT NULL DEFAULT ''" },
    { name: "instagram", sql: "instagram TEXT NOT NULL DEFAULT ''" },
    { name: "services", sql: "services TEXT NOT NULL DEFAULT ''" },
    { name: "is_public", sql: "is_public INTEGER NOT NULL DEFAULT 1" },
    { name: "accepts_enquiries", sql: "accepts_enquiries INTEGER NOT NULL DEFAULT 1" },
  ]);
  await addMissingColumns("collaborators", [
    { name: "business_id", sql: "business_id INTEGER NOT NULL DEFAULT 1" },
    { name: "invited_by_user_id", sql: "invited_by_user_id INTEGER" },
    { name: "created_at", sql: "created_at TEXT NOT NULL DEFAULT ''" },
    { name: "expires_at", sql: "expires_at TEXT NOT NULL DEFAULT ''" },
    { name: "accepted_at", sql: "accepted_at TEXT" },
    { name: "accepted_by_user_id", sql: "accepted_by_user_id INTEGER" },
    { name: "revoked_at", sql: "revoked_at TEXT" },
  ]);
  await addMissingColumns("reservation_items", [
    { name: "currency", sql: "currency TEXT NOT NULL DEFAULT 'MZN'" },
  ]);
  await addMissingColumns("events", [
    { name: "owner_user_id", sql: "owner_user_id INTEGER" },
    { name: "event_type", sql: "event_type TEXT NOT NULL DEFAULT 'Other'" },
    { name: "address", sql: "address TEXT NOT NULL DEFAULT ''" },
    { name: "guest_count", sql: "guest_count INTEGER NOT NULL DEFAULT 0" },
    { name: "budget", sql: "budget INTEGER NOT NULL DEFAULT 0" },
    { name: "currency", sql: "currency TEXT NOT NULL DEFAULT 'MZN'" },
    { name: "on_site_contact", sql: "on_site_contact TEXT NOT NULL DEFAULT ''" },
    { name: "color", sql: "color TEXT NOT NULL DEFAULT '#b75d3f'" },
    { name: "updated_at", sql: "updated_at TEXT NOT NULL DEFAULT ''" },
    { name: "archived_at", sql: "archived_at TEXT" },
  ]);

  await migrateLegacyCategoriesConstraint();

  await db.batch([
    db.prepare("DROP INDEX IF EXISTS categories_name_unique"),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS categories_business_name_idx ON categories (business_id, name)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS business_profile_business_id_unique ON business_profile (business_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS inventory_business_idx ON inventory_items (business_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS reservations_business_date_idx ON reservations (business_id, date, end_date)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS collaborators_business_email_idx ON collaborators (business_id, email, status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS item_photos_business_item_idx ON item_photos (business_id, item_id, sort_order)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS movements_business_item_date_idx ON inventory_movements (business_id, item_id, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS maintenance_business_item_idx ON maintenance_records (business_id, item_id, status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS kits_business_idx ON kits (business_id, active)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS kit_items_kit_item_idx ON kit_items (kit_id, item_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS clients_business_name_idx ON clients (business_id, name)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS events_business_dates_idx ON events (business_id, start_date, end_date)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS event_tasks_business_event_status_idx ON event_tasks (business_id, event_id, status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS event_tasks_assignee_due_idx ON event_tasks (business_id, assignee_user_id, due_date)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS reservation_items_business_item_idx ON reservation_items (business_id, item_id, reservation_id)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS reservation_items_reservation_item_idx ON reservation_items (reservation_id, item_id)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_source_idx ON notifications (user_id, source_key)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS notifications_business_user_date_idx ON notifications (business_id, user_id, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS audit_logs_business_date_idx ON audit_logs (business_id, created_at)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions (endpoint)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (business_id, user_id, enabled)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS operational_events_business_date_idx ON operational_events (business_id, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS beta_feedback_business_date_idx ON beta_feedback (business_id, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS public_enquiries_business_date_idx ON public_enquiries (business_id, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS public_enquiries_rate_limit_idx ON public_enquiries (business_id, ip_hash, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS email_deliveries_business_date_idx ON email_deliveries (business_id, created_at)",
    ),
  ]);

  await migrateLegacyReservations();

  await db.batch([
    db.prepare("DROP TRIGGER IF EXISTS reservation_items_availability_insert"),
    db.prepare(`CREATE TRIGGER reservation_items_availability_insert
      BEFORE INSERT ON reservation_items
      BEGIN
        SELECT CASE
          WHEN NEW.quantity <= 0 THEN RAISE(ABORT, 'INVALID_RESERVATION_QUANTITY')
          WHEN NOT EXISTS (
            SELECT 1 FROM inventory_items
            WHERE id = NEW.item_id AND business_id = NEW.business_id
          ) THEN RAISE(ABORT, 'RESERVATION_ITEM_NOT_FOUND')
          WHEN NEW.quantity > (
            SELECT inventory_items.quantity - COALESCE((
              SELECT SUM(existing.quantity)
              FROM reservation_items AS existing
              JOIN reservations AS booked
                ON booked.id = existing.reservation_id
               AND booked.business_id = existing.business_id
              WHERE existing.business_id = NEW.business_id
                AND existing.item_id = NEW.item_id
                AND existing.reservation_id != NEW.reservation_id
                AND booked.status NOT IN ('Cancelled', 'Returned')
                AND booked.date <= (
                  SELECT end_date FROM reservations
                  WHERE id = NEW.reservation_id AND business_id = NEW.business_id
                )
                AND booked.end_date >= (
                  SELECT date FROM reservations
                  WHERE id = NEW.reservation_id AND business_id = NEW.business_id
                )
            ), 0)
            FROM inventory_items
            WHERE id = NEW.item_id AND business_id = NEW.business_id
          ) THEN RAISE(ABORT, 'INSUFFICIENT_DATE_AVAILABILITY')
        END;
      END`),
    db.prepare("DROP TRIGGER IF EXISTS reservations_checkout_stock"),
    db.prepare(`CREATE TRIGGER reservations_checkout_stock
      BEFORE UPDATE OF status ON reservations
      WHEN NEW.status = 'CheckedOut' AND OLD.status = 'Confirmed'
      BEGIN
        SELECT CASE WHEN EXISTS (
          SELECT 1
          FROM reservation_items AS line
          JOIN inventory_items AS stock
            ON stock.id = line.item_id
           AND stock.business_id = line.business_id
          WHERE line.reservation_id = NEW.id
            AND line.business_id = NEW.business_id
            AND stock.available < line.quantity
        ) THEN RAISE(ABORT, 'INSUFFICIENT_PHYSICAL_STOCK') END;
      END`),
    db.prepare("DROP TRIGGER IF EXISTS rental_requests_accept_availability"),
    db.prepare(`CREATE TRIGGER rental_requests_accept_availability
      BEFORE UPDATE OF status ON rental_requests
      WHEN NEW.status = 'Accepted' AND OLD.status != 'Accepted'
      BEGIN
        SELECT CASE
          WHEN NEW.quantity <= 0 THEN RAISE(ABORT, 'INVALID_NETWORK_QUANTITY')
          WHEN NOT EXISTS (
            SELECT 1
            FROM marketplace_listings AS listing
            JOIN inventory_items AS stock
              ON stock.id = listing.item_id
             AND stock.business_id = listing.business_id
            WHERE listing.id = NEW.listing_id
              AND listing.business_id = NEW.owner_business_id
              AND listing.active = 1
          ) THEN RAISE(ABORT, 'NETWORK_LISTING_NOT_FOUND')
          WHEN NEW.quantity > (
            SELECT stock.quantity
              - COALESCE((
                SELECT SUM(line.quantity)
                FROM reservation_items AS line
                JOIN reservations AS reservation
                  ON reservation.id = line.reservation_id
                 AND reservation.business_id = line.business_id
                WHERE line.business_id = NEW.owner_business_id
                  AND line.item_id = listing.item_id
                  AND reservation.status NOT IN ('Cancelled', 'Returned')
                  AND reservation.date <= NEW.end_date
                  AND reservation.end_date >= NEW.start_date
              ), 0)
              - COALESCE((
                SELECT SUM(other.quantity)
                FROM rental_requests AS other
                WHERE other.owner_business_id = NEW.owner_business_id
                  AND other.listing_id = NEW.listing_id
                  AND other.id != NEW.id
                  AND other.status IN ('Accepted', 'CheckedOut', 'Disputed')
                  AND other.start_date <= NEW.end_date
                  AND other.end_date >= NEW.start_date
              ), 0)
            FROM marketplace_listings AS listing
            JOIN inventory_items AS stock
              ON stock.id = listing.item_id
             AND stock.business_id = listing.business_id
            WHERE listing.id = NEW.listing_id
          ) THEN RAISE(ABORT, 'INSUFFICIENT_NETWORK_AVAILABILITY')
        END;
      END`),
    db.prepare("DROP TRIGGER IF EXISTS rental_requests_checkout_stock"),
    db.prepare(`CREATE TRIGGER rental_requests_checkout_stock
      BEFORE UPDATE OF status ON rental_requests
      WHEN NEW.status = 'CheckedOut' AND OLD.status = 'Accepted'
      BEGIN
        SELECT CASE WHEN NEW.quantity > (
          SELECT stock.available
          FROM marketplace_listings AS listing
          JOIN inventory_items AS stock
            ON stock.id = listing.item_id
           AND stock.business_id = listing.business_id
          WHERE listing.id = NEW.listing_id
            AND listing.business_id = NEW.owner_business_id
        ) THEN RAISE(ABORT, 'INSUFFICIENT_NETWORK_PHYSICAL_STOCK') END;
      END`),
  ]);

  const businessCount = await db
    .prepare("SELECT COUNT(*) AS count FROM businesses")
    .first<{ count: number }>();
  if (!businessCount?.count) {
    const legacyProfile = await db
      .prepare(
        "SELECT business_name AS businessName, handle FROM business_profile ORDER BY id LIMIT 1",
      )
      .first<{ businessName: string; handle: string }>();
    const legacyItems = await db
      .prepare("SELECT COUNT(*) AS count FROM inventory_items")
      .first<{ count: number }>();
    const legacyReservations = await db
      .prepare("SELECT COUNT(*) AS count FROM reservations")
      .first<{ count: number }>();
    if (legacyProfile || legacyItems?.count || legacyReservations?.count) {
      await db
        .prepare(
          "INSERT INTO businesses (id, name, handle, plan, created_at) VALUES (1, ?, ?, 'Network', ?)",
        )
        .bind(
          legacyProfile?.businessName || "Trove Studio",
          legacyProfile?.handle || "trove-studio",
          now(),
        )
        .run();
    }
  }
  await ensureBusinessSubscriptions();
}

async function uniqueHandle(base: string) {
  const clean = slugify(base);
  let candidate = clean;
  let suffix = 1;
  while (
    await env.DB.prepare("SELECT id FROM businesses WHERE handle = ?")
      .bind(candidate)
      .first()
  ) {
    suffix += 1;
    candidate = `${clean}-${suffix}`;
  }
  return candidate;
}

async function createBusinessForUser(userId: number, user: ChatGPTUser) {
  const nameBase = user.fullName || user.email.split("@")[0] || "Trove";
  const businessName = `${nameBase} Studio`;
  const handle = await uniqueHandle(businessName);
  const business = await env.DB.prepare(
    "INSERT INTO businesses (name, handle, plan, created_at) VALUES (?, ?, 'Basic', ?) RETURNING id",
  )
    .bind(businessName, handle, now())
    .first<{ id: number }>();
  if (!business) throw new Error("Unable to create business");
  const createdAt = now();
  const trialEnd = addDays(new Date(createdAt), 14).toISOString();

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO memberships (business_id, user_id, role, status, created_at) VALUES (?, ?, 'owner', 'Active', ?)",
    ).bind(business.id, userId, createdAt),
    env.DB.prepare(
      "INSERT INTO subscriptions (business_id, plan, status, amount, currency, current_period_start, current_period_end, cancel_at_period_end, provider, created_at, updated_at) VALUES (?, 'Basic', 'Trialing', ?, 'MZN', ?, ?, 0, 'PaySuite', ?, ?)",
    ).bind(business.id, PLAN_CATALOG.Basic.amount, createdAt, trialEnd, createdAt, createdAt),
    env.DB.prepare(
      "INSERT INTO business_profile (id, business_id, business_name, handle, bio, location, phone, email, color) VALUES (?, ?, ?, ?, '', 'Maputo, Moçambique', '', ?, '#b75d3f')",
    ).bind(Date.now(), business.id, businessName, handle, user.email),
    ...DEFAULT_CATEGORIES.map((name, index) =>
      env.DB.prepare(
        "INSERT INTO categories (id, business_id, name) VALUES (?, ?, ?)",
      ).bind(Date.now() + index + 1, business.id, name),
    ),
  ]);
}

async function resolveWorkspace(
  user: ChatGPTUser,
  requestedBusinessId?: number,
): Promise<WorkspaceContext> {
  await ensureWorkspaceDatabase();
  await env.DB.prepare(
    "INSERT INTO users (email, display_name, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name",
  )
    .bind(user.email.toLowerCase(), user.displayName, now())
    .run();
  const storedUser = await env.DB.prepare(
    "SELECT id FROM users WHERE email = ?",
  )
    .bind(user.email.toLowerCase())
    .first<{ id: number }>();
  if (!storedUser) throw new Error("Unable to resolve user");

  let memberships = await env.DB.prepare(
    "SELECT m.business_id AS businessId, m.role, b.name, b.handle, b.plan FROM memberships m JOIN businesses b ON b.id = m.business_id WHERE m.user_id = ? AND m.status = 'Active' ORDER BY m.id",
  )
    .bind(storedUser.id)
    .all<{
      businessId: number;
      role: WorkspaceRole;
      name: string;
      handle: string;
      plan: "Basic" | "Network";
    }>();

  if (!memberships.results.length) {
    const membershipCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM memberships WHERE status = 'Active'",
    ).first<{ count: number }>();
    const legacyBusiness = await env.DB.prepare(
      "SELECT id FROM businesses ORDER BY id LIMIT 1",
    ).first<{ id: number }>();
    if (!membershipCount?.count && legacyBusiness) {
      await env.DB.prepare(
        "INSERT INTO memberships (business_id, user_id, role, status, created_at) VALUES (?, ?, 'owner', 'Active', ?)",
      )
        .bind(legacyBusiness.id, storedUser.id, now())
        .run();
    } else {
      await createBusinessForUser(storedUser.id, user);
    }
    memberships = await env.DB.prepare(
      "SELECT m.business_id AS businessId, m.role, b.name, b.handle, b.plan FROM memberships m JOIN businesses b ON b.id = m.business_id WHERE m.user_id = ? AND m.status = 'Active' ORDER BY m.id",
    )
      .bind(storedUser.id)
      .all();
  }

  const membership =
    memberships.results.find(
      (entry: { businessId: number }) =>
        entry.businessId === requestedBusinessId,
    ) || memberships.results[0];
  if (!membership) throw new Error("No active workspace");
  await refreshSubscription(membership.businessId);
  const subscription = await env.DB.prepare(
    "SELECT status, current_period_end AS currentPeriodEnd, grace_until AS graceUntil, cancel_at_period_end AS cancelAtPeriodEnd FROM subscriptions WHERE business_id = ?",
  ).bind(membership.businessId).first<{
    status: SubscriptionStatus;
    currentPeriodEnd: string;
    graceUntil: string | null;
    cancelAtPeriodEnd: number;
  }>();
  if (!subscription) throw new Error("Unable to resolve subscription");

  const profile = await env.DB.prepare(
    "SELECT id FROM business_profile WHERE business_id = ?",
  )
    .bind(membership.businessId)
    .first();
  if (!profile) {
    await env.DB.prepare(
      "INSERT INTO business_profile (id, business_id, business_name, handle, bio, location, phone, email, color) VALUES (?, ?, ?, ?, '', 'Maputo, Moçambique', '', ?, '#b75d3f')",
    )
      .bind(
        Date.now(),
        membership.businessId,
        membership.name,
        membership.handle,
        user.email,
      )
      .run();
  }
  const categoryCount = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM categories WHERE business_id = ?",
  )
    .bind(membership.businessId)
    .first<{ count: number }>();
  if (!categoryCount?.count) {
    await env.DB.batch(
      DEFAULT_CATEGORIES.map((name, index) =>
        env.DB.prepare(
          "INSERT OR IGNORE INTO categories (id, business_id, name) VALUES (?, ?, ?)",
        ).bind(Date.now() + index + 1, membership.businessId, name),
      ),
    );
  }

  return {
    user,
    userId: storedUser.id,
    businessId: membership.businessId,
    businessName: membership.name,
    businessHandle: membership.handle,
    plan: membership.plan,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    graceUntil: subscription.graceUntil,
    cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
    role: normalizeRole(membership.role),
  };
}

export async function getWorkspaceContext(
  request: Request,
): Promise<WorkspaceContext | null> {
  const user = getUserFromHeaders(request.headers);
  if (!user) return null;
  const requested = Number(request.headers.get("x-trove-business-id") || "");
  return resolveWorkspace(
    user,
    Number.isSafeInteger(requested) ? requested : undefined,
  );
}

export function can(
  context: WorkspaceContext,
  permission: WorkspacePermission,
) {
  return PERMISSIONS[permission].includes(context.role);
}

export async function authorize(
  request: Request,
  permission: WorkspacePermission = "read",
): Promise<WorkspaceContext | Response> {
  const context = await getWorkspaceContext(request);
  if (!context) {
    return Response.json(
      { error: "Authentication required", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }
  if (!can(context, permission)) {
    return Response.json(
      { error: "You do not have permission for this action", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  if (
    !["read", "manageBilling"].includes(permission) &&
    !(
      context.subscriptionStatus === "Trialing" &&
      !paymentConfiguration().apiToken
    ) &&
    !subscriptionAllowsWrites(
      context.subscriptionStatus,
      context.currentPeriodEnd,
      context.graceUntil,
    )
  ) {
    return Response.json(
      {
        error: "An active subscription is required for this action",
        code: "SUBSCRIPTION_REQUIRED",
      },
      { status: 402 },
    );
  }
  return context;
}

export function isAuthorizationResponse(
  value: WorkspaceContext | Response,
): value is Response {
  return value instanceof Response;
}
