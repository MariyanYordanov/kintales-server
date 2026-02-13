#!/bin/bash
set -e

# Validate required environment variables
for var in KINTALES_APP_DB_PASSWORD KINTALES_ADMIN_DB_PASSWORD KINTALES_BACKUP_DB_PASSWORD; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is not set" >&2
    exit 1
  fi
done

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v app_pass="$KINTALES_APP_DB_PASSWORD" \
  -v admin_pass="$KINTALES_ADMIN_DB_PASSWORD" \
  -v backup_pass="$KINTALES_BACKUP_DB_PASSWORD" \
  -v db_name="$POSTGRES_DB" <<-'EOSQL'
  CREATE ROLE kintales_app WITH LOGIN PASSWORD :'app_pass'
    CONNECTION LIMIT 20;

  CREATE ROLE kintales_admin WITH LOGIN PASSWORD :'admin_pass'
    CREATEDB;

  CREATE ROLE kintales_backup WITH LOGIN PASSWORD :'backup_pass';

  GRANT CONNECT ON DATABASE :db_name TO kintales_app;
  GRANT CONNECT ON DATABASE :db_name TO kintales_backup;
  GRANT USAGE ON SCHEMA public TO kintales_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kintales_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kintales_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kintales_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO kintales_app;

  GRANT SELECT ON ALL TABLES IN SCHEMA public TO kintales_backup;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO kintales_backup;
EOSQL
