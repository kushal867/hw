# EduSathi — Database Design

PostgreSQL 15+. Migrations live in `supabase/migrations/` and run in order:

| File | Purpose |
|---|---|
| `0001_schema.sql` | Tables, constraints, indexes |
| `0002_rls_and_functions.sql` | Grants, Row Level Security, triggers, trusted functions, `public_notes` view, private `documents` bucket |
| `0003_avatars_bucket.sql` | Public `avatars` bucket row (legacy; files now live on disk) |
| `0004_local_auth.sql` | Password hashes, `auth.sessions`, `auth.tokens` (self-hosted auth) |

All timestamps are `timestamptz` (UTC). The UI formats them in Nepal time (`Asia/Kathmandu`).

## Hierarchy

```
colleges 1─* courses 1─* semesters 1─* subjects
```

- Every level has `status` (`active`/`archived`) and unique constraints that prevent duplicates
  (`colleges(name, city)`, `courses(college_id, slug)`, `semesters(course_id, semester_number, academic_year)`, `subjects(semester_id, name)`).
- `academic_year` is free text, so BS (e.g. `2082`) and AD (`2025/26`) calendars both work.
- `colleges.country` (default `NP`) allows expansion to other countries without a redesign.
- `subjects` has `unique (id, semester_id)`. Documents, posts and questions reference `(subject_id, semester_id)`
  through a **composite foreign key**, so the database itself guarantees a subject belongs to the selected semester.

## Core tables

| Table | Key points |
|---|---|
| `profiles` | 1:1 with `auth.users`. `platform_role` (`user`/`admin`) and `restricted_until` are **protected** (no client write). Email is never stored here. |
| `semester_members` | PK `(semester_id, user_id)` → no duplicate memberships. `role`: owner/moderator/member. `membership_status`: active/pending/removed. |
| `semester_invites` | Stores only `token_hash` (SHA-256). `expires_at`, `max_uses`, `used_count`, `revoked_at`, `requires_approval`. Check constraint `used_count <= max_uses`. |
| `semester_requests` | A student asking an admin to set up a group (admin assigns the first owner). |
| `documents` | Private by default. Public ⇔ `visibility='public'` **and** `moderation_status='approved'` (check constraint). `sha256` unique per semester (duplicate detection). `mime_type` is constrained to `application/pdf`. |
| `discussion_posts` / `discussion_comments` | `status`: visible/hidden/removed (moderation). |
| `exam_questions` | `question_type`: practice / previous_exam / teacher_confirmed. Students can only insert the first two. |
| `saved_questions` | Per-user revision collection. |
| `reports` | Reports for documents, posts, comments, questions, users and copyright complaints. |
| `notifications`, `profile_badges`, `audit_logs`, `deletion_requests`, `rate_limits` | Supporting tables. `audit_logs` and `rate_limits` are never readable by ordinary users. |

## Roles and authorization model

Three database roles are used (created by `supabase/tests_stub.sql`): `anon`, `authenticated`, `service_role`.

- **Browser / user-scoped server client** → `authenticated`; every table has RLS enabled.
- **Server-only privileged code** → `service_role` (bypasses RLS). Used for: document inserts after file validation,
  invite creation, publication/approval, moderation, role changes. Always preceded by an explicit authorization check in code.

Semester roles:

- **owner** – manage members/roles, invitations, everything a moderator can do.
- **moderator** – invitations, join requests, hide/remove content in *that* semester only.
- **member** – read and contribute.

Platform `admin` is separate and cannot be obtained through any user-reachable path.

## Row Level Security summary

- Hierarchy tables: public read of `active` rows; writes admin-only.
- `profiles`: readable by self, classmates (shared active semester) and admins. Users can update only
  `display_name, username, avatar_path, preferred_language, bio, college_id, course_id, semester_id` (column grants) —
  plus a trigger rejects any change to protected fields from a user session.
- `semester_members`: readable by co-members; **no insert/update policy** (joins and role changes happen only through
  service-role functions). Users may delete their own non-owner row (leave).
- `documents`: members/moderators/admins only. Users may edit only title/description/tags/category/subject
  (column grants + `guard_document_update` trigger). Anonymous visitors have **no** access to this table.
- Discussions/questions: readable by active members only; authors edit their own; moderators delete/hide within their semester.
- `reports`: reporter sees own; admins see all. `notifications`: owner only. `audit_logs`: admins only.

## Trusted functions (service role only)

| Function | Guarantees |
|---|---|
| `redeem_invite(token_hash, user)` | Row-locks the invite → atomic counting under concurrency; rejects expired/revoked/exhausted; no duplicate membership; creates `pending` membership when approval is required. |
| `decide_join_request`, `remove_member` | Caller must be owner/moderator of that semester (or admin). Moderators cannot remove owners or other moderators. |
| `set_member_role` | Owner only. Promoting someone to owner is a *transfer* (old owner becomes moderator). |
| `admin_assign_owner` | Platform admin only. |
| `check_rate_limit` | Fixed-window limiter, fails closed. |
| `evaluate_badges` | Quality-gated badges (no badges if the user has actioned reports; counts distinct posts helped, not raw volume). |

Trigger `guard_last_owner` makes it impossible to remove or demote the last active owner.

## Files and the public/private split

- All PDFs live in the **private** `documents` bucket under server-chosen paths `semester_id/uuid.pdf`.
  There are **no** `storage.objects` policies for client roles, so file access is only through the app's routes:
  - `GET /api/documents/:id/file` — RLS on `documents` decides if the caller is a member.
  - `GET /api/public-notes/:id/file` — serves only if the row is in `public_notes` (approved + public).
- `public_notes` is the **only** anonymous window into documents. It exposes no `storage_path` and no private rows.
- Publication flow: uploader requests → `moderation_status='pending'` → admin approves (sets `visibility='public'`, `published_at`).
  Homework/assignments/lab reports are not eligible for publication.

## Running on your own server (what this deployment uses)

The app no longer uses Supabase. It talks to Postgres directly (`src/lib/db.ts`) and keeps the same security model:

- One login role, `edusathi_app`, is a member of `anon`, `authenticated` and `service_role`. For each query the app opens a
  transaction, runs `SET LOCAL ROLE <role>` and sets `request.jwt.claim.sub` to the signed-in user id, so **RLS and `auth.uid()`
  behave exactly as in the policies**. Logged-out visitors run as `anon`; trusted server code runs as `service_role`.
- `0004_local_auth.sql` adds password hashes (scrypt), `auth.sessions` (SHA-256 of an HttpOnly cookie token) and `auth.tokens`
  (single-use email-verification / password-reset tokens). Only `service_role` can read these tables.
- PDFs and avatars are stored on disk under `STORAGE_DIR` (`documents/` private, `avatars/` public) and are served only by the routes above.
- Setup: `create role edusathi_app login password '…' in role anon, authenticated, service_role;` then apply `tests_stub.sql`
  (creates the `auth`/`storage` schemas and roles) and the migrations in order. `scripts/deploy.sh` ships the app; see the README.

## Testing the database

```bash
# needs a Postgres you can create databases on
PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh

# optional: exercise the query layer (embeds, RLS per user, rpc) against that database
psql -d edusathi_test -f supabase/tests/fixtures.sql
TEST_DATABASE_URL=postgres://edusathi_app:...@host/edusathi_test npm test
```

Applies all migrations on top of `supabase/tests_stub.sql` and runs `supabase/tests/rls.test.sql`, which proves with
separate users (owner, member, outsider, anonymous) that private data is isolated, roles can't be self-escalated,
invites behave under expiry/revocation/max-use limits, and the last owner can't be removed.
