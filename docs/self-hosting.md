# Self-hosting, backup, and restore

OpenIbex is designed to run as a single container with a bind-mounted `/data` directory.

## What to back up

Back up the entire `/data` directory (or `./data` on the host when using Docker Compose). It contains:

- SQLite database: `openibex.db`
- Uploads: `uploads/`
- Streams: `streams/`
- Exports: `exports/`

## Backup (recommended)

1. Stop the container (reduces the chance of copying mid-write):

```bash
docker compose stop
```

2. Back up `./data`:

```bash
tar -czf openibex-backup-$(date +%F).tar.gz ./data
```

3. Start again:

```bash
docker compose start
```

## Restore

1. Stop the container:

```bash
docker compose stop
```

2. Replace the `./data` directory with the one from your backup archive.

3. Start the container:

```bash
docker compose up -d
```

## Notes

- If you need consistent backups while the app is running, consider stopping briefly or using filesystem snapshots on the host.
- Always keep `SESSION_SECRET` stable across restarts; changing it will log users out.
- When restoring, the app will apply any pending migrations on startup.
