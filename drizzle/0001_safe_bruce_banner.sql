CREATE TABLE `categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `collaborators` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `currency` text DEFAULT 'MZN' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `photo_url` text;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `storage_location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `condition` text DEFAULT 'Bom' NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `event_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `contact` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `quantity` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `status` text DEFAULT 'Confirmed' NOT NULL;