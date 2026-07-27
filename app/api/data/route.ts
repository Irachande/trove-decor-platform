import { env } from "cloudflare:workers";

const starterItems = [
  [1, "Cadeira Bentwood", "Mobiliário", 48, 36, "Reserved", "sand", "CB", 650, "MZN", "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=80", "Corredor A · Prateleira 2", "Excelente"],
  [2, "Jarra âmbar pequena", "Mesa", 72, 72, "Available", "amber", "JA", 180, "MZN", "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=80", "Corredor C · Caixa 14", "Bom"],
  [3, "Guardanapo de linho · Sálvia", "Têxteis", 120, 84, "Rented", "sage", "GL", 75, "MZN", "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=80", "Corredor B · Caixa 6", "Excelente"],
  [4, "Lanterna de rattan · Grande", "Iluminação", 18, 14, "Reserved", "clay", "LR", 900, "MZN", "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80", "Corredor D · Chão 3", "Bom"],
  [5, "Plinto canelado · Marfim", "Estruturas", 8, 8, "Available", "ivory", "PC", 2500, "MZN", "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=900&q=80", "Zona E · Posição 5", "Excelente"],
  [6, "Castiçal de pedra", "Mesa", 34, 28, "Available", "stone", "CP", 220, "MZN", "https://images.unsplash.com/photo-1602874801006-e26b7af32e9f?auto=format&fit=crop&w=900&q=80", "Corredor C · Caixa 9", "Requer inspecção"],
] as const;

const starterCategories = ["Mobiliário", "Mesa", "Têxteis", "Iluminação", "Estruturas"];

