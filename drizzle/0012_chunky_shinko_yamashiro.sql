CREATE TABLE `event_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`uploaded_by_user_id` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_documents_object_key_unique` ON `event_documents` (`object_key`);--> statement-breakpoint
CREATE INDEX `event_documents_business_event_idx` ON `event_documents` (`business_id`,`event_id`);--> statement-breakpoint
CREATE TABLE `event_expenses` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	`supplier_id` integer,
	`category` text DEFAULT 'Other' NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'MZN' NOT NULL,
	`payment_status` text DEFAULT 'Planned' NOT NULL,
	`incurred_date` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_expenses_business_event_status_idx` ON `event_expenses` (`business_id`,`event_id`,`payment_status`);--> statement-breakpoint
CREATE INDEX `event_expenses_supplier_idx` ON `event_expenses` (`business_id`,`supplier_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`name` text NOT NULL,
	`service_type` text DEFAULT 'Other' NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `suppliers_business_name_idx` ON `suppliers` (`business_id`,`name`);