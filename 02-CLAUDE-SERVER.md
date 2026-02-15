# CLAUDE.md — KinTales Server (API + Infrastructure)

> This is the KinTales backend: REST API server + Docker infrastructure (PostgreSQL, MinIO, ClamAV, Postfix, Nginx).
> Runs on: Lenovo ThinkPad T15G, 64GB RAM, 2x SSD (RAID 1), Ubuntu Server 24.04 LTS, static IP.
> Related projects: kintales-app, @kintales/tree-view, @kintales/name-days, kintales-infra

---

## WHO YOU ARE

You are a **senior backend architect and DevOps mentor** working with a developer who is advanced in JavaScript/React but new to: Docker, PostgreSQL administration, server security, email servers, and production deployments. Your job is to:

1. Build a production-quality, security-hardened API server step by step.
2. **Explain WHY** every security measure exists — don't just configure, teach.
3. Write clean, tested, documented code with proper error handling.
4. Never expose sensitive data. Never trust user input. Never skip validation.
5. When the developer asks to do something, confirm it aligns with the current phase.

---

## ARCHITECTURE

```
Internet → Cloudflare (DDoS/WAF/SSL) → Static IP → ThinkPad T15G
                                                        │
                                         ┌──────────────┼──────────────┐
                                         │              │              │
                                      Docker          Docker         Docker
                                      Nginx          PostgreSQL 17   MinIO
                                   (reverse proxy,   (TLS, RLS,     (S3 storage,
                                    rate limiting,    pgAudit,       private
                                    security          pgcrypto,      buckets:
                                    headers)          SCRAM-SHA-256) avatars,
                                         │                           photos,
                                      Docker                        audio)
                                    Node.js API                        │
                                   (Express.js,                     Docker
                                    JWT auth,                       ClamAV
                                    Passport.js)                   (virus scan)
                                         │
                                      Docker
                                      Postfix
                                   (email: DKIM,
                                    SPF, DMARC)
```

All containers communicate on an **internal Docker network**. Only Nginx exposes ports 80/443 to the host. PostgreSQL, MinIO, ClamAV, Postfix are NOT accessible from outside.

---

## TECH STACK

| Component | Technology | Why |
|-----------|-----------|-----|
| Runtime | Node.js 22 LTS | Stable, long-term support |
| Framework | Express.js | Largest ecosystem, developer knows JS |
| ORM | Drizzle ORM | Type-safe, lightweight, SQL-like syntax |
| Database | PostgreSQL 17 | RLS, pgAudit, pgcrypto, proven security |
| File Storage | MinIO | S3-compatible, self-hosted, private buckets |
| Auth | Passport.js + JWT | Google OAuth, email/password |
| Password Hash | argon2 | Strongest current algorithm (NOT bcrypt) |
| Validation | Zod | Schema validation on all endpoints |
| Email | Postfix (self-hosted) | Full control, DKIM/SPF/DMARC |
| Virus Scan | ClamAV | Scan all file uploads |
| Reverse Proxy | Nginx | Rate limiting, headers, SSL termination |
| Scheduler | node-cron | Daily events, dormant checks, auto-confirm |
| Real-time | Socket.io | WebSocket for live comments |
| Containerization | Docker + Docker Compose | Isolation, reproducibility |
| Monitoring | Prometheus + Grafana | System health, alerts |

---

## PROJECT STRUCTURE

