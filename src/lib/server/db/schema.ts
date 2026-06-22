import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const appMeta = sqliteTable('app_meta', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
});

export const userRoles = ['athlete', 'coach', 'admin'] as const;
export type UserRole = (typeof userRoles)[number];

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	displayName: text('display_name'),
	role: text('role', { enum: userRoles }).notNull().default('athlete'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	sessionTokenHash: text('session_token_hash').notNull().unique(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
});

export const sports = ['Bike', 'Run', 'Swim', 'Strength', 'Other'] as const;
export type Sport = (typeof sports)[number];

export const plannedWorkouts = sqliteTable('planned_workouts', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	sport: text('sport', { enum: sports }).notNull(),
	scheduledDate: text('scheduled_date').notNull(), // local date YYYY-MM-DD
	title: text('title').notNull(),
	description: text('description'),
	plannedDurationSec: integer('planned_duration_sec'),
	plannedDistanceM: real('planned_distance_m'),
	plannedLoad: real('planned_load'),
	structureJson: text('structure_json'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
});

export const fileTypes = ['fit'] as const;
export type ActivityFileType = (typeof fileTypes)[number];

export const activityFiles = sqliteTable(
	'activity_files',
	{
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	originalFilename: text('original_filename').notNull(),
	filePath: text('file_path').notNull(),
	fileType: text('file_type', { enum: fileTypes }).notNull(),
	sha256: text('sha256').notNull(),
	sizeBytes: integer('size_bytes').notNull(),
	uploadedAt: integer('uploaded_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		userShaUnique: uniqueIndex('activity_files_user_sha256_unique').on(t.userId, t.sha256),
		userUploadedAtIdx: index('activity_files_user_uploaded_at_idx').on(t.userId, t.uploadedAt)
	})
);

export const importJobStatuses = ['pending', 'processing', 'succeeded', 'failed'] as const;
export type ImportJobStatus = (typeof importJobStatuses)[number];

export const importJobs = sqliteTable(
	'import_jobs',
	{
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	activityFileId: text('activity_file_id')
		.notNull()
		.references(() => activityFiles.id, { onDelete: 'cascade' }),
	status: text('status', { enum: importJobStatuses }).notNull().default('pending'),
	errorMessage: text('error_message'),
	startedAt: integer('started_at', { mode: 'timestamp_ms' }),
	completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		userCreatedAtIdx: index('import_jobs_user_created_at_idx').on(t.userId, t.createdAt),
		statusIdx: index('import_jobs_status_idx').on(t.status)
	})
);

export const activities = sqliteTable(
	'activities',
	{
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	activityFileId: text('activity_file_id').references(() => activityFiles.id, { onDelete: 'set null' }),
	// Source metadata for bulk imports (e.g. Garmin export).
	source: text('source'),
	sourceActivityId: text('source_activity_id'),
	sourceFileSha256: text('source_file_sha256'),
	sourceFilename: text('source_filename'),
	importedAt: integer('imported_at', { mode: 'timestamp_ms' }),
	sport: text('sport', { enum: sports }).notNull(),
	title: text('title').notNull(),
	description: text('description'),
	startTime: integer('start_time', { mode: 'timestamp_ms' }).notNull(),
	timezone: text('timezone'),
	durationSec: integer('duration_sec'),
	movingTimeSec: integer('moving_time_sec'),
	distanceM: real('distance_m'),
	elevationGainM: real('elevation_gain_m'),
	avgHr: real('avg_hr'),
	maxHr: real('max_hr'),
	avgPowerW: real('avg_power_w'),
	maxPowerW: real('max_power_w'),
	normalizedPowerLikeW: real('normalized_power_like_w'),
	avgCadence: real('avg_cadence'),
	calories: real('calories'),
	loadScore: real('load_score'),
	streamPath: text('stream_path'),
	parserVersion: text('parser_version'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		userStartTimeIdx: index('activities_user_start_time_idx').on(t.userId, t.startTime),
		userSourceFileShaUnique: uniqueIndex('activities_user_source_file_sha_unique').on(t.userId, t.sourceFileSha256),
		userSourceActivityUnique: uniqueIndex('activities_user_source_activity_unique').on(t.userId, t.source, t.sourceActivityId)
	})
);

