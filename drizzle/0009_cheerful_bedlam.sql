CREATE TABLE `email_deliveries` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`recipient` text NOT NULL,
	`template` text NOT NULL,
	`provider` text DEFAULT 'Resend' NOT NULL,
	`provider_message_id` text,
	`status` text NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `public_enquiries` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`event_date` text DEFAULT '' NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'New' NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `business_profile` ADD `website` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_profile` ADD `instagram` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_profile` ADD `services` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_profile` ADD `is_public` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `business_profile` ADD `accepts_enquiries` integer DEFAULT true NOT NULL;