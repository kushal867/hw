#!/usr/bin/env bash
# Rolling, zero-downtime release: build locally (the server is small), ship a new release directory, then restart the
# instances ONE AT A TIME, waiting for /api/health before touching the next. A failed health check rolls back automatically.
# Usage: scripts/deploy.sh [ssh-host]          env: SKIP_BUILD=1 (reuse .next), PORTS="3040 3041"
set -euo pipefail
HOST=${1:-edusathi}; PORTS=${PORTS:-"3040 3041"}
cd "$(dirname "$0")/.."
[ "${SKIP_BUILD:-}" = 1 ] || NEXT_PUBLIC_SITE_URL=https://www.edusathi.tech DATABASE_URL=postgresql://build@127.0.0.1/build npm run build
STAGE=$(mktemp -d); trap 'rm -rf "$STAGE"' EXIT
cp -r .next/standalone/. "$STAGE/"; mkdir -p "$STAGE/.next"; cp -r .next/static "$STAGE/.next/static"; cp -r public "$STAGE/public"
REL=$(date +%Y%m%d-%H%M%S)
tar czf - -C "$STAGE" . | ssh "$HOST" "set -e; D=/opt/edusathi/releases/$REL; mkdir -p \$D; tar xzf - -C \$D; chown -R edusathi:edusathi \$D"
ssh "$HOST" bash -s -- "$REL" $PORTS <<'REMOTE'
set -euo pipefail
REL=$1; shift
cd /opt/edusathi
PREV=$(readlink -f current 2>/dev/null || true)
ln -sfn "releases/$REL" current.new && mv -T current.new current
for p in "$@"; do
  systemctl restart "edusathi@$p"
  ok=0; for _ in $(seq 1 45); do curl -fs -o /dev/null "http://127.0.0.1:$p/api/health" && { ok=1; break; }; sleep 1; done
  if [ "$ok" = 0 ]; then
    echo "!! instance $p failed its health check; rolling back to ${PREV:-none}"
    [ -n "$PREV" ] && { ln -sfn "$PREV" current.new && mv -T current.new current; systemctl restart "edusathi@$p"; }
    exit 1
  fi
  echo "instance $p healthy ($REL)"
done
ls -1dt releases/* | tail -n +4 | xargs -r rm -rf   # keep the 3 newest releases for rollback
REMOTE
