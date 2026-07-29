import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const businesses = sqliteTable("businesses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
  plan: text("plan").notNull().default("Basic"),
  createdAt: text("created_at").notNull(),
});

export const memberships = sqliteTable("memberships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("Active"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("memberships_business_user_idx").on(table.businessId, table.userId),
]);

export const inventoryItems = sqliteTable("inventory_items", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull().default(1),
  name: text("name").notNull(),
  category: text("category").notNull(),
  quantity: integer("quantity").notNull(),
  available: integer("available").notNull(),
  status: text("status").notNull(),
  tone: text("tone").notNull(),
  symbol: text("symbol").notNull(),
  price: integer("price").notNull().default(0),
  currency: text("currency").notNull().default("MZN"),
  photoUrl: text("photo_url"),
  storageLocation: text("storage_location").notNull().default(""),
  condition: text("condition").notNull().default("Bom"),
  description: text("description").notNull().default(""),
  sku: text("sku").notNull().default(""),
  replacementValue: integer("replacement_value").notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
});

export const itemPhotos = sqliteTable("item_photos", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  itemId: integer("item_id").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const inventoryMovements = sqliteTable("inventory_movements", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  itemId: integer("item_id").notNull(),
  type: text("type").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  note: text("note").notNull().default(""),
  createdByUserId: integer("created_by_user_id"),
  createdAt: text("created_at").notNull(),
});

export const maintenanceRecords = sqliteTable("maintenance_records", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  itemId: integer("item_id").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  notes: text("notes").notNull().default(""),
  cost: integer("cost").notNull().default(0),
  scheduledDate: text("scheduled_date").notNull().default(""),
  completedAt: text("completed_at"),
  createdByUserId: integer("created_by_user_id"),
  createdAt: text("created_at").notNull(),
});

export const kits = sqliteTable("kits", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: integer("price").notNull().default(0),
  currency: text("currency").notNull().default("MZN"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const kitItems = sqliteTable("kit_items", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  kitId: integer("kit_id").notNull(),
  itemId: integer("item_id").notNull(),
  quantity: integer("quantity").notNull(),
}, (table) => [
  uniqueIndex("kit_items_kit_item_idx").on(table.kitId, table.itemId),
]);

export const reservations = sqliteTable("reservations", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull().default(1),
  item: text("item").notNull(),
  client: text("client").notNull(),
  date: text("date").notNull(),
  endDate: text("end_date").notNull(),
  color: text("color").notNull(),
  eventName: text("event_name").notNull().default(""),
  contact: text("contact").notNull().default(""),
  notes: text("notes").notNull().default(""),
  quantity: integer("quantity").notNull().default(1),
  status: text("status").notNull().default("Confirmed"),
  clientId: integer("client_id"),
  eventId: integer("event_id"),
  subtotal: integer("subtotal").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  total: integer("total").notNull().default(0),
  deposit: integer("deposit").notNull().default(0),
  currency: text("currency").notNull().default("MZN"),
  logistics: text("logistics").notNull().default(""),
  paymentStatus: text("payment_status").notNull().default("Pending"),
  checkedOutAt: text("checked_out_at"),
  returnedAt: text("returned_at"),
  cancelledAt: text("cancelled_at"),
  createdByUserId: integer("created_by_user_id"),
  createdAt: text("created_at").notNull().default(""),
});

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  clientId: integer("client_id").notNull(),
  name: text("name").notNull(),
  venue: text("venue").notNull().default(""),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  setupTime: text("setup_time").notNull().default(""),
  pickupTime: text("pickup_time").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("Planned"),
  createdAt: text("created_at").notNull(),
});

export const reservationItems = sqliteTable("reservation_items", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  reservationId: integer("reservation_id").notNull(),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull().default(0),
  currency: text("currency").notNull().default("MZN"),
}, (table) => [
  uniqueIndex("reservation_items_reservation_item_idx").on(
    table.reservationId,
    table.itemId,
  ),
]);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull().default(1),
  name: text("name").notNull(),
}, (table) => [
  uniqueIndex("categories_business_name_idx").on(table.businessId, table.name),
]);

export const collaborators = sqliteTable("collaborators", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull().default(1),
  email: text("email").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("Pending"),
  invitedByUserId: integer("invited_by_user_id"),
  createdAt: text("created_at").notNull().default(""),
});

export const businessProfile = sqliteTable("business_profile", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull().default(1).unique(),
  businessName: text("business_name").notNull(),
  handle: text("handle").notNull(),
  bio: text("bio").notNull(),
  location: text("location").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  color: text("color").notNull(),
  avatarUrl: text("avatar_url"),
});