```
kintales-server/
├── src/
│   ├── routes/
│   │   ├── auth.routes.js          # POST /register, /login, /refresh, /forgot-password, /reset-password
│   │   │                           # GET /google, /google/callback
│   │   ├── tree.routes.js          # GET/POST/PUT/DELETE /api/trees/*
│   │   ├── relatives.routes.js     # GET/POST/PUT/DELETE /api/relatives/*
│   │   ├── relationships.routes.js # POST/DELETE /api/relationships/*
│   │   ├── stories.routes.js       # GET/POST/PUT/DELETE /api/stories/*
│   │   ├── comments.routes.js      # POST/DELETE /api/comments/*
│   │   ├── photos.routes.js        # GET/POST/DELETE /api/photos/*
│   │   ├── audio.routes.js         # GET/POST/DELETE /api/audio/*
│   │   ├── events.routes.js        # GET /api/trees/:id/events?from=&to=
│   │   ├── death.routes.js         # POST /api/death-records, POST /api/death-records/:id/confirm
│   │   ├── guardians.routes.js     # GET/POST/DELETE /api/guardians/*
│   │   ├── legacy.routes.js        # POST /api/legacy-keys, POST /api/legacy-keys/redeem
│   │   └── export.routes.js        # GET /api/trees/:id/export (ZIP download)
│   ├── middleware/
│   │   ├── auth.middleware.js       # JWT verification, attach user to req
│   │   ├── treeAccess.middleware.js # Verify user is member of tree (owner/editor/viewer)
│   │   ├── rateLimit.middleware.js  # express-rate-limit config
│   │   ├── validate.middleware.js   # Zod schema validation
│   │   ├── upload.middleware.js     # Multer config + ClamAV scan
│   │   ├── cors.middleware.js       # CORS whitelist
│   │   └── security.middleware.js   # Helmet headers, HSTS, CSP
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── tree.service.js
│   │   ├── relatives.service.js
│   │   ├── stories.service.js
│   │   ├── events.service.js        # Birthday/name day/commemoration calculation
│   │   ├── death.service.js         # Confirmation logic, auto-confirm, commemorations
│   │   ├── guardian.service.js
│   │   ├── legacy.service.js        # Key generation (FORMAT-YEAR-HEX), redemption
│   │   ├── storage.service.js       # MinIO upload/download, presigned URLs
│   │   ├── email.service.js         # Send via local Postfix: registration, password reset, legacy invites
│   │   ├── export.service.js        # ZIP generation: photos + audio + stories + tree JSON
│   │   └── virusScan.service.js     # ClamAV integration
│   ├── jobs/
│   │   ├── scheduler.js             # node-cron master scheduler
│   │   ├── generateEvents.js        # Daily 6:00 AM: compute today's birthdays, name days, commemorations
│   │   ├── generatePushNotifications.js # Daily 7:00 AM: send FCM push for today's events
│   │   ├── dormantCheck.js          # Monthly: flag trees with no login > 1 year as DORMANT, > 3 years as ARCHIVED
│   │   ├── autoConfirmDeath.js      # Hourly: auto-confirm death records past 48h deadline
│   │   └── cleanupExpiredTokens.js  # Daily: remove expired refresh tokens
│   ├── db/
│   │   ├── schema.js                # Drizzle ORM schema (all tables)
│   │   ├── migrations/
│   │   └── seeds/
│   │       ├── nameDays.js          # Import from @kintales/name-days
│   │       └── testData.js          # Dev test family
│   ├── websocket/
│   │   ├── index.js                 # Socket.io setup, auth middleware
│   │   └── comments.ws.js           # Room per story, comment:new, comment:deleted
│   ├── config/
│   │   ├── passport.js              # Google OAuth strategy (+ Facebook later)
│   │   ├── database.js              # PostgreSQL connection with TLS
│   │   ├── minio.js                 # MinIO client config
│   │   └── email.js                 # Nodemailer + local Postfix transport
│   ├── utils/
│   │   ├── errors.js                # AppError class, error codes
│   │   ├── logger.js                # Winston structured logging
│   │   └── crypto.js                # Legacy key code generator
│   └── app.js                       # Express setup, middleware chain, routes
├── docker/
│   ├── postgres/
│   │   ├── Dockerfile
│   │   ├── postgresql.conf          # TLS, logging, performance tuning
│   │   ├── pg_hba.conf              # SCRAM-SHA-256, localhost only
│   │   └── init/
│   │       ├── 01-create-roles.sql  # kintales_app, kintales_admin, kintales_backup
│   │       ├── 02-enable-extensions.sql  # pgcrypto, pgaudit, uuid-ossp
│   │       └── 03-enable-rls.sql    # RLS policies on all tables
│   ├── nginx/
│   │   ├── nginx.conf               # Reverse proxy, rate limiting, security headers
│   │   └── ssl/                     # Let's Encrypt certs (mounted volume)
│   ├── minio/
│   │   └── create-buckets.sh        # avatars, photos, audio (private)
│   ├── clamav/
│   │   └── Dockerfile               # ClamAV daemon for file scanning
│   └── postfix/
│       ├── Dockerfile
│       ├── main.cf                   # TLS, DKIM, relay restrictions
│       └── opendkim/                 # DKIM signing keys
├── docker-compose.yml                # ALL services orchestrated
├── docker-compose.dev.yml            # Dev overrides (exposed ports, debug)
├── Dockerfile                        # Node.js API image
├── backup/
│   ├── backup.sh                     # Daily: pg_dump + MinIO sync + GPG encrypt
│   ├── restore.sh                    # Full restore from backup
│   └── test-restore.sh              # Monthly: restore to temp DB, verify integrity
├── .env.example
├── CLAUDE.md
└── README.md
```

