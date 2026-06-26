CREATE TABLE `activity_stream_metrics` (
	`activity_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`version` integer NOT NULL,
	`hr_histogram_json` text,
	`power_curve_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_stream_metrics_user_idx` ON `activity_stream_metrics` (`user_id`);