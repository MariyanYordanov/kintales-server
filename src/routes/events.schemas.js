import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Validate that a string is a real YYYY-MM-DD date. */
function isValidDate(str) {
  if (!DATE_REGEX.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

export const getEventsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid tree ID'),
  }),
  query: z
    .object({
      from: z
        .string()
        .refine((v) => isValidDate(v), { message: 'Invalid from date (YYYY-MM-DD)' })
        .optional(),
      to: z
        .string()
        .refine((v) => isValidDate(v), { message: 'Invalid to date (YYYY-MM-DD)' })
        .optional(),
    })
    .refine(
      (q) => {
        if (q.from && q.to) {
          return new Date(q.from) <= new Date(q.to);
        }
        return true;
      },
      { message: 'from date must be before or equal to to date' },
    )
    .refine(
      (q) => {
        if (q.from && q.to) {
          const diff = (new Date(q.to) - new Date(q.from)) / (1000 * 60 * 60 * 24);
          return diff <= 365;
        }
        return true;
      },
      { message: 'Date range cannot exceed 365 days' },
    ),
});