---

## DATABASE SCHEMA (Drizzle ORM)

### Core Tables

```sql
profiles:
  id              UUID PK DEFAULT gen_random_uuid()
  email           TEXT UNIQUE NOT NULL
  password_hash   TEXT          -- NULL for OAuth-only users
  full_name       TEXT NOT NULL
  avatar_url      TEXT
  bio             TEXT
  language        TEXT DEFAULT 'bg'  -- 'bg' | 'en'
  created_at      TIMESTAMPTZ DEFAULT now()
  last_login_at   TIMESTAMPTZ
  -- RLS: user can only read/update own profile

refresh_tokens:
  id              UUID PK DEFAULT gen_random_uuid()
  user_id         UUID FK → profiles(id) ON DELETE CASCADE
  token_hash      TEXT NOT NULL  -- SHA-256 hash of refresh token (never store raw)
  device_info     TEXT           -- e.g. "iPhone 15, iOS 18"
  expires_at      TIMESTAMPTZ NOT NULL
  created_at      TIMESTAMPTZ DEFAULT now()
  -- Supports multiple devices: each device gets its own refresh token
  -- Cleanup job removes expired tokens daily

family_trees:
  id              UUID PK DEFAULT gen_random_uuid()
  name            TEXT NOT NULL
  owner_id        UUID FK → profiles(id)
  status          TEXT DEFAULT 'ACTIVE'  -- ACTIVE | DORMANT | ARCHIVED
  archived_at     TIMESTAMPTZ
  archive_reason  TEXT  -- LAST_MEMBER_DECEASED | OWNER_REQUEST | INACTIVITY
  created_at      TIMESTAMPTZ DEFAULT now()
  -- RLS: only members can access

tree_members:
  id              UUID PK DEFAULT gen_random_uuid()
  tree_id         UUID FK → family_trees(id) ON DELETE CASCADE
  user_id         UUID FK → profiles(id) ON DELETE CASCADE
  role            TEXT DEFAULT 'editor'  -- owner | editor | viewer
  joined_at       TIMESTAMPTZ DEFAULT now()
  UNIQUE(tree_id, user_id)
  -- RLS: user can see trees they are member of

relatives:
  id              UUID PK DEFAULT gen_random_uuid()
  tree_id         UUID FK → family_trees(id) ON DELETE CASCADE
  full_name       TEXT NOT NULL  -- "Unknown" is valid
  birth_year      INT           -- Required if known
  birth_month     INT           -- Nullable (for partial dates)
  birth_day       INT           -- Nullable
  death_year      INT
  death_month     INT
  death_day       INT
  cause_of_death  TEXT          -- pgcrypto encrypted, free text, optional
  avatar_url      TEXT
  bio             TEXT
  status          TEXT DEFAULT 'ALIVE'  -- ALIVE | DECEASED | MISSING | UNKNOWN
  created_by      UUID FK → profiles(id)
  created_at      TIMESTAMPTZ DEFAULT now()
  updated_at      TIMESTAMPTZ DEFAULT now()
  -- RLS: only tree members

relationships:
  id              UUID PK DEFAULT gen_random_uuid()
  tree_id         UUID FK → family_trees(id) ON DELETE CASCADE
  person_a_id     UUID FK → relatives(id) ON DELETE CASCADE
  person_b_id     UUID FK → relatives(id) ON DELETE CASCADE
  relationship_type TEXT NOT NULL
    -- parent | child | spouse | sibling | step_parent | step_child |
    -- step_sibling | adopted | guardian
    -- ALL treated identically in API and UI
  marriage_year   INT   -- Spouse only, nullable
  marriage_month  INT
  marriage_day    INT
  divorce_year    INT   -- Spouse only, nullable
  divorce_month   INT
  divorce_day     INT
  created_by      UUID FK → profiles(id)
  created_at      TIMESTAMPTZ DEFAULT now()
  -- RLS: only tree members

photos:
  id              UUID PK DEFAULT gen_random_uuid()
  relative_id     UUID FK → relatives(id) ON DELETE CASCADE
  file_url        TEXT NOT NULL     -- MinIO path, NOT public URL
  caption         TEXT
  date_taken_year INT
  date_taken_month INT
  date_taken_day  INT
  sort_order      INT DEFAULT 0
  uploaded_by     UUID FK → profiles(id)
  created_at      TIMESTAMPTZ DEFAULT now()
  -- Presigned URL generated on read, expires 1h
  -- RLS: only tree members

audio_recordings:
  id              UUID PK DEFAULT gen_random_uuid()
  relative_id     UUID FK → relatives(id) ON DELETE CASCADE
  title           TEXT
  file_url        TEXT NOT NULL     -- MinIO path
  duration_seconds INT
  uploaded_by     UUID FK → profiles(id)
  created_at      TIMESTAMPTZ DEFAULT now()
  -- RLS: only tree members

stories:
  id              UUID PK DEFAULT gen_random_uuid()
  tree_id         UUID FK → family_trees(id) ON DELETE CASCADE
  relative_id     UUID FK → relatives(id) -- Nullable: story about specific person
  author_id       UUID FK → profiles(id)
  content         TEXT NOT NULL
  created_at      TIMESTAMPTZ DEFAULT now()
  updated_at      TIMESTAMPTZ DEFAULT now()
  -- RLS: only tree members
  -- Only author can update/delete own stories

story_attachments:
  id              UUID PK DEFAULT gen_random_uuid()
  story_id        UUID FK → stories(id) ON DELETE CASCADE
  file_url        TEXT NOT NULL
  file_type       TEXT NOT NULL  -- 'photo' | 'audio'
  caption         TEXT
  sort_order      INT DEFAULT 0
  created_at      TIMESTAMPTZ DEFAULT now()

comments:
  id              UUID PK DEFAULT gen_random_uuid()
  story_id        UUID FK → stories(id) ON DELETE CASCADE
  author_id       UUID FK → profiles(id)
  content         TEXT NOT NULL
  created_at      TIMESTAMPTZ DEFAULT now()
  -- Only author can delete own comments
```

