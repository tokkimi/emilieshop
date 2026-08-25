CREATE TABLE `book_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`locale` text DEFAULT 'fr' NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`model` text NOT NULL,
	`input_json` text NOT NULL,
	`result_json` text NOT NULL,
	`usage_json` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_book_generations_project_updated` ON `book_generations` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_book_generations_owner` ON `book_generations` (`owner_id`);