async function addMissingColumns(table: string, columns: { name: string; sql: string }[]) {
  const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  const names = new Set(result.results.map((column: { name: string }) => column.name));
  for (const column of columns) {
    if (!names.has(column.name)) await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column.sql}`).run();
  }
}

async function ensureDatabase() {
  const db = env.DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, quantity INTEGER NOT NULL, available INTEGER NOT NULL, status TEXT NOT NULL, tone TEXT NOT NULL, symbol TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'MZN', photo_url TEXT, storage_location TEXT NOT NULL DEFAULT '', condition TEXT NOT NULL DEFAULT 'Bom')"),
    db.prepare("CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY, item TEXT NOT NULL, client TEXT NOT NULL, date TEXT NOT NULL, end_date TEXT NOT NULL, color TEXT NOT NULL, event_name TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'Confirmed')"),
    db.prepare("CREATE TABLE IF NOT EXISTS business_profile (id INTEGER PRIMARY KEY, business_name TEXT NOT NULL, handle TEXT NOT NULL, bio TEXT NOT NULL, location TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, color TEXT NOT NULL, avatar_url TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)"),
    db.prepare("CREATE TABLE IF NOT EXISTS collaborators (id INTEGER PRIMARY KEY, email TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending')"),
  ]);
  await addMissingColumns("inventory_items", [
    { name: "price", sql: "price INTEGER NOT NULL DEFAULT 0" },
    { name: "currency", sql: "currency TEXT NOT NULL DEFAULT 'MZN'" },
    { name: "photo_url", sql: "photo_url TEXT" },
    { name: "storage_location", sql: "storage_location TEXT NOT NULL DEFAULT ''" },
    { name: "condition", sql: "condition TEXT NOT NULL DEFAULT 'Bom'" },
  ]);
  await addMissingColumns("reservations", [
    { name: "event_name", sql: "event_name TEXT NOT NULL DEFAULT ''" },
    { name: "contact", sql: "contact TEXT NOT NULL DEFAULT ''" },
    { name: "notes", sql: "notes TEXT NOT NULL DEFAULT ''" },
    { name: "quantity", sql: "quantity INTEGER NOT NULL DEFAULT 1" },
    { name: "status", sql: "status TEXT NOT NULL DEFAULT 'Confirmed'" },
  ]);
  await db.batch([
    db.prepare("UPDATE inventory_items SET price = 650, currency = 'MZN', photo_url = ?, storage_location = 'Corredor A · Prateleira 2', condition = 'Excelente' WHERE id = 1 AND price = 0").bind(starterItems[0][10]),
    db.prepare("UPDATE inventory_items SET price = 180, currency = 'MZN', photo_url = ?, storage_location = 'Corredor C · Caixa 14', condition = 'Bom' WHERE id = 2 AND price = 0").bind(starterItems[1][10]),
    db.prepare("UPDATE inventory_items SET price = 75, currency = 'MZN', photo_url = ?, storage_location = 'Corredor B · Caixa 6', condition = 'Excelente' WHERE id = 3 AND price = 0").bind(starterItems[2][10]),
    db.prepare("UPDATE inventory_items SET price = 900, currency = 'MZN', photo_url = ?, storage_location = 'Corredor D · Chão 3', condition = 'Bom' WHERE id = 4 AND price = 0").bind(starterItems[3][10]),
    db.prepare("UPDATE inventory_items SET price = 2500, currency = 'MZN', photo_url = ?, storage_location = 'Zona E · Posição 5', condition = 'Excelente' WHERE id = 5 AND price = 0").bind(starterItems[4][10]),
    db.prepare("UPDATE inventory_items SET price = 220, currency = 'MZN', photo_url = ?, storage_location = 'Corredor C · Caixa 9', condition = 'Requer inspecção' WHERE id = 6 AND price = 0").bind(starterItems[5][10]),
  ]);

  const count = await db.prepare("SELECT COUNT(*) AS count FROM inventory_items").first<{ count: number }>();
  if (!count?.count) {
    await db.batch(starterItems.map((item) =>
      db.prepare("INSERT INTO inventory_items (id, name, category, quantity, available, status, tone, symbol, price, currency, photo_url, storage_location, condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(...item),
    ));
  }
  const categoryCount = await db.prepare("SELECT COUNT(*) AS count FROM categories").first<{ count: number }>();
  if (!categoryCount?.count) {
    await db.batch(starterCategories.map((name, index) => db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)").bind(index + 1, name)));
  }
  await db.prepare("INSERT OR IGNORE INTO categories (name) SELECT DISTINCT category FROM inventory_items WHERE category IS NOT NULL AND category != ''").run();
  const profileCount = await db.prepare("SELECT COUNT(*) AS count FROM business_profile").first<{ count: number }>();
  if (!profileCount?.count) {
    await db.prepare("INSERT INTO business_profile (id, business_name, handle, bio, location, phone, email, color) VALUES (1, ?, ?, ?, ?, ?, ?, ?)")
      .bind("Terra & Table", "terraandtable", "Decoração de eventos e mesas cheias de alma para casamentos e celebrações intimistas.", "Maputo, Mozambique", "+258 84 555 0192", "hello@terraandtable.co", "#b75d3f")
      .run();
  }
}

export async function GET() {
  try {
    await ensureDatabase();
    const [items, reservations, categories, profile] = await Promise.all([
      env.DB.prepare("SELECT id, name, category, quantity, available, status, tone, symbol, price, currency, photo_url AS photoUrl, storage_location AS storageLocation, condition FROM inventory_items ORDER BY id").all(),
      env.DB.prepare("SELECT id, item, client, date, end_date AS endDate, color, event_name AS eventName, contact, notes, quantity, status FROM reservations ORDER BY date").all(),
      env.DB.prepare("SELECT id, name FROM categories ORDER BY name").all(),
      env.DB.prepare("SELECT business_name AS businessName, handle, bio, location, phone, email, color, avatar_url AS avatarUrl FROM business_profile WHERE id = 1").first(),
    ]);
    return Response.json({ items: items.results, reservations: reservations.results, categories: categories.results, profile });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load workspace" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const { action, payload } = await request.json() as { action: string; payload: Record<string, string | number | null> };
    if (action === "addItem") {
      await env.DB.prepare("INSERT INTO inventory_items (id, name, category, quantity, available, status, tone, symbol, price, currency, photo_url, storage_location, condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(payload.id, payload.name, payload.category, payload.quantity, payload.available, payload.status, payload.tone, payload.symbol, payload.price || 0, payload.currency || "MZN", payload.photoUrl || null, payload.storageLocation || "", payload.condition || "Bom").run();
    } else if (action === "removeItem") {
      await env.DB.prepare("DELETE FROM inventory_items WHERE id = ?").bind(payload.id).run();
    } else if (action === "bulkStatus" || action === "bulkRemove") {
      const ids = String(payload.ids || "").split(",").map(Number).filter((id) => Number.isInteger(id));
      if (ids.length) {
        const placeholders = ids.map(() => "?").join(",");
        if (action === "bulkStatus") await env.DB.prepare(`UPDATE inventory_items SET status = ? WHERE id IN (${placeholders})`).bind(payload.status, ...ids).run();
        else await env.DB.prepare(`DELETE FROM inventory_items WHERE id IN (${placeholders})`).bind(...ids).run();
      }
    } else if (action === "addReservation") {
      await env.DB.prepare("INSERT INTO reservations (id, item, client, date, end_date, color, event_name, contact, notes, quantity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(payload.id, payload.item, payload.client, payload.date, payload.endDate, payload.color, payload.eventName || "", payload.contact || "", payload.notes || "", payload.quantity || 1, payload.status || "Confirmed").run();
    } else if (action === "addCategory") {
      await env.DB.prepare("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)").bind(payload.id, payload.name).run();
    } else if (action === "removeCategory") {
      await env.DB.batch([
        env.DB.prepare("UPDATE inventory_items SET category = ? WHERE category = ?").bind(payload.fallback, payload.name),
        env.DB.prepare("DELETE FROM categories WHERE name = ?").bind(payload.name),
      ]);
    } else if (action === "inviteMember") {
      await env.DB.prepare("INSERT INTO collaborators (id, email, role, status) VALUES (?, ?, ?, 'Pending')").bind(payload.id, payload.email, payload.role).run();
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
