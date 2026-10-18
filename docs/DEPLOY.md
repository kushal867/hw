# Deploying EduSathi

Production: one small server (1 CPU, ~2 GB RAM), PostgreSQL 16, nginx, **two app instances** behind nginx.

## Layout on the server
```
/opt/edusathi/releases/<timestamp>/   one directory per release (the 3 newest are kept for rollback)
/opt/edusathi/current -> releases/…   symlink the instances run from
/opt/edusathi/env                     environment (DATABASE_URL, NEXT_PUBLIC_SITE_URL, STORAGE_DIR, SMTP_*…)
/opt/edusathi/storage/                uploaded PDFs (private), avatars and college photos (public)
/opt/edusathi/backups/                nightly pg_dump + files (cron.d/edusathi-backup), pre-migration dumps
```
Instances are systemd units from `deploy/edusathi@.service`: `edusathi@3040` and `edusathi@3041` (the port is the instance name).
nginx balances them with `deploy/nginx-upstream.conf` (least_conn, passive failover) and `deploy/nginx-site.conf`
(server-sent events for chat are never buffered; nginx does not add HSTS because Next.js already does).

## What load balancing does (and doesn't) buy here
- **Does:** zero-downtime releases, and the site keeps serving if one process crashes or restarts.
- **Doesn't:** make a single-core server faster. For real capacity, add CPU/RAM or a second machine; nothing in the app is tied to
  one process (sessions, rate limits and chat fan-out all live in PostgreSQL, so any instance can serve any request).

## Release
```bash
scripts/deploy.sh                 # build locally, ship, restart instance by instance (waits for /api/health, auto-rollback on failure)
SKIP_BUILD=1 scripts/deploy.sh    # reuse an existing .next build
```
Migrations are applied **before** the release, by hand, after a backup (they are additive so the running version keeps working):
```bash
ssh edusathi 'sudo -u postgres pg_dump -Fc edusathi > /opt/edusathi/backups/pre-NNNN-$(date +%F-%H%M).dump'
scp supabase/migrations/NNNN_*.sql edusathi:/tmp/ && ssh edusathi 'sudo -u postgres psql -v ON_ERROR_STOP=1 -d edusathi -f /tmp/NNNN_*.sql'
```
Rollback: `ln -sfn releases/<previous> /opt/edusathi/current && systemctl restart edusathi@3040 && systemctl restart edusathi@3041`.

## Checks
`curl https://www.edusathi.tech/api/health` (database / storage / realtime), `journalctl -u 'edusathi@*' -f`, `systemctl status edusathi@3040 edusathi@3041`.
The chat end-to-end suite runs against any URL: `BASE_URL=https://www.edusathi.tech CHROME=/usr/bin/google-chrome node scripts/e2e-chat.mjs`
(it creates `@example.com` users and groups; delete them afterwards).
