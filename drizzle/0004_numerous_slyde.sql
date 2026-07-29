CREATE TABLE `clients` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`client_id` integer NOT NULL,
	`name` text NOT NULL,
	`venue` text DEFAULT '' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`setup_time` text DEFAULT '' NOT NULL,
	`pickup_time` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Planned' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reservation_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`reservation_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`item_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'MZN' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reservation_items_reservation_item_idx` ON `reservation_items` (`reservation_id`,`item_id`);--> statement-breakpoint
ALTER TABLE `reservations` ADD `client_id` integer;--> statement-breakpoint
ALTER TABLE `reservations` ADD `event_id` integer;--> statement-breakpoint
ALTER TABLE `reservations` ADD `subtotal` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `discount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `delivery_fee` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `total` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `deposit` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `currency` text DEFAULT 'MZN' NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `logistics` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `payment_status` text DEFAULT 'Pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `checked_out_at` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `returned_at` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `cancelled_at` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `created_by_user_id` integer;--> statement-breakpoint
ALTER TABLE `reservations` ADD `created_at` text DEFAULT '' NOT NULL;