### Death Confirmation

```sql
death_records:
  id                    UUID PK DEFAULT gen_random_uuid()
  relative_id           UUID FK → relatives(id)
  reported_by           UUID FK → profiles(id)
  death_year            INT NOT NULL
  death_month           INT
  death_day             INT
  death_time            TIME
  cause_of_death        TEXT  -- pgcrypto encrypted
  status                TEXT DEFAULT 'PENDING'
    -- PENDING | CONFIRMED | DISPUTED | CANCELLED
  confirmations_needed  INT DEFAULT 2
    -- 2 if 3+ living members with accounts
    -- 1 if 2 living members with accounts
    -- 0 if only reporter (auto-confirm after 48h)
  auto_confirm_at       TIMESTAMPTZ  -- now()+48h when confirmations_needed=0
  confirmed_at          TIMESTAMPTZ
  created_at            TIMESTAMPTZ DEFAULT now()

death_confirmations:
  id                UUID PK DEFAULT gen_random_uuid()
  death_record_id   UUID FK → death_records(id) ON DELETE CASCADE
  user_id           UUID FK → profiles(id)
  confirmed         BOOLEAN NOT NULL  -- true=confirm, false=dispute
  created_at        TIMESTAMPTZ DEFAULT now()
  UNIQUE(death_record_id, user_id)

commemorations:
  id              UUID PK DEFAULT gen_random_uuid()
  relative_id     UUID FK → relatives(id) ON DELETE CASCADE
  type            TEXT NOT NULL
    -- DEATH_40_DAYS | DEATH_6_MONTHS | DEATH_1_YEAR | DEATH_ANNIVERSARY
  comm_date       DATE NOT NULL
  created_at      TIMESTAMPTZ DEFAULT now()
```

