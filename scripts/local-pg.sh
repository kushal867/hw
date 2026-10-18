#!/usr/bin/env bash
# Starts (creating if needed) a throwaway local Postgres for running scripts/test-db.sh. Needs Postgres 16 binaries + root.
# The data dir must be outside any 0700 directory so the postgres user can reach it.
set -e
B=/usr/lib/postgresql/16/bin; D=/var/tmp/edusathi-pg
if [ ! -d $D/data ]; then mkdir -p $D && chown postgres:postgres $D && su postgres -s /bin/bash -c "$B/initdb -D $D/data -A trust >/dev/null"; fi
su postgres -s /bin/bash -c "$B/pg_ctl -D $D/data -o '-p 5434 -k $D' -l $D/log -w start" >/dev/null 2>&1 || true
echo "export PGHOST=$D PGPORT=5434 PGUSER=postgres"
