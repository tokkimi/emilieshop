CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_id` text NOT NULL,
	`event_name` text NOT NULL,
	`path` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_event_created` ON `analytics_events` (`event_name`,`created_at`);--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`version_hash` text NOT NULL,
	`approved_at` integer NOT NULL,
	`user_agent` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_approvals_project_id` ON `approvals` (`project_id`);--> statement-breakpoint
CREATE TABLE `message_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_threads_user_updated` ON `message_threads` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`attachment_key` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `message_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_messages_thread_created` ON `messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`email` text PRIMARY KEY NOT NULL,
	`locale` text DEFAULT 'fr' NOT NULL,
	`segment` text DEFAULT 'owner' NOT NULL,
	`status` text DEFAULT 'subscribed' NOT NULL,
	`consent_source` text NOT NULL,
	`consent_at` integer NOT NULL,
	`unsubscribed_at` integer
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
