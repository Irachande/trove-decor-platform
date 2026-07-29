import { env } from "cloudflare:workers";
import { getUserFromHeaders, type ChatGPTUser } from "./chatgpt-auth";

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
  | "manageCategories"
  | "manageProfile"
  | "manageTeam";

export type WorkspaceContext = {
  user: ChatGPTUser;
  userId: number;
  businessId: number;
  businessName: string;
  businessHandle: string;
  plan: "Basic" | "Network";
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
  manageCategories: ["owner", "manager", "inventory"],
  manageProfile: ["owner", "manager"],
  manageTeam: ["owner", "manager"],
};

function now() {
  return new Date().toISOString();
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
      "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL, client_id INTEGER NOT NULL, name TEXT NOT NULL, venue TEXT NOT NULL DEFAULT '', start_date TEXT NOT NULL, end_date TEXT NOT NULL, setup_time TEXT NOT NULL DEFAULT '', pickup_time TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Planned', created_at TEXT NOT NULL)",
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
  ]);
  await addMissingColumns("collaborators", [
    { name: "business_id", sql: "business_id INTEGER NOT NULL DEFAULT 1" },
    { name: "invited_by_user_id", sql: "invited_by_user_id INTEGER" },
    { name: "created_at", sql: "created_at TEXT NOT NULL DEFAULT ''" },
  ]);
  await addMissingColumns("reservation_items", [
    { name: "currency", sql: "currency TEXT NOT NULL DEFAULT 'MZN'" },
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
      "CREATE INDEX IF NOT EXISTS reservation_items_business_item_idx ON reservation_items (business_id, item_id, reservation_id)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS reservation_items_reservation_item_idx ON reservation_items (reservation_id, item_id)",
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

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO memberships (business_id, user_id, role, status, created_at) VALUES (?, ?, 'owner', 'Active', ?)",
    ).bind(business.id, userId, now()),
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

  const invitations = await env.DB.prepare(
    "SELECT id, business_id AS businessId, role FROM collaborators WHERE lower(email) = ? AND status = 'Pending'",
  )
    .bind(user.email.toLowerCase())
    .all<{ id: number; businessId: number; role: string }>();
  for (const invite of invitations.results) {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO memberships (business_id, user_id, role, status, created_at) VALUES (?, ?, ?, 'Active', ?)",
      ).bind(
        invite.businessId,
        storedUser.id,
        normalizeRole(invite.role),
        now(),
      ),
      env.DB.prepare(
        "UPDATE collaborators SET status = 'Active' WHERE id = ? AND business_id = ?",
      ).bind(invite.id, invite.businessId),
    ]);
  }

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
  return context;
}

export function isAuthorizationResponse(
  value: WorkspaceContext | Response,
): value is Response {
  return value instanceof Response;
}
