/**
 * Zod validation middleware factory
 * Validates request body, query, or params against a Zod schema
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'query' | 'params'} source - Where to validate
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req[source]);

      if (!result.success) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      // Replace with parsed (and coerced) data
      req[source] = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};
