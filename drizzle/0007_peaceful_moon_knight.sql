CREATE TABLE `marketplace_listings` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`daily_price` integer NOT NULL,
	`deposit` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'MZN' NOT NULL,
	`minimum_quantity` integer DEFAULT 1 NOT NULL,
	`maximum_quantity` integer DEFAULT 1 NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`latitude` text,
	`longitude` text,
	`delivery_options` text DEFAULT 'Pickup' NOT NULL,
	`terms` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by_user_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketplace_listings_business_item_idx` ON `marketplace_listings` (`business_id`,`item_id`);--> statement-breakpoint
CREATE TABLE `rental_disputes` (
	`id` integer PRIMARY KEY NOT NULL,
	`rental_request_id` integer NOT NULL,
	`opened_by_business_id` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`proposed_resolution` text DEFAULT '' NOT NULL,
	`proposed_by_business_id` integer,
	`resolved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_disputes_rental_request_id_unique` ON `rental_disputes` (`rental_request_id`);--> statement-breakpoint
CREATE TABLE `rental_requests` (
	`id` integer PRIMARY KEY NOT NULL,
	`listing_id` integer NOT NULL,
	`owner_business_id` integer NOT NULL,
	`requester_business_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`unit_price` integer NOT NULL,
	`deposit` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`currency` text DEFAULT 'MZN' NOT NULL,
	`requester_note` text DEFAULT '' NOT NULL,
	`owner_note` text DEFAULT '' NOT NULL,
	`delivery_method` text DEFAULT 'Pickup' NOT NULL,
	`proposed_by_business_id` integer,
	`payment_status` text DEFAULT 'Pending' NOT NULL,
	`deposit_status` text DEFAULT 'Pending' NOT NULL,
	`checked_out_at` text,
	`returned_at` text,
	`cancelled_at` text,
	`created_by_user_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rental_reviews` (
	`id` integer PRIMARY KEY NOT NULL,
	`rental_request_id` integer NOT NULL,
	`reviewer_business_id` integer NOT NULL,
	`reviewed_business_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_reviews_request_reviewer_idx` ON `rental_reviews` (`rental_request_id`,`reviewer_business_id`);