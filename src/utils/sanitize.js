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
