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

## Public site, search engines and ads
The public pages (home, colleges → programs → terms → subjects, public notes, public groups at `/g/<id>`, guides, about, legal) are server-rendered with
canonical URLs, Open Graph/Twitter cards (`/og?title=…`), JSON-LD, `robots.txt`, a database-generated `sitemap.xml` and a web manifest. Empty template pages
(a term with no subjects/notes/groups, a subject with no notes) are `noindex` and left out of the sitemap, so search engines only see real content.

Settings that are baked in at **build time** go into `.env.production.local` on the machine that runs `scripts/deploy.sh` (it is git-ignored):
```
NEXT_PUBLIC_CONTACT_EMAIL=you@example.com                  # shown on Contact and Privacy pages
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=xxxxxxxx              # Google Search Console "HTML tag" token
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-1234567890123456         # enables AdSense (consent banner, script, CSP) - leave unset until approved
NEXT_PUBLIC_ADSENSE_SLOT=1234567890                        # optional manual ad unit id (auto ads need no slot)
```
and the runtime variable `ADSENSE_PUBLISHER_ID=pub-1234567890123456` in `/opt/edusathi/env` (served at `/ads.txt`). With these unset, no ad code loads and
the Content-Security-Policy stays fully locked down. Ads are loaded only after the visitor accepts the consent banner and appear only on public pages.

Submit `https://www.edusathi.tech/sitemap.xml` in Google Search Console after verifying the site.

## Event reminders
`/etc/cron.d/edusathi-reminders` runs `select run_event_reminders()` every 15 minutes. It notifies every active member once, when a group event is
less than 24 hours away (and marks it reminded). Log: `/var/log/edusathi-reminders.log` (only written when reminders were sent).