export const importBatchStatuses = ['pending', 'processing', 'completed', 'failed'] as const;
export type ImportBatchStatus = (typeof importBatchStatuses)[number];

export const importBatches = sqliteTable(
	'import_batches',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		source: text('source').notNull(),
		originalName: text('original_name').notNull(),
		status: text('status', { enum: importBatchStatuses }).notNull().default('pending'),
		totalFiles: integer('total_files').notNull().default(0),
		processedFiles: integer('processed_files').notNull().default(0),
		importedCount: integer('imported_count').notNull().default(0),
		duplicateCount: integer('duplicate_count').notNull().default(0),
		failedCount: integer('failed_count').notNull().default(0),
		startedAt: integer('started_at', { mode: 'timestamp_ms' }),
		completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		userCreatedIdx: index('import_batches_user_created_idx').on(t.userId, t.createdAt)
	})
);

export const importItemStatuses = ['discovered', 'processing', 'imported', 'duplicate', 'unsupported', 'failed'] as const;
export type ImportItemStatus = (typeof importItemStatuses)[number];

export const importItems = sqliteTable(
	'import_items',
	{
		id: text('id').primaryKey(),
		batchId: text('batch_id')
			.notNull()
			.references(() => importBatches.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		sourcePath: text('source_path').notNull(),
		originalFilename: text('original_filename').notNull(),
		detectedFormat: text('detected_format').notNull(),
		fileSizeBytes: integer('file_size_bytes').notNull(),
		sha256: text('sha256').notNull(),
		status: text('status', { enum: importItemStatuses }).notNull().default('discovered'),
		activityId: text('activity_id').references(() => activities.id, { onDelete: 'set null' }),
		errorMessage: text('error_message'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		batchIdx: index('import_items_batch_idx').on(t.batchId, t.createdAt),
		userShaIdx: index('import_items_user_sha_idx').on(t.userId, t.sha256)
	})
);

export const dailyMetrics = sqliteTable(
	'daily_metrics',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		date: text('date').notNull(), // YYYY-MM-DD local date
		sport: text('sport', { enum: sports }), // null = all sports
		durationSec: integer('duration_sec').notNull().default(0),
		distanceM: real('distance_m').notNull().default(0),
		elevationGainM: real('elevation_gain_m').notNull().default(0),
		loadScore: real('load_score').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		userDateUnique: uniqueIndex('daily_metrics_user_date_sport_unique').on(t.userId, t.date, t.sport)
	})
);

export const workoutLinkMatchTypes = ['auto', 'manual'] as const;
export type WorkoutLinkMatchType = (typeof workoutLinkMatchTypes)[number];

export const workoutLinks = sqliteTable(
	'workout_links',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		activityId: text('activity_id')
			.notNull()
			.references(() => activities.id, { onDelete: 'cascade' }),
		plannedWorkoutId: text('planned_workout_id')
			.notNull()
			.references(() => plannedWorkouts.id, { onDelete: 'cascade' }),
		matchType: text('match_type', { enum: workoutLinkMatchTypes }).notNull(),
		durationCompliance: real('duration_compliance'),
		distanceCompliance: real('distance_compliance'),
		loadCompliance: real('load_compliance'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		userPlannedUnique: uniqueIndex('workout_links_user_planned_unique').on(t.userId, t.plannedWorkoutId),
		userActivityUnique: uniqueIndex('workout_links_user_activity_unique').on(t.userId, t.activityId),
		userActivityIdx: index('workout_links_user_activity_idx').on(t.userId, t.activityId)
	})
);

export const commentTargetTypes = ['activity', 'planned_workout'] as const;
export type CommentTargetType = (typeof commentTargetTypes)[number];

export const comments = sqliteTable(
	'comments',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		targetType: text('target_type', { enum: commentTargetTypes }).notNull(),
		targetId: text('target_id').notNull(),
		body: text('body').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		userTargetIdx: index('comments_user_target_idx').on(t.userId, t.targetType, t.targetId)
	})
);

export const appSettings = sqliteTable('app_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
});
