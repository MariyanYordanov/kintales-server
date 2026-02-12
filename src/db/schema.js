import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  time,
  serial,
  unique,
} from 'drizzle-orm/pg-core';

// ============================================================
// 1. profiles
// ============================================================
export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  fullName: text('full_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  language: text('language').default('bg'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

// ============================================================
// 2. refresh_tokens
// ============================================================
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  deviceInfo: text('device_info'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 3. family_trees
// ============================================================
export const familyTrees = pgTable('family_trees', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => profiles.id),
  status: text('status').default('ACTIVE'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archiveReason: text('archive_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 4. tree_members
// ============================================================
export const treeMembers = pgTable(
  'tree_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    treeId: uuid('tree_id')
      .notNull()
      .references(() => familyTrees.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: text('role').default('editor'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('tree_members_tree_user_idx').on(table.treeId, table.userId),
  ]
);

// ============================================================
// 5. relatives
// ============================================================
export const relatives = pgTable('relatives', {
  id: uuid('id').defaultRandom().primaryKey(),
  treeId: uuid('tree_id')
    .notNull()
    .references(() => familyTrees.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  birthYear: integer('birth_year'),
  birthMonth: integer('birth_month'),
  birthDay: integer('birth_day'),
  deathYear: integer('death_year'),
  deathMonth: integer('death_month'),
  deathDay: integer('death_day'),
  causeOfDeath: text('cause_of_death'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  status: text('status').default('ALIVE'),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 6. relationships
// ============================================================
export const relationships = pgTable('relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  treeId: uuid('tree_id')
    .notNull()
    .references(() => familyTrees.id, { onDelete: 'cascade' }),
  personAId: uuid('person_a_id')
    .notNull()
    .references(() => relatives.id, { onDelete: 'cascade' }),
  personBId: uuid('person_b_id')
    .notNull()
    .references(() => relatives.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type').notNull(),
  marriageYear: integer('marriage_year'),
  marriageMonth: integer('marriage_month'),
  marriageDay: integer('marriage_day'),
  divorceYear: integer('divorce_year'),
  divorceMonth: integer('divorce_month'),
  divorceDay: integer('divorce_day'),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 7. photos
// ============================================================
export const photos = pgTable('photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  relativeId: uuid('relative_id')
    .notNull()
    .references(() => relatives.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  caption: text('caption'),
  dateTakenYear: integer('date_taken_year'),
  dateTakenMonth: integer('date_taken_month'),
  dateTakenDay: integer('date_taken_day'),
  sortOrder: integer('sort_order').default(0),
  uploadedBy: uuid('uploaded_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 8. audio_recordings
// ============================================================
export const audioRecordings = pgTable('audio_recordings', {
  id: uuid('id').defaultRandom().primaryKey(),
  relativeId: uuid('relative_id')
    .notNull()
    .references(() => relatives.id, { onDelete: 'cascade' }),
  title: text('title'),
  fileUrl: text('file_url').notNull(),
  durationSeconds: integer('duration_seconds'),
  uploadedBy: uuid('uploaded_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 9. stories
// ============================================================
export const stories = pgTable('stories', {
  id: uuid('id').defaultRandom().primaryKey(),
  treeId: uuid('tree_id')
    .notNull()
    .references(() => familyTrees.id, { onDelete: 'cascade' }),
  relativeId: uuid('relative_id').references(() => relatives.id),
  authorId: uuid('author_id')
    .notNull()
    .references(() => profiles.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 10. story_attachments
// ============================================================
export const storyAttachments = pgTable('story_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  storyId: uuid('story_id')
    .notNull()
    .references(() => stories.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  fileType: text('file_type').notNull(),
  caption: text('caption'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 11. comments
// ============================================================
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  storyId: uuid('story_id')
    .notNull()
    .references(() => stories.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => profiles.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 12. death_records
// ============================================================
export const deathRecords = pgTable('death_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  relativeId: uuid('relative_id')
    .notNull()
    .references(() => relatives.id),
  reportedBy: uuid('reported_by')
    .notNull()
    .references(() => profiles.id),
  deathYear: integer('death_year').notNull(),
  deathMonth: integer('death_month'),
  deathDay: integer('death_day'),
  deathTime: time('death_time'),
  causeOfDeath: text('cause_of_death'),
  status: text('status').default('PENDING'),
  confirmationsNeeded: integer('confirmations_needed').default(2),
  autoConfirmAt: timestamp('auto_confirm_at', { withTimezone: true }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 13. death_confirmations
// ============================================================
export const deathConfirmations = pgTable(
  'death_confirmations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deathRecordId: uuid('death_record_id')
      .notNull()
      .references(() => deathRecords.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id),
    confirmed: boolean('confirmed').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('death_conf_record_user_idx').on(table.deathRecordId, table.userId),
  ]
);

// ============================================================
// 14. commemorations
// ============================================================
export const commemorations = pgTable('commemorations', {
  id: uuid('id').defaultRandom().primaryKey(),
  relativeId: uuid('relative_id')
    .notNull()
    .references(() => relatives.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  commDate: date('comm_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 15. name_days
// ============================================================
export const nameDays = pgTable(
  'name_days',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    nameVariants: text('name_variants').array(),
    dateMonth: integer('date_month').notNull(),
    dateDay: integer('date_day').notNull(),
    holidayName: text('holiday_name'),
    tradition: text('tradition').default('bulgarian'),
  },
  (table) => [
    unique('name_days_unique_idx').on(
      table.name,
      table.dateMonth,
      table.dateDay,
      table.tradition
    ),
  ]
);

// ============================================================
// 16. notifications
// ============================================================
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  treeId: uuid('tree_id').references(() => familyTrees.id),
  type: text('type').notNull(),
  relativeId: uuid('relative_id').references(() => relatives.id),
  title: text('title').notNull(),
  body: text('body'),
  eventDate: date('event_date').notNull(),
  isRead: boolean('is_read').default(false),
  pushSent: boolean('push_sent').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 17. push_tokens
// ============================================================
export const pushTokens = pgTable(
  'push_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    deviceToken: text('device_token').notNull(),
    platform: text('platform').notNull(),
    deviceInfo: text('device_info'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('push_tokens_user_device_idx').on(table.userId, table.deviceToken),
  ]
);

// ============================================================
// 18. tree_guardians
// ============================================================
export const treeGuardians = pgTable('tree_guardians', {
  id: uuid('id').defaultRandom().primaryKey(),
  treeId: uuid('tree_id')
    .notNull()
    .references(() => familyTrees.id, { onDelete: 'cascade' }),
  guardianUserId: uuid('guardian_user_id').references(() => profiles.id),
  guardianEmail: text('guardian_email'),
  guardianName: text('guardian_name'),
  assignedBy: uuid('assigned_by')
    .notNull()
    .references(() => profiles.id),
  status: text('status').default('PENDING'),
  permissions: text('permissions').default('FULL'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// 19. legacy_keys
// ============================================================
export const legacyKeys = pgTable('legacy_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  treeId: uuid('tree_id')
    .notNull()
    .references(() => familyTrees.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => profiles.id),
  keyCode: text('key_code').notNull().unique(),
  keyType: text('key_type').notNull(),
  recipientEmail: text('recipient_email'),
  recipientName: text('recipient_name'),
  status: text('status').default('ACTIVE'),
  usedBy: uuid('used_by').references(() => profiles.id),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