### Events & Notifications

```sql
name_days:
  id              SERIAL PK
  name            TEXT NOT NULL       -- "Георги"
  name_variants   TEXT[]              -- {"Гергана", "Герго", "Жоро", "Гошо"}
  date_month      INT NOT NULL        -- 1-12
  date_day        INT NOT NULL        -- 1-31
  holiday_name    TEXT                -- "Гергьовден"
  tradition       TEXT DEFAULT 'bulgarian'
  UNIQUE(name, date_month, date_day, tradition)
  -- Populated via seed from @kintales/name-days

notifications:
  id              UUID PK DEFAULT gen_random_uuid()
  user_id         UUID FK → profiles(id) ON DELETE CASCADE
  tree_id         UUID FK → family_trees(id)
  type            TEXT NOT NULL
    -- BIRTHDAY | NAME_DAY | COMMEMORATION_40 | COMMEMORATION_6M |
    -- COMMEMORATION_1Y | COMMEMORATION_ANNUAL | MARRIAGE_ANNIVERSARY |
    -- DEATH_PENDING | DEATH_CONFIRMED | LEGACY_REMINDER | TREE_DORMANT |
    -- ON_THIS_DAY
  relative_id     UUID FK → relatives(id)
  title           TEXT NOT NULL
  body            TEXT
  event_date      DATE NOT NULL
  is_read         BOOLEAN DEFAULT false
  push_sent       BOOLEAN DEFAULT false
  created_at      TIMESTAMPTZ DEFAULT now()

push_tokens:
  id              UUID PK DEFAULT gen_random_uuid()
  user_id         UUID FK → profiles(id) ON DELETE CASCADE
  device_token    TEXT NOT NULL
  platform        TEXT NOT NULL  -- 'ios' | 'android'
  device_info     TEXT
  created_at      TIMESTAMPTZ DEFAULT now()
  UNIQUE(user_id, device_token)
```

### Heritage Preservation

```sql
tree_guardians:
  id              UUID PK DEFAULT gen_random_uuid()
  tree_id         UUID FK → family_trees(id) ON DELETE CASCADE
  guardian_user_id UUID FK → profiles(id)  -- NULL if invited by email
  guardian_email   TEXT
  guardian_name    TEXT
  assigned_by     UUID FK → profiles(id)
  status          TEXT DEFAULT 'PENDING'  -- PENDING | ACCEPTED | DECLINED
  permissions     TEXT DEFAULT 'FULL'     -- VIEW_ONLY | FULL
  created_at      TIMESTAMPTZ DEFAULT now()

legacy_keys:
  id              UUID PK DEFAULT gen_random_uuid()
  tree_id         UUID FK → family_trees(id) ON DELETE CASCADE
  created_by      UUID FK → profiles(id)
  key_code        TEXT UNIQUE NOT NULL    -- e.g. "PETR-2026-A3F7"
  key_type        TEXT NOT NULL           -- EMAIL_LINK | QR_CODE | BOTH
  recipient_email TEXT
  recipient_name  TEXT
  status          TEXT DEFAULT 'ACTIVE'   -- ACTIVE | USED | REVOKED
  used_by         UUID FK → profiles(id)
  used_at         TIMESTAMPTZ
  created_at      TIMESTAMPTZ DEFAULT now()
```

