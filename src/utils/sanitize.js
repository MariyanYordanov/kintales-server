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
