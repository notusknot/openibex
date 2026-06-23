ALTER TABLE `users` ADD `ftp_watts` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `threshold_hr_bpm` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `max_hr_bpm` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `threshold_pace_sec_per_km` real;--> statement-breakpoint
ALTER TABLE `users` ADD `units` text DEFAULT 'imperial' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `week_start` text DEFAULT 'mon' NOT NULL;