CREATE TABLE `calendar_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`label` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`etag` text,
	`last_modified` text,
	`status` text DEFAULT 'idle' NOT NULL,
	`locked_at` integer,
	`locked_by` text,
	`last_polled_at` integer,
	`last_status` text,
	`last_error` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`cooldown_until` integer,
	`last_event_count` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_subscriptions_user_url_unique` ON `calendar_subscriptions` (`user_id`,`url`);--> statement-breakpoint
CREATE INDEX `calendar_subscriptions_user_created_idx` ON `calendar_subscriptions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `calendar_synced_workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`user_id` text NOT NULL,
	`ical_uid` text NOT NULL,
	`recurrence_id` text DEFAULT '' NOT NULL,
	`planned_workout_id` text,
	`synced_hash` text NOT NULL,
	`conflict_hash` text,
	`upstream_sequence` integer,
	`upstream_last_modified` text,
	`state` text DEFAULT 'synced' NOT NULL,
	`conflict_json` text,
	`removed_upstream` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `calendar_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planned_workout_id`) REFERENCES `planned_workouts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_synced_workouts_uid_unique` ON `calendar_synced_workouts` (`subscription_id`,`ical_uid`,`recurrence_id`);--> statement-breakpoint
CREATE INDEX `calendar_synced_workouts_user_state_idx` ON `calendar_synced_workouts` (`user_id`,`state`);--> statement-breakpoint
CREATE INDEX `calendar_synced_workouts_planned_idx` ON `calendar_synced_workouts` (`planned_workout_id`);