import { env } from "cloudflare:workers";
import {
  authorize,
  isAuthorizationResponse,
  type WorkspacePermission,
} from "../../workspace";

type Payload = Record<string, unknown>;
type ImportedItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  available: number;
  status: string;
  price: number;
  currency: string;
  storageLocation: string;
  condition: string;
  description?: string;
  sku?: string;
  replacementValue?: number;
  minStock?: number;
  tone?: string;
  symbol?: string;
};

const ACTION_PERMISSIONS: Record<string, WorkspacePermission> = {
  addItem: "manageInventory",
  updateItem: "manageInventory",
  removeItem: "manageInventory",
  bulkStatus: "manageInventory",
  bulkRemove: "manageInventory",
  addItemPhotos: "manageInventory",
  removeItemPhoto: "manageInventory",
  adjustStock: "manageInventory",
  addMaintenance: "manageInventory",
  updateMaintenance: "manageInventory",
  createKit: "manageInventory",
  updateKit: "manageInventory",
  deleteKit: "manageInventory",
  importItems: "manageInventory",
  addReservation: "manageReservations",
  addCategory: "manageCategories",
  removeCategory: "manageCategories",
  inviteMember: "manageTeam",
  updateProfile: "manageProfile",
};

function text(
  payload: Payload,
  key: string,
  options: { required?: boolean; max?: number } = {},
) {
  const value = String(payload[key] ?? "").trim();
  if (options.required && !value) throw new Error(`${key} is required`);
  if (value.length > (options.max ?? 500)) throw new Error(`${key} is too long`);
  return value;
}

