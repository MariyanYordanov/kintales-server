import { z } from 'zod';

const stripHtml = (str) => str.replace(/<[^>]*>/g, '');

const STATUSES = ['ALIVE', 'DECEASED', 'MISSING', 'UNKNOWN'];

/** Partial date fields (year/month/day) with dependency validation. */
const partialDateFields = (prefix) => ({
  [`${prefix}Year`]: z.number().int().min(1000).max(2100).optional(),
  [`${prefix}Month`]: z.number().int().min(1).max(12).optional(),
  [`${prefix}Day`]: z.number().int().min(1).max(31).optional(),
});

/** Refine: if day is present, month must be; if month is present, year must be. */
function refinePartialDate(data, prefix) {
  if (data[`${prefix}Day`] !== undefined && data[`${prefix}Month`] === undefined) {
    return false;
  }
  if (data[`${prefix}Month`] !== undefined && data[`${prefix}Year`] === undefined) {
    return false;
  }
  return true;
}

/** Refine: day is valid for the given month/year (e.g. no Feb 30). */
function refineDateValidity(data, prefix) {
  const year = data[`${prefix}Year`];
  const month = data[`${prefix}Month`];
  const day = data[`${prefix}Day`];
  if (year === undefined || month === undefined || day === undefined) return true;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Refine: death date must not be before birth date (when both fully specified). */
function refineDeathAfterBirth(data) {
  if (data.birthYear === undefined || data.deathYear === undefined) return true;
  if (data.deathYear > data.birthYear) return true;
  if (data.deathYear < data.birthYear) return false;
  // Same year — check months
  if (data.birthMonth !== undefined && data.deathMonth !== undefined) {
    if (data.deathMonth > data.birthMonth) return true;
    if (data.deathMonth < data.birthMonth) return false;
    // Same month — check days
    if (data.birthDay !== undefined && data.deathDay !== undefined) {
      return data.deathDay >= data.birthDay;
    }
  }
  return true;
}

const relativeBodyBase = z.object({
  fullName: z
    .string()
    .max(200, 'Name must be at most 200 characters')
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .transform(stripHtml),
  ...partialDateFields('birth'),
  ...partialDateFields('death'),
  bio: z
    .string()
    .max(2000, 'Bio must be at most 2000 characters')
    .trim()
    .transform(stripHtml)
    .optional(),
  status: z.enum(STATUSES).optional(),
});

export const createRelativeSchema = z.object({
  body: relativeBodyBase
    .extend({
      treeId: z.string().uuid('Invalid tree ID'),
    })
    .refine((d) => refinePartialDate(d, 'birth'), {
      message: 'Birth date: if day is set, month is required; if month is set, year is required',
    })
    .refine((d) => refinePartialDate(d, 'death'), {
      message: 'Death date: if day is set, month is required; if month is set, year is required',
    })
    .refine(refineDeathAfterBirth, {
      message: 'Death date cannot be before birth date',
    })
    .refine((d) => refineDateValidity(d, 'birth'), {
      message: 'Invalid birth date for the given month',
    })
    .refine((d) => refineDateValidity(d, 'death'), {
      message: 'Invalid death date for the given month',
    }),
});

export const updateRelativeSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid relative ID'),
  }),
  body: relativeBodyBase
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    })
    .refine((d) => refinePartialDate(d, 'birth'), {
      message: 'Birth date: if day is set, month is required; if month is set, year is required',
    })
    .refine((d) => refinePartialDate(d, 'death'), {
      message: 'Death date: if day is set, month is required; if month is set, year is required',
    })
    .refine(refineDeathAfterBirth, {
      message: 'Death date cannot be before birth date',
    })
    .refine((d) => refineDateValidity(d, 'birth'), {
      message: 'Invalid birth date for the given month',
    })
    .refine((d) => refineDateValidity(d, 'death'), {
      message: 'Invalid death date for the given month',
    }),
});

export const paramsWithRelativeId = z.object({
  params: z.object({
    id: z.string().uuid('Invalid relative ID'),
  }),
});
