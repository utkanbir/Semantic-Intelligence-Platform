# Port-forward cluster PostgreSQL to localhost:5433 (avoids conflict with local 5432).
# Keep this terminal open while using DBeaver/pgAdmin/psql.
#
# Connection:
#   Host: localhost
#   Port: 5433
#   User: sip_user
#   Password: replace-me  (or value from sip-postgres-secrets)
#   Database: sip_db

$ErrorActionPreference = "Stop"
Write-Host "Forwarding sip-dev/sip-postgres -> localhost:5433 (Ctrl+C to stop)" -ForegroundColor Cyan
kubectl -n sip-dev port-forward svc/sip-postgres 5433:5432