function integer(
  payload: Payload,
  key: string,
  options: { min?: number; max?: number } = {},
) {
  const value = Number(payload[key]);
  if (!Number.isSafeInteger(value)) throw new Error(`${key} must be an integer`);
  if (value < (options.min ?? Number.MIN_SAFE_INTEGER)) {
    throw new Error(`${key} is too small`);
  }
  if (value > (options.max ?? Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${key} is too large`);
  }
  return value;
}

function parseIds(payload: Payload) {
  const ids = String(payload.ids || "")
    .split(",")
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length || ids.length > 200) {
    throw new Error("Select between 1 and 200 items");
  }
  return [...new Set(ids)];
}

function clientError(error: unknown) {
  const message = error instanceof Error ? error.message : "Invalid request";
  const validation =
    /required|too long|too small|too large|must be|select between|invalid|not found|exceeds|duplicate/i.test(
      message,
    );
  return Response.json({ error: message }, { status: validation ? 400 : 500 });
}

function validateItem(input: Payload): ImportedItem {
  const id = integer(input, "id", { min: 1 });
  const quantity = integer(input, "quantity", { min: 1, max: 100000 });
  const available = integer(input, "available", { min: 0, max: quantity });
  const status = text(input, "status", { required: true, max: 30 });
  if (!["Available", "Reserved", "Rented"].includes(status)) {
    throw new Error("status is invalid");
  }
  return {
    id,
    name: text(input, "name", { required: true, max: 160 }),
    category: text(input, "category", { required: true, max: 80 }),
    quantity,
    available,
    status,
    price: integer(input, "price", { min: 0, max: 100000000 }),
    currency: text(input, "currency", { required: true, max: 3 }).toUpperCase(),
    storageLocation: text(input, "storageLocation", { max: 160 }),
    condition: text(input, "condition", { max: 80 }) || "Bom",
    description: text(input, "description", { max: 2000 }),
    sku: text(input, "sku", { max: 80 }),
    replacementValue: integer(
      { replacementValue: input.replacementValue ?? 0 },
      "replacementValue",
      { min: 0, max: 100000000 },
    ),
    minStock: integer({ minStock: input.minStock ?? 0 }, "minStock", {
      min: 0,
      max: 100000,
    }),
    tone: text(input, "tone", { max: 30 }) || "clay",
    symbol: text(input, "symbol", { max: 8 }) || "IT",
  };
}

function itemInsert(item: ImportedItem, businessId: number, photoUrl?: string) {
  return env.DB.prepare(
    "INSERT INTO inventory_items (id, business_id, name, category, quantity, available, status, tone, symbol, price, currency, photo_url, storage_location, condition, description, sku, replacement_value, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    item.id,
    businessId,
    item.name,
    item.category,
    item.quantity,
    item.available,
    item.status,
    item.tone,
    item.symbol,
    item.price,
    item.currency,
    photoUrl || null,
    item.storageLocation,
    item.condition,
    item.description || "",
    item.sku || "",
    item.replacementValue || 0,
    item.minStock || 0,
  );
}

async function deleteOwnedPhoto(url: string, businessId: number) {
  const key = new URL(url, "https://trove.local").searchParams.get("key");
  if (key?.startsWith(`businesses/${businessId}/items/`)) {
    await env.MEDIA.delete(key);
  }
}

export async function GET(request: Request) {
  try {
    const context = await authorize(request);
    if (isAuthorizationResponse(context)) return context;

    const [
      items,
      reservations,
      categories,
      profile,
      activeMembers,
      pendingMembers,
      photos,
      movements,
      maintenance,
      kits,
      kitItems,
    ] = await Promise.all([
      env.DB.prepare(
        "SELECT id, name, category, quantity, available, status, tone, symbol, price, currency, photo_url AS photoUrl, storage_location AS storageLocation, condition, description, sku, replacement_value AS replacementValue, min_stock AS minStock FROM inventory_items WHERE business_id = ? ORDER BY id DESC",
      ).bind(context.businessId).all(),
      env.DB.prepare(
        "SELECT id, item, client, date, end_date AS endDate, color, event_name AS eventName, contact, notes, quantity, status FROM reservations WHERE business_id = ? ORDER BY date",
      ).bind(context.businessId).all(),
      env.DB.prepare(
        "SELECT id, name FROM categories WHERE business_id = ? ORDER BY name",
      ).bind(context.businessId).all(),
      env.DB.prepare(
        "SELECT business_name AS businessName, handle, bio, location, phone, email, color, avatar_url AS avatarUrl FROM business_profile WHERE business_id = ?",
      ).bind(context.businessId).first(),
      env.DB.prepare(
        "SELECT u.id, u.email, u.display_name AS displayName, m.role, m.status FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.business_id = ? AND m.status = 'Active' ORDER BY m.id",
      ).bind(context.businessId).all(),
      env.DB.prepare(
        "SELECT id, email, role, status FROM collaborators WHERE business_id = ? AND status = 'Pending' ORDER BY id",
      ).bind(context.businessId).all(),
      env.DB.prepare(
        "SELECT id, item_id AS itemId, url, sort_order AS sortOrder FROM item_photos WHERE business_id = ? ORDER BY item_id, sort_order, id",
      ).bind(context.businessId).all(),
      env.DB.prepare(
        "SELECT id, item_id AS itemId, type, quantity_delta AS quantityDelta, note, created_at AS createdAt FROM inventory_movements WHERE business_id = ? ORDER BY created_at DESC LIMIT 500",
      ).bind(context.businessId).all(),
      env.DB.prepare(
        "SELECT id, item_id AS itemId, type, status, notes, cost, scheduled_date AS scheduledDate, completed_at AS completedAt, created_at AS createdAt FROM maintenance_records WHERE business_id = ? ORDER BY created_at DESC",
      ).bind(context.businessId).all(),
      env.DB.prepare(
        "SELECT id, name, description, price, currency, active, created_at AS createdAt FROM kits WHERE business_id = ? ORDER BY created_at DESC",
      ).bind(context.businessId).all(),
      env.DB.prepare(
        "SELECT id, kit_id AS kitId, item_id AS itemId, quantity FROM kit_items WHERE business_id = ? ORDER BY kit_id, id",
      ).bind(context.businessId).all(),
    ]);

    return Response.json({
      items: items.results,
      reservations: reservations.results,
      categories: categories.results,
      profile,
      members: [...activeMembers.results, ...pendingMembers.results],
      photos: photos.results,
      movements: movements.results,
      maintenance: maintenance.results,
      kits: kits.results.map((kit: Record<string, unknown>) => ({
        ...kit,
        active: Boolean(kit.active),
        items: kitItems.results.filter(
          (entry: Record<string, unknown>) => entry.kitId === kit.id,
        ),
      })),
      user: context.user,
      workspace: {
        id: context.businessId,
        name: context.businessName,
        handle: context.businessHandle,
        role: context.role,
        plan: context.plan,
      },
    });
  } catch (error) {
    return clientError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: string; payload?: Payload };
    const action = String(body.action || "");
    const payload = body.payload || {};
    const permission = ACTION_PERMISSIONS[action];
    if (!permission) {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }
    const context = await authorize(request, permission);
    if (isAuthorizationResponse(context)) return context;
    const createdAt = new Date().toISOString();

    if (action === "addItem") {
      const item = validateItem(payload);
      const photoUrl = text(payload, "photoUrl", { max: 1000 });
      await env.DB.batch([
        itemInsert(item, context.businessId, photoUrl),
        env.DB.prepare(
          "INSERT INTO inventory_movements (id, business_id, item_id, type, quantity_delta, note, created_by_user_id, created_at) VALUES (?, ?, ?, 'initial', ?, ?, ?, ?)",
        ).bind(Date.now() + 1, context.businessId, item.id, item.quantity, "Stock inicial", context.userId, createdAt),
        ...(photoUrl
          ? [env.DB.prepare(
            "INSERT INTO item_photos (id, business_id, item_id, url, sort_order, created_at) VALUES (?, ?, ?, ?, 0, ?)",
          ).bind(Date.now() + 2, context.businessId, item.id, photoUrl, createdAt)]
          : []),
      ]);
    } else if (action === "updateItem") {
      const item = validateItem(payload);
      const existing = await env.DB.prepare(
        "SELECT quantity, available FROM inventory_items WHERE id = ? AND business_id = ?",
      ).bind(item.id, context.businessId).first<{ quantity: number; available: number }>();
      if (!existing) throw new Error("Item not found");
      const delta = item.quantity - existing.quantity;
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE inventory_items SET name = ?, category = ?, quantity = ?, available = ?, status = ?, price = ?, currency = ?, storage_location = ?, condition = ?, description = ?, sku = ?, replacement_value = ?, min_stock = ?, tone = ?, symbol = ? WHERE id = ? AND business_id = ?",
        ).bind(item.name, item.category, item.quantity, item.available, item.status, item.price, item.currency, item.storageLocation, item.condition, item.description || "", item.sku || "", item.replacementValue || 0, item.minStock || 0, item.tone, item.symbol, item.id, context.businessId),
        ...(delta
          ? [env.DB.prepare(
            "INSERT INTO inventory_movements (id, business_id, item_id, type, quantity_delta, note, created_by_user_id, created_at) VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?)",
          ).bind(Date.now(), context.businessId, item.id, delta, "Quantidade actualizada na ficha", context.userId, createdAt)]
          : []),
      ]);
    } else if (action === "removeItem") {
      const itemId = integer(payload, "id", { min: 1 });
      const storedPhotos = await env.DB.prepare(
        "SELECT url FROM item_photos WHERE item_id = ? AND business_id = ?",
      ).bind(itemId, context.businessId).all<{ url: string }>();
      await env.DB.batch([
        env.DB.prepare("DELETE FROM item_photos WHERE item_id = ? AND business_id = ?").bind(itemId, context.businessId),
        env.DB.prepare("DELETE FROM inventory_movements WHERE item_id = ? AND business_id = ?").bind(itemId, context.businessId),
        env.DB.prepare("DELETE FROM maintenance_records WHERE item_id = ? AND business_id = ?").bind(itemId, context.businessId),
        env.DB.prepare("DELETE FROM kit_items WHERE item_id = ? AND business_id = ?").bind(itemId, context.businessId),
        env.DB.prepare("DELETE FROM inventory_items WHERE id = ? AND business_id = ?").bind(itemId, context.businessId),
      ]);
      await Promise.all(storedPhotos.results.map((photo: { url: string }) => deleteOwnedPhoto(photo.url, context.businessId)));
    } else if (action === "bulkStatus" || action === "bulkRemove") {
      const ids = parseIds(payload);
      const placeholders = ids.map(() => "?").join(",");
      if (action === "bulkStatus") {
        const status = text(payload, "status", { required: true, max: 30 });
        await env.DB.prepare(
          `UPDATE inventory_items SET status = ? WHERE business_id = ? AND id IN (${placeholders})`,
        ).bind(status, context.businessId, ...ids).run();
      } else {
        const storedPhotos = await env.DB.prepare(
          `SELECT url FROM item_photos WHERE business_id = ? AND item_id IN (${placeholders})`,
        ).bind(context.businessId, ...ids).all<{ url: string }>();
        await env.DB.batch([
          env.DB.prepare(`DELETE FROM item_photos WHERE business_id = ? AND item_id IN (${placeholders})`).bind(context.businessId, ...ids),
          env.DB.prepare(`DELETE FROM inventory_movements WHERE business_id = ? AND item_id IN (${placeholders})`).bind(context.businessId, ...ids),
          env.DB.prepare(`DELETE FROM maintenance_records WHERE business_id = ? AND item_id IN (${placeholders})`).bind(context.businessId, ...ids),
          env.DB.prepare(`DELETE FROM kit_items WHERE business_id = ? AND item_id IN (${placeholders})`).bind(context.businessId, ...ids),
          env.DB.prepare(`DELETE FROM inventory_items WHERE business_id = ? AND id IN (${placeholders})`).bind(context.businessId, ...ids),
        ]);
        await Promise.all(storedPhotos.results.map((photo: { url: string }) => deleteOwnedPhoto(photo.url, context.businessId)));
      }
    } else if (action === "addItemPhotos") {
      const itemId = integer(payload, "itemId", { min: 1 });
      const exists = await env.DB.prepare(
        "SELECT id FROM inventory_items WHERE id = ? AND business_id = ?",
      ).bind(itemId, context.businessId).first();
      if (!exists) throw new Error("Item not found");
      const urls = Array.isArray(payload.urls)
        ? payload.urls.map(String).map((url) => url.trim()).filter(Boolean)
        : [];
      if (!urls.length || urls.length > 8 || urls.some((url) => url.length > 1000)) {
        throw new Error("photos are invalid");
      }
      const count = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM item_photos WHERE item_id = ? AND business_id = ?",
      ).bind(itemId, context.businessId).first<{ count: number }>();
      if ((count?.count || 0) + urls.length > 8) throw new Error("photos exceeds limit");
      await env.DB.batch(urls.map((url, index) =>
        env.DB.prepare(
          "INSERT INTO item_photos (id, business_id, item_id, url, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).bind(Date.now() + index, context.businessId, itemId, url, (count?.count || 0) + index, createdAt),
      ));
      await env.DB.prepare(
        "UPDATE inventory_items SET photo_url = COALESCE(photo_url, ?) WHERE id = ? AND business_id = ?",
      ).bind(urls[0], itemId, context.businessId).run();
    } else if (action === "removeItemPhoto") {
      const photoId = integer(payload, "id", { min: 1 });
      const photo = await env.DB.prepare(
        "SELECT item_id AS itemId, url FROM item_photos WHERE id = ? AND business_id = ?",
      ).bind(photoId, context.businessId).first<{ itemId: number; url: string }>();
      if (!photo) throw new Error("Photo not found");
      await env.DB.prepare("DELETE FROM item_photos WHERE id = ? AND business_id = ?")
        .bind(photoId, context.businessId).run();
      const next = await env.DB.prepare(
        "SELECT url FROM item_photos WHERE item_id = ? AND business_id = ? ORDER BY sort_order, id LIMIT 1",
      ).bind(photo.itemId, context.businessId).first<{ url: string }>();
      await env.DB.prepare(
        "UPDATE inventory_items SET photo_url = ? WHERE id = ? AND business_id = ?",
      ).bind(next?.url || null, photo.itemId, context.businessId).run();
      await deleteOwnedPhoto(photo.url, context.businessId);
    } else if (action === "adjustStock") {
      const itemId = integer(payload, "itemId", { min: 1 });
      const delta = integer(payload, "delta", { min: -100000, max: 100000 });
      if (!delta) throw new Error("delta must be different from zero");
      const item = await env.DB.prepare(
        "SELECT quantity, available FROM inventory_items WHERE id = ? AND business_id = ?",
      ).bind(itemId, context.businessId).first<{ quantity: number; available: number }>();
      if (!item) throw new Error("Item not found");
      if (item.quantity + delta < 0 || item.available + delta < 0) {
        throw new Error("Adjustment exceeds available stock");
      }
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE inventory_items SET quantity = quantity + ?, available = available + ? WHERE id = ? AND business_id = ?",
        ).bind(delta, delta, itemId, context.businessId),
        env.DB.prepare(
          "INSERT INTO inventory_movements (id, business_id, item_id, type, quantity_delta, note, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(integer(payload, "id", { min: 1 }), context.businessId, itemId, text(payload, "type", { required: true, max: 30 }), delta, text(payload, "note", { max: 500 }), context.userId, createdAt),
      ]);
    } else if (action === "addMaintenance") {
      const itemId = integer(payload, "itemId", { min: 1 });
      const exists = await env.DB.prepare(
        "SELECT id FROM inventory_items WHERE id = ? AND business_id = ?",
      ).bind(itemId, context.businessId).first();
      if (!exists) throw new Error("Item not found");
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO maintenance_records (id, business_id, item_id, type, status, notes, cost, scheduled_date, completed_at, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
        ).bind(integer(payload, "id", { min: 1 }), context.businessId, itemId, text(payload, "type", { required: true, max: 40 }), text(payload, "status", { required: true, max: 30 }), text(payload, "notes", { max: 2000 }), integer(payload, "cost", { min: 0, max: 100000000 }), text(payload, "scheduledDate", { max: 10 }), context.userId, createdAt),
        env.DB.prepare(
          "UPDATE inventory_items SET condition = ? WHERE id = ? AND business_id = ?",
        ).bind(text(payload, "condition", { max: 80 }) || "Em manutenção", itemId, context.businessId),
      ]);
    } else if (action === "updateMaintenance") {
      const id = integer(payload, "id", { min: 1 });
      const status = text(payload, "status", { required: true, max: 30 });
      await env.DB.prepare(
        "UPDATE maintenance_records SET status = ?, completed_at = ? WHERE id = ? AND business_id = ?",
      ).bind(status, status === "Completed" ? createdAt : null, id, context.businessId).run();
    } else if (action === "createKit" || action === "updateKit") {
      const kitId = integer(payload, "id", { min: 1 });
      const name = text(payload, "name", { required: true, max: 160 });
      const kitEntries = Array.isArray(payload.items) ? payload.items : [];
      if (!kitEntries.length || kitEntries.length > 100) {
        throw new Error("Kit items are required");
      }
      const normalized = kitEntries.map((entry) => {
        const value = entry as Payload;
        return {
          itemId: integer(value, "itemId", { min: 1 }),
          quantity: integer(value, "quantity", { min: 1, max: 100000 }),
        };
      });
      if (new Set(normalized.map((entry) => entry.itemId)).size !== normalized.length) {
        throw new Error("Duplicate kit item");
      }
      const placeholders = normalized.map(() => "?").join(",");
      const owned = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM inventory_items WHERE business_id = ? AND id IN (${placeholders})`,
      ).bind(context.businessId, ...normalized.map((entry) => entry.itemId)).first<{ count: number }>();
      if (owned?.count !== normalized.length) throw new Error("Kit item not found");
      const kitStatement = action === "createKit"
        ? env.DB.prepare(
          "INSERT INTO kits (id, business_id, name, description, price, currency, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
        ).bind(kitId, context.businessId, name, text(payload, "description", { max: 1000 }), integer(payload, "price", { min: 0, max: 100000000 }), text(payload, "currency", { required: true, max: 3 }).toUpperCase(), createdAt)
        : env.DB.prepare(
          "UPDATE kits SET name = ?, description = ?, price = ?, currency = ?, active = ? WHERE id = ? AND business_id = ?",
        ).bind(name, text(payload, "description", { max: 1000 }), integer(payload, "price", { min: 0, max: 100000000 }), text(payload, "currency", { required: true, max: 3 }).toUpperCase(), payload.active === false ? 0 : 1, kitId, context.businessId);
      await env.DB.batch([
        kitStatement,
        env.DB.prepare("DELETE FROM kit_items WHERE kit_id = ? AND business_id = ?").bind(kitId, context.businessId),
        ...normalized.map((entry, index) =>
          env.DB.prepare(
            "INSERT INTO kit_items (id, business_id, kit_id, item_id, quantity) VALUES (?, ?, ?, ?, ?)",
          ).bind(Date.now() + index, context.businessId, kitId, entry.itemId, entry.quantity),
        ),
      ]);
    } else if (action === "deleteKit") {
      const id = integer(payload, "id", { min: 1 });
      await env.DB.batch([
        env.DB.prepare("DELETE FROM kit_items WHERE kit_id = ? AND business_id = ?").bind(id, context.businessId),
        env.DB.prepare("DELETE FROM kits WHERE id = ? AND business_id = ?").bind(id, context.businessId),
      ]);
    } else if (action === "importItems") {
      const rawItems = Array.isArray(payload.items) ? payload.items : [];
      if (!rawItems.length || rawItems.length > 500) {
        throw new Error("Import must have between 1 and 500 items");
      }
      const imported = rawItems.map((entry) => validateItem(entry as Payload));
      const ids = imported.map((item) => item.id);
      if (new Set(ids).size !== ids.length) throw new Error("Duplicate imported item id");
      await env.DB.batch(imported.flatMap((item, index) => [
        itemInsert(item, context.businessId),
        env.DB.prepare(
          "INSERT INTO inventory_movements (id, business_id, item_id, type, quantity_delta, note, created_by_user_id, created_at) VALUES (?, ?, ?, 'import', ?, ?, ?, ?)",
        ).bind(Date.now() + index, context.businessId, item.id, item.quantity, "Importação de inventário", context.userId, createdAt),
        env.DB.prepare(
          "INSERT OR IGNORE INTO categories (id, business_id, name) VALUES (?, ?, ?)",
        ).bind(Date.now() + 1000 + index, context.businessId, item.category),
      ]));
    } else if (action === "addReservation") {
      const start = text(payload, "date", { required: true, max: 10 });
      const end = text(payload, "endDate", { required: true, max: 10 });
      if (end < start) throw new Error("End date must follow start date");
      await env.DB.prepare(
        "INSERT INTO reservations (id, business_id, item, client, date, end_date, color, event_name, contact, notes, quantity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(integer(payload, "id", { min: 1 }), context.businessId, text(payload, "item", { required: true, max: 240 }), text(payload, "client", { required: true, max: 160 }), start, end, text(payload, "color", { max: 20 }) || "#b75d3f", text(payload, "eventName", { max: 180 }), text(payload, "contact", { max: 180 }), text(payload, "notes", { max: 2000 }), integer(payload, "quantity", { min: 1, max: 100000 }), text(payload, "status", { max: 30 }) || "Confirmed").run();
    } else if (action === "addCategory") {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO categories (id, business_id, name) VALUES (?, ?, ?)",
      ).bind(integer(payload, "id", { min: 1 }), context.businessId, text(payload, "name", { required: true, max: 80 })).run();
    } else if (action === "removeCategory") {
      const name = text(payload, "name", { required: true, max: 80 });
      const fallback = text(payload, "fallback", { required: true, max: 80 });
      await env.DB.batch([
        env.DB.prepare("UPDATE inventory_items SET category = ? WHERE business_id = ? AND category = ?").bind(fallback, context.businessId, name),
        env.DB.prepare("DELETE FROM categories WHERE business_id = ? AND name = ?").bind(context.businessId, name),
        env.DB.prepare("INSERT OR IGNORE INTO categories (id, business_id, name) VALUES (?, ?, ?)").bind(Date.now(), context.businessId, fallback),
      ]);
    } else if (action === "inviteMember") {
      const email = text(payload, "email", { required: true, max: 254 }).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email address");
      if (email === context.user.email) throw new Error("You already belong to this business");
      const role = text(payload, "role", { required: true, max: 40 });
      await env.DB.batch([
        env.DB.prepare("DELETE FROM collaborators WHERE business_id = ? AND lower(email) = ? AND status = 'Pending'").bind(context.businessId, email),
        env.DB.prepare("INSERT INTO collaborators (id, business_id, email, role, status, invited_by_user_id, created_at) VALUES (?, ?, ?, ?, 'Pending', ?, ?)").bind(integer(payload, "id", { min: 1 }), context.businessId, email, role, context.userId, createdAt),
      ]);
    } else if (action === "updateProfile") {
      const businessName = text(payload, "businessName", { required: true, max: 120 });
      const handle = text(payload, "handle", { required: true, max: 60 }).toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!handle) throw new Error("Invalid profile handle");
      await env.DB.batch([
        env.DB.prepare("UPDATE business_profile SET business_name = ?, handle = ?, bio = ?, location = ?, phone = ?, email = ?, color = ?, avatar_url = ? WHERE business_id = ?").bind(businessName, handle, text(payload, "bio", { max: 1000 }), text(payload, "location", { max: 160 }), text(payload, "phone", { max: 80 }), text(payload, "email", { max: 254 }), text(payload, "color", { max: 20 }) || "#b75d3f", text(payload, "avatarUrl", { max: 1000 }) || null, context.businessId),
        env.DB.prepare("UPDATE businesses SET name = ?, handle = ? WHERE id = ?").bind(businessName, handle, context.businessId),
      ]);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return clientError(error);
  }
}
