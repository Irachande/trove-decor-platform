import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const inventoryItems = sqliteTable("inventory_items", {
  id: integer("id").primaryKey(),
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
  name: text("name").notNull().unique(),
});

export const collaborators = sqliteTable("collaborators", {
  id: integer("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("Pending"),
});

export const businessProfile = sqliteTable("business_profile", {
  id: integer("id").primaryKey(),
  businessName: text("business_name").notNull(),
  handle: text("handle").notNull(),
  bio: text("bio").notNull(),
  location: text("location").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  color: text("color").notNull(),
  avatarUrl: text("avatar_url"),
});
