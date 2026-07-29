import { env } from "cloudflare:workers";
import {
  authorize,
  isAuthorizationResponse,
  type WorkspacePermission,
} from "../../workspace";

type Payload = Record<string, string | number | null | undefined>;

const ACTION_PERMISSIONS: Record<string, WorkspacePermission> = {
  addItem: "manageInventory",
  removeItem: "manageInventory",
  bulkStatus: "manageInventory",
  bulkRemove: "manageInventory",
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
  if (options.required && !value) {
    throw new Error(`${key} is required`);
  }
  if (value.length > (options.max ?? 500)) {
    throw new Error(`${key} is too long`);
  }
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
    /required|too long|too small|too large|must be|select between|invalid/i.test(
      message,
    );
  return Response.json(
    { error: message },
    { status: validation ? 400 : 500 },
  );
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
    ] = await Promise.all([
      env.DB.prepare(
        "SELECT id, name, category, quantity, available, status, tone, symbol, price, currency, photo_url AS photoUrl, storage_location AS storageLocation, condition FROM inventory_items WHERE business_id = ? ORDER BY id",
      )
        .bind(context.businessId)
        .all(),
      env.DB.prepare(
        "SELECT id, item, client, date, end_date AS endDate, color, event_name AS eventName, contact, notes, quantity, status FROM reservations WHERE business_id = ? ORDER BY date",
      )
        .bind(context.businessId)
        .all(),
      env.DB.prepare(
        "SELECT id, name FROM categories WHERE business_id = ? ORDER BY name",
      )
        .bind(context.businessId)
        .all(),
      env.DB.prepare(
        "SELECT business_name AS businessName, handle, bio, location, phone, email, color, avatar_url AS avatarUrl FROM business_profile WHERE business_id = ?",
      )
        .bind(context.businessId)
        .first(),
      env.DB.prepare(
        "SELECT u.id, u.email, u.display_name AS displayName, m.role, m.status FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.business_id = ? AND m.status = 'Active' ORDER BY m.id",
      )
        .bind(context.businessId)
        .all(),
      env.DB.prepare(
        "SELECT id, email, role, status FROM collaborators WHERE business_id = ? AND status = 'Pending' ORDER BY id",
      )
        .bind(context.businessId)
        .all(),
    ]);

    return Response.json({
      items: items.results,
      reservations: reservations.results,
      categories: categories.results,
      profile,
      members: [...activeMembers.results, ...pendingMembers.results],
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
    const body = (await request.json()) as {
      action?: string;
      payload?: Payload;
    };
    const action = String(body.action || "");
    const payload = body.payload || {};
    const permission = ACTION_PERMISSIONS[action];
    if (!permission) {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    const context = await authorize(request, permission);
    if (isAuthorizationResponse(context)) return context;

    if (action === "addItem") {
      const id = integer(payload, "id", { min: 1 });
      const name = text(payload, "name", { required: true, max: 160 });
      const category = text(payload, "category", {
        required: true,
        max: 80,
      });
      const quantity = integer(payload, "quantity", { min: 1, max: 100000 });
      const available = integer(payload, "available", {
        min: 0,
        max: quantity,
      });
      const price = integer(payload, "price", { min: 0, max: 100000000 });
      const currency = text(payload, "currency", {
        required: true,
        max: 3,
      }).toUpperCase();
      await env.DB.prepare(
        "INSERT INTO inventory_items (id, business_id, name, category, quantity, available, status, tone, symbol, price, currency, photo_url, storage_location, condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          id,
          context.businessId,
          name,
          category,
          quantity,
          available,
          text(payload, "status", { required: true, max: 30 }),
          text(payload, "tone", { max: 30 }) || "clay",
          text(payload, "symbol", { max: 8 }) || "IT",
          price,
          currency,
          text(payload, "photoUrl", { max: 1000 }) || null,
          text(payload, "storageLocation", { max: 160 }),
          text(payload, "condition", { max: 80 }) || "Bom",
        )
        .run();
    } else if (action === "removeItem") {
      await env.DB.prepare(
        "DELETE FROM inventory_items WHERE id = ? AND business_id = ?",
      )
        .bind(integer(payload, "id", { min: 1 }), context.businessId)
        .run();
    } else if (action === "bulkStatus" || action === "bulkRemove") {
      const ids = parseIds(payload);
      const placeholders = ids.map(() => "?").join(",");
      if (action === "bulkStatus") {
        const status = text(payload, "status", {
          required: true,
          max: 30,
        });
        await env.DB.prepare(
          `UPDATE inventory_items SET status = ? WHERE business_id = ? AND id IN (${placeholders})`,
        )
          .bind(status, context.businessId, ...ids)
          .run();
      } else {
        await env.DB.prepare(
          `DELETE FROM inventory_items WHERE business_id = ? AND id IN (${placeholders})`,
        )
          .bind(context.businessId, ...ids)
          .run();
      }
    } else if (action === "addReservation") {
      const start = text(payload, "date", { required: true, max: 10 });
      const end = text(payload, "endDate", { required: true, max: 10 });
      if (end < start) throw new Error("End date must follow start date");
      await env.DB.prepare(
        "INSERT INTO reservations (id, business_id, item, client, date, end_date, color, event_name, contact, notes, quantity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          integer(payload, "id", { min: 1 }),
          context.businessId,
          text(payload, "item", { required: true, max: 240 }),
          text(payload, "client", { required: true, max: 160 }),
          start,
          end,
          text(payload, "color", { max: 20 }) || "#b75d3f",
          text(payload, "eventName", { max: 180 }),
          text(payload, "contact", { max: 180 }),
          text(payload, "notes", { max: 2000 }),
          integer(payload, "quantity", { min: 1, max: 100000 }),
          text(payload, "status", { max: 30 }) || "Confirmed",
        )
        .run();
    } else if (action === "addCategory") {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO categories (id, business_id, name) VALUES (?, ?, ?)",
      )
        .bind(
          integer(payload, "id", { min: 1 }),
          context.businessId,
          text(payload, "name", { required: true, max: 80 }),
        )
        .run();
    } else if (action === "removeCategory") {
      const name = text(payload, "name", { required: true, max: 80 });
      const fallback = text(payload, "fallback", {
        required: true,
        max: 80,
      });
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE inventory_items SET category = ? WHERE business_id = ? AND category = ?",
        ).bind(fallback, context.businessId, name),
        env.DB.prepare(
          "DELETE FROM categories WHERE business_id = ? AND name = ?",
        ).bind(context.businessId, name),
        env.DB.prepare(
          "INSERT OR IGNORE INTO categories (id, business_id, name) VALUES (?, ?, ?)",
        ).bind(Date.now(), context.businessId, fallback),
      ]);
    } else if (action === "inviteMember") {
      const email = text(payload, "email", {
        required: true,
        max: 254,
      }).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Invalid email address");
      }
      if (email === context.user.email) {
        throw new Error("You already belong to this business");
      }
      const role = text(payload, "role", { required: true, max: 40 });
      await env.DB.prepare(
        "DELETE FROM collaborators WHERE business_id = ? AND lower(email) = ? AND status = 'Pending'",
      )
        .bind(context.businessId, email)
        .run();
      await env.DB.prepare(
        "INSERT INTO collaborators (id, business_id, email, role, status, invited_by_user_id, created_at) VALUES (?, ?, ?, ?, 'Pending', ?, ?)",
      )
        .bind(
          integer(payload, "id", { min: 1 }),
          context.businessId,
          email,
          role,
          context.userId,
          new Date().toISOString(),
        )
        .run();
    } else if (action === "updateProfile") {
      const businessName = text(payload, "businessName", {
        required: true,
        max: 120,
      });
      const handle = text(payload, "handle", {
        required: true,
        max: 60,
      })
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "");
      if (!handle) throw new Error("Invalid profile handle");
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE business_profile SET business_name = ?, handle = ?, bio = ?, location = ?, phone = ?, email = ?, color = ?, avatar_url = ? WHERE business_id = ?",
        ).bind(
          businessName,
          handle,
          text(payload, "bio", { max: 1000 }),
          text(payload, "location", { max: 160 }),
          text(payload, "phone", { max: 80 }),
          text(payload, "email", { max: 254 }),
          text(payload, "color", { max: 20 }) || "#b75d3f",
          text(payload, "avatarUrl", { max: 1000 }) || null,
          context.businessId,
        ),
        env.DB.prepare(
          "UPDATE businesses SET name = ?, handle = ? WHERE id = ?",
        ).bind(businessName, handle, context.businessId),
      ]);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return clientError(error);
  }
}
