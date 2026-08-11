#!/bin/sh
set -eu

load_secret_file() {
  variable_name="$1"
  required="${2:-false}"
  eval "file_path=\${${variable_name}_FILE:-}"

  if [ -n "$file_path" ]; then
    if [ ! -r "$file_path" ]; then
      echo "Required secret file for ${variable_name} is not readable." >&2
      exit 1
    fi
    secret_value="$(cat "$file_path")"
    if [ -z "$secret_value" ]; then
      echo "Secret file for ${variable_name} is empty." >&2
      exit 1
    fi
    export "${variable_name}=${secret_value}"
    unset "${variable_name}_FILE"
  fi

  eval "current_value=\${${variable_name}:-}"
  if [ "$required" = "true" ] && [ -z "$current_value" ]; then
    echo "${variable_name} or ${variable_name}_FILE is required." >&2
    exit 1
  fi
}

build_database_url() {
  if [ -n "${DATABASE_URL:-}" ]; then
    return
  fi

  password_file="${DATABASE_PASSWORD_FILE:-}"
  if [ -z "$password_file" ] || [ ! -r "$password_file" ]; then
    echo "DATABASE_URL(_FILE) or a readable DATABASE_PASSWORD_FILE is required." >&2
    exit 1
  fi

  : "${DATABASE_HOST:?DATABASE_HOST is required}"
  : "${DATABASE_PORT:=5432}"
  : "${DATABASE_USER:?DATABASE_USER is required}"
  : "${DATABASE_NAME:?DATABASE_NAME is required}"

  case "$DATABASE_PORT" in *[!0-9]*|'') echo "DATABASE_PORT must be numeric." >&2; exit 1 ;; esac
  case "$DATABASE_USER" in *[!A-Za-z0-9_-]*|'') echo "DATABASE_USER contains unsupported characters." >&2; exit 1 ;; esac
  case "$DATABASE_NAME" in *[!A-Za-z0-9_-]*|'') echo "DATABASE_NAME contains unsupported characters." >&2; exit 1 ;; esac
  case "$DATABASE_HOST" in *[!A-Za-z0-9_.:-]*|'') echo "DATABASE_HOST contains unsupported characters." >&2; exit 1 ;; esac

  DATABASE_URL="$(
    DATABASE_PASSWORD_FILE="$password_file" \
    DATABASE_HOST="$DATABASE_HOST" \
    DATABASE_PORT="$DATABASE_PORT" \
    DATABASE_USER="$DATABASE_USER" \
    DATABASE_NAME="$DATABASE_NAME" \
    node <<'NODE'
const fs = require('fs');
const password = fs.readFileSync(process.env.DATABASE_PASSWORD_FILE, 'utf8').trim();
if (!password) process.exit(1);
const user = encodeURIComponent(process.env.DATABASE_USER);
const host = process.env.DATABASE_HOST;
const port = process.env.DATABASE_PORT;
const name = encodeURIComponent(process.env.DATABASE_NAME);
process.stdout.write(`postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}?schema=public`);
NODE
  )"
  if [ -z "$DATABASE_URL" ]; then
    echo "Could not construct DATABASE_URL from the supplied database secret." >&2
    exit 1
  fi
  export DATABASE_URL
  unset DATABASE_PASSWORD_FILE
}

load_secret_file DATABASE_URL false
if [ "${APP_RUNTIME_MODE:-server}" != "importer-preflight" ]; then
  build_database_url
fi

load_secret_file UPI_WEBHOOK_SECRET false
load_secret_file WHATSAPP_API_KEY false
load_secret_file WEATHER_API_KEY false
load_secret_file UPI_GATEWAY_KEY false

if [ "${APP_RUNTIME_MODE:-server}" = "server" ]; then
  load_secret_file RECOVERY_HASH_SECRET true
  load_secret_file OTP_HASH_SECRET false
fi

exec "$@"
