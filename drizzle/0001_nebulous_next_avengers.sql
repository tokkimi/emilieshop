CREATE INDEX `idx_media_project_id` ON `media` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_owner_updated` ON `projects` (`owner_id`,`updated_at`);