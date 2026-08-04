#!/usr/bin/env bash
# Runs the database security suite against a throwaway database.
#
# The suite is not idempotent by design — it asserts on the signup trigger, so
# it needs a database where nobody has signed up yet. This rebuilds one from the
# migrations on every run, which also means the migrations themselves are
# re-verified each time.
#
# Usage: PGPORT=5433 tests/db/run.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

export PGHOST="${PGHOST:-/tmp}"
export PGPORT="${PGPORT:-5433}"
export PGUSER="${PGUSER:-postgres}"
DB="${DB:-apptest}"

psql -q -v ON_ERROR_STOP=1 -d postgres \
  -c "drop database if exists $DB;" -c "create database $DB;"

psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/harness.sql"

for migration in "$ROOT"/supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$migration"
done

psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/security.test.sql"
