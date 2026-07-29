CREATE TABLE `inventory_movements` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by_user_id` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_photos` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`url` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kit_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`kit_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`quantity` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kit_items_kit_item_idx` ON `kit_items` (`kit_id`,`item_id`);--> statement-breakpoint
CREATE TABLE `kits` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'MZN' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `maintenance_records` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	`scheduled_date` text DEFAULT '' NOT NULL,
	`completed_at` text,
	`created_by_user_id` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `sku` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `replacement_value` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `min_stock` integer DEFAULT 0 NOT NULL;