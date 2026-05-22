CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`activity_file_id` text,
	`sport` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`start_time` integer NOT NULL,
	`timezone` text,
	`duration_sec` integer,
	`moving_time_sec` integer,
	`distance_m` real,
	`elevation_gain_m` real,
	`avg_hr` real,
	`max_hr` real,
	`avg_power_w` real,
	`max_power_w` real,
	`normalized_power_like_w` real,
	`avg_cadence` real,
	`calories` real,
	`load_score` real,
	`stream_path` text,
	`parser_version` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_file_id`) REFERENCES `activity_files`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activities_user_start_time_idx` ON `activities` (`user_id`,`start_time`);--> statement-breakpoint
CREATE TABLE `activity_files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`original_filename` text NOT NULL,
	`file_path` text NOT NULL,
	`file_type` text NOT NULL,
	`sha256` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_files_user_sha256_unique` ON `activity_files` (`user_id`,`sha256`);--> statement-breakpoint
CREATE INDEX `activity_files_user_uploaded_at_idx` ON `activity_files` (`user_id`,`uploaded_at`);--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`activity_file_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_file_id`) REFERENCES `activity_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `import_jobs_user_created_at_idx` ON `import_jobs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `import_jobs_status_idx` ON `import_jobs` (`status`);