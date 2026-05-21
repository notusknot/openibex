import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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
