#!/bin/bash
# ============================================
# KinTales Daily Backup Script
# Runs daily via cron at 3:00 AM
# ============================================
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backup
RETENTION_DAYS=30

echo "$(date): Starting backup..."

# 1. PostgreSQL dump (encrypted)
docker exec kintales-postgres pg_dump -U kintales_backup kintales | \
  gpg --symmetric --cipher-algo AES256 --passphrase-file /root/.backup-passphrase \
  > "$BACKUP_DIR/db_$DATE.sql.gpg"

# 2. MinIO data sync
rsync -a /var/lib/docker/volumes/kintales_minio_data/ "$BACKUP_DIR/minio_$DATE/"

# 3. Cleanup old backups
find "$BACKUP_DIR" -name "db_*.sql.gpg" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "minio_*" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} +

# 4. Sync to backup disk (RAID 1 second disk or external)
rsync -a "$BACKUP_DIR/" /mnt/backup-disk/kintales/

# 5. Log success
echo "$(date): Backup completed: db_$DATE.sql.gpg" >> /var/log/kintales-backup.log
