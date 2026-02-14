import { z } from 'zod';

const RELATIONSHIP_TYPES = [
  'parent', 'child', 'spouse', 'sibling',
  'step_parent', 'step_child', 'step_sibling',
  'adopted', 'guardian',
];

/** Partial date fields for marriage/divorce. */
const partialDateFields = (prefix) => ({
  [`${prefix}Year`]: z.number().int().min(1000).max(2100).optional(),
  [`${prefix}Month`]: z.number().int().min(1).max(12).optional(),
  [`${prefix}Day`]: z.number().int().min(1).max(31).optional(),
});

/** Refine: day is valid for the given month/year (e.g. no Feb 30). */
function refineDateValidity(data, prefix) {
  const year = data[`${prefix}Year`];
  const month = data[`${prefix}Month`];
  const day = data[`${prefix}Day`];
  if (year === undefined || month === undefined || day === undefined) return true;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export const createRelationshipSchema = z.object({
  body: z
    .object({
      treeId: z.string().uuid('Invalid tree ID'),
      personAId: z.string().uuid('Invalid person A ID'),
      personBId: z.string().uuid('Invalid person B ID'),
      relationshipType: z.enum(RELATIONSHIP_TYPES),
      ...partialDateFields('marriage'),
      ...partialDateFields('divorce'),
    })
    .refine((d) => d.personAId !== d.personBId, {
      message: 'Cannot create a relationship with the same person',
    })
    .refine(
      (d) => {
        if (d.relationshipType !== 'spouse') {
          const hasMarriage = d.marriageYear !== undefined || d.marriageMonth !== undefined || d.marriageDay !== undefined;
          const hasDivorce = d.divorceYear !== undefined || d.divorceMonth !== undefined || d.divorceDay !== undefined;
          return !hasMarriage && !hasDivorce;
        }
        return true;
      },
      { message: 'Marriage and divorce dates are only allowed for spouse relationships' },
    )
    .refine(
      (d) => {
        if (d.marriageDay !== undefined && d.marriageMonth === undefined) return false;
        if (d.marriageMonth !== undefined && d.marriageYear === undefined) return false;
        if (d.divorceDay !== undefined && d.divorceMonth === undefined) return false;
        if (d.divorceMonth !== undefined && d.divorceYear === undefined) return false;
        return true;
      },
      { message: 'Date: if day is set, month is required; if month is set, year is required' },
    )
    .refine((d) => refineDateValidity(d, 'marriage'), {
      message: 'Invalid marriage date for the given month',
    })
    .refine((d) => refineDateValidity(d, 'divorce'), {
      message: 'Invalid divorce date for the given month',
    }),
});

export const paramsWithRelationshipId = z.object({
  params: z.object({
    id: z.string().uuid('Invalid relationship ID'),
  }),
});
