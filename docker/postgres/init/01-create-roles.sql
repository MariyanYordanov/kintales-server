-- ============================================
-- Database roles for KinTales
-- ============================================

-- Application role (used by the Node.js API)
CREATE ROLE kintales_app WITH LOGIN PASSWORD 'change_me_app_password'
  CONNECTION LIMIT 20;

-- Admin role (used for migrations and maintenance)
CREATE ROLE kintales_admin WITH LOGIN PASSWORD 'change_me_admin_password'
  CREATEDB;

-- Backup role (read-only, used by backup scripts)
CREATE ROLE kintales_backup WITH LOGIN PASSWORD 'change_me_backup_password';

-- Grant privileges to application role
GRANT CONNECT ON DATABASE kintales TO kintales_app;
GRANT CONNECT ON DATABASE kintales TO kintales_backup;
GRANT USAGE ON SCHEMA public TO kintales_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kintales_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kintales_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kintales_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kintales_app;

-- Grant read-only to backup role
GRANT SELECT ON ALL TABLES IN SCHEMA public TO kintales_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO kintales_backup;
