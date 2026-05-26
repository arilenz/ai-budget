#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> dumping OpenAPI spec from apps/api -> openapi.yaml"
( cd "$ROOT/apps/api" && npm run --silent openapi:dump )

echo "==> generating TypeScript client from openapi.yaml"
( cd "$ROOT/packages/api-client" && npm run --silent generate )

echo "done."
