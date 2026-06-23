CREATE TABLE `garmin_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`encrypted_blob` text NOT NULL,
	`last_sync_at` integer,
	`last_sync_status` text,
	`last_sync_error` text,
	`sync_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `garmin_credentials_user_unique` ON `garmin_credentials` (`user_id`);