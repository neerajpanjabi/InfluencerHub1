#!/usr/bin/env bash
# Nightly logical backup of the InfluenceHub database.
# Requires: DATABASE_URL, BACKUP_BUCKET (s3://...), AGE_RECIPIENT (public key) — run from a secured job runner.
set -euo pipefail
ts=$(date -u +%Y%m%dT%H%M%SZ)
file="influencehub-${ts}.dump"
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="/tmp/${file}"
age -r "$AGE_RECIPIENT" -o "/tmp/${file}.age" "/tmp/${file}"
aws s3 cp "/tmp/${file}.age" "${BACKUP_BUCKET}/${file}.age" --only-show-errors
rm -f "/tmp/${file}" "/tmp/${file}.age"
echo "backup uploaded: ${file}.age"
