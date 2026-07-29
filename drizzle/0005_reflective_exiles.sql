CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text DEFAULT '' NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`title_pt` text NOT NULL,
	`title_en` text NOT NULL,
	`body_pt` text DEFAULT '' NOT NULL,
	`body_en` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`source_key` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_user_source_idx` ON `notifications` (`user_id`,`source_key`);--> statement-breakpoint
ALTER TABLE `collaborators` ADD `expires_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `collaborators` ADD `accepted_at` text;--> statement-breakpoint
ALTER TABLE `collaborators` ADD `accepted_by_user_id` integer;--> statement-breakpoint
ALTER TABLE `collaborators` ADD `revoked_at` text;