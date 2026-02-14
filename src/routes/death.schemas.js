import { z } from 'zod';

const stripHtml = (str) => str.replace(/<[^>]*>/g, '');

/** Refine: day is valid for the given month/year (e.g. no Feb 30). */
function refineDateValidity(data) {
  const { deathYear: year, deathMonth: month, deathDay: day } = data;
  if (year === undefined || month === undefined || day === undefined) return true;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const reportDeathSchema = z.object({
  body: z
    .object({
      relativeId: z.string().uuid('Invalid relative ID'),
      deathYear: z.number().int().min(1000).max(2100),
      deathMonth: z.number().int().min(1).max(12).optional(),
      deathDay: z.number().int().min(1).max(31).optional(),
      deathTime: z
        .string()
        .regex(TIME_REGEX, 'Time must be in HH:MM format')
        .optional(),
      causeOfDeath: z
        .string()
        .max(2000, 'Cause of death must be at most 2000 characters')
        .trim()
        .transform(stripHtml)
        .optional(),
    })
    .refine(
      (d) => {
        if (d.deathDay !== undefined && d.deathMonth === undefined) return false;
        return true;
      },
      { message: 'Death date: if day is set, month is required' },
    )
    .refine(refineDateValidity, {
      message: 'Invalid death date for the given month',
    })
    .refine(
      (d) => {
        const now = new Date();
        if (d.deathYear > now.getFullYear()) return false;
        if (d.deathYear === now.getFullYear() && d.deathMonth !== undefined) {
          if (d.deathMonth > now.getMonth() + 1) return false;
          if (d.deathMonth === now.getMonth() + 1 && d.deathDay !== undefined) {
            if (d.deathDay > now.getDate()) return false;
          }
        }
        return true;
      },
      { message: 'Death date cannot be in the future' },
    ),
});

export const confirmDeathSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid death record ID'),
  }),
  body: z.object({
    confirmed: z.boolean(),
  }),
});

export const paramsWithDeathRecordId = z.object({
  params: z.object({
    id: z.string().uuid('Invalid death record ID'),
  }),
});
