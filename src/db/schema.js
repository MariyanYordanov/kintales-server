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
  index,
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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

// ============================================================
// 2. refresh_tokens
// ============================================================
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    deviceInfo: text('device_info'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
  ]
);

// ============================================================
// 3. family_trees
// ============================================================
export const familyTrees = pgTable(
  'family_trees',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    status: text('status').default('ACTIVE'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    archiveReason: text('archive_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('family_trees_owner_id_idx').on(table.ownerId),
  ]
);

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
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('tree_members_tree_user_idx').on(table.treeId, table.userId),
    index('tree_members_user_id_idx').on(table.userId),
  ]
);

// ============================================================
// 5. relatives
// ============================================================
export const relatives = pgTable(
  'relatives',
  {
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
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('relatives_tree_id_idx').on(table.treeId),
    index('relatives_created_by_idx').on(table.createdBy),
  ]
);

// ============================================================
// 6. relationships
// ============================================================
export const relationships = pgTable(
  'relationships',
  {
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
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('relationships_tree_id_idx').on(table.treeId),
    index('relationships_person_a_id_idx').on(table.personAId),
    index('relationships_person_b_id_idx').on(table.personBId),
    index('relationships_created_by_idx').on(table.createdBy),
  ]
);

// ============================================================
// 7. photos
// ============================================================
export const photos = pgTable(
  'photos',
  {
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
    uploadedBy: uuid('uploaded_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('photos_relative_id_idx').on(table.relativeId),
    index('photos_uploaded_by_idx').on(table.uploadedBy),
  ]
);

// ============================================================
// 8. audio_recordings
// ============================================================
export const audioRecordings = pgTable(
  'audio_recordings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    relativeId: uuid('relative_id')
      .notNull()
      .references(() => relatives.id, { onDelete: 'cascade' }),
    title: text('title'),
    fileUrl: text('file_url').notNull(),
    durationSeconds: integer('duration_seconds'),
    uploadedBy: uuid('uploaded_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audio_recordings_relative_id_idx').on(table.relativeId),
    index('audio_recordings_uploaded_by_idx').on(table.uploadedBy),
  ]
);

// ============================================================
// 9. stories
// ============================================================
export const stories = pgTable(
  'stories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    treeId: uuid('tree_id')
      .notNull()
      .references(() => familyTrees.id, { onDelete: 'cascade' }),
    relativeId: uuid('relative_id').references(() => relatives.id, { onDelete: 'set null' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('stories_tree_id_idx').on(table.treeId),
    index('stories_relative_id_idx').on(table.relativeId),
    index('stories_author_id_idx').on(table.authorId),
  ]
);

// ============================================================
// 10. story_attachments
// ============================================================
export const storyAttachments = pgTable(
  'story_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storyId: uuid('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    fileUrl: text('file_url').notNull(),
    fileType: text('file_type').notNull(),
    caption: text('caption'),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('story_attachments_story_id_idx').on(table.storyId),
  ]
);

// ============================================================
// 11. comments
// ============================================================
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storyId: uuid('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('comments_story_id_idx').on(table.storyId),
    index('comments_author_id_idx').on(table.authorId),
  ]
);

// ============================================================
// 12. death_records
// ============================================================
export const deathRecords = pgTable(
  'death_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    relativeId: uuid('relative_id')
      .notNull()
      .references(() => relatives.id, { onDelete: 'cascade' }),
    reportedBy: uuid('reported_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    deathYear: integer('death_year').notNull(),
    deathMonth: integer('death_month'),
    deathDay: integer('death_day'),
    deathTime: time('death_time'),
    causeOfDeath: text('cause_of_death'),
    status: text('status').default('PENDING'),
    confirmationsNeeded: integer('confirmations_needed').default(2),
    autoConfirmAt: timestamp('auto_confirm_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('death_records_relative_id_idx').on(table.relativeId),
    index('death_records_reported_by_idx').on(table.reportedBy),
  ]
);

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
      .references(() => profiles.id, { onDelete: 'cascade' }),
    confirmed: boolean('confirmed').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('death_conf_record_user_idx').on(table.deathRecordId, table.userId),
    index('death_confirmations_user_id_idx').on(table.userId),
  ]
);

// ============================================================
// 14. commemorations
// ============================================================
export const commemorations = pgTable(
  'commemorations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    relativeId: uuid('relative_id')
      .notNull()
      .references(() => relatives.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    commDate: date('comm_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('commemorations_relative_id_idx').on(table.relativeId),
  ]
);

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
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    treeId: uuid('tree_id').references(() => familyTrees.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    relativeId: uuid('relative_id').references(() => relatives.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    body: text('body'),
    eventDate: date('event_date').notNull(),
    isRead: boolean('is_read').default(false),
    pushSent: boolean('push_sent').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_tree_id_idx').on(table.treeId),
    index('notifications_relative_id_idx').on(table.relativeId),
    index('notifications_push_sent_event_date_idx').on(table.pushSent, table.eventDate),
  ]
);

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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('push_tokens_user_device_idx').on(table.userId, table.deviceToken),
  ]
);

// ============================================================
// 18. tree_guardians
// ============================================================
export const treeGuardians = pgTable(
  'tree_guardians',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    treeId: uuid('tree_id')
      .notNull()
      .references(() => familyTrees.id, { onDelete: 'cascade' }),
    guardianUserId: uuid('guardian_user_id').references(() => profiles.id, { onDelete: 'set null' }),
    guardianEmail: text('guardian_email'),
    guardianName: text('guardian_name'),
    assignedBy: uuid('assigned_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    status: text('status').default('PENDING'),
    permissions: text('permissions').default('FULL'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('tree_guardians_tree_id_idx').on(table.treeId),
    index('tree_guardians_guardian_user_id_idx').on(table.guardianUserId),
    index('tree_guardians_assigned_by_idx').on(table.assignedBy),
    unique('tree_guardians_tree_email_unique').on(table.treeId, table.guardianEmail),
  ]
);

// ============================================================
// 19. legacy_keys
// ============================================================
export const legacyKeys = pgTable(
  'legacy_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    treeId: uuid('tree_id')
      .notNull()
      .references(() => familyTrees.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    keyCode: text('key_code').notNull().unique(),
    keyType: text('key_type').notNull(),
    recipientEmail: text('recipient_email'),
    recipientName: text('recipient_name'),
    status: text('status').default('ACTIVE'),
    usedBy: uuid('used_by').references(() => profiles.id, { onDelete: 'set null' }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('legacy_keys_tree_id_idx').on(table.treeId),
    index('legacy_keys_created_by_idx').on(table.createdBy),
    index('legacy_keys_used_by_idx').on(table.usedBy),
  ]
);
