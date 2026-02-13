import { z } from 'zod';

/** Strip HTML tags to prevent XSS in stored text fields. */
const stripHtml = (str) => str.replace(/<[^>]*>/g, '');

export const updateProfileSchema = z.object({
  body: z
    .object({
      fullName: z
        .string()
        .max(200, 'Name must be at most 200 characters')
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .transform(stripHtml)
        .optional(),
      bio: z
        .string()
        .max(1000, 'Bio must be at most 1000 characters')
        .trim()
        .transform(stripHtml)
        .optional(),
      language: z.enum(['bg', 'en']).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});
