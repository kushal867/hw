#!/usr/bin/env bash
# 1) Fresh install: applies all migrations on a throwaway DB (with Supabase stubs) and runs the RLS suite.
# 2) Upgrade path: installs 0001-0004 with legacy data, applies 0005 and checks the data was converted to groups.
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
for f in supabase/migrations/000[1-4]_*.sql; do psql -q -v ON_ERROR_STOP=1 -d $UP -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d $UP -f supabase/tests/legacy_fixture.sql
psql -q -v ON_ERROR_STOP=1 -d $UP -f supabase/migrations/0005_groups.sql
psql -q -v ON_ERROR_STOP=1 -d $UP -o /dev/null -f supabase/tests/upgrade.test.sql
