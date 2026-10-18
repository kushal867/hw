# EduSathi

Free student community, homework and PDF-sharing platform for Nepal. **Any student can create a group** (public or private, like a Facebook group) for a class, homework sharing or a study circle; groups can optionally be tagged to a college semester. Next.js 15 · TypeScript · Tailwind · Supabase (Auth, Postgres, Storage, Realtime).

> Your Semester. Your Notes. Your Community.

## What you must supply (nothing is faked)

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server env only | **Never** prefix with `NEXT_PUBLIC_`. Used for invites, uploads, moderation. |
| `NEXT_PUBLIC_SITE_URL` | `.env.local` | Used in emails and invite links (your domain in production) |
| `MAX_UPLOAD_MB` | optional | Default 10 |

Also configure in Supabase: Auth → email confirmation on, Redirect URL `<SITE_URL>/auth/callback`, and an SMTP provider for production email.

## Run

```bash
cp .env.example .env.local      # fill in values
# apply supabase/migrations/0001..0005 in order (Supabase SQL editor, or `supabase db push`)
npm install
npm run dev
```

Database design and notes on using your own Postgres server: [`docs/DATABASE.md`](docs/DATABASE.md).

## First administrator

Admin rights cannot be granted from the app (by design). After signing up, run once in the SQL editor:

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

## Architecture notes

- **Authorization is server-side.** Pages/actions call `requireUser` / `semesterAccess` / `authorize` / `requireAdmin`; RLS is the second line of defence. Hidden buttons are never the gate.
- **Private files** live in a private bucket with server-chosen paths; there are no client storage policies. Downloads go through `/api/documents/:id/file` (RLS decides). Public files go through `/api/public-notes/:id/file` (approved + public only).
- **Groups**: public groups are discoverable (name/description/member count only) and join by instant join or approval; private groups are invisible and invite-only. Content is members-only in both.
- **Invites**: 256-bit random token, only its SHA-256 is stored, redemption is an atomic SQL function (row-locked), QR encodes only the join URL.
- **Uploads**: size limit, magic-byte PDF validation, embedded-script rejection, duplicate detection, rate limiting, orphan cleanup.
- **Roles** are changed only via service-role SQL functions; the last owner can't be removed.

## Known limitations before public launch

- No malware scanning (add ClamAV or a scanning API before enabling public publication at scale).
- Privacy Policy / Terms are drafts and need professional review; set real contact details on `/contact`.
- Not yet verified end-to-end against a live Supabase project; browser (Playwright) journey tests are not written.
- Verified Educator badges have no award flow yet (never self-assignable).
