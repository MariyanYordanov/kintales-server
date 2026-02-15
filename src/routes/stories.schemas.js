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

// ── List stories (paginated) ───────────────────────────────

export const getStoriesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid tree ID'),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

// ── Create story ───────────────────────────────────────────

export const createStorySchema = z.object({
  body: z.object({
    treeId: z.string().uuid('Invalid tree ID'),
    relativeId: z
      .string()
      .uuid('Invalid relative ID')
      .optional(),
    content: z
      .string()
      .min(1, 'Content is required')
      .max(10000, 'Content must be at most 10 000 characters')
      .trim()
      .transform(stripHtml),
  }),
});

// ── Update story ───────────────────────────────────────────

export const updateStorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid story ID'),
  }),
  body: z
    .object({
      content: z
        .string()
        .min(1, 'Content must not be empty')
        .max(10000, 'Content must be at most 10 000 characters')
        .trim()
        .transform(stripHtml)
        .optional(),
      relativeId: z
        .string()
        .uuid('Invalid relative ID')
        .nullable()
        .optional(),
    })
    .refine(
      (b) => b.content !== undefined || b.relativeId !== undefined,
      { message: 'At least one field (content or relativeId) must be provided' },
    ),
});

// ── Params with story ID ───────────────────────────────────

export const paramsWithStoryId = z.object({
  params: z.object({
    id: z.string().uuid('Invalid story ID'),
  }),
});
