#!/usr/bin/env bash
set -euo pipefail

deploy_env="${DEPLOY_ENV:-/opt/client-demo-app/deployment.env}"
deploy_changelog="${DEPLOY_CHANGELOG:-/opt/client-demo-app/deployment-notes/CHANGELOG.md}"
compose_override="${DEPLOY_COMPOSE_OVERRIDE:-compose.onprem-demo.yml}"
compose_env=".deploy-runtime.env"
compose_files=(-f compose.production.yml -f "$compose_override")
secret_stage_root="${RUNNER_WORKSPACE:-$(pwd)/..}/_rfly-deploy-secrets"
backup_temp=""
backup_file=""
backup_checksum=""

cleanup() {
  rm -f "$compose_env"
  if [ -n "$backup_temp" ]; then
    rm -f "$backup_temp"
  fi
}

dump_diagnostics() {
  echo "::group::compose ps"
  compose ps || true
  echo "::endgroup::"

  for service in db migrate backend frontend; do
    echo "::group::compose logs ${service}"
    compose logs --no-color --tail=200 "$service" || true
    echo "::endgroup::"
  done
}

on_exit() {
  local status="$?"
  if [ "$status" -ne 0 ]; then
    echo "Deployment failed with exit code ${status}. Dumping Compose diagnostics." >&2
    dump_diagnostics
  fi
  cleanup
  exit "$status"
}

trap on_exit EXIT

fail() {
  echo "deploy_error=$1" >&2
  exit 1
}

retry_command() {
  local description="$1"
  shift
  local attempt=1
  local max_attempts="${DEPLOY_REGISTRY_MAX_ATTEMPTS:-5}"
  local delay_seconds

  case "$max_attempts" in
    *[!0-9]*|'') fail "DEPLOY_REGISTRY_MAX_ATTEMPTS must be a positive integer" ;;
  esac
  [ "$max_attempts" -ge 1 ] || fail "DEPLOY_REGISTRY_MAX_ATTEMPTS must be at least 1"

  while true; do
    echo "${description} (attempt ${attempt}/${max_attempts})."
    if "$@"; then
      return 0
    fi

    if [ "$attempt" -ge "$max_attempts" ]; then
      fail "${description} failed after ${max_attempts} attempts"
    fi

    delay_seconds=$((attempt * 10))
    echo "${description} failed; retrying in ${delay_seconds} seconds." >&2
    sleep "$delay_seconds"
    attempt=$((attempt + 1))
  done
}

require_file() {
  local file="$1"
  [ -r "$file" ] || fail "Required file is not readable: $file"
}

require_env_file_path() {
  local var_name="$1"
  local file_path="${!var_name:-}"
  [ -n "$file_path" ] || fail "Required deployment variable is not set: $var_name"
  [ -r "$file_path" ] || fail "Required file from $var_name is not readable: $file_path"
}

rewrite_env_value() {
  local var_name="$1"
  local var_value="$2"
  local temp_env="${compose_env}.tmp"

  awk -F= -v key="$var_name" -v value="$var_value" '
    BEGIN { updated = 0 }
    $1 == key { print key "=" value; updated = 1; next }
    { print }
    END { if (!updated) print key "=" value }
  ' "$compose_env" > "$temp_env"
  mv "$temp_env" "$compose_env"
}

stage_secret_file() {
  local var_name="$1"
  local target_name="$2"
  local source_path="${!var_name:-}"
  local target_path="${secret_stage_dir}/${target_name}"

  [ -n "$source_path" ] || fail "Required deployment variable is not set: $var_name"
  [ -r "$source_path" ] || fail "Required file from $var_name is not readable: $source_path"

  rm -f "$target_path" || fail "Could not remove previous staged secret file for $var_name"
  cp "$source_path" "$target_path" || fail "Could not stage secret file from $var_name into Docker-visible runner workspace"
  chmod 0444 "$target_path" || fail "Could not secure staged secret file for $var_name"
  [ -r "$target_path" ] || fail "Staged secret file is not readable: $target_path"

  rewrite_env_value "$var_name" "$target_path"
  export "${var_name}=${target_path}"
}

compose() {
  docker compose --env-file "$compose_env" "${compose_files[@]}" "$@"
}

verify_docker_can_mount_file() {
  local file_path="$1"
  local image="${POSTGRES_IMAGE:-postgres:16-alpine}"

  docker run --rm \
    --mount "type=bind,src=${file_path},dst=/run/secret-check,readonly" \
    --entrypoint /bin/sh \
    "$image" \
    -c 'test -r /run/secret-check' \
    >/dev/null || fail "Docker cannot bind-mount staged secret file: $file_path"
}

