CREATE TABLE `payment_webhook_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`request_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_hash` text NOT NULL,
	`status` text NOT NULL,
	`processed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_webhook_events_request_id_unique` ON `payment_webhook_events` (`request_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer NOT NULL,
	`subscription_id` integer NOT NULL,
	`provider` text DEFAULT 'PaySuite' NOT NULL,
	`provider_payment_id` text,
	`reference` text NOT NULL,
	`kind` text DEFAULT 'subscription' NOT NULL,
	`plan` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'MZN' NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`checkout_url` text,
	`method` text,
	`paid_at` text,
	`failure_reason` text,
	`receipt_number` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_reference_unique` ON `payments` (`reference`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer NOT NULL,
	`plan` text DEFAULT 'Basic' NOT NULL,
	`pending_plan` text,
	`status` text DEFAULT 'Trialing' NOT NULL,
	`amount` integer DEFAULT 1200 NOT NULL,
	`currency` text DEFAULT 'MZN' NOT NULL,
	`current_period_start` text NOT NULL,
	`current_period_end` text NOT NULL,
	`grace_until` text,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`provider` text DEFAULT 'PaySuite' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_business_id_unique` ON `subscriptions` (`business_id`);