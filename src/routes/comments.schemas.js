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

// ── Create comment ───────────────────────────────────────

export const createCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid story ID'),
  }),
  body: z.object({
    content: z
      .string()
      .min(1, 'Content is required')
      .max(2000, 'Content must be at most 2000 characters')
      .trim()
      .transform(stripHtml),
  }),
});

// ── Params with comment ID ───────────────────────────────

export const paramsWithCommentId = z.object({
  params: z.object({
    id: z.string().uuid('Invalid comment ID'),
  }),
});
