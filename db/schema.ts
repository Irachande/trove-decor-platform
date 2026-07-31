import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().unique(),
  plan: text("plan").notNull().default("Basic"),
  pendingPlan: text("pending_plan"),
  status: text("status").notNull().default("Trialing"),
  amount: integer("amount").notNull().default(1200),
  currency: text("currency").notNull().default("MZN"),
  currentPeriodStart: text("current_period_start").notNull(),
  currentPeriodEnd: text("current_period_end").notNull(),
  graceUntil: text("grace_until"),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
  provider: text("provider").notNull().default("PaySuite"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  subscriptionId: integer("subscription_id").notNull(),
  provider: text("provider").notNull().default("PaySuite"),
  providerPaymentId: text("provider_payment_id"),
  reference: text("reference").notNull().unique(),
  kind: text("kind").notNull().default("subscription"),
  plan: text("plan").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("MZN"),
  status: text("status").notNull().default("Pending"),
  checkoutUrl: text("checkout_url"),
  method: text("method"),
  paidAt: text("paid_at"),
  failureReason: text("failure_reason"),
  receiptNumber: text("receipt_number"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const paymentWebhookEvents = sqliteTable("payment_webhook_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  requestId: text("request_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: text("status").notNull(),
  processedAt: text("processed_at").notNull(),
});

export const marketplaceListings = sqliteTable("marketplace_listings", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  itemId: integer("item_id").notNull(),
  dailyPrice: integer("daily_price").notNull(),
  deposit: integer("deposit").notNull().default(0),
  currency: text("currency").notNull().default("MZN"),
  minimumQuantity: integer("minimum_quantity").notNull().default(1),
  maximumQuantity: integer("maximum_quantity").notNull().default(1),
  location: text("location").notNull().default(""),
  latitude: text("latitude"),
  longitude: text("longitude"),
  deliveryOptions: text("delivery_options").notNull().default("Pickup"),
  terms: text("terms").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdByUserId: integer("created_by_user_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("marketplace_listings_business_item_idx").on(
    table.businessId,
    table.itemId,
  ),
]);

export const rentalRequests = sqliteTable("rental_requests", {
  id: integer("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  ownerBusinessId: integer("owner_business_id").notNull(),
  requesterBusinessId: integer("requester_business_id").notNull(),
  quantity: integer("quantity").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status").notNull().default("Pending"),
  unitPrice: integer("unit_price").notNull(),
  deposit: integer("deposit").notNull().default(0),
  total: integer("total").notNull(),
  currency: text("currency").notNull().default("MZN"),
  requesterNote: text("requester_note").notNull().default(""),
  ownerNote: text("owner_note").notNull().default(""),
  deliveryMethod: text("delivery_method").notNull().default("Pickup"),
  proposedByBusinessId: integer("proposed_by_business_id"),
  paymentStatus: text("payment_status").notNull().default("Pending"),
  depositStatus: text("deposit_status").notNull().default("Pending"),
  checkedOutAt: text("checked_out_at"),
  returnedAt: text("returned_at"),
  cancelledAt: text("cancelled_at"),
  createdByUserId: integer("created_by_user_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const rentalReviews = sqliteTable("rental_reviews", {
  id: integer("id").primaryKey(),
  rentalRequestId: integer("rental_request_id").notNull(),
  reviewerBusinessId: integer("reviewer_business_id").notNull(),
  reviewedBusinessId: integer("reviewed_business_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("rental_reviews_request_reviewer_idx").on(
    table.rentalRequestId,
    table.reviewerBusinessId,
  ),
]);

export const rentalDisputes = sqliteTable("rental_disputes", {
  id: integer("id").primaryKey(),
  rentalRequestId: integer("rental_request_id").notNull().unique(),
  openedByBusinessId: integer("opened_by_business_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("Open"),
  proposedResolution: text("proposed_resolution").notNull().default(""),
  proposedByBusinessId: integer("proposed_by_business_id"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

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
  ownerUserId: integer("owner_user_id"),
  name: text("name").notNull(),
  eventType: text("event_type").notNull().default("Other"),
  venue: text("venue").notNull().default(""),
  address: text("address").notNull().default(""),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  setupTime: text("setup_time").notNull().default(""),
  pickupTime: text("pickup_time").notNull().default(""),
  guestCount: integer("guest_count").notNull().default(0),
  budget: integer("budget").notNull().default(0),
  currency: text("currency").notNull().default("MZN"),
  onSiteContact: text("on_site_contact").notNull().default(""),
  color: text("color").notNull().default("#b75d3f"),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("Planned"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull().default(""),
  archivedAt: text("archived_at"),
});

export const eventTasks = sqliteTable("event_tasks", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  eventId: integer("event_id").notNull(),
  assigneeUserId: integer("assignee_user_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("General"),
  priority: text("priority").notNull().default("Normal"),
  status: text("status").notNull().default("Pending"),
  dueDate: text("due_date").notNull().default(""),
  dueTime: text("due_time").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: text("completed_at"),
  completedByUserId: integer("completed_by_user_id"),
  createdByUserId: integer("created_by_user_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("event_tasks_business_event_status_idx").on(
    table.businessId,
    table.eventId,
    table.status,
  ),
  index("event_tasks_assignee_due_idx").on(
    table.businessId,
    table.assigneeUserId,
    table.dueDate,
  ),
]);

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
  expiresAt: text("expires_at").notNull().default(""),
  acceptedAt: text("accepted_at"),
  acceptedByUserId: integer("accepted_by_user_id"),
  revokedAt: text("revoked_at"),
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  titlePt: text("title_pt").notNull(),
  titleEn: text("title_en").notNull(),
  bodyPt: text("body_pt").notNull().default(""),
  bodyEn: text("body_en").notNull().default(""),
  link: text("link").notNull().default(""),
  sourceKey: text("source_key").notNull(),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("notifications_user_source_idx").on(table.userId, table.sourceKey),
]);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull().default(""),
  summary: text("summary").notNull(),
  createdAt: text("created_at").notNull(),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  userId: integer("user_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const operationalEvents = sqliteTable("operational_events", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  userId: integer("user_id").notNull(),
  severity: text("severity").notNull().default("error"),
  source: text("source").notNull(),
  message: text("message").notNull(),
  route: text("route").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const betaFeedback = sqliteTable("beta_feedback", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  userId: integer("user_id").notNull(),
  category: text("category").notNull(),
  rating: integer("rating").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("New"),
  createdAt: text("created_at").notNull(),
});

export const publicEnquiries = sqliteTable("public_enquiries", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  eventDate: text("event_date").notNull().default(""),
  message: text("message").notNull(),
  status: text("status").notNull().default("New"),
  ipHash: text("ip_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const emailDeliveries = sqliteTable("email_deliveries", {
  id: integer("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  recipient: text("recipient").notNull(),
  template: text("template").notNull(),
  provider: text("provider").notNull().default("Resend"),
  providerMessageId: text("provider_message_id"),
  status: text("status").notNull(),
  error: text("error").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
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
  website: text("website").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  services: text("services").notNull().default(""),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  acceptsEnquiries: integer("accepts_enquiries", { mode: "boolean" }).notNull().default(true),
});
