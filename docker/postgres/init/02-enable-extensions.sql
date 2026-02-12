-- ============================================
-- PostgreSQL extensions for KinTales
-- ============================================

-- Cryptographic functions (for encrypting sensitive fields like cause_of_death)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- UUID generation (gen_random_uuid is built-in since PG 13, but uuid-ossp adds more options)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Audit logging (tracks all write + DDL operations)
CREATE EXTENSION IF NOT EXISTS "pgaudit";
