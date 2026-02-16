CREATE TABLE `feedback_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`work_item_id` text NOT NULL,
	`rating` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_entries_work_item_id_unique` ON `feedback_entries` (`work_item_id`);