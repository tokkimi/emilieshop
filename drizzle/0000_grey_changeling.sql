CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`kind` text DEFAULT 'photo' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_object_key_unique` ON `media` (`object_key`);--> statement-breakpoint
CREATE TABLE `memory_links` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`slug` text NOT NULL,
	`access_code_hash` text,
	`status` text DEFAULT 'private' NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_links_project_id_unique` ON `memory_links` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `memory_links_slug_unique` ON `memory_links` (`slug`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_cents` integer NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`print_approved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `professional_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`organization_name` text NOT NULL,
	`branding_json` text DEFAULT '{}' NOT NULL,
	`credits_purchased` integer DEFAULT 0 NOT NULL,
	`credits_used` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`address` text,
	`years` text,
	`collection` text DEFAULT 'Essentiel' NOT NULL,
	`cover_color` text DEFAULT 'forest' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`progress` integer DEFAULT 10 NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`options_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`created_at` integer NOT NULL
);
