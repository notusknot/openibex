DROP TABLE `daily_metrics`;--> statement-breakpoint
CREATE INDEX `planned_workouts_user_scheduled_date` ON `planned_workouts` (`user_id`,`scheduled_date`);