#!/usr/bin/env bash
# Brings up the backend the end-to-end tests run against.
#
# The obvious way to do this is `supabase start`, and that is what you should
# use if Docker is available to you. It was not available where these tests were
# written — the Docker registry is blocked — so this assembles the same shape
# from parts: a real Postgres, a real PostgREST, and a stand-in for the auth and
# storage services (tests/fake-supabase.mjs explains what that does and does not
# prove).
#
#   tests/stack.sh up      start everything, rebuilding the test database
#   tests/stack.sh down    stop everything
#
# Then: npx playwright test
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
RUN="${RUN_DIR:-/tmp/ai-polaroid-stack}"
PGDATA="${PGDATA:-/var/lib/postgresql/aipolaroid}"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
SECRET="super-secret-jwt-token-for-tests-only-x"

mkdir -p "$RUN"

start() {
  if ! pg_isready -h /tmp -p 5433 >/dev/null 2>&1; then
    if [ ! -d "$PGDATA/base" ]; then
      mkdir -p "$PGDATA"
      chown postgres:postgres "$PGDATA"
      chmod 700 "$PGDATA"
      su postgres -c "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust" >/dev/null
    fi
    su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-p 5433 -k /tmp' -l $PGDATA/server.log start" >/dev/null
    sleep 2
  fi

  # Services first: the database cannot be dropped while PostgREST holds
  # connections to it.
  pkill -f "postgrest.conf" 2>/dev/null || true
  pkill -f "fake-supabase.mjs" 2>/dev/null || true
  pkill -f "stub-openrouter.mjs" 2>/dev/null || true
  sleep 1

  # Rebuilds the database from the migrations and re-runs the SQL suite.
  PGPORT=5433 "$HERE/db/run.sh"

  if [ ! -x "$RUN/postgrest" ]; then
    echo "postgrest binary not found at $RUN/postgrest" >&2
    echo "download it from https://github.com/PostgREST/postgrest/releases" >&2
    exit 1
  fi

  cat > "$RUN/postgrest.conf" <<EOF
db-uri = "postgres://postgres@localhost/apptest?host=/tmp&port=5433"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = 3001
server-host = "127.0.0.1"
EOF

  setsid nohup "$RUN/postgrest" "$RUN/postgrest.conf" > "$RUN/postgrest.log" 2>&1 < /dev/null &
  setsid nohup env PGDATABASE=apptest node "$HERE/fake-supabase.mjs" > "$RUN/gateway.log" 2>&1 < /dev/null &
  setsid nohup node "$HERE/stub-openrouter.mjs" > "$RUN/stub.log" 2>&1 < /dev/null &
  sleep 4

  curl -fsS "http://127.0.0.1:54321/test/photos?email=none@example.com" >/dev/null
  echo "stack up: postgres 5433, postgrest 3001, gateway 54321, model stub 8787"
}

stop() {
  pkill -f "postgrest.conf" 2>/dev/null || true
  pkill -f "fake-supabase.mjs" 2>/dev/null || true
  pkill -f "stub-openrouter.mjs" 2>/dev/null || true
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA stop" >/dev/null 2>&1 || true
  echo "stack down"
}

case "${1:-up}" in
  up) start ;;
  down) stop ;;
  *) echo "usage: $0 [up|down]" >&2; exit 1 ;;
esac
