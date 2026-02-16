CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`action_id` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`action_id`) REFERENCES `proposed_actions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `connected_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`scopes` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`connected_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gate_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`work_item_id` text NOT NULL,
	`gate` text NOT NULL,
	`matched` integer NOT NULL,
	`reason` text NOT NULL,
	`score` integer NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gmail_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`action_id` text NOT NULL,
	`provider_draft_id` text NOT NULL,
	`thread_id` text,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`action_id`) REFERENCES `proposed_actions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proposed_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`work_item_id` text NOT NULL,
	`action_type` text NOT NULL,
	`status` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`actor` text NOT NULL,
	`summary` text NOT NULL,
	`context` text NOT NULL,
	`preview` text NOT NULL,
	`status` text NOT NULL,
	`priority_score` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
