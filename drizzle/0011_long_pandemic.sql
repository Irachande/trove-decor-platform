CREATE TABLE `event_tasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	`assignee_user_id` integer,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'General' NOT NULL,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`due_time` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`completed_by_user_id` integer,
	`created_by_user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_tasks_business_event_status_idx` ON `event_tasks` (`business_id`,`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `event_tasks_assignee_due_idx` ON `event_tasks` (`business_id`,`assignee_user_id`,`due_date`);