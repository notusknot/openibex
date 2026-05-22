import JSZip from 'jszip';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';

import { getEnv } from '$lib/server/env';
import { exportUserData } from '$lib/server/repositories/exportRepository';

function toIso(date: Date | null | undefined): string | null {
	if (!date) return null;
	const d = date instanceof Date ? date : new Date(date);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function jsonReplacer(_key: string, value: unknown) {
	if (value instanceof Date) return value.toISOString();
	return value;
}

function csvEscape(v: unknown): string {
	const s = v === null || v === undefined ? '' : String(v);
	if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
	return s;
}

function plannedWorkoutsToCsv(rows: any[]): string {
	const header = [
		'id',
		'user_id',
		'sport',
		'scheduled_date',
		'title',
		'description',
		'planned_duration_sec',
		'planned_distance_m',
		'planned_load',
		'created_at',
		'updated_at'
	];
	const lines = [header.join(',')];
	for (const r of rows) {
		lines.push(
			[
				r.id,
				r.userId,
				r.sport,
				r.scheduledDate,
				r.title,
				r.description ?? '',
				r.plannedDurationSec ?? '',
				r.plannedDistanceM ?? '',
				r.plannedLoad ?? '',
				toIso(r.createdAt) ?? '',
				toIso(r.updatedAt) ?? ''
			]
				.map(csvEscape)
				.join(',')
		);
	}
	return lines.join('\n');
}

async function readFileIfExists(absPath: string): Promise<Uint8Array | null> {
	try {
		return await fs.readFile(absPath);
	} catch {
		return null;
	}
}

export type ExportResult = {
	exportId: string;
	filename: string;
	zipBytes: Uint8Array;
};

export async function generateUserExport(userId: string): Promise<ExportResult> {
	const exportId = crypto.randomUUID();
	const filename = `openibex-export-${exportId}.zip`;

	const data = await exportUserData(userId);

	const zip = new JSZip();
	zip.file('meta/version.json', JSON.stringify({ exportVersion: 1, createdAt: new Date().toISOString() }, null, 2));
	zip.file('meta/user.json', JSON.stringify(data.user ?? null, jsonReplacer, 2));
	zip.file('meta/app_settings.json', JSON.stringify(data.appSettings, jsonReplacer, 2));

	zip.file('data/planned_workouts.json', JSON.stringify(data.planned, jsonReplacer, 2));
	zip.file('data/planned_workouts.csv', plannedWorkoutsToCsv(data.planned as any[]));
	zip.file('data/activities.json', JSON.stringify(data.activities, jsonReplacer, 2));
	zip.file('data/activity_files.json', JSON.stringify(data.activityFiles, jsonReplacer, 2));
	zip.file('data/import_jobs.json', JSON.stringify(data.importJobs, jsonReplacer, 2));
	zip.file('data/workout_links.json', JSON.stringify(data.workoutLinks, jsonReplacer, 2));
	zip.file('data/comments.json', JSON.stringify(data.comments, jsonReplacer, 2));

	const env = getEnv();
	for (const f of data.activityFiles) {
		const absPath = path.join(env.OPENIBEX_DATA_DIR, f.filePath);
		const bytes = await readFileIfExists(absPath);
		if (!bytes) continue;
		zip.file(f.filePath.replace(/^[\\/]+/, ''), bytes);
	}

	const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
	return { exportId, filename, zipBytes };
}

export async function writeUserExportToDisk(userId: string): Promise<{ exportId: string; filename: string }> {
	const env = getEnv();
	const { exportId, filename, zipBytes } = await generateUserExport(userId);

	const exportDir = path.join(env.OPENIBEX_EXPORT_DIR, exportId);
	await fs.mkdir(exportDir, { recursive: true });

	await fs.writeFile(path.join(exportDir, filename), zipBytes);
	await fs.writeFile(
		path.join(exportDir, 'manifest.json'),
		JSON.stringify({ exportId, userId, filename, createdAt: new Date().toISOString() }, null, 2)
	);

	return { exportId, filename };
}

export async function readExportManifest(exportId: string): Promise<{ exportId: string; userId: string; filename: string } | null> {
	const env = getEnv();
	const exportDir = path.join(env.OPENIBEX_EXPORT_DIR, exportId);
	try {
		const raw = await fs.readFile(path.join(exportDir, 'manifest.json'), 'utf8');
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return null;
		if (parsed.exportId !== exportId) return null;
		if (typeof parsed.userId !== 'string') return null;
		if (typeof parsed.filename !== 'string') return null;
		return { exportId, userId: parsed.userId, filename: parsed.filename };
	} catch {
		return null;
	}
}

export async function readExportZipBytes(exportId: string, filename: string): Promise<Uint8Array | null> {
	const env = getEnv();
	const exportDir = path.join(env.OPENIBEX_EXPORT_DIR, exportId);
	try {
		return await fs.readFile(path.join(exportDir, filename));
	} catch {
		return null;
	}
}
