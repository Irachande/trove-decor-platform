import { env } from "cloudflare:workers";

const starterItems = [
  [1, "Bentwood dining chair", "Furniture", 48, 36, "Reserved", "sand", "BC"],
  [2, "Amber bud vase", "Tabletop", 72, 72, "Available", "amber", "AV"],
  [3, "Linen napkin · Sage", "Textiles", 120, 84, "Rented", "sage", "LN"],
  [4, "Rattan lantern · Large", "Lighting", 18, 14, "Reserved", "clay", "RL"],
  [5, "Fluted plinth · Ivory", "Structures", 8, 8, "Available", "ivory", "FP"],
  [6, "Stone candle holder", "Tabletop", 34, 28, "Available", "stone", "SC"],
] as const;

async function ensureDatabase() {
  const db = env.DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, quantity INTEGER NOT NULL, available INTEGER NOT NULL, status TEXT NOT NULL, tone TEXT NOT NULL, symbol TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY, item TEXT NOT NULL, client TEXT NOT NULL, date TEXT NOT NULL, end_date TEXT NOT NULL, color TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS business_profile (id INTEGER PRIMARY KEY, business_name TEXT NOT NULL, handle TEXT NOT NULL, bio TEXT NOT NULL, location TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, color TEXT NOT NULL, avatar_url TEXT)"),
  ]);

  const count = await db.prepare("SELECT COUNT(*) AS count FROM inventory_items").first<{ count: number }>();
  if (!count?.count) {
    await db.batch(starterItems.map((item) =>
      db.prepare("INSERT INTO inventory_items (id, name, category, quantity, available, status, tone, symbol) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(...item),
    ));
  }
  const profileCount = await db.prepare("SELECT COUNT(*) AS count FROM business_profile").first<{ count: number }>();
  if (!profileCount?.count) {
    await db.prepare("INSERT INTO business_profile (id, business_name, handle, bio, location, phone, email, color) VALUES (1, ?, ?, ?, ?, ?, ?, ?)")
      .bind("Terra & Table", "terraandtable", "Warm, considered event styling and soulful tablescapes for weddings and intimate gatherings.", "Maputo, Mozambique", "+258 84 555 0192", "hello@terraandtable.co", "#b75d3f")
      .run();
  }
}

export async function GET() {
  try {
    await ensureDatabase();
    const [items, reservations, profile] = await Promise.all([
      env.DB.prepare("SELECT * FROM inventory_items ORDER BY id").all(),
      env.DB.prepare("SELECT id, item, client, date, end_date AS endDate, color FROM reservations ORDER BY date").all(),
      env.DB.prepare("SELECT business_name AS businessName, handle, bio, location, phone, email, color, avatar_url AS avatarUrl FROM business_profile WHERE id = 1").first(),
    ]);
    return Response.json({ items: items.results, reservations: reservations.results, profile });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load workspace" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const { action, payload } = await request.json() as { action: string; payload: Record<string, string | number> };
    if (action === "addItem") {
      await env.DB.prepare("INSERT INTO inventory_items (id, name, category, quantity, available, status, tone, symbol) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(payload.id, payload.name, payload.category, payload.quantity, payload.available, payload.status, payload.tone, payload.symbol).run();
    } else if (action === "removeItem") {
      await env.DB.prepare("DELETE FROM inventory_items WHERE id = ?").bind(payload.id).run();
    } else if (action === "addReservation") {
      await env.DB.prepare("INSERT INTO reservations (id, item, client, date, end_date, color) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(payload.id, payload.item, payload.client, payload.date, payload.endDate, payload.color).run();
    } else if (action === "updateProfile") {
      await env.DB.prepare("UPDATE business_profile SET business_name = ?, handle = ?, bio = ?, location = ?, phone = ?, email = ?, color = ?, avatar_url = ? WHERE id = 1")
        .bind(payload.businessName, payload.handle, payload.bio, payload.location, payload.phone, payload.email, payload.color, payload.avatarUrl || null).run();
    } else {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save change" }, { status: 500 });
  }
}
