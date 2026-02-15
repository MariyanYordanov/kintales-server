/**
 * Sanitize a profile row — strip passwordHash and internal fields.
 * Shared by auth.service and profile.service.
 * @param {object} profile - Drizzle profile row
 * @param {string|null} [presignedAvatarUrl] - Optional presigned URL to replace raw avatarUrl
 * @returns {object} Safe user object for API responses
 */
export function sanitizeProfile(profile, presignedAvatarUrl) {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    avatarUrl: presignedAvatarUrl !== undefined ? presignedAvatarUrl : profile.avatarUrl,
    bio: profile.bio,
    language: profile.language,
  };
}

/**
 * Sanitize a family tree row.
 * @param {object} tree - Drizzle family_trees row
 * @param {string} [role] - User's role in the tree (from tree_members)
 * @returns {object} Safe tree object for API responses
 */
export function sanitizeTree(tree, role) {
  return {
    id: tree.id,
    name: tree.name,
    ownerId: tree.ownerId,
    status: tree.status,
    createdAt: tree.createdAt,
    ...(role !== undefined && { role }),
  };
}

/**
 * Sanitize a relative row — strip createdBy, causeOfDeath (sensitive).
 * @param {object} relative - Drizzle relatives row
 * @returns {object} Safe relative object for API responses
 */
export function sanitizeRelative(relative) {
  return {
    id: relative.id,
    treeId: relative.treeId,
    fullName: relative.fullName,
    birthYear: relative.birthYear,
    birthMonth: relative.birthMonth,
    birthDay: relative.birthDay,
    deathYear: relative.deathYear,
    deathMonth: relative.deathMonth,
    deathDay: relative.deathDay,
    avatarUrl: relative.avatarUrl,
    bio: relative.bio,
    status: relative.status,
    createdAt: relative.createdAt,
    updatedAt: relative.updatedAt,
  };
}

/**
 * Sanitize a relationship row — strip createdBy.
 * @param {object} rel - Drizzle relationships row
 * @returns {object} Safe relationship object for API responses
 */
export function sanitizeRelationship(rel) {
  return {
    id: rel.id,
    treeId: rel.treeId,
    personAId: rel.personAId,
    personBId: rel.personBId,
    relationshipType: rel.relationshipType,
    marriageYear: rel.marriageYear,
    marriageMonth: rel.marriageMonth,
    marriageDay: rel.marriageDay,
    divorceYear: rel.divorceYear,
    divorceMonth: rel.divorceMonth,
    divorceDay: rel.divorceDay,
    createdAt: rel.createdAt,
  };
}

/**
 * Sanitize a photo row — replace fileUrl with presigned URL.
 * @param {object} photo - Drizzle photos row
 * @param {string|null} presignedUrl - Presigned URL for the file
 * @returns {object} Safe photo object for API responses
 */
export function sanitizePhoto(photo, presignedUrl) {
  return {
    id: photo.id,
    relativeId: photo.relativeId,
    fileUrl: presignedUrl,
    caption: photo.caption,
    dateTakenYear: photo.dateTakenYear,
    dateTakenMonth: photo.dateTakenMonth,
    dateTakenDay: photo.dateTakenDay,
    sortOrder: photo.sortOrder,
    uploadedBy: photo.uploadedBy,
    createdAt: photo.createdAt,
  };
}

/**
 * Sanitize an audio recording row — replace fileUrl with presigned URL.
 * @param {object} audio - Drizzle audio_recordings row
 * @param {string|null} presignedUrl - Presigned URL for the file
 * @returns {object} Safe audio object for API responses
 */
export function sanitizeAudio(audio, presignedUrl) {
  return {
    id: audio.id,
    relativeId: audio.relativeId,
    title: audio.title,
    fileUrl: presignedUrl,
    durationSeconds: audio.durationSeconds,
    uploadedBy: audio.uploadedBy,
    createdAt: audio.createdAt,
  };
}

/**
 * Sanitize a death record row.
 * causeOfDeath is sensitive — only shown to reporter and tree owner.
 * @param {object} record - Drizzle death_records row
 * @param {{ showCause?: boolean }} [options]
 * @returns {object} Safe death record for API responses
 */
