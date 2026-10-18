# EduSathi

Free student community, homework and PDF-sharing platform for Nepal. **Any student can create a group** (public or private, like a Facebook group) for a class, homework sharing or a study circle; groups can optionally be tagged to a college semester. Next.js 15 · TypeScript · Tailwind · self-hosted PostgreSQL (own auth, sessions and disk storage).

> Your Semester. Your Notes. Your Community.

## Configuration

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection for the `edusathi_app` role (see `docs/DATABASE.md`) |
| `NEXT_PUBLIC_SITE_URL` | Public URL, used in emails and invite links (`https://www.edusathi.tech` in production) |
| `STORAGE_DIR` | Directory for uploaded PDFs (private) and avatars (public) |
| `MAX_UPLOAD_MB` | Optional, default 10 |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Optional. Without SMTP, sign-ups are auto-verified and reset links go to the server log |

## Run locally

```bash
cp .env.example .env.local      # fill in values
# create the database, then apply supabase/tests_stub.sql and supabase/migrations/0001..0009 in order (see docs/DATABASE.md)
npm install
npm run dev
```

## Deploy

`scripts/deploy.sh` builds locally (the production server is small) and ships the standalone bundle to the server, where it runs
as the `edusathi` systemd service behind nginx. Database, nginx and TLS are described in [`docs/DATABASE.md`](docs/DATABASE.md).

Database design and notes: [`docs/DATABASE.md`](docs/DATABASE.md).

## First administrator

Admin rights cannot be granted from the app (by design). After signing up, run once with `psql`:

```sql
update public.profiles set platform_role = 'admin' where id = '<your auth user id>';
```

Then use `/admin/colleges` to add colleges → courses → semesters → subjects (optionally run `supabase/seed/nepal_colleges.sql`). Students create their own groups; use `/admin/groups` to archive abusive ones.

## Tests

```bash
npm test                         # unit tests: PDF validation, tokens, redirects, Nepal time, PDF export (incl. Devanagari)
PGHOST=... PGUSER=postgres scripts/test-db.sh   # database/RLS isolation suite (needs a Postgres)
npm run typecheck && npm run build
```

## Chat
Group chat + DMs with live delivery (SSE). See `docs/CHAT.md`. Health check: `GET /api/health`.

## Architecture notes

- **Authorization is server-side.** Pages/actions call `requireUser` / `groupAccess` / `authorize` / `requireAdmin`; RLS is the second line of defence. Hidden buttons are never the gate.
- **Private files** live in a private directory with server-chosen paths. Downloads go through `/api/documents/:id/file` (RLS decides). Public files go through `/api/public-notes/:id/file` (approved + public only).
- **Sessions**: random 256-bit token in an HttpOnly cookie; only its SHA-256 is stored. Passwords use scrypt. Login, signup and reset are rate-limited.
- **Groups**: public groups are discoverable (name/description/member count only) and join by instant join or approval; private groups are invisible and invite-only. Content is members-only in both.
- **Invites**: 256-bit random token, only its SHA-256 is stored, redemption is an atomic SQL function (row-locked), QR encodes only the join URL.
- **Uploads**: size limit, magic-byte PDF validation, embedded-script rejection, duplicate detection, rate limiting, orphan cleanup.
- **Roles** are changed only via service-role SQL functions; the last owner can't be removed.

## Known limitations before public launch

- No malware scanning (add ClamAV or a scanning API before enabling public publication at scale).
- Privacy Policy / Terms are drafts and need professional review; set real contact details on `/contact`.
- Email sending needs an SMTP provider (see Configuration).
- Verified Educator badges have no award flow yet (never self-assignable).
