import { z } from 'zod';

const stripHtml = (str) => str.replace(/<[^>]*>/g, '');

export const uploadAudioSchema = z.object({
  body: z.object({
    relativeId: z.string().uuid('Invalid relative ID'),
    title: z
      .string()
      .max(200, 'Title must be at most 200 characters')
      .trim()
      .transform(stripHtml)
      .optional(),
  }),
});

export const paramsWithAudioId = z.object({
  params: z.object({
    id: z.string().uuid('Invalid audio recording ID'),
  }),
});