wait_for_http() {
  local url="$1"
  local deadline=$((SECONDS + 240))

  until curl --fail --silent --show-error "$url" >/dev/null; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      fail "Timed out waiting for ${url}"
    fi
    sleep 5
  done
}

wait_for_service_healthy() {
  local service="$1"
  local deadline=$((SECONDS + 240))
  local container_id=""
  local health_status=""

  until [ -n "$container_id" ]; do
    container_id="$(compose ps -q "$service" 2>/dev/null || true)"
    if [ "$SECONDS" -ge "$deadline" ]; then
      fail "Timed out waiting for ${service} container to exist"
    fi
    sleep 2
  done

  while true; do
    health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
    case "$health_status" in
      healthy|running|exited)
        echo "Service ${service} status: ${health_status}"
        return
        ;;
      unhealthy)
        fail "Service ${service} became unhealthy"
        ;;
    esac

    if [ "$SECONDS" -ge "$deadline" ]; then
      fail "Timed out waiting for ${service} to become healthy"
    fi
    sleep 5
  done
}

backup_database_before_migration() {
  local backup_root="${DEPLOY_BACKUP_DIRECTORY:-$(dirname "$deploy_env")/backups}"
  local backup_directory
  local resolved_backup_root
  local worktree_root
  local backup_stamp
  case "$backup_root" in
    /*) ;;
    *) fail "DEPLOY_BACKUP_DIRECTORY must be an absolute host path" ;;
  esac
  [ "$backup_root" != "/" ] || fail "DEPLOY_BACKUP_DIRECTORY cannot be the filesystem root"
  mkdir -p "$backup_root" || fail "Could not create database backup root"
  resolved_backup_root="$(cd "$backup_root" && pwd -P)"
  worktree_root="$(pwd -P)"
  case "${resolved_backup_root}/" in
    "${worktree_root}/"*) fail "Database backups must be stored outside the repository checkout" ;;
  esac
  backup_directory="${resolved_backup_root}/${DEPLOYMENT_NAME}"
  backup_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$backup_directory" || fail "Could not create database backup directory"
  chmod 0700 "$backup_directory" || fail "Could not secure database backup directory"
  umask 077
  backup_temp="$(mktemp "${backup_directory}/${DEPLOYMENT_NAME}-${backup_stamp}-${source_sha}.XXXXXX.dump")" \
    || fail "Could not allocate a unique database backup file"
  backup_file="$backup_temp"

  echo "Creating a pre-migration PostgreSQL backup."
  compose exec -T db pg_dump \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --format custom \
    --no-owner \
    --no-privileges \
    > "$backup_temp"
  [ -s "$backup_temp" ] || fail "Pre-migration database backup is empty"
  compose exec -T db pg_restore --list < "$backup_temp" >/dev/null \
    || fail "Pre-migration database backup could not be read back"
  chmod 0600 "$backup_temp"
  sync "$backup_temp" || fail "Could not flush the verified database backup to storage"
  backup_checksum="$(sha256sum "$backup_file" | awk '{print $1}')"
  [ -n "$backup_checksum" ] || fail "Could not calculate database backup checksum"
  backup_temp=""
  echo "Verified pre-migration backup: ${backup_file}"
}

require_file "$deploy_env"
require_file compose.production.yml
require_file "$compose_override"
sed -e 's/\r$//' -e 's/[[:space:]]*$//' "$deploy_env" > "$compose_env"
chmod 0600 "$compose_env"

set -a
# shellcheck disable=SC1090
. "./$compose_env"
set +a

[ -n "${DEPLOYMENT_NAME:-}" ] || fail "DEPLOYMENT_NAME must be set in the deployment environment"
case "$DEPLOYMENT_NAME" in
  *[!a-z0-9_-]*|'') fail "DEPLOYMENT_NAME may contain only lowercase letters, digits, underscores, and hyphens" ;;
esac
[ -n "${APP_PORT:-}" ] || fail "APP_PORT must be set in the deployment environment"
case "$APP_PORT" in
  *[!0-9]*|'') fail "APP_PORT must be a numeric TCP port" ;;
esac
if [ "$APP_PORT" -lt 1024 ] || [ "$APP_PORT" -gt 65535 ]; then
  fail "APP_PORT must be between 1024 and 65535"
fi

health_host="${DEPLOY_HEALTH_HOST:-${APP_BIND_ADDRESS:-127.0.0.1}}"
case "$health_host" in
  0.0.0.0|'::') health_host="127.0.0.1" ;;
esac

secret_stage_dir="${DEPLOY_SECRET_STAGE_DIR:-${secret_stage_root}/${DEPLOYMENT_NAME}}"

require_env_file_path DB_PASSWORD_FILE
require_env_file_path RECOVERY_HASH_SECRET_FILE
require_env_file_path OTP_HASH_SECRET_FILE

mkdir -p "$secret_stage_dir" || fail "Could not create Docker-visible secret staging directory: $secret_stage_dir"
[ -d "$secret_stage_dir" ] || fail "Secret staging path is not a directory: $secret_stage_dir"
[ -w "$secret_stage_dir" ] || fail "Secret staging directory is not writable by $(id -un): $secret_stage_dir"
chmod 0700 "$secret_stage_dir" || fail "Could not secure secret staging directory: $secret_stage_dir"
stage_secret_file DB_PASSWORD_FILE db_password
stage_secret_file RECOVERY_HASH_SECRET_FILE recovery_hash_secret
stage_secret_file OTP_HASH_SECRET_FILE otp_hash_secret

if ! docker info >/dev/null 2>&1; then
  fail "Docker is not available to the self-hosted runner. Add the runner user to the docker group or configure approved non-interactive Docker access."
fi
verify_docker_can_mount_file "$DB_PASSWORD_FILE"

existing_frontend_id="$(compose ps -q frontend 2>/dev/null || true)"
published_container_ids="$(docker ps --filter "publish=${APP_PORT}" --format '{{.ID}}' || true)"
if [ -n "$published_container_ids" ]; then
  while IFS= read -r container_id; do
    [ -z "$container_id" ] && continue
    if [ -z "$existing_frontend_id" ] || [ "$container_id" != "${existing_frontend_id:0:12}" ]; then
      fail "Host port ${APP_PORT} is published by a container outside deployment ${DEPLOYMENT_NAME}"
    fi
  done <<< "$published_container_ids"
elif ss -lnt | grep -Eq ":${APP_PORT}[[:space:]]"; then
  fail "Host port ${APP_PORT} is already used by a non-Docker listener"
fi

mkdir -p "$(dirname "$deploy_changelog")"

source_sha="$(git rev-parse HEAD)"
started_at="$(date --iso-8601=seconds)"

# Tag locally built images with the exact deployed revision. The operator's
# environment file remains unchanged; only this deployment's runtime copy is
# rewritten. This prevents staging and production from relying on one mutable
# image tag.
rewrite_env_value IMAGE_TAG "$source_sha"
export IMAGE_TAG="$source_sha"

compose config --quiet

# Compose BuildKit resolves Dockerfile frontends and base-image metadata through
# Docker Hub even when layers are already cached. The office connection has
# occasionally returned short-lived DNS failures for auth.docker.io. Build the
# targets sequentially and retry each one so a transient registry lookup cannot
# abort an otherwise safe deployment or create a burst of concurrent lookups.
echo "Building deployment images sequentially with registry retry protection."
retry_command "Building migration image" compose build migrate
retry_command "Building backend image" compose build backend
retry_command "Building frontend image" compose build frontend

echo "Starting database."
compose up --detach db
wait_for_service_healthy db

backup_database_before_migration

echo "Running database migrations."
compose rm --force --stop migrate >/dev/null 2>&1 || true
compose run --rm migrate

echo "Starting backend and frontend."
compose up --detach --no-deps backend frontend

wait_for_http "http://${health_host}:${APP_PORT}/healthz"
wait_for_http "http://${health_host}:${APP_PORT}/api/health"

{
  echo
  echo "## ${started_at}"
  echo
  echo "- source_sha: ${source_sha}"
  echo "- image_tag: ${source_sha}"
  echo "- workflow_run: ${GITHUB_RUN_ID:-local}"
  echo "- deployment_name: ${DEPLOYMENT_NAME}"
  echo "- compose_files: compose.production.yml + ${compose_override}"
  echo "- deploy_env: ${deploy_env}"
  echo "- bind_address: ${APP_BIND_ADDRESS:-127.0.0.1}"
  echo "- host_port: ${APP_PORT}"
  echo "- pre_migration_backup: ${backup_file}"
  echo "- pre_migration_backup_sha256: ${backup_checksum}"
  echo "- checks: compose config, build, db health, verified backup, migration, /healthz, /api/health"
  echo "- recovery: redeploy the approved prior source revision; restore ${backup_file} only through the documented, outage-controlled database restore procedure when schema rollback requires it"
} >> "$deploy_changelog"

echo "On-prem deployment completed for ${source_sha}."
