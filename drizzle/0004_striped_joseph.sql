CREATE TABLE `workout_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`planned_workout_id` text NOT NULL,
	`match_type` text NOT NULL,
	`duration_compliance` real,
	`distance_compliance` real,
	`load_compliance` real,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planned_workout_id`) REFERENCES `planned_workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workout_links_user_planned_unique` ON `workout_links` (`user_id`,`planned_workout_id`);--> statement-breakpoint
CREATE INDEX `workout_links_user_activity_idx` ON `workout_links` (`user_id`,`activity_id`);