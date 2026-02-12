import { validationError } from '../utils/errors.js';

/**
 * Validate request against a Zod schema.
 * Schema should define { body, query, params } as needed.
 * @param {import('zod').ZodSchema} schema
 */
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return next(validationError(errors));
  }

  next();
};
