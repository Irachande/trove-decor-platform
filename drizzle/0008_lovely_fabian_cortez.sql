CREATE TABLE `beta_feedback` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`category` text NOT NULL,
	`rating` integer NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'New' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operational_events` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`severity` text DEFAULT 'error' NOT NULL,
	`source` text NOT NULL,
	`message` text NOT NULL,
	`route` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);