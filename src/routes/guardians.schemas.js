import { z } from 'zod';

/** Strip HTML tags iteratively to handle nested/obfuscated patterns. */
function stripHtml(str) {
  let result = str;
  let prev;
  do {
    prev = result;
    result = result.replace(/<[^>]*>/g, '');
  } while (result !== prev);
  return result;
}

// ── Create guardian ──────────────────────────────────────────

export const createGuardianSchema = z.object({
  body: z.object({
    treeId: z.string().uuid('Invalid tree ID'),
    guardianEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address'),
    guardianName: z
      .string()
      .trim()
      .min(1, 'Guardian name is required')
      .max(200, 'Guardian name must be 200 characters or less')
      .transform(stripHtml),
    permissions: z.enum(['VIEW_ONLY', 'FULL']).default('FULL'),
  }),
});

// ── Params with guardian ID ──────────────────────────────────

export const paramsWithGuardianId = z.object({
  params: z.object({
    id: z.string().uuid('Invalid guardian ID'),
  }),
});
