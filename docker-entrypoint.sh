#!/bin/sh
set -e

# Target uid/gid for the app process and the /data bind-mount. Defaults to 1000
# (the image's built-in `node` user). Override via PUID/PGID to match the host
# user that owns ./data, so SQLite writes don't fail with EACCES.
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# When started as root, take ownership of the data dir and drop privileges to
# PUID:PGID before running the app. This makes `docker compose up` work without
# the host user ever having to chown ./data by hand. gosu accepts a numeric
# uid:gid, so the target user does not need to exist in /etc/passwd.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /data
  chown -R "${PUID}:${PGID}" /data
  exec gosu "${PUID}:${PGID}" "$@"
fi

# Already non-root (e.g. compose `user:` override or `--user`): run as-is and
# assume the caller has arranged /data to be writable.
exec "$@"
