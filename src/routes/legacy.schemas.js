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

// ── Create legacy key ────────────────────────────────────────

export const createLegacyKeySchema = z.object({
  body: z.object({
    treeId: z.string().uuid('Invalid tree ID'),
    keyType: z.enum(['EMAIL_LINK', 'QR_CODE', 'BOTH']),
    recipientEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address')
      .optional(),
    recipientName: z
      .string()
      .trim()
      .max(200, 'Recipient name must be 200 characters or less')
      .transform(stripHtml)
      .optional(),
  }),
});

// ── Redeem legacy key ────────────────────────────────────────

export const redeemLegacyKeySchema = z.object({
  body: z.object({
    keyCode: z
      .string()
      .trim()
      .min(1, 'Key code is required')
      .max(30, 'Key code must be 30 characters or less'),
  }),
});

// ── Params with legacy key ID ────────────────────────────────

export const paramsWithLegacyKeyId = z.object({
  params: z.object({
    id: z.string().uuid('Invalid legacy key ID'),
  }),
});
