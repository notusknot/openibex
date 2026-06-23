ALTER TABLE `sync_jobs` ADD `consecutive_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sync_jobs` ADD `cooldown_until` integer;