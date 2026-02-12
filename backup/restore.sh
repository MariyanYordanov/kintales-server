#!/bin/bash
# ============================================
# KinTales Restore Script
# Usage: ./restore.sh /path/to/db_YYYYMMDD_HHMMSS.sql.gpg
# ============================================
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <backup_file.sql.gpg>"
  exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "$(date): Starting restore from $BACKUP_FILE..."

# 1. Decrypt and restore
gpg --decrypt --passphrase-file /root/.backup-passphrase "$BACKUP_FILE" | \
  docker exec -i kintales-postgres psql -U kintales_admin kintales

echo "$(date): Restore completed successfully"
