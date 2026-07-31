ALTER TABLE `events` ADD `owner_user_id` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `event_type` text DEFAULT 'Other' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `guest_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `budget` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `currency` text DEFAULT 'MZN' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `on_site_contact` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `color` text DEFAULT '#b75d3f' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `archived_at` text;