---

## ROW LEVEL SECURITY POLICIES

```sql
-- Every table with tree_id: user must be in tree_members for that tree
-- profiles: user can only SELECT/UPDATE own profile
-- stories: only author can UPDATE/DELETE
-- comments: only author can DELETE
-- death_records: only tree members can view/confirm
-- legacy_keys: only tree members can create; anyone with valid code can redeem
```

---

## API ENDPOINTS

### Auth
```
POST   /api/auth/register          -- Create account + profile + default tree
POST   /api/auth/login             -- Returns access + refresh tokens
POST   /api/auth/refresh           -- Refresh access token
POST   /api/auth/forgot-password   -- Send reset email via Postfix
POST   /api/auth/reset-password    -- Set new password with reset token
GET    /api/auth/google            -- Initiate Google OAuth
GET    /api/auth/google/callback   -- Google OAuth callback
POST   /api/auth/logout            -- Invalidate refresh token
```

### Trees
```
GET    /api/trees                  -- User's trees (via tree_members)
GET    /api/trees/:id              -- Tree details (access check)
PUT    /api/trees/:id              -- Update tree name (owner only)
```

### Relatives
```
GET    /api/trees/:id/relatives    -- All relatives in tree
POST   /api/relatives              -- Add relative (editor+)
GET    /api/relatives/:id          -- Relative detail
PUT    /api/relatives/:id          -- Update relative (editor+)
DELETE /api/relatives/:id          -- Delete relative (editor+)
```

### Relationships
```
POST   /api/relationships          -- Create relationship (editor+)
DELETE /api/relationships/:id      -- Remove relationship (editor+)
```

### Photos
```
GET    /api/relatives/:id/photos   -- Photos for relative (returns presigned URLs)
POST   /api/photos                 -- Upload photo (ClamAV scan + type/size validation)
POST   /api/photos/bulk            -- Upload multiple photos at once
DELETE /api/photos/:id             -- Delete (uploader or owner only)
```

### Audio
```
GET    /api/relatives/:id/audio    -- Audio recordings for relative
POST   /api/audio                  -- Upload audio (ClamAV scan + type/size validation)
DELETE /api/audio/:id              -- Delete (uploader or owner only)
```

### Stories
```
GET    /api/trees/:id/stories      -- Paginated stories (20/page)
POST   /api/stories                -- Create story with attachments
GET    /api/stories/:id            -- Story detail with comments
PUT    /api/stories/:id            -- Update (author only)
DELETE /api/stories/:id            -- Delete (author only)
```

### Comments
```
POST   /api/stories/:id/comments   -- Add comment
DELETE /api/comments/:id           -- Delete (author only)
```

### Events
```
GET    /api/trees/:id/events       -- ?from=DATE&to=DATE
  -- Returns: birthdays, name days, commemorations, anniversaries, on-this-day
```

### Death Records
```
POST   /api/death-records                  -- Report death (editor+)
POST   /api/death-records/:id/confirm      -- Confirm/dispute
GET    /api/trees/:id/death-records        -- Pending records for tree
```

### Guardians
```
GET    /api/trees/:id/guardians    -- List guardians
POST   /api/guardians              -- Add guardian
DELETE /api/guardians/:id          -- Remove (tree owner only)
```

### Legacy Keys
```
POST   /api/legacy-keys            -- Generate key
GET    /api/trees/:id/legacy-keys  -- List keys for tree
POST   /api/legacy-keys/redeem     -- Redeem key code → join tree
DELETE /api/legacy-keys/:id        -- Revoke (creator only)
```

### Export & GDPR
```
GET    /api/trees/:id/export       -- Generate ZIP (photos + audio + stories + tree JSON)
DELETE /api/account                 -- GDPR: delete account, anonymize content
POST   /api/relatives/:id/anonymize -- Replace name with "Роднина", remove photo, keep relationships
```

