#!/bin/sh
set -eu

raw_origins="${MAP_FRAME_ORIGINS:-}"
map_frame_sources="'none'"

if [ -n "$raw_origins" ]; then
  map_frame_sources=""
  old_ifs="$IFS"
  IFS=','
  for origin in $raw_origins; do
    origin="$(printf '%s' "$origin" | tr -d '[:space:]')"
    if ! printf '%s' "$origin" | grep -Eq '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'; then
      echo "MAP_FRAME_ORIGINS must contain comma-separated HTTPS origins without paths." >&2
      exit 1
    fi
    map_frame_sources="${map_frame_sources} ${origin}"
  done
  IFS="$old_ifs"
fi

export MAP_FRAME_SOURCES="$map_frame_sources"
envsubst '${MAP_FRAME_SOURCES}' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf

exec "$@"
