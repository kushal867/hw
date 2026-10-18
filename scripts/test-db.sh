#!/usr/bin/env bash
# 1) Fresh install: applies all migrations on a throwaway DB (with Supabase stubs) and runs the RLS suite.
# 2) Upgrade path: installs 0001-0006 with legacy data, applies 0007 and checks the data was converted to groups.
# 3) Runs the TypeScript suite incl. the query-layer integration tests.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
set -euo pipefail
DB=edusathi_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/tests_stub.sql
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d $DB -o /dev/null -f supabase/tests/rls.test.sql

UP=edusathi_upgrade
psql -q -d postgres -c "drop database if exists $UP" -c "create database $UP"
psql -q -v ON_ERROR_STOP=1 -d $UP -f supabase/tests_stub.sql
for f in supabase/migrations/000[1-6]_*.sql; do psql -q -v ON_ERROR_STOP=1 -d $UP -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d $UP -f supabase/tests/legacy_fixture.sql
psql -q -v ON_ERROR_STOP=1 -d $UP -f supabase/migrations/0007_groups.sql
psql -q -v ON_ERROR_STOP=1 -d $UP -o /dev/null -f supabase/tests/upgrade.test.sql

# 3) Query layer (embeds, RLS per user, rpc, groups) against a fresh database loaded with fixtures.
IT=edusathi_it
psql -q -d postgres -c "drop database if exists $IT" -c "create database $IT"
psql -q -v ON_ERROR_STOP=1 -d $IT -f supabase/tests_stub.sql
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d $IT -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d $IT -f supabase/tests/fixtures.sql
TEST_DATABASE_URL="postgres:///$IT?host=${PGHOST}&port=${PGPORT:-5432}&user=${PGUSER:-postgres}" npx vitest run
