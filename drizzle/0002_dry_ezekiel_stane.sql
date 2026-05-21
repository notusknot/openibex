CREATE TABLE `planned_workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`sport` text NOT NULL,
	`scheduled_date` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`planned_duration_sec` integer,
	`planned_distance_m` real,
	`planned_load` real,
	`structure_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