export function sanitizeDeathRecord(record, { showCause = false } = {}) {
  return {
    id: record.id,
    relativeId: record.relativeId,
    reportedBy: record.reportedBy,
    deathYear: record.deathYear,
    deathMonth: record.deathMonth,
    deathDay: record.deathDay,
    deathTime: record.deathTime,
    status: record.status,
    confirmationsNeeded: record.confirmationsNeeded,
    autoConfirmAt: record.autoConfirmAt,
    confirmedAt: record.confirmedAt,
    createdAt: record.createdAt,
    ...(showCause && { causeOfDeath: record.causeOfDeath }),
  };
}

/**
 * Sanitize a death confirmation row.
 * @param {object} conf - Drizzle death_confirmations row
 * @returns {object} Safe confirmation for API responses
 */
export function sanitizeDeathConfirmation(conf) {
  return {
    id: conf.id,
    deathRecordId: conf.deathRecordId,
    userId: conf.userId,
    confirmed: conf.confirmed,
    createdAt: conf.createdAt,
  };
}

/**
 * Sanitize a commemoration row.
 * @param {object} comm - Drizzle commemorations row
 * @returns {object} Safe commemoration for API responses
 */
export function sanitizeCommemoration(comm) {
  return {
    id: comm.id,
    relativeId: comm.relativeId,
    type: comm.type,
    commDate: comm.commDate,
    createdAt: comm.createdAt,
  };
}

/**
 * Sanitize a story row — include presigned attachment URLs.
 * @param {object} story - Drizzle stories row
 * @param {object[]} [sanitizedAttachments] - Already-sanitized attachment objects
 * @returns {object} Safe story object for API responses
 */
export function sanitizeStory(story, sanitizedAttachments = [], sanitizedComments = []) {
  return {
    id: story.id,
    treeId: story.treeId,
    relativeId: story.relativeId,
    authorId: story.authorId,
    content: story.content,
    attachments: sanitizedAttachments,
    comments: sanitizedComments,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
  };
}

/**
 * Sanitize a comment row.
 * @param {object} comment - Drizzle comments row
 * @returns {object} Safe comment object for API responses
 */
export function sanitizeComment(comment) {
  return {
    id: comment.id,
    storyId: comment.storyId,
    authorId: comment.authorId,
    content: comment.content,
    createdAt: comment.createdAt,
  };
}

/**
 * Sanitize a story attachment row — replace fileUrl with presigned URL.
 * @param {object} attachment - Drizzle story_attachments row
 * @param {string|null} presignedUrl - Presigned URL for the file
 * @returns {object} Safe attachment object for API responses
 */
export function sanitizeAttachment(attachment, presignedUrl) {
  return {
    id: attachment.id,
    storyId: attachment.storyId,
    fileUrl: presignedUrl,
    fileType: attachment.fileType,
    caption: attachment.caption,
    sortOrder: attachment.sortOrder,
    createdAt: attachment.createdAt,
  };
}

/**
 * Sanitize a tree guardian row.
 * @param {object} guardian - Drizzle tree_guardians row
 * @returns {object} Safe guardian object for API responses
 */
export function sanitizeGuardian(guardian) {
  return {
    id: guardian.id,
    treeId: guardian.treeId,
    guardianUserId: guardian.guardianUserId,
    guardianEmail: guardian.guardianEmail,
    guardianName: guardian.guardianName,
    assignedBy: guardian.assignedBy,
    status: guardian.status,
    permissions: guardian.permissions,
    createdAt: guardian.createdAt,
  };
}

/**
 * Sanitize a legacy key row.
 * @param {object} key - Drizzle legacy_keys row
 * @returns {object} Safe legacy key object for API responses
 */
export function sanitizeLegacyKey(key) {
  return {
    id: key.id,
    treeId: key.treeId,
    createdBy: key.createdBy,
    keyCode: key.keyCode,
    keyType: key.keyType,
    recipientEmail: key.recipientEmail,
    recipientName: key.recipientName,
    status: key.status,
    usedBy: key.usedBy,
    usedAt: key.usedAt,
    createdAt: key.createdAt,
  };
}
