#!/usr/bin/env bash
# High-load testing script for cluster balancer
# Prints one line per request: port=<port> url=<url> status=<code> data=<body>
# Usage: bash scripts/highload.sh [COUNT] [URL] [CONCURRENCY]

set -euo pipefail

COUNT="${1:-100}"
URL="${2:-http://localhost:4000/api/users}"
CONCURRENCY="${3:-50}"

export TARGET_URL="$URL"

# Preflight: check if target is reachable
if ! curl -sS --connect-timeout 1 --max-time 3 -o /dev/null "$TARGET_URL"; then
    echo "Target not reachable: $TARGET_URL" >&2
    exit 1
fi

# Run requests in parallel
seq "$COUNT" | xargs -n1 -P "$CONCURRENCY" -I{} bash -c '
    url="$TARGET_URL"
    headers_file=$(mktemp)
    body_file=$(mktemp)

    if ! curl -sS --connect-timeout 1 --max-time 5 -D "$headers_file" -o "$body_file" "$url"; then
        rm -f "$headers_file" "$body_file"
        exit 0
    fi

    # Status code
    status=$(head -n1 "$headers_file" | awk "{print \$2}")

    # X-Worker-Port header (case-insensitive)
    port=$(grep -i "^X-Worker-Port:" "$headers_file" | awk "{print \$2}" | tr -d "\r")

    # Body
    body=$(tr -d "\n" < "$body_file")

    echo "port=${port:-N/A} url=${url} status=${status} data=${body}"

    rm -f "$headers_file" "$body_file"
'
