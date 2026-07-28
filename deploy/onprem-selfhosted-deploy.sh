#!/usr/bin/env bash
set -euo pipefail

deploy_env="${DEPLOY_ENV:-/opt/client-demo-app/deployment.env}"
deploy_changelog="${DEPLOY_CHANGELOG:-/opt/client-demo-app/deployment-notes/CHANGELOG.md}"
compose_env=".deploy-runtime.env"
compose_files=(-f compose.production.yml -f compose.onprem-demo.yml)
secret_stage_dir="${DEPLOY_SECRET_STAGE_DIR:-${RUNNER_WORKSPACE:-$(pwd)/..}/_rfly-deploy-secrets}"

cleanup() {
  rm -f "$compose_env"
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

require_file "$deploy_env"
require_file compose.production.yml
require_file compose.onprem-demo.yml
sed -e 's/\r$//' -e 's/[[:space:]]*$//' "$deploy_env" > "$compose_env"
chmod 0600 "$compose_env"

set -a
# shellcheck disable=SC1090
. "./$compose_env"
set +a

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

if docker ps --format '{{.Names}}' | grep -Fxq 'srs'; then
  echo "Verified existing srs container is running."
else
  fail "Existing srs container was not observed running; stop before deploying and inspect the server."
fi

if ss -lntup | grep -q ':8088 '; then
  if ! docker ps --format '{{.Names}}' | grep -Eq '^rfly-onprem-demo.*frontend|^rfly-onprem-demo.*-frontend'; then
    echo "Port 8088 is already in use. Continuing only if it belongs to this Compose deployment will be checked by Docker."
  fi
fi

mkdir -p "$(dirname "$deploy_changelog")"

source_sha="$(git rev-parse HEAD)"
started_at="$(date --iso-8601=seconds)"

compose config --quiet

echo "Building deployment images."
compose build db migrate backend frontend

echo "Starting database."
compose up --detach db
wait_for_service_healthy db

echo "Running database migrations."
compose rm --force --stop migrate >/dev/null 2>&1 || true
compose run --rm migrate

echo "Starting backend and frontend."
compose up --detach --no-deps backend frontend

wait_for_http http://127.0.0.1:8088/healthz
wait_for_http http://127.0.0.1:8088/api/health

if ! docker ps --format '{{.Names}}' | grep -Fxq 'srs'; then
  fail "srs container disappeared after deployment."
fi

{
  echo
  echo "## ${started_at}"
  echo
  echo "- source_sha: ${source_sha}"
  echo "- workflow_run: ${GITHUB_RUN_ID:-local}"
  echo "- compose_files: compose.production.yml + compose.onprem-demo.yml"
  echo "- deploy_env: ${deploy_env}"
  echo "- host_port: 8088"
  echo "- checks: compose config, build, db health, migration, localhost /healthz, localhost /api/health, srs still running"
  echo "- rollback: docker compose --env-file ${deploy_env} -f compose.production.yml -f compose.onprem-demo.yml down"
} >> "$deploy_changelog"

echo "On-prem deployment completed for ${source_sha}."
