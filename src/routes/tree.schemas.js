import { z } from 'zod';

const stripHtml = (str) => str.replace(/<[^>]*>/g, '');

export const paramsWithId = z.object({
  params: z.object({
    id: z.string().uuid('Invalid tree ID'),
  }),
});

export const updateTreeSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid tree ID'),
  }),
  body: z.object({
    name: z
      .string()
      .max(200, 'Name must be at most 200 characters')
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .transform(stripHtml),
  }),
});
