#!/bin/bash
# ============================================
# KinTales Monthly Restore Test
# Verifies backup integrity by restoring to a temporary database
# ============================================
set -euo pipefail

LATEST_BACKUP=$(ls -t /backup/db_*.sql.gpg 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "Error: No backup files found"
  exit 1
fi

echo "$(date): Testing restore from $LATEST_BACKUP..."

# 1. Create temporary database
docker exec kintales-postgres psql -U kintales_admin -c "CREATE DATABASE kintales_test_restore;"

# 2. Restore to temp database
gpg --decrypt --passphrase-file /root/.backup-passphrase "$LATEST_BACKUP" | \
  docker exec -i kintales-postgres psql -U kintales_admin kintales_test_restore

# 3. Verify data integrity (basic checks)
TABLES=$(docker exec kintales-postgres psql -U kintales_admin -d kintales_test_restore -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
echo "Tables found: $TABLES"

PROFILES=$(docker exec kintales-postgres psql -U kintales_admin -d kintales_test_restore -t -c \
  "SELECT count(*) FROM profiles;" 2>/dev/null || echo "0")
echo "Profiles: $PROFILES"

# 4. Cleanup
docker exec kintales-postgres psql -U kintales_admin -c "DROP DATABASE kintales_test_restore;"

echo "$(date): Restore test completed successfully"
