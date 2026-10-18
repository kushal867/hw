#!/usr/bin/env bash
# Build locally (the server is small) and ship the standalone bundle to the server, then restart the service.
# Usage: scripts/deploy.sh [ssh-host]      (default host: edusathi)
set -euo pipefail
HOST=${1:-edusathi}
cd "$(dirname "$0")/.."
NEXT_PUBLIC_SITE_URL=https://www.edusathi.tech DATABASE_URL=postgresql://build@127.0.0.1/build npm run build
STAGE=$(mktemp -d); trap 'rm -rf "$STAGE"' EXIT
cp -r .next/standalone/. "$STAGE/"; mkdir -p "$STAGE/.next"; cp -r .next/static "$STAGE/.next/static"; cp -r public "$STAGE/public"
tar czf - -C "$STAGE" . | ssh "$HOST" 'set -e
  NEW=/opt/edusathi/app.new; rm -rf $NEW; mkdir $NEW; tar xzf - -C $NEW; chown -R edusathi:edusathi $NEW
  systemctl stop edusathi; rm -rf /opt/edusathi/app.old; mv /opt/edusathi/app /opt/edusathi/app.old; mv $NEW /opt/edusathi/app
  systemctl start edusathi; sleep 3; systemctl is-active edusathi; rm -rf /opt/edusathi/app.old'
