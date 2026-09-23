#!/bin/bash
#
# Compatibility wrapper for the TypeScript deploy build command.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || { echo "Failed to cd to $REPO_ROOT"; exit 1; }

# The Coolify build server's IPv6 path to Cloudflare stalls intermittently during
# the TLS handshake. Bun reports it as "unknown certificate verification error",
# Node as UND_ERR_CONNECT_TIMEOUT. Print both address families' timings so a
# failed build log shows whether the path is healthy. Informational only.
for host in pro-api.llama.fi api.llama.fi; do
	for family in 4 6; do
		result="$(curl -"$family" -sS -o /dev/null --max-time 10 \
			-w 'ip=%{remote_ip} connect=%{time_connect}s tls=%{time_appconnect}s status=%{http_code}' \
			"https://$host/" 2>&1)" || true
		echo "[build:network] $host IPv$family: $result"
	done
done

# Prefer IPv4 in both runtimes: Bun runs build preparation in this process and
# ignores NODE_OPTIONS; Next.js runs `next build` under Node, which reads it.
export NODE_OPTIONS="${NODE_OPTIONS:-} --dns-result-order=ipv4first"
exec bun --dns-result-order=ipv4first ./scripts/command/deployBuildCli.ts
