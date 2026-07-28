#!/usr/bin/env bash
set -euo pipefail

deploy_env="${DEPLOY_ENV:-/opt/client-demo-app/deployment.env}"
deploy_changelog="${DEPLOY_CHANGELOG:-/opt/client-demo-app/deployment-notes/CHANGELOG.md}"
compose_env=".deploy-runtime.env"
compose_files=(-f compose.production.yml -f compose.onprem-demo.yml)

cleanup() {
  rm -f "$compose_env"
}

trap cleanup EXIT

fail() {
  echo "deploy_error=$1" >&2
  exit 1
}

require_file() {
  local file="$1"
  [ -r "$file" ] || fail "Required file is not readable: $file"
}

compose() {
  docker compose --env-file "$compose_env" "${compose_files[@]}" "$@"
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

require_file "$deploy_env"
require_file compose.production.yml
require_file compose.onprem-demo.yml
cp "$deploy_env" "$compose_env"
chmod 0600 "$compose_env"

if ! docker info >/dev/null 2>&1; then
  fail "Docker is not available to the self-hosted runner. Add the runner user to the docker group or configure approved non-interactive Docker access."
fi

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

if docker compose up --help | grep -q -- '--wait'; then
  compose up --detach --build --wait --wait-timeout 240
else
  echo "Docker Compose does not advertise --wait support; using health-check polling fallback."
  compose up --detach --build
fi

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
  echo "- checks: compose config, compose up, localhost /healthz, localhost /api/health, srs still running"
  echo "- rollback: docker compose --env-file ${deploy_env} -f compose.production.yml -f compose.onprem-demo.yml down"
} >> "$deploy_changelog"

echo "On-prem deployment completed for ${source_sha}."