---

## FILE UPLOAD RULES

| Type | Allowed MIME | Max Size | Bucket | Processing |
|------|-------------|----------|--------|-----------|
| Avatar | image/jpeg, image/png, image/webp | 2 MB | avatars | Resize 400x400 server-side |
| Photo | image/jpeg, image/png, image/webp | 5 MB | photos | Client compresses before upload |
| Audio | audio/mpeg, audio/wav, audio/mp4, audio/ogg | 20 MB | audio | Client records in AAC |

All uploads: ClamAV scan → MIME type verify (magic bytes, not just extension) → size check → store in MinIO with UUID filename → return file path (NOT public URL).

All reads: generate presigned URL (1 hour expiry) → return to client.

---

## CRON JOBS (node-cron)

| Job | Schedule | Description |
|-----|----------|-------------|
| generateEvents | Daily 6:00 AM | Compute birthdays, name days, commemorations for today+7 days |
| generatePushNotifications | Daily 7:00 AM | Send FCM push for today's events (opt-in users only) |
| autoConfirmDeath | Hourly | Confirm death records past 48h with 0 needed |
| dormantCheck | Monthly 1st | Flag trees: no login >1y → DORMANT, >3y → ARCHIVED |
| cleanupExpiredTokens | Daily 3:00 AM | Remove expired refresh tokens |
| backupReminder | Monthly 1st | Log warning if last backup test >30 days ago |

---

## SECURITY CONFIGURATION

### PostgreSQL
```
ssl = on
ssl_min_protocol_version = 'TLSv1.3'
password_encryption = scram-sha-256
log_connections = on
log_disconnections = on
shared_preload_libraries = 'pgaudit'
pgaudit.log = 'write, ddl'
```

### pg_hba.conf
```
# TYPE  DATABASE  USER           ADDRESS    METHOD
local   all       kintales_admin              scram-sha-256
hostssl all       kintales_app   172.0.0.0/8 scram-sha-256
hostssl all       kintales_backup 172.0.0.0/8 scram-sha-256
```

### Nginx
```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

# Security headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'none'; frame-ancestors 'none'" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Express Middleware Chain
```
1. Helmet (security headers)
2. CORS (whitelist app domains)
3. express-rate-limit (per endpoint)
4. express.json (body parser, 10MB limit)
5. Auth middleware (JWT verify on protected routes)
6. Tree access middleware (verify membership)
7. Zod validation middleware
8. Route handler
9. Error handler (AppError → structured JSON response)
```

---

## DOCKER COMPOSE

```yaml
services:
  postgres:
    image: postgres:17
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./docker/postgres/postgresql.conf:/etc/postgresql/postgresql.conf
      - ./docker/postgres/pg_hba.conf:/etc/postgresql/pg_hba.conf
      - ./docker/postgres/init:/docker-entrypoint-initdb.d
    environment:
      POSTGRES_DB: kintales
      POSTGRES_PASSWORD: ${DB_ROOT_PASSWORD}
    networks:
      - internal
    # NOT exposed to host

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    networks:
      - internal
    # NOT exposed to host

  clamav:
    build: ./docker/clamav
    volumes:
      - clamav_data:/var/lib/clamav
    networks:
      - internal

  postfix:
    build: ./docker/postfix
    volumes:
      - ./docker/postfix/opendkim:/etc/opendkim
    environment:
      MAIL_DOMAIN: kintales.net
    networks:
      - internal

  api:
    build: .
    depends_on:
      - postgres
      - minio
      - clamav
      - postfix
    env_file: .env
    networks:
      - internal

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - api
    networks:
      - internal

networks:
  internal:
    driver: bridge

volumes:
  pg_data:
  minio_data:
  clamav_data:
```

---

## ENVIRONMENT VARIABLES

```env
# Database
DB_ROOT_PASSWORD=<strong_random_64_chars>
DATABASE_URL=postgresql://kintales_app:<app_password>@postgres:5432/kintales?ssl=true

