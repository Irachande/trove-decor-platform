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
});

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
});

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
