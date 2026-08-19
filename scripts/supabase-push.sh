#!/usr/bin/env bash
# Links to the Supabase project for the given environment and pushes pending
# migrations. Used by `npm run supabase:push:dev` / `supabase:push:prod`.
set -euo pipefail

env_name="${1:?Usage: supabase-push.sh <dev|prod>}"
env_file=".env.${env_name}"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file — copy .env.${env_name}.example to $env_file and fill in real values first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF not set in $env_file}"
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN not set in $env_file}"

echo "Linking to Supabase project ($env_name): $SUPABASE_PROJECT_REF"
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "Pushing migrations to $env_name..."
npx supabase db push
