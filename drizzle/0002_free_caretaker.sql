CREATE TABLE `businesses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`handle` text NOT NULL,
	`plan` text DEFAULT 'Basic' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `businesses_handle_unique` ON `businesses` (`handle`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_business_user_idx` ON `memberships` (`business_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
DROP INDEX `categories_name_unique`;--> statement-breakpoint
ALTER TABLE `categories` ADD `business_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_business_name_idx` ON `categories` (`business_id`,`name`);--> statement-breakpoint
ALTER TABLE `business_profile` ADD `business_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `business_profile_business_id_unique` ON `business_profile` (`business_id`);--> statement-breakpoint
ALTER TABLE `collaborators` ADD `business_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `collaborators` ADD `invited_by_user_id` integer;--> statement-breakpoint
ALTER TABLE `collaborators` ADD `created_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `business_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `business_id` integer DEFAULT 1 NOT NULL;