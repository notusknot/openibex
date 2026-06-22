CREATE TABLE `daily_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`sport` text,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`distance_m` real DEFAULT 0 NOT NULL,
	`elevation_gain_m` real DEFAULT 0 NOT NULL,
	`load_score` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_metrics_user_date_sport_unique` ON `daily_metrics` (`user_id`,`date`,`sport`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`original_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_files` integer DEFAULT 0 NOT NULL,
	`processed_files` integer DEFAULT 0 NOT NULL,
	`imported_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `import_batches_user_created_idx` ON `import_batches` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `import_items` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source_path` text NOT NULL,
	`original_filename` text NOT NULL,
	`detected_format` text NOT NULL,
	`file_size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`status` text DEFAULT 'discovered' NOT NULL,
	`activity_id` text,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `import_items_batch_idx` ON `import_items` (`batch_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `import_items_user_sha_idx` ON `import_items` (`user_id`,`sha256`);--> statement-breakpoint
ALTER TABLE `activities` ADD `source` text;--> statement-breakpoint
ALTER TABLE `activities` ADD `source_activity_id` text;--> statement-breakpoint
ALTER TABLE `activities` ADD `source_file_sha256` text;--> statement-breakpoint
ALTER TABLE `activities` ADD `source_filename` text;--> statement-breakpoint
ALTER TABLE `activities` ADD `imported_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `activities_user_source_file_sha_unique` ON `activities` (`user_id`,`source_file_sha256`);--> statement-breakpoint
CREATE UNIQUE INDEX `activities_user_source_activity_unique` ON `activities` (`user_id`,`source`,`source_activity_id`);