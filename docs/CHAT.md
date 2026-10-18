# EduSathi — Chat architecture

Group chat (one room per group) and direct messages between classmates who share an active group.

## Data (migration 0008)
`chat_rooms` (kind group|direct) · `chat_participants` (read state, mute) · `chat_messages` (`seq` cursor, ≤2000 chars, reply, idempotent `client_id`, edit/soft-delete) · `chat_reactions` · `user_blocks`.
Access is decided by RLS predicates (`can_access_room`, `can_send_room`, `is_room_mod`, `is_blocked_pair`). Platform admins may read GROUP chats for moderation, never DMs. Deleted text is erased. Reports can target `chat_message`.

## Real-time
Postgres triggers `pg_notify('chat', …)` with **ids only**. One `LISTEN` connection per server (`src/lib/chat/hub.ts`) fans out via Server-Sent Events (`/api/chat/stream`); clients refetch through RLS-protected endpoints, so a leaked event reveals nothing. Reconnect with backoff, `resync` after a gap, 5 streams/user, heartbeat 20 s, ends on logout.
Behind nginx set `proxy_buffering off;` (or send `X-Accel-Buffering: no`) for `/api/chat/stream`.

## Abuse controls
Same-origin check on every mutation, zod-validated bodies with size limits, sliding-window rate limits (migration 0009), flood control (10/10 s, 400/h), duplicate suppression, bidi/zero-width spoof stripping (ZWJ/ZWNJ kept for Nepali), edit window 24 h.

## Backend hardening
`src/lib/api.ts` `route()` wrapper (request id, CSRF, auth, limits, safe errors, structured logs), `src/lib/log.ts`, pool/statement timeouts and one retry on deadlock in `src/lib/db.ts`, CSP/HSTS headers in `next.config.mjs`, `GET /api/health`.
Env: `DB_POOL_MAX`, `DB_STATEMENT_TIMEOUT_MS`, `DB_SLOW_QUERY_MS`, `LOG_LEVEL`.

## Tests
`scripts/test-db.sh` (SQL suites incl. 28 chat denials, upgrade path, vitest) · `scripts/e2e-chat.mjs` (18-step browser run, needs a running app) · `npm run audit:a11y`.
