#!/usr/bin/env bash
#
# server.sh — serve the Thai flashcard app with Caddy.
#
# Binds to 0.0.0.0:9999 so other devices on your LAN (e.g. an iPad) can reach
# it at http://<this-machine-ip>:9999/ .
#
# EXPOSURE NOTE: 0.0.0.0 means every host on your local network can load this
# page. That is intended here — the content is a public, non-sensitive set of
# Thai sight words with no login and no private data. If you only want to view
# it on THIS machine, run:  BIND=127.0.0.1 ./server.sh
#
set -euo pipefail

# Directory this script lives in (so it works no matter where you invoke it).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Address to listen on. Override with e.g. BIND=127.0.0.1 ./server.sh
BIND="${BIND:-0.0.0.0}"
PORT="${PORT:-9999}"

if ! command -v caddy >/dev/null 2>&1; then
  echo "Error: 'caddy' is not installed or not on PATH." >&2
  echo "Install it from https://caddyserver.com/docs/install" >&2
  exit 1
fi

echo "Serving ${ROOT}"
echo "Listening on ${BIND}:${PORT}"
if [ "${BIND}" = "0.0.0.0" ]; then
  echo "Reachable from other devices on your network at http://<your-ip>:${PORT}/"
fi

exec caddy file-server --root "${ROOT}" --listen "${BIND}:${PORT}"