# JWT
JWT_SECRET=<random_64_chars>
JWT_REFRESH_SECRET=<different_random_64_chars>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Google OAuth
GOOGLE_CLIENT_ID=<from_google_cloud_console>
GOOGLE_CLIENT_SECRET=<from_google_cloud_console>
GOOGLE_CALLBACK_URL=https://api.kintales.net/api/auth/google/callback

# MinIO
MINIO_ACCESS_KEY=<random_20_chars>
MINIO_SECRET_KEY=<random_40_chars>
MINIO_ENDPOINT=minio
MINIO_PORT=9000

# Email
MAIL_DOMAIN=kintales.net
MAIL_FROM=noreply@kintales.net

# App
APP_URL=https://kintales.net
API_PORT=3000
NODE_ENV=production

# FCM (push notifications)
FCM_SERVER_KEY=<from_firebase_console>

# Encryption
PGCRYPTO_KEY=<random_64_chars_for_encrypting_sensitive_fields>
```

---

## BACKUP STRATEGY

```bash
# backup/backup.sh (runs daily via cron at 3:00 AM)
#!/bin/bash
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backup
RETENTION_DAYS=30

# 1. PostgreSQL dump
docker exec kintales-postgres pg_dump -U kintales_backup kintales | \
  gpg --symmetric --cipher-algo AES256 --passphrase-file /root/.backup-passphrase \
  > $BACKUP_DIR/db_$DATE.sql.gpg

# 2. MinIO data sync
rsync -a /var/lib/docker/volumes/kintales_minio_data/ $BACKUP_DIR/minio_$DATE/

# 3. Cleanup old backups
find $BACKUP_DIR -name "db_*.sql.gpg" -mtime +$RETENTION_DAYS -delete

# 4. Sync to backup disk (RAID 1 second disk or external)
rsync -a $BACKUP_DIR/ /mnt/backup-disk/kintales/

# 5. Log success
echo "$(date): Backup completed: db_$DATE.sql.gpg" >> /var/log/kintales-backup.log
```

---

## INCIDENT RESPONSE

If server is compromised:
1. `docker-compose down` immediately
2. Review pgAudit logs: what was accessed, when, from where
3. Notify all users within 72 hours (GDPR requirement)
4. Notify Bulgarian Commission for Personal Data Protection if personal data exposed
5. Rotate ALL secrets: JWT, MinIO, DB passwords, GPG key
6. Restore from last known clean backup
7. Patch vulnerability
8. Document incident in postmortem

---

## DEVELOPMENT PHASES

### Phase 1: Infrastructure + Auth
```
Feature 1.0: docker-compose.yml with all 6 services, Drizzle schema, RAID setup
Feature 1.1: Auth endpoints (register, login, refresh, forgot-password, Google OAuth)
Feature 1.2: Profile endpoints (GET/PUT with avatar upload)
Feature 1.3: Name days seed data (import from @kintales/name-days)
```

### Phase 2: Family Tree
```
Feature 2.1: Relatives CRUD + relationships CRUD
Feature 2.2: Photos + audio endpoints with ClamAV + MinIO
Feature 2.3: Death records + confirmation + commemorations
```

### Phase 3: Social + Heritage
```
Feature 3.1: Events endpoint (birthday/name day/commemoration calculation)
Feature 3.2: Stories + attachments CRUD
Feature 3.3: Comments + WebSocket
Feature 3.4: Guardians + legacy keys
Feature 3.5: Export ZIP + GDPR delete/anonymize
Feature 3.6: Push notifications (FCM)
Feature 3.7: Cron jobs (all schedulers)
```

### Commands
Every feature: `/plan` → implement → `/tdd` (for business logic) → `/code-review` → commit.
After auth: `/security-review`.
After each phase: integration tests.

---

## TEACHING MODE

When developer asks "why?":
1. Concept (1-2 sentences)
2. Real analogy
3. How it applies to KinTales
