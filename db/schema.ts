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
});

export const reservations = sqliteTable("reservations", {
  id: integer("id").primaryKey(),
  item: text("item").notNull(),
  client: text("client").notNull(),
  date: text("date").notNull(),
  endDate: text("end_date").notNull(),
  color: text("color").notNull(),
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
