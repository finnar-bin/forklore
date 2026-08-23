#!/usr/bin/env bash
# Links to the Supabase project for the given environment and deploys Edge
# Functions. Used by `npm run supabase:deploy-functions:dev` / `:prod`.
# R2 secrets (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
# R2_BUCKET, R2_PUBLIC_URL) must already be set for this project via
# `supabase secrets set` — see .env.dev.example for the names.
set -euo pipefail

env_name="${1:?Usage: supabase-deploy-functions.sh <dev|prod>}"
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

echo "Deploying get-upload-url to $env_name..."
npx supabase functions deploy get-upload-url

echo "Deploying delete-photo to $env_name..."
npx supabase functions deploy delete-photo
