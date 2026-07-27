CREATE TABLE `business_profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_name` text NOT NULL,
	`handle` text NOT NULL,
	`bio` text NOT NULL,
	`location` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`color` text NOT NULL,
	`avatar_url` text
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`quantity` integer NOT NULL,
	`available` integer NOT NULL,
	`status` text NOT NULL,
	`tone` text NOT NULL,
	`symbol` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` integer PRIMARY KEY NOT NULL,
	`item` text NOT NULL,
	`client` text NOT NULL,
	`date` text NOT NULL,
	`end_date` text NOT NULL,
	`color` text NOT NULL
);
