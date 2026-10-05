#!/usr/bin/env bash
# Project-local PostgreSQL for development.
#
# Runs an isolated cluster from ./.postgres on port 54329 (password-protected,
# localhost only), so it never touches any other Postgres on this machine.
#   npm run db:up      create (first run) and start
#   npm run db:down    stop
#   npm run db:status  show status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${TAXKATHA_PG_PORT:-54329}"
PGUSER_NAME="taxkatha"
DIR="$ROOT/.postgres"
DATA="$DIR/data"
LOG="$DIR/server.log"
PWFILE="$DIR/password"
ENV_FILE="$ROOT/.env.local"

PGBIN="${PGBIN:-}"
if [ -z "$PGBIN" ]; then
  for candidate in /opt/homebrew/opt/postgresql@17/bin /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin; do
    if [ -x "$candidate/initdb" ]; then PGBIN="$candidate"; break; fi
  done
fi
if [ -z "$PGBIN" ] && command -v initdb >/dev/null 2>&1; then PGBIN="$(dirname "$(command -v initdb)")"; fi
if [ -z "$PGBIN" ]; then
  echo "PostgreSQL binaries not found. Install with: brew install postgresql@16" >&2
  exit 1
fi

running() { "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; }

set_env() { # set_env KEY VALUE — add to .env.local only if the key is missing
  touch "$ENV_FILE"
  if ! grep -q "^$1=" "$ENV_FILE"; then printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"; fi
}

case "${1:-up}" in
  up)
    if [ ! -d "$DATA" ]; then
      mkdir -p "$DIR"
      (umask 077; openssl rand -hex 24 | tr -d '\n' > "$PWFILE")
      "$PGBIN/initdb" -D "$DATA" -U "$PGUSER_NAME" --auth=scram-sha-256 --pwfile="$PWFILE" -E UTF8 --locale=C >/dev/null
      echo "Created local cluster in .postgres/"
    fi
    if ! running; then
      "$PGBIN/pg_ctl" -D "$DATA" -l "$LOG" -w \
        -o "-p $PORT -c listen_addresses=localhost -c unix_socket_directories=$DIR" start >/dev/null
    fi
    export PGPASSWORD; PGPASSWORD="$(cat "$PWFILE")"
    for db in taxkatha taxkatha_test; do
      exists="$("$PGBIN/psql" -h localhost -p "$PORT" -U "$PGUSER_NAME" -d postgres -Atc "select 1 from pg_database where datname='$db'")"
      if [ "$exists" != "1" ]; then "$PGBIN/createdb" -h localhost -p "$PORT" -U "$PGUSER_NAME" "$db"; fi
    done
    URL="postgres://$PGUSER_NAME:$PGPASSWORD@localhost:$PORT/taxkatha"
    set_env DATABASE_URL "$URL"
    set_env DATABASE_URL_UNPOOLED "$URL"
    set_env TEST_DATABASE_URL "postgres://$PGUSER_NAME:$PGPASSWORD@localhost:$PORT/taxkatha_test"
    set_env BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
    set_env BETTER_AUTH_URL "http://localhost:3000"
    set_env NEXT_PUBLIC_SITE_URL "http://localhost:3000"
    echo "Postgres is running on localhost:$PORT (databases: taxkatha, taxkatha_test)"
    ;;
  down)
    if running; then "$PGBIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null; echo "Postgres stopped"; else echo "Postgres is not running"; fi
    ;;
  status)
    if [ -d "$DATA" ] && running; then echo "running on localhost:$PORT"; else echo "stopped"; fi
    ;;
  psql)
    export PGPASSWORD; PGPASSWORD="$(cat "$PWFILE")"
    shift
    exec "$PGBIN/psql" -h localhost -p "$PORT" -U "$PGUSER_NAME" -d "${TAXKATHA_DB:-taxkatha}" "$@"
    ;;
  *)
    echo "usage: db-local.sh up|down|status|psql" >&2; exit 2 ;;
esac
