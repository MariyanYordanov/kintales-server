import { z } from 'zod';

const stripHtml = (str) => str.replace(/<[^>]*>/g, '');

/** Refine: day is valid for the given month/year (e.g. no Feb 30). */
function refineDateValidity(data) {
  const year = data.dateTakenYear;
  const month = data.dateTakenMonth;
  const day = data.dateTakenDay;
  if (year === undefined || month === undefined || day === undefined) return true;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export const uploadPhotoSchema = z.object({
  body: z
    .object({
      relativeId: z.string().uuid('Invalid relative ID'),
      caption: z
        .string()
        .max(500, 'Caption must be at most 500 characters')
        .trim()
        .transform(stripHtml)
        .optional(),
      dateTakenYear: z.coerce.number().int().min(1800).max(2100).optional(),
      dateTakenMonth: z.coerce.number().int().min(1).max(12).optional(),
      dateTakenDay: z.coerce.number().int().min(1).max(31).optional(),
      sortOrder: z.coerce.number().int().min(0).optional(),
    })
    .refine(
      (d) => {
        if (d.dateTakenDay !== undefined && d.dateTakenMonth === undefined) return false;
        if (d.dateTakenMonth !== undefined && d.dateTakenYear === undefined) return false;
        return true;
      },
      { message: 'Date: if day is set, month is required; if month is set, year is required' },
    )
    .refine(refineDateValidity, {
      message: 'Invalid date for the given month',
    }),
});

export const uploadPhotoBulkSchema = z.object({
  body: z.object({
    relativeId: z.string().uuid('Invalid relative ID'),
  }),
});

export const paramsWithPhotoId = z.object({
  params: z.object({
    id: z.string().uuid('Invalid photo ID'),
  }),
});
