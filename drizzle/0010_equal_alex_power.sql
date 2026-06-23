CREATE TABLE `sync_jobs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`locked_at` integer,
	`locked_by` text,
	`last_run_at` integer,
	`last_status` text,
	`last_error` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
